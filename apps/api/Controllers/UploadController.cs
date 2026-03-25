using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Photobooth.Api.DTOs;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
[Route("api/upload")]
public class UploadController : ControllerBase
{
    private readonly IImageService _imageService;
    private readonly IEventService _eventService;

    public UploadController(IImageService imageService, IEventService eventService)
    {
        _imageService = imageService;
        _eventService = eventService;
    }

    /// <summary>
    /// Validate an upload token for the couple upload page.
    /// GET /api/upload/validate/{eventId}?token=XYZ
    /// Returns event name if valid, 401 if invalid.
    /// </summary>
    [HttpGet("validate/{eventId:guid}")]
    public async Task<IActionResult> ValidateToken(Guid eventId, [FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { error = "Token is required" });

        var ev = await _eventService.ValidateUploadTokenAsync(eventId, token, ct);
        if (ev is null)
            return Unauthorized(new { error = "Invalid or expired upload token" });

        return Ok(new { eventId = ev.Id, name = ev.Name, date = ev.Date });
    }

    /// <summary>
    /// Guest upload endpoint for signed photobooth devices.
    /// POST /api/upload/guest with multipart form: file + optional eventId
    /// </summary>
    [HttpPost("guest")]
    [Authorize(Roles = "Device")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<UploadResponse>> UploadGuest(
        [FromForm] Guid? eventId,
        IFormFile file,
        CancellationToken ct)
    {
        var deviceIdRaw = User.FindFirstValue("deviceId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(deviceIdRaw, out var deviceId))
            return Unauthorized(new { error = "Signed device identity is missing." });

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided" });

        await using var stream = file.OpenReadStream();
        try
        {
            var result = await _imageService.UploadDeviceGuestImageAsync(deviceId, eventId, stream, file.FileName, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Assigned event not found" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Couple upload endpoint — secure link with token.
    /// POST /api/upload/couple/{eventId}?token=XYZ
    /// </summary>
    [HttpPost("couple/{eventId:guid}")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<UploadResponse>> UploadCouple(
        Guid eventId,
        [FromQuery] string token,
        IFormFile file,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { error = "Token is required" });

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file provided" });

        await using var stream = file.OpenReadStream();
        try
        {
            var result = await _imageService.UploadCoupleImageAsync(eventId, token, stream, file.FileName, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { error = "Invalid or expired upload token" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Event not found" });
        }
    }
}
