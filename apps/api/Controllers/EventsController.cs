using Microsoft.AspNetCore.Mvc;
using Photobooth.Api.DTOs;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
[Route("api/events")]
public class EventsController : ControllerBase
{
    private readonly IEventService _eventService;
    private readonly IImageService _imageService;

    public EventsController(IEventService eventService, IImageService imageService)
    {
        _eventService = eventService;
        _imageService = imageService;
    }

    [HttpGet]
    public async Task<ActionResult<EventListResponse>> GetAll(CancellationToken ct)
    {
        var result = await _eventService.GetAllAsync(ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EventResponse>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _eventService.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<EventResponse>> Create([FromBody] CreateEventRequest request, CancellationToken ct)
    {
        var result = await _eventService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EventResponse>> Update(Guid id, [FromBody] UpdateEventRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _eventService.UpdateAsync(id, request, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            await _eventService.DeleteAsync(id, ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    /// <summary>
    /// Get all images for an event (used by slideshow)
    /// </summary>
    [HttpGet("{id:guid}/images")]
    public async Task<ActionResult<ImageListResponse>> GetImages(Guid id, CancellationToken ct)
    {
        var ev = await _eventService.GetByIdAsync(id, ct);
        if (ev is null) return NotFound();

        var result = await _imageService.GetByEventIdAsync(id, ct);
        return Ok(result);
    }
}
