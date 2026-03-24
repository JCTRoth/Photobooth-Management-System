using Microsoft.EntityFrameworkCore;
using Photobooth.Api.Data;
using Photobooth.Api.Models;

namespace Photobooth.Api.Repositories;

public interface IImageRepository
{
    Task<Image?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Image>> GetByEventIdAsync(Guid eventId, CancellationToken ct = default);
    Task<IReadOnlyList<Image>> GetByEventIdAndTypeAsync(Guid eventId, ImageType type, CancellationToken ct = default);
    Task<Image> CreateAsync(Image entity, CancellationToken ct = default);
    Task DeleteRangeAsync(IEnumerable<Image> entities, CancellationToken ct = default);
}

public class ImageRepository : IImageRepository
{
    private readonly PhotoboothDbContext _db;

    public ImageRepository(PhotoboothDbContext db) => _db = db;

    public async Task<Image?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Images.Include(i => i.Event).FirstOrDefaultAsync(i => i.Id == id, ct);

    public async Task<IReadOnlyList<Image>> GetByEventIdAsync(Guid eventId, CancellationToken ct = default) =>
        await _db.Images.Where(i => i.EventId == eventId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Image>> GetByEventIdAndTypeAsync(Guid eventId, ImageType type, CancellationToken ct = default) =>
        await _db.Images.Where(i => i.EventId == eventId && i.Type == type)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);

    public async Task<Image> CreateAsync(Image entity, CancellationToken ct = default)
    {
        _db.Images.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity;
    }

    public async Task DeleteRangeAsync(IEnumerable<Image> entities, CancellationToken ct = default)
    {
        _db.Images.RemoveRange(entities);
        await _db.SaveChangesAsync(ct);
    }
}
