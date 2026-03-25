using Microsoft.EntityFrameworkCore;
using Photobooth.Api.Models;

namespace Photobooth.Api.Data;

public class PhotoboothDbContext : DbContext
{
    public PhotoboothDbContext(DbContextOptions<PhotoboothDbContext> options)
        : base(options) { }

    public DbSet<Event> Events => Set<Event>();
    public DbSet<Image> Images => Set<Image>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<MarriageEmail> MarriageEmails => Set<MarriageEmail>();
    public DbSet<LoginCode> LoginCodes => Set<LoginCode>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<SmtpConfiguration> SmtpConfigurations => Set<SmtpConfiguration>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<DeviceRequestNonce> DeviceRequestNonces => Set<DeviceRequestNonce>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Event>(entity =>
        {
            entity.HasIndex(e => e.UploadToken).IsUnique();
            entity.HasIndex(e => e.ExpiresAt);

            entity.Property(e => e.Date)
                .HasConversion(
                    d => d.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                    d => DateOnly.FromDateTime(d));

            entity.HasMany(e => e.Devices)
                .WithOne(d => d.AssignedEvent)
                .HasForeignKey(d => d.AssignedEventId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Image>(entity =>
        {
            entity.HasIndex(e => e.EventId);

            entity.Property(e => e.Type)
                .HasConversion<string>()
                .HasMaxLength(10);

            entity.HasOne(i => i.Event)
                .WithMany(e => e.Images)
                .HasForeignKey(i => i.EventId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.LoginId).IsUnique();
        });

        modelBuilder.Entity<SmtpConfiguration>(entity =>
        {
            entity.HasIndex(e => e.UpdatedAt);
        });

        modelBuilder.Entity<MarriageEmail>(entity =>
        {
            entity.HasIndex(e => new { e.EventId, e.Email }).IsUnique();
            entity.HasIndex(e => e.VerificationToken);

            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.HasOne(m => m.Event)
                .WithMany(e => e.MarriageEmails)
                .HasForeignKey(m => m.EventId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LoginCode>(entity =>
        {
            entity.HasIndex(e => e.SubjectId);
            entity.HasIndex(e => e.ExpiresAt);

            entity.Property(e => e.Purpose)
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.HasOne(l => l.MarriageEmail)
                .WithMany(m => m.LoginCodes)
                .HasForeignKey(l => l.MarriageEmailId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.HasIndex(e => e.SubjectId);
            entity.HasIndex(e => e.ExpiresAt);
        });

        modelBuilder.Entity<Device>(entity =>
        {
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.LastSeenAt);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.AssignedEventId);

            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(20);
        });

        modelBuilder.Entity<DeviceRequestNonce>(entity =>
        {
            entity.HasIndex(e => new { e.DeviceId, e.Nonce }).IsUnique();
            entity.HasIndex(e => e.ExpiresAt);
            entity.HasIndex(e => e.CreatedAt);

            entity.HasOne(e => e.Device)
                .WithMany(d => d.RequestNonces)
                .HasForeignKey(e => e.DeviceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
