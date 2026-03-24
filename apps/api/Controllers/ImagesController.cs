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
}
