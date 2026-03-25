using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Photobooth.Client;

public sealed class PhotoboothApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly HttpClient _httpClient;
    private readonly PhotoboothClientConfig _config;
    private readonly Uri _baseUri;

    public PhotoboothApiClient(HttpClient httpClient, PhotoboothClientConfig config)
    {
        _httpClient = httpClient;
        _config = config;
        _baseUri = new Uri(config.ServerUrl.TrimEnd('/') + "/", UriKind.Absolute);
    }

    public static async Task<PhotoboothClientConfig> RegisterDeviceAsync(
        string serverUrl,
        string deviceName,
        string configPath,
        string? watchDirectory,
        string? publicKeyPem,
        CancellationToken ct)
    {
        using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        using var response = await httpClient.PostAsJsonAsync(
            new Uri(new Uri(serverUrl.TrimEnd('/') + "/", UriKind.Absolute), "api/devices/register"),
            new RegisterDeviceRequest
            {
                Name = deviceName,
                PublicKeyPem = publicKeyPem
            },
            JsonOptions,
            ct);

        await EnsureSuccessAsync(response, ct);
        var payload = await response.Content.ReadFromJsonAsync<RegisterDeviceResponse>(JsonOptions, ct)
            ?? throw new InvalidOperationException("Device registration returned an empty response.");

        if (string.IsNullOrWhiteSpace(payload.PrivateKeyPem) && string.IsNullOrWhiteSpace(publicKeyPem))
        {
            throw new InvalidOperationException("Registration succeeded but no private key was returned.");
        }

        var config = new PhotoboothClientConfig
        {
            ServerUrl = serverUrl.TrimEnd('/'),
            DeviceId = payload.DeviceId,
            PrivateKey = payload.PrivateKeyPem ?? "<provide-the-matching-private-key>",
            DeviceName = payload.Name,
            WatchDirectory = string.IsNullOrWhiteSpace(watchDirectory) ? null : watchDirectory,
        };

        await SaveConfigAsync(configPath, config, ct);
        return config;
    }

    public async Task<DeviceConfigResponse> GetConfigAsync(CancellationToken ct)
    {
        using var response = await SendSignedAsync(HttpMethod.Get, $"api/devices/{_config.DeviceId}/config", null, ct);
        await EnsureSuccessAsync(response, ct);
        return await response.Content.ReadFromJsonAsync<DeviceConfigResponse>(JsonOptions, ct)
            ?? throw new InvalidOperationException("Config endpoint returned an empty response.");
    }

    public async Task SendHeartbeatAsync(string status, Guid? currentEventId, CancellationToken ct)
    {
        var body = new HeartbeatRequest
        {
            DeviceId = _config.DeviceId,
            Timestamp = DateTimeOffset.UtcNow,
            Status = status,
            CurrentEventId = currentEventId
        };

        var content = JsonContent.Create(body, options: JsonOptions);
        using var response = await SendSignedAsync(HttpMethod.Post, "api/devices/heartbeat", content, ct);
        await EnsureSuccessAsync(response, ct);
    }

    public async Task<UploadResponse> UploadPhotoAsync(string filePath, Guid? assignedEventId, CancellationToken ct)
    {
        var extension = Path.GetExtension(filePath);
        var boundary = $"pb-{Guid.NewGuid():N}";
        using var multipart = new MultipartFormDataContent(boundary);

        if (assignedEventId.HasValue)
        {
            multipart.Add(new StringContent(assignedEventId.Value.ToString()), "eventId");
        }

        var fileContent = new StreamContent(File.OpenRead(filePath));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(GetContentType(extension));
        multipart.Add(fileContent, "file", Path.GetFileName(filePath));

        using var response = await SendSignedAsync(HttpMethod.Post, "api/upload/guest", multipart, ct);
        await EnsureSuccessAsync(response, ct);
        return await response.Content.ReadFromJsonAsync<UploadResponse>(JsonOptions, ct)
            ?? throw new InvalidOperationException("Upload endpoint returned an empty response.");
    }

    public static async Task<PhotoboothClientConfig> LoadConfigAsync(string configPath, CancellationToken ct)
    {
        await using var stream = File.OpenRead(configPath);
        var config = await JsonSerializer.DeserializeAsync<PhotoboothClientConfig>(stream, JsonOptions, ct)
            ?? throw new InvalidOperationException("Device config file is empty.");

        if (string.IsNullOrWhiteSpace(config.ServerUrl) ||
            config.DeviceId == Guid.Empty ||
            string.IsNullOrWhiteSpace(config.PrivateKey))
        {
            throw new InvalidOperationException("Device config is missing serverUrl, deviceId, or privateKey.");
        }

        return config;
    }

    public static async Task SaveConfigAsync(string configPath, PhotoboothClientConfig config, CancellationToken ct)
    {
        var directory = Path.GetDirectoryName(configPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await using var stream = File.Create(configPath);
        await JsonSerializer.SerializeAsync(stream, config, JsonOptions, ct);
    }

    private async Task<HttpResponseMessage> SendSignedAsync(
        HttpMethod method,
        string relativePath,
        HttpContent? content,
        CancellationToken ct)
    {
        var targetUri = new Uri(_baseUri, relativePath);
        var bodyBytes = Array.Empty<byte>();
        ByteArrayContent? byteContent = null;

        if (content is not null)
        {
            bodyBytes = await content.ReadAsByteArrayAsync(ct);
            byteContent = new ByteArrayContent(bodyBytes);
            foreach (var header in content.Headers)
            {
                byteContent.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        var timestamp = DateTimeOffset.UtcNow.ToString("O");
        var nonce = Guid.NewGuid().ToString("N");
        var bodyHash = Convert.ToHexString(SHA256.HashData(bodyBytes));
        var canonical = string.Join(
            "\n",
            method.Method.ToUpperInvariant(),
            targetUri.PathAndQuery,
            timestamp,
            nonce,
            bodyHash);

        var signature = SignCanonicalString(canonical);
        var request = new HttpRequestMessage(method, targetUri)
        {
            Content = byteContent
        };

        request.Headers.TryAddWithoutValidation("X-Photobooth-Device-Id", _config.DeviceId.ToString());
        request.Headers.TryAddWithoutValidation("X-Photobooth-Timestamp", timestamp);
        request.Headers.TryAddWithoutValidation("X-Photobooth-Nonce", nonce);
        request.Headers.TryAddWithoutValidation("X-Photobooth-Signature", signature);

        return await _httpClient.SendAsync(request, ct);
    }

    private string SignCanonicalString(string canonical)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(_config.PrivateKey);
        var signature = rsa.SignData(
            Encoding.UTF8.GetBytes(canonical),
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pss);

        return Convert.ToBase64String(signature);
    }

    private static string GetContentType(string extension) =>
        extension.ToLowerInvariant() switch
        {
            ".png" => "image/png",
            _ => "image/jpeg"
        };

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var raw = await response.Content.ReadAsStringAsync(ct);
        if (!string.IsNullOrWhiteSpace(raw))
        {
            try
            {
                var error = JsonSerializer.Deserialize<ApiErrorResponse>(raw, JsonOptions);
                var message = error?.Error ?? error?.Message ?? error?.Title;
                if (!string.IsNullOrWhiteSpace(message))
                {
                    throw new InvalidOperationException($"API {(int)response.StatusCode}: {message}");
                }
            }
            catch (JsonException)
            {
                // fall back to raw body
            }

            throw new InvalidOperationException($"API {(int)response.StatusCode}: {raw}");
        }

        throw new InvalidOperationException($"API {(int)response.StatusCode}: {response.ReasonPhrase}");
    }
}
