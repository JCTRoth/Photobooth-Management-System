using Microsoft.EntityFrameworkCore;
using Photobooth.Api.Data;
using Photobooth.Api.Models;

namespace Photobooth.Api.Repositories;

public interface IDeviceRequestNonceRepository
{
    Task<bool> TryStoreAsync(DeviceRequestNonce entity, CancellationToken ct = default);
    Task<int> DeleteExpiredAsync(DateTime expiresBefore, CancellationToken ct = default);
}

public class DeviceRequestNonceRepository : IDeviceRequestNonceRepository
{
    private readonly PhotoboothDbContext _db;

    public DeviceRequestNonceRepository(PhotoboothDbContext db) => _db = db;

    public async Task<bool> TryStoreAsync(DeviceRequestNonce entity, CancellationToken ct = default)
    {
        _db.DeviceRequestNonces.Add(entity);
        try
        {
            await _db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException)
        {
            _db.Entry(entity).State = EntityState.Detached;
            return false;
        }
    }

    public async Task<int> DeleteExpiredAsync(DateTime expiresBefore, CancellationToken ct = default)
    {
        var expired = await _db.DeviceRequestNonces
            .Where(n => n.ExpiresAt <= expiresBefore)
            .ToListAsync(ct);

        if (expired.Count == 0)
            return 0;

        _db.DeviceRequestNonces.RemoveRange(expired);
        await _db.SaveChangesAsync(ct);
        return expired.Count;
    }
}
