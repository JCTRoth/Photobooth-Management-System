using Microsoft.Extensions.Options;
using Photobooth.Api.Configuration;
using Photobooth.Api.DTOs;
using Photobooth.Api.Models;
using Photobooth.Api.Repositories;

namespace Photobooth.Api.Services;

public interface IImageService
{
    Task<UploadResponse> UploadDeviceGuestImageAsync(Guid deviceId, Guid? eventId, Stream fileStream, string originalFilename, CancellationToken ct = default);
    Task<UploadResponse> UploadGuestImageAsync(Guid eventId, Stream fileStream, string originalFilename, CancellationToken ct = default);
    Task<UploadResponse> UploadCoupleImageAsync(Guid eventId, string token, Stream fileStream, string originalFilename, CancellationToken ct = default);
    Task<ImageResponse?> GetByIdAsync(Guid imageId, CancellationToken ct = default);
    Task<ImageListResponse> GetByEventIdAsync(Guid eventId, CancellationToken ct = default);
    Task<Stream> GetImageStreamAsync(Guid imageId, CancellationToken ct = default);
    Task DeleteAsync(Guid imageId, CancellationToken ct = default);
    Task<ImageResponse?> UpdateCaptionAsync(Guid imageId, string? caption, CancellationToken ct = default);
}

public class ImageService : IImageService
{
    private readonly IImageRepository _imageRepo;
    private readonly IEventRepository _eventRepo;
    private readonly IDeviceRepository _deviceRepo;
    private readonly ISftpStorageService _sftpStorage;
    private readonly IEventService _eventService;
    private readonly UploadSettings _uploadSettings;

    public ImageService(
        IImageRepository imageRepo,
        IEventRepository eventRepo,
        IDeviceRepository deviceRepo,
        ISftpStorageService sftpStorage,
        IEventService eventService,
        IOptions<UploadSettings> uploadSettings)
    {
        _imageRepo = imageRepo;
        _eventRepo = eventRepo;
        _deviceRepo = deviceRepo;
        _sftpStorage = sftpStorage;
        _eventService = eventService;
        _uploadSettings = uploadSettings.Value;
    }

    public async Task<UploadResponse> UploadDeviceGuestImageAsync(Guid deviceId, Guid? eventId, Stream fileStream, string originalFilename, CancellationToken ct = default)
    {
        var device = await _deviceRepo.GetByIdAsync(deviceId, ct)
            ?? throw new KeyNotFoundException($"Device {deviceId} not found");

        if (!device.AssignedEventId.HasValue)
            throw new InvalidOperationException("This device is not assigned to an event.");

        if (eventId.HasValue && eventId.Value != device.AssignedEventId.Value)
            throw new UnauthorizedAccessException("The device is not assigned to the requested event.");

        var ev = device.AssignedEvent ?? await _eventRepo.GetByIdAsync(device.AssignedEventId.Value, ct);
        if (ev is null)
            throw new KeyNotFoundException($"Event {device.AssignedEventId.Value} not found");

        if (ev.ExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("Assigned event has expired.");

        return await ProcessUploadAsync(ev.Id, ImageType.Guest, "guests", fileStream, originalFilename, ct);
    }

    public async Task<UploadResponse> UploadGuestImageAsync(Guid eventId, Stream fileStream, string originalFilename, CancellationToken ct = default)
    {
        var ev = await _eventRepo.GetByIdAsync(eventId, ct)
            ?? throw new KeyNotFoundException($"Event {eventId} not found");

        if (ev.ExpiresAt <= DateTime.UtcNow)
            throw new InvalidOperationException("Event has expired");

        return await ProcessUploadAsync(eventId, ImageType.Guest, "guests", fileStream, originalFilename, ct);
    }

    public async Task<UploadResponse> UploadCoupleImageAsync(Guid eventId, string token, Stream fileStream, string originalFilename, CancellationToken ct = default)
    {
        var ev = await _eventService.ValidateUploadTokenAsync(eventId, token, ct)
            ?? throw new UnauthorizedAccessException("Invalid upload token");

        return await ProcessUploadAsync(eventId, ImageType.Couple, "couple", fileStream, originalFilename, ct);
    }

    public async Task<ImageResponse?> GetByIdAsync(Guid imageId, CancellationToken ct = default)
    {
        var image = await _imageRepo.GetByIdAsync(imageId, ct);
        return image is null ? null : MapToResponse(image);
    }

    public async Task<ImageListResponse> GetByEventIdAsync(Guid eventId, CancellationToken ct = default)
    {
        var images = await _imageRepo.GetByEventIdAsync(eventId, ct);
        var responses = images.Select(MapToResponse).ToList();
        return new ImageListResponse { Images = responses, Total = responses.Count };
    }

    public async Task<Stream> GetImageStreamAsync(Guid imageId, CancellationToken ct = default)
    {
        var image = await _imageRepo.GetByIdAsync(imageId, ct)
            ?? throw new KeyNotFoundException($"Image {imageId} not found");

        var subfolder = image.Type == ImageType.Guest ? "guests" : "couple";
        return await _sftpStorage.DownloadAsync(image.EventId, subfolder, image.Filename, ct);
    }

    private async Task<UploadResponse> ProcessUploadAsync(
        Guid eventId, ImageType type, string subfolder,
        Stream fileStream, string originalFilename, CancellationToken ct)
    {
        var extension = Path.GetExtension(originalFilename).ToLowerInvariant();

        var cleanedStream = StripExifData(fileStream);

        var safeFilename = $"{Guid.NewGuid()}{extension}";

        await _sftpStorage.UploadAsync(eventId, subfolder, safeFilename, cleanedStream, ct);

        var image = new Image
        {
            EventId = eventId,
            Filename = safeFilename,
            Type = type,
            CreatedAt = DateTime.UtcNow
        };

        await _imageRepo.CreateAsync(image, ct);

        return new UploadResponse
        {
            ImageId = image.Id,
            Filename = safeFilename,
            DownloadUrl = $"/d/{image.Id}"
        };
    }

    private static MemoryStream StripExifData(Stream input)
    {
        // Copy to a seekable MemoryStream if the input isn't seekable
        // (e.g. IFormFile.OpenReadStream() may not be seekable)
        MemoryStream seekableInput;
        if (!input.CanSeek)
        {
            seekableInput = new MemoryStream();
            input.CopyTo(seekableInput);
            seekableInput.Position = 0;
        }
        else
        {
            seekableInput = new MemoryStream();
            input.Position = 0;
            input.CopyTo(seekableInput);
            seekableInput.Position = 0;
        }

        var output = new MemoryStream();

        var buffer = new byte[2];
        if (seekableInput.Read(buffer, 0, 2) < 2)
        {
            seekableInput.Position = 0;
            seekableInput.CopyTo(output);
            output.Position = 0;
            return output;
        }

        // PNG files don't have EXIF in the same way, just copy
        if (buffer[0] == 0x89 && buffer[1] == 0x50)
        {
            seekableInput.Position = 0;
            seekableInput.CopyTo(output);
            output.Position = 0;
            return output;
        }

        // For JPEG: strip APP1 (EXIF) segments
        seekableInput.Position = 0;
        StripJpegExif(seekableInput, output);
        output.Position = 0;
        return output;
    }

    private static void StripJpegExif(Stream input, Stream output)
    {
        using var reader = new BinaryReader(input, System.Text.Encoding.Default, leaveOpen: true);
        using var writer = new BinaryWriter(output, System.Text.Encoding.Default, leaveOpen: true);

        // Read SOI marker
        var soi = reader.ReadBytes(2);
        if (soi[0] != 0xFF || soi[1] != 0xD8)
        {
            // Not a valid JPEG, copy as-is
            input.Position = 0;
            input.CopyTo(output);
            return;
        }
        writer.Write(soi);

        while (input.Position < input.Length)
        {
            var markerByte1 = reader.ReadByte();
            if (markerByte1 != 0xFF)
            {
                writer.Write(markerByte1);
                continue;
            }

            var markerByte2 = reader.ReadByte();

            // APP1 (EXIF) = 0xFFE1, APP2 = 0xFFE2 - skip these
            if (markerByte2 == 0xE1 || markerByte2 == 0xE2)
            {
                var segLen = (reader.ReadByte() << 8) | reader.ReadByte();
                // Skip the segment data (length includes the 2 length bytes)
                reader.ReadBytes(segLen - 2);
                continue;
            }

            writer.Write(markerByte1);
            writer.Write(markerByte2);

            // SOS marker - rest is image data, copy everything
            if (markerByte2 == 0xDA)
            {
                input.CopyTo(output);
                break;
            }

            // For other markers with length, copy them through
            if (markerByte2 is >= 0xE0 and <= 0xEF or >= 0xC0 and <= 0xCF or 0xDB or 0xC4 or 0xFE or 0xDD)
            {
                if (markerByte2 is 0xC0 or 0xC2 or 0xC4 or 0xDB or 0xFE or 0xDD
                    or >= 0xE0 and <= 0xEF)
                {
                    var lenHi = reader.ReadByte();
                    var lenLo = reader.ReadByte();
                    writer.Write(lenHi);
                    writer.Write(lenLo);
                    var segLen = (lenHi << 8) | lenLo;
                    if (segLen > 2)
                    {
                        var data = reader.ReadBytes(segLen - 2);
                        writer.Write(data);
                    }
                }
            }
        }
    }

    public async Task DeleteAsync(Guid imageId, CancellationToken ct = default)
    {
        var image = await _imageRepo.GetByIdAsync(imageId, ct)
            ?? throw new KeyNotFoundException($"Image {imageId} not found");
        var subfolder = image.Type == ImageType.Guest ? "guests" : "couple";
        await _sftpStorage.DeleteAsync(image.EventId, subfolder, image.Filename, ct);
        await _imageRepo.DeleteAsync(image, ct);
    }

    public async Task<ImageResponse?> UpdateCaptionAsync(Guid imageId, string? caption, CancellationToken ct = default)
    {
        var image = await _imageRepo.GetByIdAsync(imageId, ct);
        if (image is null) return null;
        image.Caption = caption;
        await _imageRepo.UpdateAsync(image, ct);
        return MapToResponse(image);
    }

    private ImageResponse MapToResponse(Image image)
    {
        var subfolder = image.Type == ImageType.Guest ? "guests" : "couple";
        return new ImageResponse
        {
            Id = image.Id,
            EventId = image.EventId,
            Filename = image.Filename,
            Type = image.Type.ToString(),
            CreatedAt = image.CreatedAt,
            Url = $"/api/images/{image.Id}/file",
            DownloadUrl = $"/d/{image.Id}",
            Caption = image.Caption
        };
    }
}
