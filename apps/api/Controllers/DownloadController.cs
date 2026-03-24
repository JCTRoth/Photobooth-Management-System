using Microsoft.AspNetCore.Mvc;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
public class DownloadController : ControllerBase
{
    private readonly IImageService _imageService;
    private readonly IZipService _zipService;

    public DownloadController(IImageService imageService, IZipService zipService)
    {
        _imageService = imageService;
        _zipService = zipService;
    }

    /// <summary>
    /// Public download page data:  GET /d/{imageId}
    /// Returns image metadata + URLs for the frontend to render.
    /// </summary>
    [HttpGet("d/{imageId:guid}")]
    public async Task<IActionResult> GetDownloadPage(Guid imageId, CancellationToken ct)
    {
        var image = await _imageService.GetByIdAsync(imageId, ct);
        if (image is null) return NotFound();

        return Ok(new
        {
            image.Id,
            image.Filename,
            image.Type,
            ImageUrl = $"/api/images/{imageId}/file",
            ZipUrl = $"/api/download/{imageId}/zip"
        });
    }

    /// <summary>
    /// Stream a ZIP containing the guest photo + all couple photos.
    /// GET /api/download/{imageId}/zip
    /// </summary>
    [HttpGet("api/download/{imageId:guid}/zip")]
    public async Task GetZip(Guid imageId, CancellationToken ct)
    {
        // Verify image exists before starting the response stream
        var image = await _imageService.GetByIdAsync(imageId, ct);
        if (image is null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            await Response.WriteAsJsonAsync(new { error = "Image not found" }, ct);
            return;
        }

        Response.ContentType = "application/zip";
        Response.Headers.Append("Content-Disposition", $"attachment; filename=\"photobooth-{imageId}.zip\"");

        try
        {
            // ZipArchive uses sync writes internally; buffer to MemoryStream first
            using var buffer = new MemoryStream();
            await _zipService.WriteZipToStreamAsync(imageId, buffer, ct);
            buffer.Position = 0;
            await buffer.CopyToAsync(Response.Body, ct);
        }
        catch (KeyNotFoundException)
        {
            // Response already started, can't change status code
            // The client will get a truncated/invalid ZIP
        }
    }
}
