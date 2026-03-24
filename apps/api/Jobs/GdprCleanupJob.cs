using Photobooth.Api.Repositories;
using Photobooth.Api.Services;

namespace Photobooth.Api.Jobs;

public sealed class GdprCleanupJob : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<GdprCleanupJob> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromHours(6);

    public GdprCleanupJob(IServiceProvider serviceProvider, ILogger<GdprCleanupJob> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("GDPR Cleanup Job started. Interval: {Interval}", _interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredEventsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during GDPR cleanup");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task CleanupExpiredEventsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var eventRepo = scope.ServiceProvider.GetRequiredService<IEventRepository>();
        var sftpStorage = scope.ServiceProvider.GetRequiredService<ISftpStorageService>();

        var expiredEvents = await eventRepo.GetExpiredAsync(ct);

        if (expiredEvents.Count == 0)
        {
            _logger.LogDebug("No expired events found");
            return;
        }

        _logger.LogInformation("Found {Count} expired events to clean up", expiredEvents.Count);

        foreach (var ev in expiredEvents)
        {
            try
            {
                _logger.LogInformation("Deleting expired event: {EventId} ({EventName}), expired at {ExpiresAt}",
                    ev.Id, ev.Name, ev.ExpiresAt);

                await sftpStorage.DeleteEventDirectoryAsync(ev.Id, ct);
                await eventRepo.DeleteAsync(ev, ct);

                _logger.LogInformation("Successfully deleted event {EventId}", ev.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete expired event {EventId}", ev.Id);
            }
        }
    }
}
