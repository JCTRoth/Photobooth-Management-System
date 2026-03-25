using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

public enum ImageType
{
    Guest,
    Couple
}

[Table("images")]
public class Image
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("event_id")]
    public Guid EventId { get; set; }

    [Required]
    [MaxLength(500)]
    [Column("filename")]
    public required string Filename { get; set; }

    [Column("type")]
    [MaxLength(10)]
    public required ImageType Type { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(500)]
    [Column("caption")]
    public string? Caption { get; set; }

    [ForeignKey(nameof(EventId))]
    public Event? Event { get; set; }
}
