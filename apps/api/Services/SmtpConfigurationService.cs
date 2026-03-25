using System.Net.Sockets;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MimeKit;
using Photobooth.Api.Configuration;
using Photobooth.Api.Data;
using Photobooth.Api.Models;

namespace Photobooth.Api.Services;

public record SmtpConfigDto(
    string Host,
    int Port,
    string Username,
    string Password,
    string FromAddress,
    string FromName,
    bool UseSsl,
    bool UseStartTls,
    bool IsVerified,
    DateTime? VerifiedAt);

public record SaveSmtpConfigRequest(
    string Host,
    int Port,
    string Username,
    string Password,
    string FromAddress,
    string FromName,
    bool UseSsl,
    bool UseStartTls);

public record SmtpTestResult(
    bool Success,
    bool OtpReady,
    string Message);

public interface ISmtpConfigurationService
{
    Task<SmtpConfigDto> GetAsync(CancellationToken ct = default);
    Task<SmtpConfigDto> SaveAsync(SaveSmtpConfigRequest req, CancellationToken ct = default);
    Task<SmtpTestResult> TestAndVerifyAsync(string recipientEmail, CancellationToken ct = default);
    Task<bool> IsOtpReadyAsync(CancellationToken ct = default);
}

public class SmtpConfigurationService : ISmtpConfigurationService
{
    private readonly PhotoboothDbContext _db;
    private readonly SmtpSettings _defaults;
    private readonly ILogger<SmtpConfigurationService> _logger;

    public SmtpConfigurationService(
        PhotoboothDbContext db,
        IOptions<SmtpSettings> defaults,
        ILogger<SmtpConfigurationService> logger)
    {
        _db = db;
        _defaults = defaults.Value;
        _logger = logger;
    }

    public async Task<SmtpConfigDto> GetAsync(CancellationToken ct = default)
    {
        var current = await _db.SmtpConfigurations.OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        if (current is null)
        {
            return new SmtpConfigDto(
                _defaults.Host,
                _defaults.Port,
                _defaults.Username,
                _defaults.Password,
                _defaults.FromAddress,
                _defaults.FromName,
                _defaults.UseSsl,
                _defaults.UseStartTls,
                false,
                null);
        }

        return new SmtpConfigDto(
            current.Host,
            current.Port,
            current.Username,
            current.Password,
            current.FromAddress,
            current.FromName,
            current.UseSsl,
            current.UseStartTls,
            current.IsVerified,
            current.VerifiedAt);
    }

    public async Task<SmtpConfigDto> SaveAsync(SaveSmtpConfigRequest req, CancellationToken ct = default)
    {
        var current = await _db.SmtpConfigurations.OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        if (current is null)
        {
            current = new SmtpConfiguration
            {
                Host = req.Host.Trim(),
                Port = req.Port,
                Username = req.Username.Trim(),
                Password = req.Password,
                FromAddress = req.FromAddress.Trim(),
                FromName = req.FromName.Trim(),
                UseSsl = req.UseSsl,
                UseStartTls = req.UseStartTls,
                IsVerified = false,
                VerifiedAt = null,
                UpdatedAt = DateTime.UtcNow
            };
            _db.SmtpConfigurations.Add(current);
        }
        else
        {
            current.Host = req.Host.Trim();
            current.Port = req.Port;
            current.Username = req.Username.Trim();
            current.Password = req.Password;
            current.FromAddress = req.FromAddress.Trim();
            current.FromName = req.FromName.Trim();
            current.UseSsl = req.UseSsl;
            current.UseStartTls = req.UseStartTls;
            current.IsVerified = false;
            current.VerifiedAt = null;
            current.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return await GetAsync(ct);
    }

    public async Task<SmtpTestResult> TestAndVerifyAsync(string recipientEmail, CancellationToken ct = default)
    {
        var current = await _db.SmtpConfigurations.OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        if (current is null)
            return new SmtpTestResult(false, false, "Save SMTP settings first.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(current.FromName, current.FromAddress));
        message.To.Add(MailboxAddress.Parse(recipientEmail.Trim()));
        message.Subject = "Photobooth SMTP test";
        message.Body = new TextPart(MimeKit.Text.TextFormat.Plain)
        {
            Text = "SMTP configuration test succeeded."
        };

        using var client = new SmtpClient();
        var secureSocketOptions = current.UseSsl
            ? SecureSocketOptions.SslOnConnect
            : current.UseStartTls
                ? SecureSocketOptions.StartTlsWhenAvailable
                : SecureSocketOptions.None;

        try
        {
            await client.ConnectAsync(current.Host, current.Port, secureSocketOptions, ct);
            if (!string.IsNullOrWhiteSpace(current.Username))
                await client.AuthenticateAsync(current.Username, current.Password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            current.IsVerified = true;
            current.VerifiedAt = DateTime.UtcNow;
            current.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return new SmtpTestResult(true, true, "SMTP test email sent successfully. Admin OTP is now enabled.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SMTP test failed for {Host}:{Port}", current.Host, current.Port);

            current.IsVerified = false;
            current.VerifiedAt = null;
            current.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            return new SmtpTestResult(false, false, BuildFriendlyErrorMessage(ex, current));
        }
    }

    public async Task<bool> IsOtpReadyAsync(CancellationToken ct = default)
    {
        var current = await _db.SmtpConfigurations.OrderByDescending(x => x.UpdatedAt).FirstOrDefaultAsync(ct);
        return current?.IsVerified == true;
    }

    private static string BuildFriendlyErrorMessage(Exception ex, SmtpConfiguration current)
    {
        var transportHint = current.UseSsl
            ? "SSL/TLS is enabled."
            : current.UseStartTls
                ? "STARTTLS is enabled."
                : "No transport encryption is enabled.";

        var generic = $"SMTP test failed for {current.Host}:{current.Port}. {transportHint}";

        return ex switch
        {
            SocketException => $"{generic} The server could not be reached. Check the host, port, firewall, and whether the SMTP service is running.",
            TimeoutException => $"{generic} The server did not respond in time. Check connectivity and port settings.",
            SmtpCommandException smtpCommand => $"{generic} The server rejected the request: {smtpCommand.Message}",
            AuthenticationException => $"{generic} Authentication failed. Check username, password, and whether the account requires an app password.",
            SmtpProtocolException => $"{generic} The server responded with an invalid SMTP handshake. This usually means the port and SSL/STARTTLS settings do not match the server.",
            _ => $"{generic} {ex.Message}"
        };
    }
}
