using System.ComponentModel.DataAnnotations;

namespace Photobooth.Api.DTOs;

public record RegisterDeviceRequest
{
    [Required]
    [MaxLength(150)]
    public required string Name { get; init; }

    public string? PublicKeyPem { get; init; }
}

public record RegisterDeviceResponse
{
    public Guid DeviceId { get; init; }
    public required string Name { get; init; }
    public required string PublicKeyPem { get; init; }
    public string? PrivateKeyPem { get; init; }
    public required string Status { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record DeviceHeartbeatRequest
{
    [Required]
    public Guid DeviceId { get; init; }

    [Required]
    public DateTimeOffset Timestamp { get; init; }

    [Required]
    [RegularExpression("idle|active|error", ErrorMessage = "Status must be idle, active, or error.")]
    public required string Status { get; init; }

    public Guid? CurrentEventId { get; init; }
    public DeviceRuntimeTelemetryRequest? Runtime { get; init; }
}

public record DeviceHeartbeatResponse
{
    public Guid DeviceId { get; init; }
    public required string Status { get; init; }
    public DateTime ServerTimeUtc { get; init; }
    public Guid? AssignedEventId { get; init; }
}

public record AssignDeviceEventRequest
{
    public Guid? EventId { get; init; }
}

public record DeviceAssignedEventResponse
{
    public Guid EventId { get; init; }
    public required string EventName { get; init; }
    public DateOnly EventDate { get; init; }
    public DateTime ExpiresAt { get; init; }
}

public record DeviceRuntimeTelemetryRequest
{
    [MaxLength(64)]
    public string? ClientVersion { get; init; }

    [MaxLength(64)]
    public string? RuntimeVersion { get; init; }

    [MaxLength(255)]
    public string? MachineName { get; init; }

    [MaxLength(255)]
    public string? LocalDashboardUrl { get; init; }

    [MaxLength(500)]
    public string? WatchDirectory { get; init; }

    public DateTimeOffset? LastConfigSyncAt { get; init; }
    public DateTimeOffset? LastEventLoadedAt { get; init; }

    [MaxLength(200)]
    public string? LoadedEventName { get; init; }

    public DateTimeOffset? LastUploadAt { get; init; }

    [MaxLength(20)]
    public string? LastUploadStatus { get; init; }

    [MaxLength(260)]
    public string? LastUploadFileName { get; init; }

    [MaxLength(500)]
    public string? LastUploadError { get; init; }

    [MaxLength(500)]
    public string? LastHeartbeatError { get; init; }

    [Range(0, int.MaxValue)]
    public int PendingUploadCount { get; init; }

    [MaxLength(20)]
    public string? WatcherState { get; init; }
}

public record DeviceRuntimeTelemetryResponse
{
    public string? ClientVersion { get; init; }
    public string? RuntimeVersion { get; init; }
    public string? MachineName { get; init; }
    public string? LocalDashboardUrl { get; init; }
    public string? WatchDirectory { get; init; }
    public DateTime? LastConfigSyncAt { get; init; }
    public DateTime? LastEventLoadedAt { get; init; }
    public string? LoadedEventName { get; init; }
    public DateTime? LastUploadAt { get; init; }
    public string? LastUploadStatus { get; init; }
    public string? LastUploadFileName { get; init; }
    public string? LastUploadError { get; init; }
    public string? LastHeartbeatError { get; init; }
    public string? WatcherState { get; init; }
    public int PendingUploadCount { get; init; }
}

public record DeviceSummaryResponse
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public required string Status { get; init; }
    public required string Connectivity { get; init; }
    public DateTime? LastSeenAt { get; init; }
    public string? PublicKeyFingerprint { get; init; }
    public DateTime CreatedAt { get; init; }
    public DeviceAssignedEventResponse? AssignedEvent { get; init; }
    public DeviceRuntimeTelemetryResponse? Runtime { get; init; }
}

public record DeviceListResponse
{
    public required IReadOnlyList<DeviceSummaryResponse> Devices { get; init; }
    public int Total { get; init; }
}

public record DeviceDetailResponse
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public required string Status { get; init; }
    public required string Connectivity { get; init; }
    public DateTime? LastSeenAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public required string PublicKeyFingerprint { get; init; }
    public DeviceAssignedEventResponse? AssignedEvent { get; init; }
    public DeviceRuntimeTelemetryResponse? Runtime { get; init; }
}

public record DeviceConfigResponse
{
    public Guid DeviceId { get; init; }
    public int HeartbeatIntervalSeconds { get; init; }
    public required string HeartbeatEndpoint { get; init; }
    public required string GuestUploadEndpoint { get; init; }
    public required string ConfigEndpoint { get; init; }
    public required string QrBaseUrl { get; init; }
    public DeviceAssignedEventResponse? AssignedEvent { get; init; }
}
