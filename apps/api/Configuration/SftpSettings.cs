namespace Photobooth.Api.Configuration;

public sealed class SftpSettings
{
    public const string SectionName = "Sftp";

    public required string Host { get; init; }
    public int Port { get; init; } = 22;
    public required string Username { get; init; }
    public required string Password { get; init; }
    public string BasePath { get; init; } = "/weddings";
    public required string PublicBaseUrl { get; init; }
}
