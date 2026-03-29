using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MimeKit;
using Photobooth.Api.Configuration;
using Photobooth.Api.Data;

namespace Photobooth.Api.Services;

public interface IEmailService
{
    Task SendVerificationEmailAsync(string to, string eventName, string verificationUrl, CancellationToken ct = default);
    Task SendLoginCodeAsync(string to, string code, CancellationToken ct = default);
    Task SendAdminTwoFactorCodeAsync(string to, string code, CancellationToken ct = default);
    Task SendAdminPasswordResetAsync(string to, string loginId, string code, string resetUrl, CancellationToken ct = default);
}

public class EmailService : IEmailService
{
    private readonly SmtpSettings _defaults;
    private readonly PhotoboothDbContext _db;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<SmtpSettings> settings, PhotoboothDbContext db, ILogger<EmailService> logger)
    {
        _defaults = settings.Value;
        _db = db;
        _logger = logger;
    }

    public Task SendVerificationEmailAsync(string to, string eventName, string verificationUrl, CancellationToken ct = default)
    {
        var subject = $"You're invited – verify your access to {eventName}";
        var body = $"""
            <html><body style="font-family:sans-serif;max-width:600px;margin:auto">
              <h2 style="color:#333">Wedding Photo Access</h2>
              <p>You have been invited to access the wedding photos for <strong>{eventName}</strong>.</p>
              <p>Please click the button below to confirm your e-mail address. This link is valid for <strong>48 hours</strong>.</p>
              <p style="margin:32px 0">
                <a href="{verificationUrl}"
                   style="background:#6366f1;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:1rem">
                  Confirm my e-mail
                </a>
              </p>
              <p style="color:#888;font-size:0.85rem">If you weren't expecting this invitation, you can safely ignore this e-mail.</p>
            </body></html>
            """;
        return SendAsync(to, subject, body, ct);
    }

    public Task SendLoginCodeAsync(string to, string code, CancellationToken ct = default)
    {
        var subject = "Your login code";
        var body = $"""
            <html><body style="font-family:sans-serif;max-width:600px;margin:auto">
              <h2 style="color:#333">Login Code</h2>
              <p>Use the following code to log in. It is valid for <strong>10 minutes</strong>.</p>
              <p style="font-size:2.5rem;letter-spacing:0.3em;font-weight:700;color:#6366f1;margin:32px 0">{code}</p>
              <p style="color:#888;font-size:0.85rem">If you didn't request this code, please ignore this e-mail.</p>
            </body></html>
            """;
        return SendAsync(to, subject, body, ct);
    }

    public Task SendAdminTwoFactorCodeAsync(string to, string code, CancellationToken ct = default)
    {
        var subject = "Admin login verification code";
        var body = $"""
            <html><body style="font-family:sans-serif;max-width:600px;margin:auto">
              <h2 style="color:#333">Admin Verification Code</h2>
              <p>Your two-factor verification code for admin access:</p>
              <p style="font-size:2.5rem;letter-spacing:0.3em;font-weight:700;color:#6366f1;margin:32px 0">{code}</p>
              <p style="color:#888;font-size:0.85rem">This code expires in <strong>10 minutes</strong>. If you didn't initiate this login, change your password immediately.</p>
            </body></html>
            """;
        return SendAsync(to, subject, body, ct);
    }

    public Task SendAdminPasswordResetAsync(string to, string loginId, string code, string resetUrl, CancellationToken ct = default)
    {
        var subject = "Reset your admin password";
        var body = $"""
            <html><body style="font-family:sans-serif;max-width:600px;margin:auto">
              <h2 style="color:#333">Admin Password Reset</h2>
              <p>A password reset was requested for the admin account <strong>{loginId}</strong>.</p>
              <p>Use the button below or enter the verification code manually. Both stay valid for <strong>10 minutes</strong>.</p>
              <p style="margin:32px 0">
                <a href="{resetUrl}"
                   style="background:#1f7a5c;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:1rem">
                  Reset admin password
                </a>
              </p>
              <p style="font-size:2.2rem;letter-spacing:0.3em;font-weight:700;color:#1f7a5c;margin:28px 0">{code}</p>
              <p style="color:#888;font-size:0.85rem">If you did not request this reset, you can ignore this e-mail. Existing admin passwords remain unchanged until a new password is submitted successfully.</p>
            </body></html>
            """;
        return SendAsync(to, subject, body, ct);
    }

    private async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct)
    {
        var settings = await ResolveSettingsAsync(ct);
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.FromName, settings.FromAddress));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart(MimeKit.Text.TextFormat.Html) { Text = htmlBody };

        using var client = new SmtpClient();
        try
        {
            var secureSocketOptions = settings.UseSsl
                ? SecureSocketOptions.SslOnConnect
                : settings.UseStartTls
                    ? SecureSocketOptions.StartTlsWhenAvailable
                    : SecureSocketOptions.None;

            await client.ConnectAsync(settings.Host, settings.Port, secureSocketOptions, ct);
            if (!string.IsNullOrWhiteSpace(settings.Username))
                await client.AuthenticateAsync(settings.Username, settings.Password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            _logger.LogInformation("Email sent to {To}: {Subject}", to, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To}: {Subject}", to, subject);
            throw;
        }
    }

    private async Task<SmtpSettings> ResolveSettingsAsync(CancellationToken ct)
    {
        var runtime = await _db.SmtpConfigurations.OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        if (runtime is null)
            return _defaults;

        return new SmtpSettings
        {
            Host = runtime.Host,
            Port = runtime.Port,
            Username = runtime.Username,
            Password = runtime.Password,
            FromAddress = runtime.FromAddress,
            FromName = runtime.FromName,
            UseSsl = runtime.UseSsl,
            UseStartTls = runtime.UseStartTls
        };
    }
}
