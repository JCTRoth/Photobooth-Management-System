using Microsoft.EntityFrameworkCore;
using Photobooth.Api.Models;

namespace Photobooth.Api.Data;

public class PhotoboothDbContext : DbContext
{
    public PhotoboothDbContext(DbContextOptions<PhotoboothDbContext> options)
        : base(options) { }

    public DbSet<Event> Events => Set<Event>();
    public DbSet<Image> Images => Set<Image>();

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
    }
}
