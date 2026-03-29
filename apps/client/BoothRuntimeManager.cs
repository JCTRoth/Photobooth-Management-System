namespace Photobooth.Client;

public sealed class BoothRuntimeManager : IAsyncDisposable
{
    private readonly string _configPath;
    private readonly ClientRuntimeState _state;
    private readonly SemaphoreSlim _runnerGate = new(1, 1);

    private Task? _runnerTask;
    private CancellationTokenSource? _runnerCts;

    public BoothRuntimeManager(string configPath)
    {
        _configPath = configPath;
        _state = new ClientRuntimeState(configPath);
    }

    public void SetDashboardUrl(string dashboardUrl) => _state.SetLocalDashboardUrl(dashboardUrl);

    public async Task InitializeAsync(CancellationToken ct)
    {
        if (!File.Exists(_configPath))
        {
            return;
        }

        var config = await PhotoboothApiClient.LoadConfigAsync(_configPath, ct);
        _state.SetConfig(config);
        await StartRunnerAsync(ct);
    }

    public LocalDashboardStatusResponse GetStatus() => _state.CreateStatus();

    public async Task<LocalSetupResultResponse> RegisterDeviceAsync(LocalRegisterDeviceRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.PrivateKeyPem) && string.IsNullOrWhiteSpace(request.PublicKeyPem))
        {
            throw new InvalidOperationException("A private key was provided without its matching public key.");
        }

        var config = await PhotoboothApiClient.RegisterDeviceAsync(
            request.ServerUrl,
            request.DeviceName,
            _configPath,
            request.WatchDirectory,
            string.IsNullOrWhiteSpace(request.PublicKeyPem) ? null : request.PublicKeyPem.Trim(),
            string.IsNullOrWhiteSpace(request.PrivateKeyPem) ? null : request.PrivateKeyPem.Trim(),
            ct);

        _state.SetConfig(config);

        if (request.StartRunner)
        {
            await RestartRunnerAsync(ct);
        }

        return new LocalSetupResultResponse
        {
            Message = $"Device {config.DeviceName} registered and saved to {Path.GetFullPath(_configPath)}.",
            Config = _state.CreateStatus().Config
        };
    }

    public async Task<LocalSetupResultResponse> ImportConfigAsync(LocalImportConfigRequest request, CancellationToken ct)
    {
        var config = PhotoboothApiClient.ParseConfig(request.RawJson);
        await PhotoboothApiClient.SaveConfigAsync(_configPath, config, ct);
        _state.SetConfig(config);

        if (request.StartRunner)
        {
            await RestartRunnerAsync(ct);
        }

        return new LocalSetupResultResponse
        {
            Message = $"Config imported and saved to {Path.GetFullPath(_configPath)}.",
            Config = _state.CreateStatus().Config
        };
    }

    public async Task StartRunnerAsync(CancellationToken ct)
    {
        await _runnerGate.WaitAsync(ct);
        try
        {
            if (_runnerTask is { IsCompleted: false })
            {
                return;
            }

            var config = await PhotoboothApiClient.LoadConfigAsync(_configPath, ct);
            _state.SetConfig(config);
            _state.SetRunnerLifecycle("starting");

            _runnerCts = new CancellationTokenSource();
            var linked = CancellationTokenSource.CreateLinkedTokenSource(_runnerCts.Token);

            _runnerTask = Task.Run(async () =>
            {
                try
                {
                    using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
                    var apiClient = new PhotoboothApiClient(httpClient, config);
                    var runner = new PhotoboothDeviceRunner(apiClient, config, _state);
                    _state.SetRunnerLifecycle("running");
                    await runner.RunAsync(linked.Token);
                }
                catch (OperationCanceledException) when (linked.IsCancellationRequested)
                {
                    _state.SetRunnerLifecycle("stopped");
                }
                catch (Exception ex)
                {
                    _state.SetRunnerLifecycle("error", ex.Message);
                }
                finally
                {
                    linked.Dispose();
                }
            }, CancellationToken.None);
        }
        finally
        {
            _runnerGate.Release();
        }
    }

    public async Task StopRunnerAsync()
    {
        Task? runnerTask;

        await _runnerGate.WaitAsync();
        try
        {
            if (_runnerTask is not { IsCompleted: false })
            {
                _state.SetRunnerLifecycle("stopped");
                return;
            }

            _state.SetRunnerLifecycle("stopping");
            _runnerCts?.Cancel();
            runnerTask = _runnerTask;
        }
        finally
        {
            _runnerGate.Release();
        }

        if (runnerTask is not null)
        {
            try
            {
                await runnerTask;
            }
            catch (OperationCanceledException)
            {
                // expected
            }
        }

        await _runnerGate.WaitAsync();
        try
        {
            _runnerCts?.Dispose();
            _runnerCts = null;
            _runnerTask = null;
            _state.SetRunnerLifecycle("stopped");
            _state.SetDeviceStatus("idle");
            _state.SetWatcherState("stopped");
            _state.SetPendingUploadCount(0);
        }
        finally
        {
            _runnerGate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        await StopRunnerAsync();
        _runnerGate.Dispose();
    }

    private async Task RestartRunnerAsync(CancellationToken ct)
    {
        await StopRunnerAsync();
        await StartRunnerAsync(ct);
    }
}
