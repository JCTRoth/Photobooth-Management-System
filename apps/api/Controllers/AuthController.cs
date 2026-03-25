using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Photobooth.Api.Data;
using Photobooth.Api.Models;
using Photobooth.Api.Services;

namespace Photobooth.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const string RefreshTokenCookie = "refresh_token";
    private const int MaxCodeRequestsPerEmailPerHour = 20;
    private static readonly CookieOptions RefreshCookieOptions = new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Lax,
        MaxAge = TimeSpan.FromHours(72)
    };

    private readonly IAuthService _auth;
    private readonly IEmailService _email;
    private readonly PhotoboothDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly ILogger<AuthController> _logger;
    private readonly ISmtpConfigurationService _smtpConfig;

    public AuthController(
        IAuthService auth,
        IEmailService email,
        PhotoboothDbContext db,
        IMemoryCache cache,
        ILogger<AuthController> logger,
        ISmtpConfigurationService smtpConfig)
    {
        _auth = auth;
        _email = email;
        _db = db;
        _cache = cache;
        _logger = logger;
        _smtpConfig = smtpConfig;
    }

    // ==================== Admin Login (2-step) ====================

    /// <summary>
    /// Step 1 - verify identifier+password.
    /// If SMTP is ready, send 2FA code and require step 2.
    /// If SMTP is not ready yet, directly issue tokens.
    /// </summary>
    [HttpPost("admin/login")]
    public async Task<IActionResult> AdminLogin([FromBody] AdminLoginRequest req, CancellationToken ct)
    {
        var admin = await _auth.FindAdminAsync(req.Identifier, ct);
        if (admin is null || !_auth.VerifyPassword(admin, req.Password))
            return Unauthorized(new { error = "Invalid credentials" });

        admin.LastLoginAt = DateTime.UtcNow;

        var otpReady = await _smtpConfig.IsOtpReadyAsync(ct);
        if (!otpReady)
        {
            await _db.SaveChangesAsync(ct);
            var pair = _auth.IssueTokens(admin.Id, "Admin", admin.Email, null, admin.MustChangePassword);
            SetRefreshCookie(pair.RefreshToken);
            return Ok(new
            {
                requiresCode = false,
                accessToken = pair.AccessToken,
                role = "Admin",
                mustChangePassword = admin.MustChangePassword
            });
        }

        if (!CheckEmailRateLimit(admin.Email))
            return StatusCode(429, new { error = "Too many requests, please try again later." });

        var code = await _auth.CreateLoginCodeAsync(admin.Id, LoginCodePurpose.AdminTwoFactor, null, ct);
        await _email.SendAdminTwoFactorCodeAsync(admin.Email, code, ct);
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            requiresCode = true,
            message = "Verification code sent to your e-mail."
        });
    }

    /// <summary>Step 2 – verify 2FA code, issue tokens.</summary>
    [HttpPost("admin/verify")]
    public async Task<IActionResult> AdminVerify([FromBody] AdminVerifyRequest req, CancellationToken ct)
    {
        var admin = await _auth.FindAdminAsync(req.Identifier, ct);
        if (admin is null) return Unauthorized(new { error = "Invalid request" });

        var valid = await _auth.ValidateLoginCodeAsync(admin.Id, req.Code, LoginCodePurpose.AdminTwoFactor, ct);
        if (!valid) return Unauthorized(new { error = "Invalid or expired code" });

        admin.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var tokens = _auth.IssueTokens(admin.Id, "Admin", admin.Email, null, admin.MustChangePassword);
        SetRefreshCookie(tokens.RefreshToken);

        return Ok(new
        {
            accessToken = tokens.AccessToken,
            role = "Admin",
            mustChangePassword = admin.MustChangePassword
        });
    }

    // ==================== Marriage Login (OTP) ====================

    /// <summary>Request a 6-digit OTP for a confirmed marriage email.</summary>
    [HttpPost("marriage/request")]
    public async Task<IActionResult> MarriageRequestCode([FromBody] MarriageLoginRequest req, CancellationToken ct)
    {
        if (!CheckEmailRateLimit(req.Email))
            return StatusCode(429, new { error = "Too many requests, please try again later." });

        var me = await _db.MarriageEmails
            .Include(m => m.Event)
            .FirstOrDefaultAsync(m => m.Email == req.Email.ToLowerInvariant() && m.Status == MarriageEmailStatus.Confirmed, ct);

        if (me is null)
            return Ok(new { message = "If that e-mail is registered, a code has been sent." }); // no enumeration

        var code = await _auth.CreateLoginCodeAsync(me.Id, LoginCodePurpose.MarriageLogin, me.Id, ct);
        await _email.SendLoginCodeAsync(me.Email, code, ct);

        return Ok(new { message = "If that e-mail is registered, a code has been sent." });
    }

    /// <summary>Exchange OTP for tokens.</summary>
    [HttpPost("marriage/verify")]
    public async Task<IActionResult> MarriageVerify([FromBody] MarriageVerifyRequest req, CancellationToken ct)
    {
        var me = await _db.MarriageEmails
            .Include(m => m.Event)
            .FirstOrDefaultAsync(m => m.Email == req.Email.ToLowerInvariant() && m.Status == MarriageEmailStatus.Confirmed, ct);

        if (me is null) return Unauthorized(new { error = "Invalid or expired code" });

        var valid = await _auth.ValidateLoginCodeAsync(me.Id, req.Code, LoginCodePurpose.MarriageLogin, ct);
        if (!valid) return Unauthorized(new { error = "Invalid or expired code" });

        me.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var tokens = _auth.IssueTokens(me.Id, "MarriageUser", me.Email, me.EventId);
        SetRefreshCookie(tokens.RefreshToken);

        return Ok(new
        {
            accessToken = tokens.AccessToken,
            role = "MarriageUser",
            eventId = me.EventId,
            eventName = me.Event?.Name
        });
    }

    // ==================== Email Verification ====================

    /// <summary>Called when the invited person clicks the verification link.</summary>
    [HttpGet("marriage/confirm")]
    public async Task<IActionResult> ConfirmEmail([FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(token)) return BadRequest();

        var me = await _auth.ConsumeVerificationTokenAsync(token, ct);
        if (me is null)
            return BadRequest(new { error = "Verification link is invalid or has expired." });

        // Redirect the browser to the landing page guest login after confirmation
        return Redirect($"/?verified=1&email={Uri.EscapeDataString(me.Email)}");
    }

    // ==================== Token Refresh ====================

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        var raw = Request.Cookies[RefreshTokenCookie];
        if (string.IsNullOrEmpty(raw)) return Unauthorized();

        var result = await _auth.RotateRefreshTokenAsync(raw, ct);
        if (result is null)
        {
            Response.Cookies.Delete(RefreshTokenCookie);
            return Unauthorized(new { error = "Session expired, please log in again." });
        }

        SetRefreshCookie(result.Tokens.RefreshToken);
        return Ok(new
        {
            accessToken = result.Tokens.AccessToken,
            mustChangePassword = result.MustChangePassword
        });
    }

    // ==================== Logout ====================

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var raw = Request.Cookies[RefreshTokenCookie];
        if (!string.IsNullOrEmpty(raw))
            await _auth.RevokeRefreshTokenAsync(raw, ct);

        Response.Cookies.Delete(RefreshTokenCookie);
        return NoContent();
    }

    // ==================== First-time Admin Setup ====================

    /// <summary>
    /// Creates the first admin account. Only works when no admin users exist yet.
    /// POST /api/auth/admin/setup
    /// </summary>
    [HttpPost("admin/setup")]
    public async Task<IActionResult> AdminSetup([FromBody] AdminSetupRequest req, CancellationToken ct)
    {
        if (await _db.AdminUsers.AnyAsync(ct))
            return Conflict(new { error = "Admin account already exists." });

        var admin = new AdminUser
        {
            LoginId = req.LoginId,
            Email = req.Email.ToLowerInvariant(),
            PasswordHash = _auth.HashPassword(req.Password),
            IsActive = true,
            MustChangePassword = true,
            IsBootstrap = true
        };
        _db.AdminUsers.Add(admin);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Initial admin account created for {Email}", admin.Email);
        return Ok(new { message = "Admin account created. You can now log in." });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("admin/change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req, CancellationToken ct)
    {
        var subject = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(subject, out var adminId)) return Unauthorized();

        var admin = await _db.AdminUsers.FirstOrDefaultAsync(a => a.Id == adminId && a.IsActive, ct);
        if (admin is null) return Unauthorized();

        if (!_auth.VerifyPassword(admin, req.CurrentPassword))
            return BadRequest(new { error = "Current password is incorrect." });

        admin.PasswordHash = _auth.HashPassword(req.NewPassword);
        admin.MustChangePassword = false;
        admin.IsBootstrap = false;
        if (!string.IsNullOrWhiteSpace(req.Email))
            admin.Email = req.Email.Trim().ToLowerInvariant();
        admin.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Password updated." });
    }

    // ==================== Helpers ====================

    private void SetRefreshCookie(string token)
        => Response.Cookies.Append(RefreshTokenCookie, token, RefreshCookieOptions);

    /// <summary>
    /// Enforce 20 code-request attempts per email per hour using in-memory sliding window.
    /// Returns false if the limit is exceeded.
    /// </summary>
    private bool CheckEmailRateLimit(string email)
    {
        var key = $"coderatelimit:{email.ToLowerInvariant()}";
        var count = _cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            return 0;
        });
        if (count >= MaxCodeRequestsPerEmailPerHour) return false;
        _cache.Set(key, count + 1, TimeSpan.FromHours(1));
        return true;
    }
}

// --- DTOs ---

public record AdminLoginRequest
{
    [Required, MinLength(1)] public required string Identifier { get; init; }
    [Required] public required string Password { get; init; }
}

public record AdminVerifyRequest
{
    [Required, MinLength(1)] public required string Identifier { get; init; }
    [Required, MinLength(6), MaxLength(6)] public required string Code { get; init; }
}

public record MarriageLoginRequest
{
    [Required, EmailAddress] public required string Email { get; init; }
}

public record MarriageVerifyRequest
{
    [Required, EmailAddress] public required string Email { get; init; }
    [Required, MinLength(6), MaxLength(6)] public required string Code { get; init; }
}

public record AdminSetupRequest
{
    [Required, MinLength(1)] public required string LoginId { get; init; }
    [Required, EmailAddress] public required string Email { get; init; }
    [Required, MinLength(12)] public required string Password { get; init; }
}

public record ChangePasswordRequest
{
    [Required, MinLength(1)] public required string CurrentPassword { get; init; }
    [Required, MinLength(12)] public required string NewPassword { get; init; }
    [EmailAddress] public string? Email { get; init; }
}
