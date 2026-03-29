using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;

namespace Photobooth.Client;

public sealed class ClientRuntimeState
{
    private readonly object _gate = new();
    private readonly string _clientVersion;
    private readonly string _runtimeVersion;
    private readonly string _machineName;
    private readonly string _configPath;

    private string? _localDashboardUrl;
    private PhotoboothClientConfig? _config;
    private DeviceConfigResponse? _runtimeConfig;
    private string _runnerLifecycle = "stopped";
    private string _deviceStatus = "idle";
    private string _watcherState = "not-configured";
    private string _connectionState = "disconnected";
    private int _pendingUploadCount;
    private DateTimeOffset? _lastConfigSyncAt;
    private DateTimeOffset? _lastEventLoadedAt;
    private string? _loadedEventName;
    private DateTimeOffset? _lastHeartbeatAt;
    private DateTimeOffset? _lastSuccessfulHeartbeatAt;
    private string? _lastHeartbeatError;
    private DateTimeOffset? _lastUploadAt;
    private string? _lastUploadStatus;
    private string? _lastUploadFileName;
    private string? _lastUploadError;
    private string? _runnerError;

    public ClientRuntimeState(string configPath)
    {
        _configPath = Path.GetFullPath(configPath);
        var assembly = typeof(ClientRuntimeState).Assembly;
        _clientVersion = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion
            ?.Split('+')[0]
            ?? assembly.GetName().Version?.ToString()
            ?? "dev";
        _runtimeVersion = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription;
        _machineName = Environment.MachineName;
    }

    public void SetLocalDashboardUrl(string localDashboardUrl)
    {
        lock (_gate)
        {
            _localDashboardUrl = localDashboardUrl;
        }
    }

    public void SetConfig(PhotoboothClientConfig config)
    {
        lock (_gate)
        {
            _config = config;
            _watcherState = string.IsNullOrWhiteSpace(config.WatchDirectory) ? "not-configured" : "ready";
        }
    }

    public void ClearConfig()
    {
        lock (_gate)
        {
            _config = null;
            _runtimeConfig = null;
            _watcherState = "not-configured";
            _deviceStatus = "idle";
            _connectionState = "disconnected";
            _pendingUploadCount = 0;
            _lastConfigSyncAt = null;
            _lastEventLoadedAt = null;
            _loadedEventName = null;
            _lastHeartbeatAt = null;
            _lastSuccessfulHeartbeatAt = null;
            _lastHeartbeatError = null;
            _lastUploadAt = null;
            _lastUploadStatus = null;
            _lastUploadFileName = null;
            _lastUploadError = null;
            _runnerError = null;
        }
    }

    public void SetRunnerLifecycle(string lifecycle, string? error = null)
    {
        lock (_gate)
        {
            _runnerLifecycle = lifecycle;
            _runnerError = error;
        }
    }

    public void SetDeviceStatus(string status)
    {
        lock (_gate)
        {
            _deviceStatus = status;
        }
    }

    public void SetWatcherState(string watcherState, string? error = null)
    {
        lock (_gate)
        {
            _watcherState = watcherState;
            if (!string.IsNullOrWhiteSpace(error))
            {
                _runnerError = error;
            }
        }
    }

    public void SetPendingUploadCount(int pendingUploadCount)
    {
        lock (_gate)
        {
            _pendingUploadCount = Math.Max(0, pendingUploadCount);
        }
    }

    public void RecordConfigSync(DeviceConfigResponse runtimeConfig)
    {
        lock (_gate)
        {
            _runtimeConfig = runtimeConfig;
            _lastConfigSyncAt = DateTimeOffset.UtcNow;

            var assignedEventName = runtimeConfig.AssignedEvent?.EventName;
            if (!string.IsNullOrWhiteSpace(assignedEventName) && !string.Equals(_loadedEventName, assignedEventName, StringComparison.Ordinal))
            {
                _loadedEventName = assignedEventName;
                _lastEventLoadedAt = _lastConfigSyncAt;
            }
            else if (!string.IsNullOrWhiteSpace(assignedEventName) && _lastEventLoadedAt is null)
            {
                _loadedEventName = assignedEventName;
                _lastEventLoadedAt = _lastConfigSyncAt;
            }

            if (runtimeConfig.AssignedEvent is null)
            {
                _loadedEventName = null;
            }
        }
    }

    public void RecordHeartbeatSuccess()
    {
        lock (_gate)
        {
            _lastHeartbeatAt = DateTimeOffset.UtcNow;
            _lastSuccessfulHeartbeatAt = _lastHeartbeatAt;
            _lastHeartbeatError = null;
            _connectionState = "connected";
        }
    }

    public void RecordHeartbeatFailure(string error)
    {
        lock (_gate)
        {
            _lastHeartbeatAt = DateTimeOffset.UtcNow;
            _lastHeartbeatError = error;
            _connectionState = "degraded";
        }
    }

    public void RecordUploadStarted(string fileName)
    {
        lock (_gate)
        {
            _deviceStatus = "active";
            _lastUploadStatus = "uploading";
            _lastUploadFileName = fileName;
            _lastUploadError = null;
        }
    }

    public void RecordUploadSuccess(string fileName)
    {
        lock (_gate)
        {
            _lastUploadAt = DateTimeOffset.UtcNow;
            _lastUploadStatus = "success";
            _lastUploadFileName = fileName;
            _lastUploadError = null;
        }
    }

    public void RecordUploadFailure(string fileName, string error)
    {
        lock (_gate)
        {
            _lastUploadAt = DateTimeOffset.UtcNow;
            _lastUploadStatus = "error";
            _lastUploadFileName = fileName;
            _lastUploadError = error;
            _runnerError = error;
        }
    }

    public LocalDashboardStatusResponse CreateStatus()
    {
        lock (_gate)
        {
            return new LocalDashboardStatusResponse
            {
                ClientVersion = _clientVersion,
                RuntimeVersion = _runtimeVersion,
                MachineName = _machineName,
                LocalDashboardUrl = _localDashboardUrl ?? "http://127.0.0.1:5077",
                ConfigPath = _configPath,
                ConfigExists = File.Exists(_configPath),
                Config = _config is null ? null : SanitizeConfig(_config),
                Runner = new LocalRunnerStatusResponse
                {
                    Lifecycle = _runnerLifecycle,
                    DeviceStatus = _deviceStatus,
                    WatcherState = _watcherState,
                    ConnectionState = _connectionState,
                    PendingUploadCount = _pendingUploadCount,
                    LastConfigSyncAt = _lastConfigSyncAt,
                    LastEventLoadedAt = _lastEventLoadedAt,
                    LoadedEventName = _loadedEventName,
                    LastHeartbeatAt = _lastHeartbeatAt,
                    LastSuccessfulHeartbeatAt = _lastSuccessfulHeartbeatAt,
                    LastHeartbeatError = _lastHeartbeatError,
                    LastUploadAt = _lastUploadAt,
                    LastUploadStatus = _lastUploadStatus,
                    LastUploadFileName = _lastUploadFileName,
                    LastUploadError = _lastUploadError,
                    RunnerError = _runnerError
                },
                AssignedEvent = _runtimeConfig?.AssignedEvent
            };
        }
    }

    public DeviceRuntimeTelemetryRequest CreateHeartbeatTelemetry()
    {
        lock (_gate)
        {
            return new DeviceRuntimeTelemetryRequest
            {
                ClientVersion = _clientVersion,
                RuntimeVersion = _runtimeVersion,
                MachineName = _machineName,
                LocalDashboardUrl = _localDashboardUrl,
                WatchDirectory = _config?.WatchDirectory,
                LastConfigSyncAt = _lastConfigSyncAt,
                LastEventLoadedAt = _lastEventLoadedAt,
                LoadedEventName = _loadedEventName,
                LastUploadAt = _lastUploadAt,
                LastUploadStatus = _lastUploadStatus,
                LastUploadFileName = _lastUploadFileName,
                LastUploadError = _lastUploadError,
                LastHeartbeatError = _lastHeartbeatError,
                PendingUploadCount = _pendingUploadCount,
                WatcherState = _watcherState
            };
        }
    }

    public static LocalGeneratedKeyPairResponse GenerateKeyPair()
    {
        using var rsa = RSA.Create(2048);
        var publicKeyPem = rsa.ExportSubjectPublicKeyInfoPem();
        var privateKeyPem = rsa.ExportPkcs8PrivateKeyPem();
        var fingerprint = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(publicKeyPem)))[..16];

        return new LocalGeneratedKeyPairResponse
        {
            PublicKeyPem = publicKeyPem,
            PrivateKeyPem = privateKeyPem,
            Fingerprint = fingerprint
        };
    }

    private static LocalConfigSummaryResponse SanitizeConfig(PhotoboothClientConfig config) => new()
    {
        ServerUrl = config.ServerUrl,
        DeviceId = config.DeviceId,
        DeviceName = config.DeviceName,
        WatchDirectory = config.WatchDirectory,
        UploadSettlingDelayMs = config.UploadSettlingDelayMs,
        AllowedExtensions = config.AllowedExtensions
    };
}
