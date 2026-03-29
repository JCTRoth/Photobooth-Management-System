using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Photobooth.Api.Configuration;
using Photobooth.Api.Data;
using Photobooth.Api.Models;

namespace Photobooth.Api.Services;

public record TokenPair(string AccessToken, string RefreshToken);
public record RefreshResult(TokenPair Tokens, bool MustChangePassword);

public interface IAuthService
{
    // Admin
    Task<AdminUser?> FindAdminAsync(string identifier, CancellationToken ct = default);
    bool VerifyPassword(AdminUser admin, string password);
    string HashPassword(string password);

    // OTP codes
    Task<string> CreateLoginCodeAsync(Guid subjectId, LoginCodePurpose purpose, Guid? marriageEmailId, CancellationToken ct = default);
    Task<bool> ValidateLoginCodeAsync(Guid subjectId, string code, LoginCodePurpose purpose, CancellationToken ct = default);

    // JWT
    TokenPair IssueTokens(Guid subjectId, string role, string email, Guid? eventId = null, bool mustChangePassword = false);
    ClaimsPrincipal? ValidateAccessToken(string token);

    // Refresh tokens
    Task<RefreshResult?> RotateRefreshTokenAsync(string rawRefreshToken, CancellationToken ct = default);
    Task RevokeRefreshTokenAsync(string rawRefreshToken, CancellationToken ct = default);
    Task RevokeAllRefreshTokensAsync(Guid subjectId, string role, CancellationToken ct = default);

    // Marriage verification
    Task<string> CreateVerificationTokenAsync(MarriageEmail me, CancellationToken ct = default);
    Task<MarriageEmail?> ConsumeVerificationTokenAsync(string token, CancellationToken ct = default);
}

public class AuthService : IAuthService
{
    private static readonly TimeSpan CodeTtl = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan VerificationTtl = TimeSpan.FromHours(48);
    private const int MaxActiveCodesPerSubject = 5;

    private readonly PhotoboothDbContext _db;
    private readonly JwtSettings _jwt;
    private readonly PasswordHasher<AdminUser> _hasher = new();

    public AuthService(PhotoboothDbContext db, IOptions<JwtSettings> jwt)
    {
        _db = db;
        _jwt = jwt.Value;
    }

    // ---------- Admin ----------

    public Task<AdminUser?> FindAdminAsync(string identifier, CancellationToken ct = default)
    {
        var normalized = identifier.Trim().ToLowerInvariant();
        return _db.AdminUsers.FirstOrDefaultAsync(a =>
            a.IsActive && (a.LoginId.ToLower() == normalized || a.Email.ToLower() == normalized), ct)!;
    }

    public bool VerifyPassword(AdminUser admin, string password)
        => _hasher.VerifyHashedPassword(admin, admin.PasswordHash, password) != PasswordVerificationResult.Failed;

    public string HashPassword(string password)
        => _hasher.HashPassword(new AdminUser { LoginId = "placeholder", Email = "placeholder@localhost", PasswordHash = "" }, password);

    // ---------- OTP Codes ----------

    public async Task<string> CreateLoginCodeAsync(Guid subjectId, LoginCodePurpose purpose, Guid? marriageEmailId, CancellationToken ct = default)
    {
        // Invalidate old unused codes for the same subject+purpose
        var old = await _db.LoginCodes
            .Where(c => c.SubjectId == subjectId && c.Purpose == purpose && c.UsedAt == null)
            .ToListAsync(ct);
        _db.LoginCodes.RemoveRange(old);

        var code = GenerateOtp();
        _db.LoginCodes.Add(new LoginCode
        {
            SubjectId = subjectId,
            Purpose = purpose,
            Code = code,
            ExpiresAt = DateTime.UtcNow.Add(CodeTtl),
            MarriageEmailId = marriageEmailId
        });
        await _db.SaveChangesAsync(ct);
        return code;
    }

    public async Task<bool> ValidateLoginCodeAsync(Guid subjectId, string code, LoginCodePurpose purpose, CancellationToken ct = default)
    {
        var entry = await _db.LoginCodes.FirstOrDefaultAsync(c =>
            c.SubjectId == subjectId &&
            c.Purpose == purpose &&
            c.Code == code &&
            c.UsedAt == null &&
            c.ExpiresAt > DateTime.UtcNow, ct);

        if (entry is null) return false;

        entry.UsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // ---------- JWT ----------

    public TokenPair IssueTokens(Guid subjectId, string role, string email, Guid? eventId = null, bool mustChangePassword = false)
    {
        var accessToken = BuildAccessToken(subjectId, role, email, eventId, mustChangePassword);
        var rawRefresh = GenerateRawToken();
        var refreshHash = HashToken(rawRefresh);

        _db.RefreshTokens.Add(new RefreshToken
        {
            SubjectId = subjectId,
            Role = role,
            TokenHash = refreshHash,
            ExpiresAt = DateTime.UtcNow.AddHours(_jwt.RefreshTokenHours)
        });
        _db.SaveChanges();

        return new TokenPair(accessToken, rawRefresh);
    }

    public ClaimsPrincipal? ValidateAccessToken(string token)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var handler = new JwtSecurityTokenHandler();
        try
        {
            return handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _jwt.Issuer,
                ValidateAudience = true,
                ValidAudience = _jwt.Audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out _);
        }
        catch
        {
            return null;
        }
    }

    // ---------- Refresh Token Rotation ----------

    public async Task<RefreshResult?> RotateRefreshTokenAsync(string rawRefreshToken, CancellationToken ct = default)
    {
        var hash = HashToken(rawRefreshToken);
        var stored = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash, ct);

        if (stored is null || !stored.IsActive)
        {
            // Reuse detected – revoke entire family
            if (stored is not null)
            {
                stored.RevokedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }
            return null;
        }

        // Look up the subject's email from the appropriate table
        string email;
        Guid? eventId = null;
        var mustChangePassword = false;

        if (stored.Role == "Admin")
        {
            var admin = await _db.AdminUsers.FindAsync([stored.SubjectId], ct);
            if (admin is null) return null;
            email = admin.Email;
            mustChangePassword = admin.MustChangePassword;
        }
        else
        {
            var me = await _db.MarriageEmails.FindAsync([stored.SubjectId], ct);
            if (me is null) return null;
            email = me.Email;
            eventId = me.EventId;
        }

        // Revoke old token
        stored.RevokedAt = DateTime.UtcNow;

        // Issue new pair
        var newPair = IssueTokens(stored.SubjectId, stored.Role, email, eventId, mustChangePassword);
        await _db.SaveChangesAsync(ct);
        return new RefreshResult(newPair, mustChangePassword);
    }

    public async Task RevokeRefreshTokenAsync(string rawRefreshToken, CancellationToken ct = default)
    {
        var hash = HashToken(rawRefreshToken);
        var stored = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.TokenHash == hash, ct);
        if (stored is not null)
        {
            stored.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task RevokeAllRefreshTokensAsync(Guid subjectId, string role, CancellationToken ct = default)
    {
        var activeTokens = await _db.RefreshTokens
            .Where(r => r.SubjectId == subjectId && r.Role == role && r.RevokedAt == null && r.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(ct);

        if (activeTokens.Count == 0)
            return;

        var revokedAt = DateTime.UtcNow;
        foreach (var token in activeTokens)
            token.RevokedAt = revokedAt;

        await _db.SaveChangesAsync(ct);
    }

    // ---------- Marriage Email Verification ----------

    public async Task<string> CreateVerificationTokenAsync(MarriageEmail me, CancellationToken ct = default)
    {
        var raw = GenerateRawToken();
        me.VerificationToken = raw;
        me.TokenExpiresAt = DateTime.UtcNow.Add(VerificationTtl);
        me.LastSentAt = DateTime.UtcNow;
        me.Status = MarriageEmailStatus.Pending;
        await _db.SaveChangesAsync(ct);
        return raw;
    }

    public async Task<MarriageEmail?> ConsumeVerificationTokenAsync(string token, CancellationToken ct = default)
    {
        var me = await _db.MarriageEmails
            .Include(m => m.Event)
            .FirstOrDefaultAsync(m =>
                m.VerificationToken == token &&
                m.Status == MarriageEmailStatus.Pending &&
                m.TokenExpiresAt > DateTime.UtcNow, ct);

        if (me is null) return null;

        me.Status = MarriageEmailStatus.Confirmed;
        me.VerifiedAt = DateTime.UtcNow;
        me.VerificationToken = null;
        me.TokenExpiresAt = null;
        await _db.SaveChangesAsync(ct);
        return me;
    }

    // ---------- Helpers ----------

    private string BuildAccessToken(Guid subjectId, string role, string email, Guid? eventId, bool mustChangePassword)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, subjectId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(ClaimTypes.Role, role),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        if (eventId.HasValue)
            claims.Add(new Claim("eventId", eventId.Value.ToString()));
        if (role == "Admin")
            claims.Add(new Claim("mustChangePassword", mustChangePassword ? "true" : "false"));

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwt.AccessTokenMinutes),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateOtp()
    {
        // Cryptographically secure 6-digit OTP (000000–999999)
        var bytes = RandomNumberGenerator.GetBytes(4);
        var value = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
        return value.ToString("D6");
    }

    private static string GenerateRawToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    private static string HashToken(string raw)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToBase64String(hashBytes);
    }
}
