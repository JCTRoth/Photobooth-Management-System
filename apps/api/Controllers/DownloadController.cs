using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
public class DownloadController : ControllerBase
{
    private readonly IImageService _imageService;
    private readonly IEventService _eventService;
    private readonly IZipService _zipService;

    public DownloadController(IImageService imageService, IEventService eventService, IZipService zipService)
    {
        _imageService = imageService;
        _eventService = eventService;
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

    /// <summary>
    /// Stream a ZIP containing all photos from one event.
    /// GET /api/download/events/{eventId}/zip
    /// </summary>
    [Authorize(Roles = "Admin,MarriageUser")]
    [HttpGet("api/download/events/{eventId:guid}/zip")]
    public async Task<IActionResult> GetEventZip(Guid eventId, CancellationToken ct)
    {
        if (User.IsInRole("MarriageUser"))
        {
            var eventClaim = User.FindFirstValue("eventId");
            if (!Guid.TryParse(eventClaim, out var claimEventId) || claimEventId != eventId)
            {
                return Forbid();
            }
        }

        var ev = await _eventService.GetByIdAsync(eventId, ct);
        if (ev is null)
        {
            return NotFound(new { error = "Event not found" });
        }

        var fileName = $"photobooth-{eventId}-photos.zip";
        Response.ContentType = "application/zip";
        Response.Headers.Append("Content-Disposition", $"attachment; filename=\"{fileName}\"");

        try
        {
            using var buffer = new MemoryStream();
            await _zipService.WriteEventZipToStreamAsync(eventId, buffer, ct);
            buffer.Position = 0;
            await buffer.CopyToAsync(Response.Body, ct);
            return new EmptyResult();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Unable to build ZIP for this event" });
        }
    }
}
