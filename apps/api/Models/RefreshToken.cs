using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

[Table("refresh_tokens")]
public class RefreshToken
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>AdminUser.Id or MarriageEmail.Id</summary>
    [Column("subject_id")]
    public Guid SubjectId { get; set; }

    [Column("role")]
    [MaxLength(20)]
    public required string Role { get; set; }

    /// <summary>SHA-256 hash of the raw token value stored in the cookie.</summary>
    [Required]
    [MaxLength(128)]
    [Column("token_hash")]
    public required string TokenHash { get; set; }

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("replaced_by_id")]
    public Guid? ReplacedById { get; set; }

    [Column("revoked_at")]
    public DateTime? RevokedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsRevoked => RevokedAt is not null;
    public bool IsActive => !IsRevoked && !IsExpired;
}
