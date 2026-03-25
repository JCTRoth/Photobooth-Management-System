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

public sealed class HeartbeatRequest
{
    public Guid DeviceId { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public required string Status { get; init; }
    public Guid? CurrentEventId { get; init; }
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
