using AspNetCoreRateLimit;
using Microsoft.EntityFrameworkCore;
using Photobooth.Api.Configuration;
using Photobooth.Api.Data;
using Photobooth.Api.Jobs;
using Photobooth.Api.Middleware;
using Photobooth.Api.Repositories;
using Photobooth.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// --- Handle --cleanup-only mode for CronJob ---
if (args.Contains("--cleanup-only"))
{
    builder.Services.Configure<SftpSettings>(builder.Configuration.GetSection(SftpSettings.SectionName));
    builder.Services.AddDbContext<PhotoboothDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
    builder.Services.AddScoped<IEventRepository, EventRepository>();
    builder.Services.AddScoped<IImageRepository, ImageRepository>();
    builder.Services.AddSingleton<ISftpStorageService, SftpStorageService>();

    await using var cleanupApp = builder.Build();
    using var scope = cleanupApp.Services.CreateScope();
    var eventRepo = scope.ServiceProvider.GetRequiredService<IEventRepository>();
    var sftpStorage = scope.ServiceProvider.GetRequiredService<ISftpStorageService>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    var expiredEvents = await eventRepo.GetExpiredAsync();
    logger.LogInformation("GDPR Cleanup: Found {Count} expired events", expiredEvents.Count);

    foreach (var ev in expiredEvents)
    {
        try
        {
            logger.LogInformation("Deleting expired event: {EventId} ({EventName})", ev.Id, ev.Name);
            await sftpStorage.DeleteEventDirectoryAsync(ev.Id);
            await eventRepo.DeleteAsync(ev);
            logger.LogInformation("Deleted event {EventId}", ev.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete event {EventId}", ev.Id);
        }
    }

    logger.LogInformation("GDPR Cleanup complete");
    return;
}

// --- Configuration ---
builder.Services.Configure<SftpSettings>(builder.Configuration.GetSection(SftpSettings.SectionName));
builder.Services.Configure<UploadSettings>(builder.Configuration.GetSection(UploadSettings.SectionName));

// --- Database ---
builder.Services.AddDbContext<PhotoboothDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// --- Repositories ---
builder.Services.AddScoped<IEventRepository, EventRepository>();
builder.Services.AddScoped<IImageRepository, ImageRepository>();

// --- Services ---
if (builder.Environment.IsDevelopment())
{
    var localStoragePath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads");
    builder.Services.AddSingleton<ISftpStorageService>(
        new LocalStorageService(localStoragePath, "/api/images"));
}
else
{
    builder.Services.AddSingleton<ISftpStorageService, SftpStorageService>();
}
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IImageService, ImageService>();
builder.Services.AddScoped<IZipService, ZipService>();

// --- Background Jobs ---
builder.Services.AddHostedService<GdprCleanupJob>();

// --- Rate Limiting ---
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimit"));
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddInMemoryRateLimiting();

// --- CORS ---
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"];
        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// --- Controllers & Swagger ---
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Photobooth API", Version = "v1" });
});

var app = builder.Build();

// --- Middleware pipeline ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseIpRateLimiting();
app.UseMiddleware<ExceptionHandlerMiddleware>();

// Security headers
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("X-XSS-Protection", "0");
    await next();
});

app.UseCors();
app.UseMiddleware<FileValidationMiddleware>();
app.MapControllers();

// --- Auto-migrate in development ---
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PhotoboothDbContext>();
    await db.Database.MigrateAsync();
}

await app.RunAsync();
