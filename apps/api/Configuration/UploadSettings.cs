namespace Photobooth.Api.Configuration;

public sealed class UploadSettings
{
    public const string SectionName = "Upload";

    public long MaxFileSizeBytes { get; init; } = 10 * 1024 * 1024; // 10 MB
    public string[] AllowedExtensions { get; init; } = [".jpg", ".jpeg", ".png"];
    public string[] AllowedContentTypes { get; init; } = ["image/jpeg", "image/png"];
}
