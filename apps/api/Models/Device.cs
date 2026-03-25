using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

public enum DeviceStatus
{
    Pending,
    Idle,
    Active,
    Error,
    Offline
}

[Table("devices")]
public class Device
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(150)]
    [Column("name")]
    public required string Name { get; set; }

    [Required]
    [MaxLength(4096)]
    [Column("public_key")]
    public required string PublicKey { get; set; }

    [Column("last_seen_at")]
    public DateTime? LastSeenAt { get; set; }

    [Required]
    [Column("status")]
    public DeviceStatus Status { get; set; } = DeviceStatus.Pending;

    [Column("assigned_event_id")]
    public Guid? AssignedEventId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(AssignedEventId))]
    public Event? AssignedEvent { get; set; }

    public ICollection<DeviceRequestNonce> RequestNonces { get; set; } = new List<DeviceRequestNonce>();
}
