using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.DependencyInjection;

namespace Photobooth.Client;

public sealed class LocalDashboardHost : IAsyncDisposable
{
    private readonly BoothRuntimeManager _manager;
    private readonly string _configPath;
    private readonly string _host;
    private readonly int _port;

    public LocalDashboardHost(BoothRuntimeManager manager, string configPath, string host, int port)
    {
        _manager = manager;
        _configPath = configPath;
        _host = host;
        _port = port;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        var dashboardUrl = $"http://{_host}:{_port}";
        _manager.SetDashboardUrl(dashboardUrl);
        await _manager.InitializeAsync(ct);

        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseUrls(dashboardUrl);
        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.SerializerOptions.WriteIndented = true;
        });

        var app = builder.Build();
        var localConsolePath = Path.Combine(AppContext.BaseDirectory, "LocalConsole");
        var staticFileProvider = new PhysicalFileProvider(localConsolePath);

        app.UseDefaultFiles(new DefaultFilesOptions
        {
            FileProvider = staticFileProvider,
            RequestPath = string.Empty
        });
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = staticFileProvider,
            RequestPath = string.Empty
        });

        app.MapGet("/api/status", () => Results.Json(_manager.GetStatus()));
        app.MapPost("/api/keys/generate", () => Results.Json(ClientRuntimeState.GenerateKeyPair()));

        app.MapPost("/api/setup/register", async (LocalRegisterDeviceRequest request, CancellationToken requestCt) =>
        {
            var result = await _manager.RegisterDeviceAsync(request, requestCt);
            return Results.Json(result);
        });

        app.MapPost("/api/config/import", async (LocalImportConfigRequest request, CancellationToken requestCt) =>
        {
            var result = await _manager.ImportConfigAsync(request, requestCt);
            return Results.Json(result);
        });

        app.MapPost("/api/runner/start", async (CancellationToken requestCt) =>
        {
            await _manager.StartRunnerAsync(requestCt);
            return Results.Json(new LocalCommandResult { Message = "Booth runtime started." });
        });

        app.MapPost("/api/runner/stop", async () =>
        {
            await _manager.StopRunnerAsync();
            return Results.Json(new LocalCommandResult { Message = "Booth runtime stopped." });
        });

        app.MapGet("/api/config/download", async () =>
        {
            if (!File.Exists(_configPath))
            {
                return Results.NotFound(new LocalCommandResult { Message = "No local config file has been saved yet." });
            }

            var fileName = Path.GetFileName(_configPath);
            var bytes = await File.ReadAllBytesAsync(_configPath, ct);
            return Results.File(bytes, "application/json", fileName);
        });

        Console.WriteLine($"Local booth dashboard available at {dashboardUrl}");
        await app.StartAsync(ct);
        try
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // expected when the booth process shuts down
        }
        finally
        {
            await app.StopAsync(CancellationToken.None);
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _manager.DisposeAsync();
    }
}
