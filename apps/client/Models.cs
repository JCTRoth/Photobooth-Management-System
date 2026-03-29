using System.Text.Json.Serialization;

namespace Photobooth.Client;

public sealed class PhotoboothClientConfig
{
    public required string ServerUrl { get; init; }
    public required Guid DeviceId { get; init; }
    public required string PrivateKey { get; init; }
    public string DeviceName { get; init; } = string.Empty;
    public string? WatchDirectory { get; init; }
    public int UploadSettlingDelayMs { get; init; } = 1500;
    public string[] AllowedExtensions { get; init; } = [".jpg", ".jpeg", ".png"];
}

public sealed class LocalConfigSummaryResponse
{
    public required string ServerUrl { get; init; }
    public Guid DeviceId { get; init; }
    public required string DeviceName { get; init; }
    public string? WatchDirectory { get; init; }
    public int UploadSettlingDelayMs { get; init; }
    public required string[] AllowedExtensions { get; init; }
}

public sealed class LocalRunnerStatusResponse
{
    public required string Lifecycle { get; init; }
    public required string DeviceStatus { get; init; }
    public required string WatcherState { get; init; }
    public required string ConnectionState { get; init; }
    public int PendingUploadCount { get; init; }
    public DateTimeOffset? LastConfigSyncAt { get; init; }
    public DateTimeOffset? LastEventLoadedAt { get; init; }
    public string? LoadedEventName { get; init; }
    public DateTimeOffset? LastHeartbeatAt { get; init; }
    public DateTimeOffset? LastSuccessfulHeartbeatAt { get; init; }
    public string? LastHeartbeatError { get; init; }
    public DateTimeOffset? LastUploadAt { get; init; }
    public string? LastUploadStatus { get; init; }
    public string? LastUploadFileName { get; init; }
    public string? LastUploadError { get; init; }
    public string? RunnerError { get; init; }
}

public sealed class LocalDashboardStatusResponse
{
    public required string ClientVersion { get; init; }
    public required string RuntimeVersion { get; init; }
    public required string MachineName { get; init; }
    public required string LocalDashboardUrl { get; init; }
    public required string ConfigPath { get; init; }
    public bool ConfigExists { get; init; }
    public LocalConfigSummaryResponse? Config { get; init; }
    public required LocalRunnerStatusResponse Runner { get; init; }
    public DeviceAssignedEventResponse? AssignedEvent { get; init; }
}

public sealed class LocalGeneratedKeyPairResponse
{
    public required string PublicKeyPem { get; init; }
    public required string PrivateKeyPem { get; init; }
    public required string Fingerprint { get; init; }
}

public sealed class LocalRegisterDeviceRequest
{
    public required string ServerUrl { get; init; }
    public required string DeviceName { get; init; }
    public string? WatchDirectory { get; init; }
    public string? PublicKeyPem { get; init; }
    public string? PrivateKeyPem { get; init; }
    public bool StartRunner { get; init; } = true;
}

public sealed class LocalImportConfigRequest
{
    public required string RawJson { get; init; }
    public bool StartRunner { get; init; } = true;
}

public sealed class LocalCommandResult
{
    public required string Message { get; init; }
}

public sealed class LocalSetupResultResponse
{
    public required string Message { get; init; }
    public LocalConfigSummaryResponse? Config { get; init; }
}

public sealed class RegisterDeviceRequest
{
    public required string Name { get; init; }
    public string? PublicKeyPem { get; init; }
}

public sealed class RegisterDeviceResponse
{
    public Guid DeviceId { get; init; }
    public required string Name { get; init; }
    public string? PrivateKeyPem { get; init; }
}

public sealed class DeviceAssignedEventResponse
{
    public Guid EventId { get; init; }
    public required string EventName { get; init; }
    public required string EventDate { get; init; }
    public required DateTime ExpiresAt { get; init; }
}

public sealed class DeviceConfigResponse
{
    public Guid DeviceId { get; init; }
    public int HeartbeatIntervalSeconds { get; init; }
    public required string HeartbeatEndpoint { get; init; }
    public required string GuestUploadEndpoint { get; init; }
    public required string ConfigEndpoint { get; init; }
    public required string QrBaseUrl { get; init; }
    public DeviceAssignedEventResponse? AssignedEvent { get; init; }
}

public sealed class DeviceRuntimeTelemetryRequest
{
    public string? ClientVersion { get; init; }
    public string? RuntimeVersion { get; init; }
    public string? MachineName { get; init; }
    public string? LocalDashboardUrl { get; init; }
    public string? WatchDirectory { get; init; }
    public DateTimeOffset? LastConfigSyncAt { get; init; }
    public DateTimeOffset? LastEventLoadedAt { get; init; }
    public string? LoadedEventName { get; init; }
    public DateTimeOffset? LastUploadAt { get; init; }
    public string? LastUploadStatus { get; init; }
    public string? LastUploadFileName { get; init; }
    public string? LastUploadError { get; init; }
    public string? LastHeartbeatError { get; init; }
    public int PendingUploadCount { get; init; }
    public string? WatcherState { get; init; }
}

public sealed class HeartbeatRequest
{
    public Guid DeviceId { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public required string Status { get; init; }
    public Guid? CurrentEventId { get; init; }
    public DeviceRuntimeTelemetryRequest? Runtime { get; init; }
}

public sealed class UploadResponse
{
    public Guid ImageId { get; init; }
    public required string Filename { get; init; }
    public required string DownloadUrl { get; init; }
}

public sealed class ApiErrorResponse
{
    public string? Error { get; init; }
    public string? Message { get; init; }
    public string? Title { get; init; }

    [JsonExtensionData]
    public IDictionary<string, object?> Extra { get; init; } = new Dictionary<string, object?>();
}
