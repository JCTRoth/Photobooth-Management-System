using Microsoft.EntityFrameworkCore;
using Photobooth.Api.Data;
using Photobooth.Api.Models;

namespace Photobooth.Api.Repositories;

public interface IEventRepository
{
    Task<Event?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Event?> GetByUploadTokenAsync(string token, CancellationToken ct = default);
    Task<IReadOnlyList<Event>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Event>> GetExpiredAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Event>> GetPendingRetentionWarningsAsync(DateTime nowUtc, DateTime warningThresholdUtc, CancellationToken ct = default);
    Task<Event> CreateAsync(Event entity, CancellationToken ct = default);
    Task UpdateAsync(Event entity, CancellationToken ct = default);
    Task DeleteAsync(Event entity, CancellationToken ct = default);
}

public class EventRepository : IEventRepository
{
    private readonly PhotoboothDbContext _db;

    public EventRepository(PhotoboothDbContext db) => _db = db;

    public async Task<Event?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Events
            .Include(e => e.Images)
            .Include(e => e.MarriageEmails)
            .FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<Event?> GetByUploadTokenAsync(string token, CancellationToken ct = default) =>
        await _db.Events.FirstOrDefaultAsync(e => e.UploadToken == token, ct);

    public async Task<IReadOnlyList<Event>> GetAllAsync(CancellationToken ct = default) =>
        await _db.Events
            .Include(e => e.Images)
            .Include(e => e.MarriageEmails)
            .OrderByDescending(e => e.Date)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Event>> GetExpiredAsync(CancellationToken ct = default) =>
        await _db.Events
            .Include(e => e.Images)
            .Include(e => e.MarriageEmails)
            .Where(e => e.ExpiresAt <= DateTime.UtcNow)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Event>> GetPendingRetentionWarningsAsync(
        DateTime nowUtc,
        DateTime warningThresholdUtc,
        CancellationToken ct = default) =>
        await _db.Events
            .Include(e => e.MarriageEmails)
            .Where(e =>
                e.RetentionWarningSentAt == null
                && e.ExpiresAt > nowUtc
                && e.ExpiresAt <= warningThresholdUtc)
            .OrderBy(e => e.ExpiresAt)
            .ToListAsync(ct);

    public async Task<Event> CreateAsync(Event entity, CancellationToken ct = default)
    {
        _db.Events.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity;
    }

    public async Task UpdateAsync(Event entity, CancellationToken ct = default)
    {
        entity.UpdatedAt = DateTime.UtcNow;
        _db.Events.Update(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Event entity, CancellationToken ct = default)
    {
        _db.Events.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }
}
