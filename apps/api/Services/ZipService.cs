using System.IO.Compression;
using Photobooth.Api.Models;
using Photobooth.Api.Repositories;

namespace Photobooth.Api.Services;

public interface IZipService
{
    Task WriteZipToStreamAsync(Guid imageId, Stream outputStream, CancellationToken ct = default);
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
        await AddImageToArchive(archive, image, "guest", ct);

        // Add all couple images
        var index = 1;
        foreach (var coupleImage in coupleImages)
        {
            await AddImageToArchive(archive, coupleImage, $"couple/{index:D3}", ct);
            index++;
        }
    }

    private async Task AddImageToArchive(ZipArchive archive, Image image, string prefix, CancellationToken ct)
    {
        var subfolder = image.Type == ImageType.Guest ? "guests" : "couple";
        var extension = Path.GetExtension(image.Filename);
        var entryName = $"{prefix}_{image.Filename}";

        var entry = archive.CreateEntry(entryName, CompressionLevel.Fastest);
        await using var entryStream = entry.Open();
        await using var imageStream = await _sftpStorage.DownloadAsync(image.EventId, subfolder, image.Filename, ct);
        await imageStream.CopyToAsync(entryStream, ct);
    }
}
