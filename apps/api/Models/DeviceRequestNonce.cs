using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

[Table("device_request_nonces")]
public class DeviceRequestNonce
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("device_id")]
    public Guid DeviceId { get; set; }

    [Required]
    [MaxLength(200)]
    [Column("nonce")]
    public required string Nonce { get; set; }

    [Column("signed_at")]
    public DateTime SignedAt { get; set; }

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(DeviceId))]
    public Device? Device { get; set; }
}
