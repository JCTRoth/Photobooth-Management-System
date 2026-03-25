using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

[Table("smtp_configurations")]
public class SmtpConfiguration
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(255)]
    [Column("host")]
    public required string Host { get; set; }

    [Column("port")]
    public int Port { get; set; } = 587;

    [Required]
    [MaxLength(255)]
    [Column("username")]
    public required string Username { get; set; }

    [Required]
    [MaxLength(255)]
    [Column("password")]
    public required string Password { get; set; }

    [Required]
    [MaxLength(320)]
    [Column("from_address")]
    public required string FromAddress { get; set; }

    [MaxLength(200)]
    [Column("from_name")]
    public string FromName { get; set; } = "Photobooth";

    [Column("use_ssl")]
    public bool UseSsl { get; set; }

    [Column("use_start_tls")]
    public bool UseStartTls { get; set; } = true;

    [Column("is_verified")]
    public bool IsVerified { get; set; }

    [Column("verified_at")]
    public DateTime? VerifiedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
