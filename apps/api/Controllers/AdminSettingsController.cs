using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
[Route("api/admin/settings")]
[Authorize(Roles = "Admin")]
public class AdminSettingsController : ControllerBase
{
    private readonly ISmtpConfigurationService _smtp;

    public AdminSettingsController(ISmtpConfigurationService smtp)
    {
        _smtp = smtp;
    }

    [HttpGet("smtp")]
    public async Task<IActionResult> GetSmtp(CancellationToken ct)
    {
        var config = await _smtp.GetAsync(ct);
        return Ok(config);
    }

    [HttpPut("smtp")]
    public async Task<IActionResult> SaveSmtp([FromBody] SaveSmtpSettingsRequest req, CancellationToken ct)
    {
        var config = await _smtp.SaveAsync(new SaveSmtpConfigRequest(
            req.Host,
            req.Port,
            req.Username,
            req.Password,
            req.FromAddress,
            req.FromName,
            req.UseSsl,
            req.UseStartTls), ct);

        return Ok(config);
    }

    [HttpPost("smtp/test")]
    public async Task<IActionResult> TestSmtp([FromBody] TestSmtpRequest req, CancellationToken ct)
    {
        var result = await _smtp.TestAndVerifyAsync(req.RecipientEmail, ct);
        if (!result.Success) return BadRequest(new { error = result.Message, otpReady = result.OtpReady });

        return Ok(new { message = result.Message, otpReady = result.OtpReady });
    }
}

public record SaveSmtpSettingsRequest
{
    [Required, MinLength(1)] public required string Host { get; init; }
    [Range(1, 65535)] public int Port { get; init; } = 587;
    [Required] public required string Username { get; init; }
    [Required] public required string Password { get; init; }
    [Required, EmailAddress] public required string FromAddress { get; init; }
    [Required] public required string FromName { get; init; }
    public bool UseSsl { get; init; }
    public bool UseStartTls { get; init; } = true;
}

public record TestSmtpRequest
{
    [Required, EmailAddress] public required string RecipientEmail { get; init; }
}
