using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

[Table("events")]
public class Event
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(200)]
    [Column("name")]
    public required string Name { get; set; }

    [Column("date")]
    public DateOnly Date { get; set; }

    [Required]
    [MaxLength(128)]
    [Column("upload_token")]
    public required string UploadToken { get; set; }

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("retention_warning_sent_at")]
    public DateTime? RetentionWarningSentAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    [Column("slideshow_albums_json")]
    public string SlideshowAlbumsJson { get; set; } = "[]";

    public ICollection<Image> Images { get; set; } = new List<Image>();
    public ICollection<MarriageEmail> MarriageEmails { get; set; } = new List<MarriageEmail>();
    public ICollection<Device> Devices { get; set; } = new List<Device>();
}
