using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Photobooth.Api.Models;
using Photobooth.Api.Repositories;

namespace Photobooth.Api.Services;

public static class DeviceSignatureHeaders
{
    public const string DeviceId = "X-Photobooth-Device-Id";
    public const string Timestamp = "X-Photobooth-Timestamp";
    public const string Nonce = "X-Photobooth-Nonce";
    public const string Signature = "X-Photobooth-Signature";
}

public record DeviceAuthenticationResult(
    bool Success,
    Device? Device,
    ClaimsPrincipal? Principal,
    string? Error);

public interface IDeviceAuthenticationService
{
    bool HasDeviceSignatureHeaders(HttpRequest request);
    Task<DeviceAuthenticationResult> AuthenticateAsync(HttpContext context, CancellationToken ct = default);
}

public class DeviceAuthenticationService : IDeviceAuthenticationService
{
    private static readonly TimeSpan TimestampTolerance = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan NonceLifetime = TimeSpan.FromMinutes(10);

    private readonly IDeviceRepository _deviceRepo;
    private readonly IDeviceRequestNonceRepository _nonceRepo;

    public DeviceAuthenticationService(
        IDeviceRepository deviceRepo,
        IDeviceRequestNonceRepository nonceRepo)
    {
        _deviceRepo = deviceRepo;
        _nonceRepo = nonceRepo;
    }

    public bool HasDeviceSignatureHeaders(HttpRequest request) =>
        request.Headers.ContainsKey(DeviceSignatureHeaders.DeviceId) ||
        request.Headers.ContainsKey(DeviceSignatureHeaders.Signature);

    public async Task<DeviceAuthenticationResult> AuthenticateAsync(HttpContext context, CancellationToken ct = default)
    {
        var request = context.Request;

        if (!Guid.TryParse(request.Headers[DeviceSignatureHeaders.DeviceId], out var deviceId))
            return new DeviceAuthenticationResult(false, null, null, "Device header is missing or invalid.");

        var timestampRaw = request.Headers[DeviceSignatureHeaders.Timestamp].ToString();
        if (!DateTimeOffset.TryParse(timestampRaw, out var timestamp))
            return new DeviceAuthenticationResult(false, null, null, "Timestamp header is missing or invalid.");

        if (DateTimeOffset.UtcNow - timestamp > TimestampTolerance ||
            timestamp - DateTimeOffset.UtcNow > TimestampTolerance)
        {
            return new DeviceAuthenticationResult(false, null, null, "Request timestamp is outside the allowed clock skew.");
        }

        var nonce = request.Headers[DeviceSignatureHeaders.Nonce].ToString().Trim();
        if (string.IsNullOrWhiteSpace(nonce))
            return new DeviceAuthenticationResult(false, null, null, "Nonce header is missing.");

        var signatureRaw = request.Headers[DeviceSignatureHeaders.Signature].ToString().Trim();
        if (string.IsNullOrWhiteSpace(signatureRaw))
            return new DeviceAuthenticationResult(false, null, null, "Signature header is missing.");

        byte[] signature;
        try
        {
            signature = Convert.FromBase64String(signatureRaw);
        }
        catch (FormatException)
        {
            return new DeviceAuthenticationResult(false, null, null, "Signature header is not valid base64.");
        }

        var device = await _deviceRepo.GetByIdAsync(deviceId, ct);
        if (device is null)
            return new DeviceAuthenticationResult(false, null, null, "Device not found.");

        var body = await ReadBodyBytesAsync(request, ct);
        var pathAndQuery = request.Path + request.QueryString.ToUriComponent();
        var bodyHash = Convert.ToHexString(SHA256.HashData(body));
        var stringToSign = $"{request.Method.ToUpperInvariant()}\n{pathAndQuery}\n{timestampRaw}\n{nonce}\n{bodyHash}";

        using var rsa = RSA.Create();
        rsa.ImportFromPem(device.PublicKey);
        var verified = rsa.VerifyData(
            Encoding.UTF8.GetBytes(stringToSign),
            signature,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pss);

        if (!verified)
            return new DeviceAuthenticationResult(false, null, null, "Signature verification failed.");

        await _nonceRepo.DeleteExpiredAsync(DateTime.UtcNow, ct);
        var stored = await _nonceRepo.TryStoreAsync(new DeviceRequestNonce
        {
            DeviceId = device.Id,
            Nonce = nonce,
            SignedAt = timestamp.UtcDateTime,
            ExpiresAt = DateTime.UtcNow.Add(NonceLifetime),
            CreatedAt = DateTime.UtcNow
        }, ct);

        if (!stored)
            return new DeviceAuthenticationResult(false, null, null, "Replay attack detected for this nonce.");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, device.Id.ToString()),
            new(ClaimTypes.Name, device.Name),
            new(ClaimTypes.Role, "Device"),
            new("deviceId", device.Id.ToString()),
            new("deviceName", device.Name)
        };

        if (device.AssignedEventId.HasValue)
            claims.Add(new Claim("assignedEventId", device.AssignedEventId.Value.ToString()));

        var identity = new ClaimsIdentity(claims, "DeviceSignature");
        var principal = new ClaimsPrincipal(identity);

        return new DeviceAuthenticationResult(true, device, principal, null);
    }

    private static async Task<byte[]> ReadBodyBytesAsync(HttpRequest request, CancellationToken ct)
    {
        request.EnableBuffering();
        request.Body.Position = 0;
        using var memory = new MemoryStream();
        await request.Body.CopyToAsync(memory, ct);
        request.Body.Position = 0;
        return memory.ToArray();
    }
}
