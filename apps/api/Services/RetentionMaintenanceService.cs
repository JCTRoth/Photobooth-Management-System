using Microsoft.Extensions.Options;
using Photobooth.Api.Configuration;
using Photobooth.Api.Models;
using Photobooth.Api.Repositories;

namespace Photobooth.Api.Services;

public interface IRetentionMaintenanceService
{
    Task<RetentionMaintenanceResult> RunAsync(CancellationToken ct = default);
}

public sealed record RetentionMaintenanceResult(
    int WarningEmailsSent,
    int EventsArchivedAndDeleted,
    int DevicesMarkedOffline,
    int DeletedNonces);

public sealed class RetentionMaintenanceService : IRetentionMaintenanceService
{
    private readonly IEventRepository _eventRepository;
    private readonly IDeviceRepository _deviceRepository;
    private readonly IDeviceRequestNonceRepository _nonceRepository;
    private readonly IEventArchiveService _eventArchiveService;
    private readonly ISftpStorageService _storage;
    private readonly IEmailService _emailService;
    private readonly RetentionSettings _retentionSettings;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RetentionMaintenanceService> _logger;

    public RetentionMaintenanceService(
        IEventRepository eventRepository,
        IDeviceRepository deviceRepository,
        IDeviceRequestNonceRepository nonceRepository,
        IEventArchiveService eventArchiveService,
        ISftpStorageService storage,
        IEmailService emailService,
        IOptions<RetentionSettings> retentionSettings,
        IConfiguration configuration,
        ILogger<RetentionMaintenanceService> logger)
    {
        _eventRepository = eventRepository;
        _deviceRepository = deviceRepository;
        _nonceRepository = nonceRepository;
        _eventArchiveService = eventArchiveService;
        _storage = storage;
        _emailService = emailService;
        _retentionSettings = retentionSettings.Value;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<RetentionMaintenanceResult> RunAsync(CancellationToken ct = default)
    {
        var warningEmailsSent = await SendRetentionWarningsAsync(ct);
        var archivedAndDeleted = await ArchiveAndDeleteExpiredEventsAsync(ct);

        var devicesMarkedOffline = await _deviceRepository.MarkOfflineAsync(DateTime.UtcNow.AddMinutes(-2), ct);
        if (devicesMarkedOffline > 0)
        {
            _logger.LogInformation("Marked {Count} stale devices as offline", devicesMarkedOffline);
        }

        var deletedNonces = await _nonceRepository.DeleteExpiredAsync(DateTime.UtcNow, ct);
        if (deletedNonces > 0)
        {
            _logger.LogInformation("Deleted {Count} expired device request nonces", deletedNonces);
        }

        return new RetentionMaintenanceResult(
            warningEmailsSent,
            archivedAndDeleted,
            devicesMarkedOffline,
            deletedNonces);
    }

    private async Task<int> SendRetentionWarningsAsync(CancellationToken ct)
    {
        if (_retentionSettings.WarningDaysBeforeExpiry <= 0)
        {
            return 0;
        }

        var nowUtc = DateTime.UtcNow;
        var warningThresholdUtc = nowUtc.AddDays(_retentionSettings.WarningDaysBeforeExpiry);
        var eventsNeedingWarning = await _eventRepository.GetPendingRetentionWarningsAsync(nowUtc, warningThresholdUtc, ct);

        if (eventsNeedingWarning.Count == 0)
        {
            return 0;
        }

        var galleryUrl = $"{(_configuration["AppBaseUrl"] ?? "http://localhost:5173").TrimEnd('/')}/my-gallery";
        var sentEmails = 0;

        foreach (var ev in eventsNeedingWarning)
        {
            var recipients = (ev.MarriageEmails ?? [])
                .Where(owner => owner.Status == MarriageEmailStatus.Confirmed)
                .Select(owner => owner.Email.Trim().ToLowerInvariant())
                .Where(email => !string.IsNullOrWhiteSpace(email))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (recipients.Count == 0)
            {
                _logger.LogInformation("No confirmed owners found for event {EventId}; skipping warning email", ev.Id);
                continue;
            }

            var daysRemaining = Math.Max(1, (int)Math.Ceiling((ev.ExpiresAt - nowUtc).TotalDays));
            var allRecipientsSucceeded = true;

            foreach (var recipient in recipients)
            {
                try
                {
                    await _emailService.SendRetentionWarningEmailAsync(
                        recipient,
                        ev.Name,
                        ev.ExpiresAt,
                        daysRemaining,
                        galleryUrl,
                        ct);
                    sentEmails++;
                }
                catch (Exception ex)
                {
                    allRecipientsSucceeded = false;
                    _logger.LogError(
                        ex,
                        "Failed sending retention warning for event {EventId} to {Email}",
                        ev.Id,
                        recipient);
                }
            }

            if (allRecipientsSucceeded)
            {
                ev.RetentionWarningSentAt = DateTime.UtcNow;
                await _eventRepository.UpdateAsync(ev, ct);
                _logger.LogInformation("Retention warning sent for event {EventId}", ev.Id);
            }
        }

        return sentEmails;
    }

    private async Task<int> ArchiveAndDeleteExpiredEventsAsync(CancellationToken ct)
    {
        var expiredEvents = await _eventRepository.GetExpiredAsync(ct);

        if (expiredEvents.Count == 0)
        {
            return 0;
        }

        _logger.LogInformation("Found {Count} expired events to archive and remove", expiredEvents.Count);

        var archivedAndDeleted = 0;

        foreach (var ev in expiredEvents)
        {
            try
            {
                var archivePath = await _eventArchiveService.ArchiveEventAsync(ev, ct);
                _logger.LogInformation("Archived event {EventId} to {ArchivePath}", ev.Id, archivePath);

                await _storage.DeleteEventDirectoryAsync(ev.Id, ct);
                await _eventRepository.DeleteAsync(ev, ct);

                archivedAndDeleted++;
                _logger.LogInformation("Removed expired event {EventId} after successful archive", ev.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to archive/remove expired event {EventId}. Event will be retried in next retention cycle.",
                    ev.Id);
            }
        }

        return archivedAndDeleted;
    }
}
