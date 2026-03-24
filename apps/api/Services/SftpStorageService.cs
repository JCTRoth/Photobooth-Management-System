using Microsoft.Extensions.Options;
using Photobooth.Api.Configuration;
using Renci.SshNet;

namespace Photobooth.Api.Services;

public interface ISftpStorageService
{
    Task UploadAsync(Guid eventId, string subfolder, string filename, Stream content, CancellationToken ct = default);
    Task<Stream> DownloadAsync(Guid eventId, string subfolder, string filename, CancellationToken ct = default);
    Task DeleteEventDirectoryAsync(Guid eventId, CancellationToken ct = default);
    string GetPublicUrl(Guid eventId, string subfolder, string filename);
}

public class SftpStorageService : ISftpStorageService, IDisposable
{
    private readonly SftpSettings _settings;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private SftpClient? _client;

    public SftpStorageService(IOptions<SftpSettings> settings)
    {
        _settings = settings.Value;
    }

    public async Task UploadAsync(Guid eventId, string subfolder, string filename, Stream content, CancellationToken ct = default)
    {
        var client = await GetConnectedClientAsync(ct);
        var remotePath = BuildPath(eventId, subfolder, filename);

        EnsureDirectoryExists(client, Path.GetDirectoryName(remotePath)!.Replace('\\', '/'));

        await Task.Run(() => client.UploadFile(content, remotePath, true), ct);
    }

    public async Task<Stream> DownloadAsync(Guid eventId, string subfolder, string filename, CancellationToken ct = default)
    {
        var client = await GetConnectedClientAsync(ct);
        var remotePath = BuildPath(eventId, subfolder, filename);

        var memoryStream = new MemoryStream();
        await Task.Run(() => client.DownloadFile(remotePath, memoryStream), ct);
        memoryStream.Position = 0;
        return memoryStream;
    }

    public async Task DeleteEventDirectoryAsync(Guid eventId, CancellationToken ct = default)
    {
        var client = await GetConnectedClientAsync(ct);
        var dirPath = $"{_settings.BasePath}/{eventId}";

        await Task.Run(() =>
        {
            if (client.Exists(dirPath))
            {
                DeleteDirectoryRecursive(client, dirPath);
            }
        }, ct);
    }

    public string GetPublicUrl(Guid eventId, string subfolder, string filename)
    {
        return $"{_settings.PublicBaseUrl.TrimEnd('/')}/{eventId}/{subfolder}/{filename}";
    }

    private string BuildPath(Guid eventId, string subfolder, string filename)
    {
        return $"{_settings.BasePath}/{eventId}/{subfolder}/{filename}";
    }

    private async Task<SftpClient> GetConnectedClientAsync(CancellationToken ct)
    {
        await _semaphore.WaitAsync(ct);
        try
        {
            if (_client is { IsConnected: true })
                return _client;

            _client?.Dispose();
            _client = new SftpClient(_settings.Host, _settings.Port, _settings.Username, _settings.Password);
            _client.Connect();
            return _client;
        }
        finally
        {
            _semaphore.Release();
        }
    }

    private static void EnsureDirectoryExists(SftpClient client, string path)
    {
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var current = "";
        foreach (var part in parts)
        {
            current += "/" + part;
            if (!client.Exists(current))
            {
                client.CreateDirectory(current);
            }
        }
    }

    private static void DeleteDirectoryRecursive(SftpClient client, string path)
    {
        foreach (var file in client.ListDirectory(path))
        {
            if (file.Name is "." or "..") continue;

            if (file.IsDirectory)
            {
                DeleteDirectoryRecursive(client, file.FullName);
            }
            else
            {
                client.DeleteFile(file.FullName);
            }
        }
        client.DeleteDirectory(path);
    }

    public void Dispose()
    {
        _semaphore.Dispose();
        _client?.Dispose();
    }
}
