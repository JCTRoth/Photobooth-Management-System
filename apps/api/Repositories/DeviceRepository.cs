using Microsoft.EntityFrameworkCore;
using Photobooth.Api.Data;
using Photobooth.Api.Models;

namespace Photobooth.Api.Repositories;

public interface IDeviceRepository
{
    Task<Device?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Device?> GetByNameAsync(string name, CancellationToken ct = default);
    Task<IReadOnlyList<Device>> GetAllAsync(CancellationToken ct = default);
    Task<Device> CreateAsync(Device entity, CancellationToken ct = default);
    Task DeleteAsync(Device entity, CancellationToken ct = default);
    Task UpdateAsync(Device entity, CancellationToken ct = default);
    Task<int> MarkOfflineAsync(DateTime staleBefore, CancellationToken ct = default);
}

public class DeviceRepository : IDeviceRepository
{
    private readonly PhotoboothDbContext _db;

    public DeviceRepository(PhotoboothDbContext db) => _db = db;

    public async Task<Device?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Devices
            .Include(d => d.AssignedEvent)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

    public async Task<Device?> GetByNameAsync(string name, CancellationToken ct = default) =>
        await _db.Devices
            .Include(d => d.AssignedEvent)
            .FirstOrDefaultAsync(d => d.Name == name, ct);

    public async Task<IReadOnlyList<Device>> GetAllAsync(CancellationToken ct = default) =>
        await _db.Devices
            .Include(d => d.AssignedEvent)
            .OrderBy(d => d.Name)
            .ToListAsync(ct);

    public async Task<Device> CreateAsync(Device entity, CancellationToken ct = default)
    {
        _db.Devices.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity;
    }

    public async Task DeleteAsync(Device entity, CancellationToken ct = default)
    {
        _db.Devices.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Device entity, CancellationToken ct = default)
    {
        entity.UpdatedAt = DateTime.UtcNow;
        _db.Devices.Update(entity);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<int> MarkOfflineAsync(DateTime staleBefore, CancellationToken ct = default)
    {
        var staleDevices = await _db.Devices
            .Where(d =>
                d.LastSeenAt.HasValue &&
                d.LastSeenAt < staleBefore &&
                d.Status != DeviceStatus.Offline)
            .ToListAsync(ct);

        foreach (var device in staleDevices)
        {
            device.Status = DeviceStatus.Offline;
            device.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return staleDevices.Count;
    }
}
