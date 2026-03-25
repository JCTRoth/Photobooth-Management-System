using System.ComponentModel.DataAnnotations;

namespace Photobooth.Api.DTOs;

public record CreateEventRequest
{
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }

    [Required]
    public DateOnly Date { get; init; }

    /// <summary>
    /// Number of days after the event date before auto-deletion. Default: 90
    /// </summary>
    public int RetentionDays { get; init; } = 90;

    public IReadOnlyList<SlideshowAlbumRequest>? SlideshowAlbums { get; init; }
}

public record UpdateEventRequest
{
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }

    [Required]
    public DateOnly Date { get; init; }

    public int RetentionDays { get; init; } = 90;

    public IReadOnlyList<SlideshowAlbumRequest>? SlideshowAlbums { get; init; }
}

public record EventResponse
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public DateOnly Date { get; init; }
    public required string UploadToken { get; init; }
    public DateTime ExpiresAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public required string CoupleUploadUrl { get; init; }
    public int ImageCount { get; init; }
    public required IReadOnlyList<SlideshowAlbumResponse> SlideshowAlbums { get; init; }
}

public record EventListResponse
{
    public required IReadOnlyList<EventResponse> Events { get; init; }
    public int Total { get; init; }
}

public record SlideshowAlbumRequest
{
    [Required]
    [MaxLength(80)]
    public required string Name { get; init; }

    [Required]
    public required string Source { get; init; }

    [Required]
    public required string Mode { get; init; }
}

public record SlideshowAlbumResponse
{
    public required string Slug { get; init; }
    public required string Name { get; init; }
    public required string Source { get; init; }
    public required string Mode { get; init; }
}
