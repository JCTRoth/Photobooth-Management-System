using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Photobooth.Api.Models;

[Table("admin_users")]
public class AdminUser
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(100)]
    [Column("login_id")]
    public required string LoginId { get; set; }

    [Required]
    [MaxLength(320)]
    [Column("email")]
    public required string Email { get; set; }

    [Required]
    [MaxLength(256)]
    [Column("password_hash")]
    public required string PasswordHash { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("must_change_password")]
    public bool MustChangePassword { get; set; } = false;

    [Column("is_bootstrap")]
    public bool IsBootstrap { get; set; } = false;

    [Column("last_login_at")]
    public DateTime? LastLoginAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
