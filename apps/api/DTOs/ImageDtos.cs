namespace Photobooth.Api.DTOs;

public record ImageResponse
{
    public Guid Id { get; init; }
    public Guid EventId { get; init; }
    public required string Filename { get; init; }
    public required string Type { get; init; }
    public DateTime CreatedAt { get; init; }
    public required string Url { get; init; }
    public required string DownloadUrl { get; init; }
}

public record ImageListResponse
{
    public required IReadOnlyList<ImageResponse> Images { get; init; }
    public int Total { get; init; }
}

public record UploadResponse
{
    public Guid ImageId { get; init; }
    public required string Filename { get; init; }
    public required string DownloadUrl { get; init; }
}

public record GuestUploadRequest
{
    public Guid EventId { get; init; }
}
