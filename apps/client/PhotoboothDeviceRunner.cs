using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Photobooth.Client;

public sealed class PhotoboothDeviceRunner
{
    private readonly PhotoboothApiClient _apiClient;
    private readonly PhotoboothClientConfig _config;
    private readonly ClientRuntimeState _state;
    private readonly ConcurrentDictionary<string, byte> _scheduledFiles = new(StringComparer.OrdinalIgnoreCase);
    private readonly Channel<string> _uploadQueue = Channel.CreateUnbounded<string>();

    private volatile string _status = "idle";
    private volatile DeviceConfigResponse? _runtimeConfig;

    public PhotoboothDeviceRunner(PhotoboothApiClient apiClient, PhotoboothClientConfig config, ClientRuntimeState state)
    {
        _apiClient = apiClient;
        _config = config;
        _state = state;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        _state.SetConfig(_config);
        _state.SetRunnerLifecycle("running");
        _state.SetDeviceStatus(_status);
        _runtimeConfig = await RefreshRuntimeConfigAsync(ct);

        Console.WriteLine($"Device {_config.DeviceId} connected to {_config.ServerUrl}");
        Console.WriteLine(_runtimeConfig.AssignedEvent is null
            ? "No event assigned yet. Heartbeats will continue while uploads wait for an assignment."
            : $"Assigned event: {_runtimeConfig.AssignedEvent.EventName} ({_runtimeConfig.AssignedEvent.EventDate})");

        var heartbeatTask = HeartbeatLoopAsync(ct);
        var uploadTask = ProcessUploadQueueAsync(ct);

        FileSystemWatcher? watcher = null;
        if (!string.IsNullOrWhiteSpace(_config.WatchDirectory))
        {
            Directory.CreateDirectory(_config.WatchDirectory);
            watcher = CreateWatcher(_config.WatchDirectory);
            watcher.EnableRaisingEvents = true;
            Console.WriteLine($"Watching {_config.WatchDirectory} for new captures...");
            _state.SetWatcherState("watching");
        }
        else
        {
            Console.WriteLine("No watch directory configured. The client will only send heartbeats until a manual upload command is used.");
            _state.SetWatcherState("not-configured");
        }

        try
        {
            await Task.WhenAll(heartbeatTask, uploadTask);
        }
        finally
        {
            watcher?.Dispose();
            _state.SetRunnerLifecycle("stopped");
            _state.SetDeviceStatus("idle");
            _state.SetWatcherState(string.IsNullOrWhiteSpace(_config.WatchDirectory) ? "not-configured" : "stopped");
        }
    }

    public async Task UploadSingleFileAsync(string filePath, CancellationToken ct)
    {
        var runtimeConfig = _runtimeConfig ?? await RefreshRuntimeConfigAsync(ct);
        var assignedEventId = runtimeConfig.AssignedEvent?.EventId;
        if (!assignedEventId.HasValue)
        {
            throw new InvalidOperationException("This device is not assigned to an event yet.");
        }

        ValidatePhoto(filePath);
        await WaitForStableFileAsync(filePath, ct);

        _status = "active";
        _state.SetDeviceStatus(_status);
        _state.RecordUploadStarted(Path.GetFileName(filePath));
        try
        {
            var response = await _apiClient.UploadPhotoAsync(filePath, assignedEventId, ct);
            Console.WriteLine($"Uploaded {Path.GetFileName(filePath)} -> {response.DownloadUrl}");
            _state.RecordUploadSuccess(Path.GetFileName(filePath));
        }
        catch (Exception ex)
        {
            _status = "error";
            _state.SetDeviceStatus(_status);
            _state.RecordUploadFailure(Path.GetFileName(filePath), ex.Message);
            throw;
        }
        finally
        {
            _status = "idle";
            _state.SetDeviceStatus(_status);
        }
    }

    private async Task HeartbeatLoopAsync(CancellationToken ct)
    {
        var heartbeatCount = 0;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (_runtimeConfig is null || heartbeatCount % 5 == 0)
                {
                    _runtimeConfig = await RefreshRuntimeConfigAsync(ct);
                }

                var currentEventId = _runtimeConfig?.AssignedEvent?.EventId;
                await _apiClient.SendHeartbeatAsync(_status, currentEventId, _state.CreateHeartbeatTelemetry(), ct);
                heartbeatCount++;
                _state.RecordHeartbeatSuccess();
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _status = "error";
                _state.SetDeviceStatus(_status);
                _state.RecordHeartbeatFailure(ex.Message);
                Console.Error.WriteLine($"Heartbeat failed: {ex.Message}");
            }

            var delaySeconds = Math.Clamp(_runtimeConfig?.HeartbeatIntervalSeconds ?? 45, 15, 120);
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct);

            if (_status == "error")
            {
                _status = "idle";
                _state.SetDeviceStatus(_status);
            }
        }
    }

    private async Task ProcessUploadQueueAsync(CancellationToken ct)
    {
        await foreach (var filePath in _uploadQueue.Reader.ReadAllAsync(ct))
        {
            try
            {
                await UploadSingleFileAsync(filePath, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Upload failed for {filePath}: {ex.Message}");
            }
            finally
            {
                _scheduledFiles.TryRemove(filePath, out _);
                _state.SetPendingUploadCount(_scheduledFiles.Count);
            }
        }
    }

    private FileSystemWatcher CreateWatcher(string watchDirectory)
    {
        var watcher = new FileSystemWatcher(watchDirectory)
        {
            IncludeSubdirectories = false,
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size
        };

        void QueueIfSupported(string? fullPath)
        {
            if (string.IsNullOrWhiteSpace(fullPath) ||
                !File.Exists(fullPath) ||
                !IsAllowedExtension(fullPath) ||
                !_scheduledFiles.TryAdd(fullPath, 0))
            {
                return;
            }

            _uploadQueue.Writer.TryWrite(fullPath);
            _state.SetPendingUploadCount(_scheduledFiles.Count);
        }

        watcher.Created += (_, args) => QueueIfSupported(args.FullPath);
        watcher.Changed += (_, args) => QueueIfSupported(args.FullPath);
        watcher.Renamed += (_, args) => QueueIfSupported(args.FullPath);
        watcher.Error += (_, args) =>
        {
            var message = args.GetException().Message;
            _state.SetWatcherState("error", message);
            Console.Error.WriteLine($"Watcher error: {message}");
        };

        return watcher;
    }

    private async Task<DeviceConfigResponse> RefreshRuntimeConfigAsync(CancellationToken ct)
    {
        var latest = await _apiClient.GetConfigAsync(ct);
        if (latest.AssignedEvent is not null)
        {
            Console.WriteLine($"Config synced. Current event: {latest.AssignedEvent.EventName}");
        }

        _state.RecordConfigSync(latest);
        return latest;
    }

    private void ValidatePhoto(string filePath)
    {
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("Photo file not found.", filePath);
        }

        if (!IsAllowedExtension(filePath))
        {
            throw new InvalidOperationException(
                $"Unsupported image type '{Path.GetExtension(filePath)}'. Allowed: {string.Join(", ", _config.AllowedExtensions)}");
        }
    }

    private bool IsAllowedExtension(string filePath) =>
        _config.AllowedExtensions.Contains(Path.GetExtension(filePath), StringComparer.OrdinalIgnoreCase);

    private async Task WaitForStableFileAsync(string filePath, CancellationToken ct)
    {
        long previousLength = -1;

        for (var attempt = 0; attempt < 20; attempt++)
        {
            ct.ThrowIfCancellationRequested();

            var info = new FileInfo(filePath);
            if (!info.Exists)
            {
                await Task.Delay(_config.UploadSettlingDelayMs, ct);
                continue;
            }

            if (info.Length == previousLength && CanOpenExclusively(filePath))
            {
                return;
            }

            previousLength = info.Length;
            await Task.Delay(_config.UploadSettlingDelayMs, ct);
        }

        throw new TimeoutException($"Timed out waiting for {filePath} to finish writing.");
    }

    private static bool CanOpenExclusively(string filePath)
    {
        try
        {
            using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.None);
            return stream.Length >= 0;
        }
        catch
        {
            return false;
        }
    }
}
