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

    [MaxLength(64)]
    [Column("client_version")]
    public string? ClientVersion { get; set; }

    [MaxLength(64)]
    [Column("runtime_version")]
    public string? RuntimeVersion { get; set; }

    [MaxLength(255)]
    [Column("machine_name")]
    public string? MachineName { get; set; }

    [MaxLength(255)]
    [Column("local_dashboard_url")]
    public string? LocalDashboardUrl { get; set; }

    [MaxLength(500)]
    [Column("watch_directory")]
    public string? WatchDirectory { get; set; }

    [Column("last_config_sync_at")]
    public DateTime? LastConfigSyncAt { get; set; }

    [MaxLength(200)]
    [Column("loaded_event_name")]
    public string? LoadedEventName { get; set; }

    [Column("last_event_loaded_at")]
    public DateTime? LastEventLoadedAt { get; set; }

    [Column("last_upload_at")]
    public DateTime? LastUploadAt { get; set; }

    [MaxLength(20)]
    [Column("last_upload_status")]
    public string? LastUploadStatus { get; set; }

    [MaxLength(260)]
    [Column("last_upload_file_name")]
    public string? LastUploadFileName { get; set; }

    [MaxLength(500)]
    [Column("last_upload_error")]
    public string? LastUploadError { get; set; }

    [MaxLength(500)]
    [Column("last_heartbeat_error")]
    public string? LastHeartbeatError { get; set; }

    [MaxLength(20)]
    [Column("watcher_state")]
    public string? WatcherState { get; set; }

    [Column("pending_upload_count")]
    public int PendingUploadCount { get; set; }

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
