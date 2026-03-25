using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Photobooth.Api.DTOs;
using Photobooth.Api.Models;
using Photobooth.Api.Repositories;

namespace Photobooth.Api.Services;

public interface IDeviceService
{
    Task<RegisterDeviceResponse> RegisterAsync(RegisterDeviceRequest request, CancellationToken ct = default);
    Task<DeviceListResponse> GetAllAsync(CancellationToken ct = default);
    Task<DeviceDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<DeviceConfigResponse?> GetConfigAsync(Guid id, CancellationToken ct = default);
    Task<DeviceHeartbeatResponse> ProcessHeartbeatAsync(DeviceHeartbeatRequest request, CancellationToken ct = default);
    Task<DeviceDetailResponse> AssignEventAsync(Guid deviceId, Guid? eventId, CancellationToken ct = default);
    Task DeleteAsync(Guid deviceId, CancellationToken ct = default);
}

public class DeviceService : IDeviceService
{
    private const int HeartbeatIntervalSeconds = 45;
    private static readonly TimeSpan OfflineThreshold = TimeSpan.FromMinutes(2);

    private readonly IDeviceRepository _deviceRepo;
    private readonly IEventRepository _eventRepo;
    private readonly IConfiguration _configuration;

    public DeviceService(
        IDeviceRepository deviceRepo,
        IEventRepository eventRepo,
        IConfiguration configuration)
    {
        _deviceRepo = deviceRepo;
        _eventRepo = eventRepo;
        _configuration = configuration;
    }

    public async Task<RegisterDeviceResponse> RegisterAsync(RegisterDeviceRequest request, CancellationToken ct = default)
    {
        var existing = await _deviceRepo.GetByNameAsync(request.Name.Trim(), ct);
        if (existing is not null)
            throw new InvalidOperationException("A device with that name already exists.");

        string publicKeyPem;
        string? privateKeyPem = null;

        if (string.IsNullOrWhiteSpace(request.PublicKeyPem))
        {
            using var rsa = RSA.Create(2048);
            publicKeyPem = rsa.ExportSubjectPublicKeyInfoPem();
            privateKeyPem = rsa.ExportPkcs8PrivateKeyPem();
        }
        else
        {
            publicKeyPem = NormalizePem(request.PublicKeyPem);
            using var rsa = RSA.Create();
            rsa.ImportFromPem(publicKeyPem);
        }

        var entity = new Device
        {
            Name = request.Name.Trim(),
            PublicKey = publicKeyPem,
            Status = DeviceStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _deviceRepo.CreateAsync(entity, ct);

        return new RegisterDeviceResponse
        {
            DeviceId = entity.Id,
            Name = entity.Name,
            PublicKeyPem = entity.PublicKey,
            PrivateKeyPem = privateKeyPem,
            Status = entity.Status.ToString(),
            CreatedAt = entity.CreatedAt
        };
    }

    public async Task<DeviceListResponse> GetAllAsync(CancellationToken ct = default)
    {
        var devices = await _deviceRepo.GetAllAsync(ct);
        var items = devices.Select(MapSummary).ToList();
        return new DeviceListResponse
        {
            Devices = items,
            Total = items.Count
        };
    }

    public async Task<DeviceDetailResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var device = await _deviceRepo.GetByIdAsync(id, ct);
        return device is null ? null : MapDetail(device);
    }

    public async Task<DeviceConfigResponse?> GetConfigAsync(Guid id, CancellationToken ct = default)
    {
        var device = await _deviceRepo.GetByIdAsync(id, ct);
        if (device is null) return null;

        var baseUrl = (_configuration["AppBaseUrl"] ?? string.Empty).TrimEnd('/');
        return new DeviceConfigResponse
        {
            DeviceId = device.Id,
            HeartbeatIntervalSeconds = HeartbeatIntervalSeconds,
            HeartbeatEndpoint = $"{baseUrl}/api/devices/heartbeat",
            GuestUploadEndpoint = $"{baseUrl}/api/upload/guest",
            ConfigEndpoint = $"{baseUrl}/api/devices/{device.Id}/config",
            QrBaseUrl = $"{baseUrl}/d",
            AssignedEvent = MapAssignedEvent(device.AssignedEvent)
        };
    }

    public async Task<DeviceHeartbeatResponse> ProcessHeartbeatAsync(DeviceHeartbeatRequest request, CancellationToken ct = default)
    {
        var device = await _deviceRepo.GetByIdAsync(request.DeviceId, ct)
            ?? throw new KeyNotFoundException($"Device {request.DeviceId} not found.");

        if (request.CurrentEventId.HasValue &&
            device.AssignedEventId.HasValue &&
            request.CurrentEventId != device.AssignedEventId)
        {
            device.Status = DeviceStatus.Error;
        }
        else
        {
            device.Status = request.Status.ToLowerInvariant() switch
            {
                "active" => DeviceStatus.Active,
                "error" => DeviceStatus.Error,
                _ => DeviceStatus.Idle
            };
        }

        device.LastSeenAt = DateTime.UtcNow;
        device.UpdatedAt = DateTime.UtcNow;
        await _deviceRepo.UpdateAsync(device, ct);

        return new DeviceHeartbeatResponse
        {
            DeviceId = device.Id,
            Status = device.Status.ToString(),
            ServerTimeUtc = DateTime.UtcNow,
            AssignedEventId = device.AssignedEventId
        };
    }

    public async Task<DeviceDetailResponse> AssignEventAsync(Guid deviceId, Guid? eventId, CancellationToken ct = default)
    {
        var device = await _deviceRepo.GetByIdAsync(deviceId, ct)
            ?? throw new KeyNotFoundException($"Device {deviceId} not found.");

        if (eventId.HasValue)
        {
            var ev = await _eventRepo.GetByIdAsync(eventId.Value, ct)
                ?? throw new KeyNotFoundException($"Event {eventId} not found.");

            device.AssignedEventId = ev.Id;
            device.AssignedEvent = ev;
        }
        else
        {
            device.AssignedEventId = null;
            device.AssignedEvent = null;
        }

        device.UpdatedAt = DateTime.UtcNow;
        await _deviceRepo.UpdateAsync(device, ct);
        return MapDetail(device);
    }

    public async Task DeleteAsync(Guid deviceId, CancellationToken ct = default)
    {
        var device = await _deviceRepo.GetByIdAsync(deviceId, ct)
            ?? throw new KeyNotFoundException($"Device {deviceId} not found.");

        await _deviceRepo.DeleteAsync(device, ct);
    }

    private static string NormalizePem(string pem) => pem.Trim().Replace("\r\n", "\n");

    private static string GetConnectivity(Device device)
    {
        if (!device.LastSeenAt.HasValue)
            return "never-seen";

        return DateTime.UtcNow - device.LastSeenAt.Value <= OfflineThreshold
            ? "online"
            : "offline";
    }

    private static string GetFingerprint(string publicKeyPem)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(publicKeyPem));
        return Convert.ToHexString(hash)[..16];
    }

    private static DeviceSummaryResponse MapSummary(Device device) => new()
    {
        Id = device.Id,
        Name = device.Name,
        Status = device.Status.ToString(),
        Connectivity = GetConnectivity(device),
        LastSeenAt = device.LastSeenAt,
        PublicKeyFingerprint = GetFingerprint(device.PublicKey),
        CreatedAt = device.CreatedAt,
        AssignedEvent = MapAssignedEvent(device.AssignedEvent)
    };

    private static DeviceDetailResponse MapDetail(Device device) => new()
    {
        Id = device.Id,
        Name = device.Name,
        Status = device.Status.ToString(),
        Connectivity = GetConnectivity(device),
        LastSeenAt = device.LastSeenAt,
        CreatedAt = device.CreatedAt,
        UpdatedAt = device.UpdatedAt,
        PublicKeyFingerprint = GetFingerprint(device.PublicKey),
        AssignedEvent = MapAssignedEvent(device.AssignedEvent)
    };

    private static DeviceAssignedEventResponse? MapAssignedEvent(Event? ev) => ev is null
        ? null
        : new DeviceAssignedEventResponse
        {
            EventId = ev.Id,
            EventName = ev.Name,
            EventDate = ev.Date,
            ExpiresAt = ev.ExpiresAt
        };
}
