using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

public enum MarriageEmailStatus
{
    Pending,
    Confirmed,
    Expired
}

/// <summary>
/// An individual email address invited to a marriage event.
/// Each confirmed email gets its own login (OTP per login).
/// </summary>
[Table("marriage_emails")]
public class MarriageEmail
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("event_id")]
    public Guid EventId { get; set; }

    [Required]
    [MaxLength(320)]
    [Column("email")]
    public required string Email { get; set; }

    [Column("status")]
    public MarriageEmailStatus Status { get; set; } = MarriageEmailStatus.Pending;

    [Column("verification_token")]
    [MaxLength(128)]
    public string? VerificationToken { get; set; }

    [Column("verified_at")]
    public DateTime? VerifiedAt { get; set; }

    [Column("last_sent_at")]
    public DateTime? LastSentAt { get; set; }

    [Column("token_expires_at")]
    public DateTime? TokenExpiresAt { get; set; }

    [Column("last_login_at")]
    public DateTime? LastLoginAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(EventId))]
    public Event? Event { get; set; }

    public ICollection<LoginCode> LoginCodes { get; set; } = new List<LoginCode>();
}
