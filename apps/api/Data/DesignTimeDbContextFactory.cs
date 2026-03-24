using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Photobooth.Api.Data;

/// <summary>
/// Design-time factory for EF Core migrations.
/// Used by `dotnet ef migrations add` when no host is running.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<PhotoboothDbContext>
{
    public PhotoboothDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<PhotoboothDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=photobooth;Username=photobooth;Password=changeme");
        return new PhotoboothDbContext(optionsBuilder.Options);
    }
}
