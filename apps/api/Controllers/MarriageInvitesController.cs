using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Photobooth.Api.Configuration;
using Photobooth.Api.Data;
using Photobooth.Api.Models;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/invites")]
[Authorize(Roles = "Admin")]
public class MarriageInvitesController : ControllerBase
{
    private readonly PhotoboothDbContext _db;
    private readonly IAuthService _auth;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;

    public MarriageInvitesController(PhotoboothDbContext db, IAuthService auth, IEmailService email, IConfiguration config)
    {
        _db = db;
        _auth = auth;
        _email = email;
        _config = config;
    }

    /// <summary>List all invited emails and their verification status.</summary>
    [HttpGet]
    public async Task<IActionResult> List(Guid eventId, CancellationToken ct)
    {
        var ev = await _db.Events.FindAsync([eventId], ct);
        if (ev is null) return NotFound();

        var items = await _db.MarriageEmails
            .Where(m => m.EventId == eventId)
            .OrderBy(m => m.Email)
            .Select(m => new MarriageEmailStatusDto
            {
                Id = m.Id,
                Email = m.Email,
                Status = m.Status.ToString(),
                VerifiedAt = m.VerifiedAt,
                LastSentAt = m.LastSentAt
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    /// <summary>Add one or more email addresses to a marriage event.</summary>
    [HttpPost]
    public async Task<IActionResult> Add(Guid eventId, [FromBody] AddInvitesRequest req, CancellationToken ct)
    {
        var ev = await _db.Events.FindAsync([eventId], ct);
        if (ev is null) return NotFound();

        var results = new List<MarriageEmailStatusDto>();

        foreach (var rawEmail in req.Emails)
        {
            var email = rawEmail.Trim().ToLowerInvariant();
            var existing = await _db.MarriageEmails.FirstOrDefaultAsync(
                m => m.EventId == eventId && m.Email == email, ct);

            if (existing is not null)
            {
                results.Add(new MarriageEmailStatusDto { Id = existing.Id, Email = email, Status = existing.Status.ToString(), VerifiedAt = existing.VerifiedAt, LastSentAt = existing.LastSentAt });
                continue;
            }

            var me = new MarriageEmail { EventId = eventId, Email = email };
            _db.MarriageEmails.Add(me);
            await _db.SaveChangesAsync(ct);

            await SendVerificationAsync(me, ev.Name, ct);
            results.Add(new MarriageEmailStatusDto { Id = me.Id, Email = email, Status = me.Status.ToString(), VerifiedAt = me.VerifiedAt, LastSentAt = me.LastSentAt });
        }

        return Ok(results);
    }

    /// <summary>Resend a verification e-mail to a specific address.</summary>
    [HttpPost("{inviteId:guid}/resend")]
    public async Task<IActionResult> Resend(Guid eventId, Guid inviteId, CancellationToken ct)
    {
        var me = await _db.MarriageEmails
            .Include(m => m.Event)
            .FirstOrDefaultAsync(m => m.Id == inviteId && m.EventId == eventId, ct);

        if (me is null) return NotFound();
        if (me.Status == MarriageEmailStatus.Confirmed)
            return BadRequest(new { error = "E-mail already confirmed." });

        await SendVerificationAsync(me, me.Event!.Name, ct);
        return Ok(new { message = "Verification e-mail resent." });
    }

    /// <summary>Remove an email from a marriage event.</summary>
    [HttpDelete("{inviteId:guid}")]
    public async Task<IActionResult> Remove(Guid eventId, Guid inviteId, CancellationToken ct)
    {
        var me = await _db.MarriageEmails
            .FirstOrDefaultAsync(m => m.Id == inviteId && m.EventId == eventId, ct);

        if (me is null) return NotFound();

        _db.MarriageEmails.Remove(me);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task SendVerificationAsync(MarriageEmail me, string eventName, CancellationToken ct)
    {
        var token = await _auth.CreateVerificationTokenAsync(me, ct);
        var baseUrl = _config["AppBaseUrl"] ?? "http://localhost:5173";
        var url = $"{baseUrl}/api/auth/marriage/confirm?token={Uri.EscapeDataString(token)}";
        await _email.SendVerificationEmailAsync(me.Email, eventName, url, ct);
    }
}

public class MarriageEmailStatusDto
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    public required string Status { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime? LastSentAt { get; set; }
}

public record AddInvitesRequest
{
    [Required, MinLength(1)]
    public required List<string> Emails { get; init; }
}
