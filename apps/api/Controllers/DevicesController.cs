using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Photobooth.Api.DTOs;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
[Route("api/devices")]
public class DevicesController : ControllerBase
{
    private readonly IDeviceService _deviceService;

    public DevicesController(IDeviceService deviceService)
    {
        _deviceService = deviceService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<RegisterDeviceResponse>> Register([FromBody] RegisterDeviceRequest request, CancellationToken ct)
    {
        var result = await _deviceService.RegisterAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.DeviceId }, result);
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<DeviceListResponse>> GetAll(CancellationToken ct)
    {
        var result = await _deviceService.GetAllAsync(ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<DeviceDetailResponse>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _deviceService.GetByIdAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPut("{id:guid}/assignment")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<DeviceDetailResponse>> AssignEvent(Guid id, [FromBody] AssignDeviceEventRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _deviceService.AssignEventAsync(id, request.EventId, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            await _deviceService.DeleteAsync(id, ct);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("{id:guid}/config")]
    [Authorize(Roles = "Admin,Device")]
    public async Task<ActionResult<DeviceConfigResponse>> GetConfig(Guid id, CancellationToken ct)
    {
        if (User.IsInRole("Device") && CurrentDeviceId() != id)
            return Forbid();

        var result = await _deviceService.GetConfigAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("heartbeat")]
    [Authorize(Roles = "Device")]
    public async Task<ActionResult<DeviceHeartbeatResponse>> Heartbeat([FromBody] DeviceHeartbeatRequest request, CancellationToken ct)
    {
        if (CurrentDeviceId() != request.DeviceId)
            return Forbid();

        try
        {
            var result = await _deviceService.ProcessHeartbeatAsync(request, ct);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    private Guid? CurrentDeviceId()
    {
        var raw = User.FindFirstValue("deviceId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
