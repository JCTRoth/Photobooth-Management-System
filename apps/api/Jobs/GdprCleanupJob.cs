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
        var retentionMaintenance = scope.ServiceProvider.GetRequiredService<IRetentionMaintenanceService>();
        var result = await retentionMaintenance.RunAsync(ct);

        _logger.LogInformation(
            "Retention maintenance completed: warningEmails={WarningEmails}, eventsArchivedAndDeleted={ArchivedDeleted}, devicesMarkedOffline={OfflineCount}, deletedNonces={NonceCount}",
            result.WarningEmailsSent,
            result.EventsArchivedAndDeleted,
            result.DevicesMarkedOffline,
            result.DeletedNonces);
    }
}
