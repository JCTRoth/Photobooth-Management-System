using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

public enum LoginCodePurpose
{
    MarriageLogin,
    AdminTwoFactor,
    AdminPasswordReset
}

[Table("login_codes")]
public class LoginCode
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>MarriageEmail.Id or AdminUser.Id depending on Purpose.</summary>
    [Column("subject_id")]
    public Guid SubjectId { get; set; }

    [Required]
    [MaxLength(6)]
    [Column("code")]
    public required string Code { get; set; }

    [Column("purpose")]
    public LoginCodePurpose Purpose { get; set; }

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("used_at")]
    public DateTime? UsedAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("marriage_email_id")]
    public Guid? MarriageEmailId { get; set; }

    [ForeignKey(nameof(MarriageEmailId))]
    public MarriageEmail? MarriageEmail { get; set; }
}
