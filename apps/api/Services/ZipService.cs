using System.IO.Compression;
using Photobooth.Api.Models;
using Photobooth.Api.Repositories;

namespace Photobooth.Api.Services;

public interface IZipService
{
    Task WriteZipToStreamAsync(Guid imageId, Stream outputStream, CancellationToken ct = default);
    Task WriteEventZipToStreamAsync(Guid eventId, Stream outputStream, CancellationToken ct = default);
}

public class ZipService : IZipService
{
    private readonly IImageRepository _imageRepo;
    private readonly ISftpStorageService _sftpStorage;

    public ZipService(IImageRepository imageRepo, ISftpStorageService sftpStorage)
    {
        _imageRepo = imageRepo;
        _sftpStorage = sftpStorage;
    }

    /// <summary>
    /// Creates a ZIP containing the requested guest image + all couple images for the same event.
    /// Streams directly to the output without buffering the entire ZIP in memory.
    /// </summary>
    public async Task WriteZipToStreamAsync(Guid imageId, Stream outputStream, CancellationToken ct = default)
    {
        var image = await _imageRepo.GetByIdAsync(imageId, ct)
            ?? throw new KeyNotFoundException($"Image {imageId} not found");

        var coupleImages = await _imageRepo.GetByEventIdAndTypeAsync(image.EventId, ImageType.Couple, ct);

        using var archive = new ZipArchive(outputStream, ZipArchiveMode.Create, leaveOpen: true);

        // Add the requested guest image
        await AddImageToArchive(archive, image, $"guest/0001_{image.Filename}", ct);

        // Add all couple images
        var index = 1;
        foreach (var coupleImage in coupleImages)
        {
            await AddImageToArchive(archive, coupleImage, $"couple/{index:D4}_{coupleImage.Filename}", ct);
            index++;
        }
    }

    public async Task WriteEventZipToStreamAsync(Guid eventId, Stream outputStream, CancellationToken ct = default)
    {
        var eventImages = await _imageRepo.GetByEventIdAsync(eventId, ct);

        using var archive = new ZipArchive(outputStream, ZipArchiveMode.Create, leaveOpen: true);

        if (eventImages.Count == 0)
        {
            var emptyEntry = archive.CreateEntry("README.txt", CompressionLevel.Fastest);
            await using var writer = new StreamWriter(emptyEntry.Open());
            await writer.WriteAsync("This event currently has no photos.");
            return;
        }

        var orderedImages = eventImages
            .OrderBy(image => image.CreatedAt)
            .ThenBy(image => image.Filename, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var guestIndex = 1;
        var coupleIndex = 1;

        foreach (var image in orderedImages)
        {
            if (image.Type == ImageType.Guest)
            {
                await AddImageToArchive(archive, image, $"guests/{guestIndex:D4}_{image.Filename}", ct);
                guestIndex++;
                continue;
            }

            await AddImageToArchive(archive, image, $"couple/{coupleIndex:D4}_{image.Filename}", ct);
            coupleIndex++;
        }
    }

    private async Task AddImageToArchive(ZipArchive archive, Image image, string entryName, CancellationToken ct)
    {
        var subfolder = image.Type == ImageType.Guest ? "guests" : "couple";

        var entry = archive.CreateEntry(entryName, CompressionLevel.Fastest);
        await using var entryStream = entry.Open();
        await using var imageStream = await _sftpStorage.DownloadAsync(image.EventId, subfolder, image.Filename, ct);
        await imageStream.CopyToAsync(entryStream, ct);
    }
}
