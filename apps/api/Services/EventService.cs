using System.Security.Cryptography;
using Photobooth.Api.DTOs;
using Photobooth.Api.Models;
using Photobooth.Api.Repositories;

namespace Photobooth.Api.Services;

public interface IEventService
{
    Task<EventResponse> CreateAsync(CreateEventRequest request, CancellationToken ct = default);
    Task<EventResponse> UpdateAsync(Guid id, UpdateEventRequest request, CancellationToken ct = default);
    Task<EventResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<EventListResponse> GetAllAsync(CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Event?> ValidateUploadTokenAsync(Guid eventId, string token, CancellationToken ct = default);
}

public class EventService : IEventService
{
    private readonly IEventRepository _eventRepo;
    private readonly ISftpStorageService _sftpStorage;

    public EventService(IEventRepository eventRepo, ISftpStorageService sftpStorage)
    {
        _eventRepo = eventRepo;
        _sftpStorage = sftpStorage;
    }

    public async Task<EventResponse> CreateAsync(CreateEventRequest request, CancellationToken ct = default)
    {
        var token = GenerateSecureToken();
        var eventDate = request.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var entity = new Event
        {
            Name = request.Name,
            Date = request.Date,
            UploadToken = token,
            ExpiresAt = eventDate.AddDays(request.RetentionDays),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var created = await _eventRepo.CreateAsync(entity, ct);
        return MapToResponse(created);
    }

    public async Task<EventResponse> UpdateAsync(Guid id, UpdateEventRequest request, CancellationToken ct = default)
    {
        var entity = await _eventRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Event {id} not found");

        entity.Name = request.Name;
        entity.Date = request.Date;
        var eventDate = request.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        entity.ExpiresAt = eventDate.AddDays(request.RetentionDays);

        await _eventRepo.UpdateAsync(entity, ct);
        return MapToResponse(entity);
    }

    public async Task<EventResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _eventRepo.GetByIdAsync(id, ct);
        return entity is null ? null : MapToResponse(entity);
    }

    public async Task<EventListResponse> GetAllAsync(CancellationToken ct = default)
    {
        var events = await _eventRepo.GetAllAsync(ct);
        var responses = events.Select(MapToResponse).ToList();
        return new EventListResponse { Events = responses, Total = responses.Count };
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _eventRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Event {id} not found");

        // Delete SFTP files first, but don't block DB deletion if SFTP fails
        try
        {
            await _sftpStorage.DeleteEventDirectoryAsync(id, ct);
        }
        catch (Exception)
        {
            // Log but continue — DB cleanup is more critical
            // SFTP orphans can be cleaned up by a reconciliation job later
        }

        await _eventRepo.DeleteAsync(entity, ct);
    }

    public async Task<Event?> ValidateUploadTokenAsync(Guid eventId, string token, CancellationToken ct = default)
    {
        var entity = await _eventRepo.GetByIdAsync(eventId, ct);
        if (entity is null) return null;
        if (!CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(entity.UploadToken),
                System.Text.Encoding.UTF8.GetBytes(token)))
            return null;
        if (entity.ExpiresAt <= DateTime.UtcNow)
            return null;
        return entity;
    }

    private static EventResponse MapToResponse(Event entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Date = entity.Date,
        UploadToken = entity.UploadToken,
        ExpiresAt = entity.ExpiresAt,
        CreatedAt = entity.CreatedAt,
        CoupleUploadUrl = $"/event/{entity.Id}/upload?token={entity.UploadToken}",
        ImageCount = entity.Images?.Count ?? 0
    };

    private static string GenerateSecureToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32); // 256-bit
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}
