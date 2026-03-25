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
