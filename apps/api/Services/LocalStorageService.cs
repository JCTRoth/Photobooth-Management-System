namespace Photobooth.Api.Services;

/// <summary>
/// Local filesystem storage for development. Implements ISftpStorageService
/// so the upload/download pipeline works without a real SFTP server.
/// </summary>
public sealed class LocalStorageService : ISftpStorageService
{
    private readonly string _basePath;
    private readonly string _publicBaseUrl;

    public LocalStorageService(string basePath, string publicBaseUrl)
    {
        _basePath = basePath;
        _publicBaseUrl = publicBaseUrl.TrimEnd('/');
    }

    public async Task UploadAsync(Guid eventId, string subfolder, string filename, Stream content, CancellationToken ct = default)
    {
        var dir = Path.Combine(_basePath, eventId.ToString(), subfolder);
        Directory.CreateDirectory(dir);

        var filePath = Path.Combine(dir, filename);
        await using var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write);
        await content.CopyToAsync(fs, ct);
    }

    public Task<Stream> DownloadAsync(Guid eventId, string subfolder, string filename, CancellationToken ct = default)
    {
        var filePath = Path.Combine(_basePath, eventId.ToString(), subfolder, filename);
        if (!File.Exists(filePath))
            throw new KeyNotFoundException($"File not found: {filename}");

        Stream stream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(Guid eventId, string subfolder, string filename, CancellationToken ct = default)
    {
        var filePath = Path.Combine(_basePath, eventId.ToString(), subfolder, filename);
        if (File.Exists(filePath)) File.Delete(filePath);
        return Task.CompletedTask;
    }

    public Task DeleteEventDirectoryAsync(Guid eventId, CancellationToken ct = default)
    {
        var dir = Path.Combine(_basePath, eventId.ToString());
        if (Directory.Exists(dir))
            Directory.Delete(dir, recursive: true);
        return Task.CompletedTask;
    }

    public string GetPublicUrl(Guid eventId, string subfolder, string filename)
    {
        return $"{_publicBaseUrl}/{eventId}/{subfolder}/{filename}";
    }
}
