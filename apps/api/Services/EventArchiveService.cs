using System.IO.Compression;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Photobooth.Api.Configuration;
using Photobooth.Api.Models;

namespace Photobooth.Api.Services;

public interface IEventArchiveService
{
    Task<string> ArchiveEventAsync(Event ev, CancellationToken ct = default);
}

public sealed class EventArchiveService : IEventArchiveService
{
    private readonly ISftpStorageService _storage;
    private readonly IHostEnvironment _environment;
    private readonly RetentionSettings _settings;
    private readonly ILogger<EventArchiveService> _logger;

    public EventArchiveService(
        ISftpStorageService storage,
        IHostEnvironment environment,
        IOptions<RetentionSettings> settings,
        ILogger<EventArchiveService> logger)
    {
        _storage = storage;
        _environment = environment;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<string> ArchiveEventAsync(Event ev, CancellationToken ct = default)
    {
        var archiveRootPath = ResolveArchiveRootPath();
        Directory.CreateDirectory(archiveRootPath);

        var eventDirectoryName = $"{ev.Date:yyyyMMdd}-{SanitizePathPart(ev.Name)}-{ev.Id:N}";
        var archiveDirectory = Path.Combine(archiveRootPath, eventDirectoryName);
        var completedMarkerPath = Path.Combine(archiveDirectory, ".completed");

        if (File.Exists(completedMarkerPath))
        {
            _logger.LogInformation("Archive already exists for event {EventId} at {ArchiveDirectory}", ev.Id, archiveDirectory);
            return archiveDirectory;
        }

        Directory.CreateDirectory(archiveDirectory);

        var zipFilePath = Path.Combine(archiveDirectory, "images.zip");
        var tempZipFilePath = $"{zipFilePath}.tmp";
        var metadataPath = Path.Combine(archiveDirectory, "event-metadata.json");

        if (File.Exists(tempZipFilePath)) File.Delete(tempZipFilePath);
        if (File.Exists(zipFilePath)) File.Delete(zipFilePath);

        try
        {
            await CreateImagesArchiveAsync(ev, tempZipFilePath, ct);
            File.Move(tempZipFilePath, zipFilePath);

            var metadataJson = JsonSerializer.Serialize(
                BuildMetadata(ev),
                new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(metadataPath, metadataJson, ct);
            await File.WriteAllTextAsync(completedMarkerPath, DateTime.UtcNow.ToString("O"), ct);

            return archiveDirectory;
        }
        catch
        {
            if (File.Exists(tempZipFilePath))
            {
                File.Delete(tempZipFilePath);
            }

            throw;
        }
    }

    private async Task CreateImagesArchiveAsync(Event ev, string outputPath, CancellationToken ct)
    {
        await using var zipFileStream = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        using var archive = new ZipArchive(zipFileStream, ZipArchiveMode.Create, leaveOpen: false);

        var orderedImages = (ev.Images ?? [])
            .OrderBy(image => image.CreatedAt)
            .ThenBy(image => image.Filename, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var guestIndex = 1;
        var coupleIndex = 1;

        foreach (var image in orderedImages)
        {
            var storageFolder = image.Type == ImageType.Guest ? "guests" : "couple";
            var fileIndex = image.Type == ImageType.Guest ? guestIndex++ : coupleIndex++;
            var entryName = $"{storageFolder}/{fileIndex:D4}_{image.Filename}";

            var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
            await using var entryStream = entry.Open();
            await using var imageStream = await _storage.DownloadAsync(ev.Id, storageFolder, image.Filename, ct);
            await imageStream.CopyToAsync(entryStream, ct);
        }
    }

    private EventArchiveMetadata BuildMetadata(Event ev)
    {
        var owners = (ev.MarriageEmails ?? [])
            .OrderBy(owner => owner.Email, StringComparer.OrdinalIgnoreCase)
            .Select(owner => new EventArchiveOwner
            {
                Email = owner.Email,
                Status = owner.Status.ToString(),
                VerifiedAt = owner.VerifiedAt
            })
            .ToList();

        var images = (ev.Images ?? [])
            .OrderBy(image => image.CreatedAt)
            .ThenBy(image => image.Filename, StringComparer.OrdinalIgnoreCase)
            .Select(image => new EventArchiveImage
            {
                Id = image.Id,
                Filename = image.Filename,
                Type = image.Type.ToString(),
                Caption = image.Caption,
                CreatedAt = image.CreatedAt
            })
            .ToList();

        return new EventArchiveMetadata
        {
            EventId = ev.Id,
            Name = ev.Name,
            Date = ev.Date,
            ExpiresAt = ev.ExpiresAt,
            CreatedAt = ev.CreatedAt,
            ArchivedAt = DateTime.UtcNow,
            Owners = owners,
            Images = images
        };
    }

    private string ResolveArchiveRootPath()
    {
        var configuredPath = _settings.ArchiveRootPath?.Trim();
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            return Path.Combine(_environment.ContentRootPath, "archives", "events");
        }

        return Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.GetFullPath(Path.Combine(_environment.ContentRootPath, configuredPath));
    }

    private static string SanitizePathPart(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return "event";
        }

        var chars = input
            .Trim()
            .ToLowerInvariant()
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-')
            .ToArray();

        var normalized = new string(chars);

        while (normalized.Contains("--", StringComparison.Ordinal))
        {
            normalized = normalized.Replace("--", "-", StringComparison.Ordinal);
        }

        normalized = normalized.Trim('-');
        return string.IsNullOrWhiteSpace(normalized) ? "event" : normalized;
    }
}

public sealed class EventArchiveMetadata
{
    public Guid EventId { get; init; }
    public string Name { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public DateTime ExpiresAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime ArchivedAt { get; init; }
    public IReadOnlyList<EventArchiveOwner> Owners { get; init; } = [];
    public IReadOnlyList<EventArchiveImage> Images { get; init; } = [];
}

public sealed class EventArchiveOwner
{
    public string Email { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime? VerifiedAt { get; init; }
}

public sealed class EventArchiveImage
{
    public Guid Id { get; init; }
    public string Filename { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string? Caption { get; init; }
    public DateTime CreatedAt { get; init; }
}
