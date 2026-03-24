using Microsoft.Extensions.Options;
using Photobooth.Api.Configuration;

namespace Photobooth.Api.Middleware;

public class FileValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly UploadSettings _uploadSettings;

    public FileValidationMiddleware(RequestDelegate next, IOptions<UploadSettings> uploadSettings)
    {
        _next = next;
        _uploadSettings = uploadSettings.Value;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Enable request buffering so the stream can be read multiple times
        // (once here for validation, again in the controller for upload)
        context.Request.EnableBuffering();

        // Only validate file uploads on upload endpoints
        if (context.Request.Path.StartsWithSegments("/api/upload")
            && context.Request.HasFormContentType
            && context.Request.Form.Files.Count > 0)
        {
            foreach (var file in context.Request.Form.Files)
            {
                if (file.Length > _uploadSettings.MaxFileSizeBytes)
                {
                    context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
                    await context.Response.WriteAsJsonAsync(new { error = $"File size exceeds maximum of {_uploadSettings.MaxFileSizeBytes / (1024 * 1024)}MB" });
                    return;
                }

                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!_uploadSettings.AllowedExtensions.Contains(extension))
                {
                    context.Response.StatusCode = StatusCodes.Status415UnsupportedMediaType;
                    await context.Response.WriteAsJsonAsync(new { error = $"File type '{extension}' is not allowed. Allowed: {string.Join(", ", _uploadSettings.AllowedExtensions)}" });
                    return;
                }

                if (!_uploadSettings.AllowedContentTypes.Contains(file.ContentType.ToLowerInvariant()))
                {
                    context.Response.StatusCode = StatusCodes.Status415UnsupportedMediaType;
                    await context.Response.WriteAsJsonAsync(new { error = "Invalid content type" });
                    return;
                }

                // Validate magic bytes
                if (!await IsValidImageAsync(file))
                {
                    context.Response.StatusCode = StatusCodes.Status415UnsupportedMediaType;
                    await context.Response.WriteAsJsonAsync(new { error = "File content does not match a valid image format" });
                    return;
                }
            }
        }

        await _next(context);
    }

    private static async Task<bool> IsValidImageAsync(IFormFile file)
    {
        using var stream = file.OpenReadStream();
        var header = new byte[8];
        var bytesRead = await stream.ReadAsync(header);
        if (bytesRead < 2) return false;

        // JPEG: FF D8 FF
        if (header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return true;

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (bytesRead >= 8 &&
            header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
            header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
            return true;

        return false;
    }
}
