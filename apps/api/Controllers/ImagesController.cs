using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Photobooth.Api.DTOs;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
[Route("api/images")]
public class ImagesController : ControllerBase
{
    private readonly IImageService _imageService;

    public ImagesController(IImageService imageService)
    {
        _imageService = imageService;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ImageResponse>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _imageService.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Serve the actual image file from SFTP
    /// </summary>
    [HttpGet("{id:guid}/file")]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetFile(Guid id, CancellationToken ct)
    {
        try
        {
            var image = await _imageService.GetByIdAsync(id, ct);
            if (image is null) return NotFound();

            var stream = await _imageService.GetImageStreamAsync(id, ct);
            var contentType = image.Filename.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
                ? "image/png"
                : "image/jpeg";

            return File(stream, contentType, image.Filename);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    /// <summary>
    /// Delete an image. Requires Admin role or MarriageUser with access to the event.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,MarriageUser")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            var image = await _imageService.GetByIdAsync(id, ct);
            if (image is null) return NotFound();

            // MarriageUser may only delete images from their own event
            if (User.IsInRole("MarriageUser"))
            {
                var eventIdClaim = User.FindFirst("eventId")?.Value;
                if (eventIdClaim is null || image.EventId.ToString() != eventIdClaim)
                    return Forbid();
            }

            await _imageService.DeleteAsync(id, ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    /// <summary>
    /// Update image caption. Requires Admin role or MarriageUser with access to the event.
    /// </summary>
    [HttpPatch("{id:guid}/caption")]
    [Authorize(Roles = "Admin,MarriageUser")]
    public async Task<ActionResult<ImageResponse>> UpdateCaption(Guid id, [FromBody] UpdateCaptionRequest req, CancellationToken ct)
    {
        var image = await _imageService.GetByIdAsync(id, ct);
        if (image is null) return NotFound();

        if (User.IsInRole("MarriageUser"))
        {
            var eventIdClaim = User.FindFirst("eventId")?.Value;
            if (eventIdClaim is null || image.EventId.ToString() != eventIdClaim)
                return Forbid();
        }

        var updated = await _imageService.UpdateCaptionAsync(id, req.Caption, ct);
        return updated is null ? NotFound() : Ok(updated);
    }
}

