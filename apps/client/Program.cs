namespace Photobooth.Client;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        if (args.Length == 0 || args[0] is "help" or "--help" or "-h")
        {
            PrintUsage();
            return 0;
        }

        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            cts.Cancel();
        };

        try
        {
            return args[0].ToLowerInvariant() switch
            {
                "register" => await RegisterAsync(args[1..], cts.Token),
                "run" => await RunAsync(args[1..], cts.Token),
                "upload-file" => await UploadFileAsync(args[1..], cts.Token),
                _ => ExitWithUsage($"Unknown command '{args[0]}'.")
            };
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("Cancelled.");
            return 1;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }
    }

    private static async Task<int> RegisterAsync(string[] args, CancellationToken ct)
    {
        var serverUrl = RequireOption(args, "--server-url");
        var deviceName = RequireOption(args, "--device-name", "--name");
        var configPath = GetOption(args, "--config") ?? "photobooth-device.json";
        var watchDirectory = GetOption(args, "--watch-dir");
        var publicKeyFile = GetOption(args, "--public-key-file");
        var publicKeyPem = publicKeyFile is null ? null : await File.ReadAllTextAsync(publicKeyFile, ct);

        var config = await PhotoboothApiClient.RegisterDeviceAsync(
            serverUrl,
            deviceName,
            configPath,
            watchDirectory,
            publicKeyPem,
            ct);

        Console.WriteLine($"Device registered: {config.DeviceId}");
        Console.WriteLine($"Config written to: {Path.GetFullPath(configPath)}");
        if (!string.IsNullOrWhiteSpace(config.WatchDirectory))
        {
            Console.WriteLine($"Watch directory: {config.WatchDirectory}");
        }

        return 0;
    }

    private static async Task<int> RunAsync(string[] args, CancellationToken ct)
    {
        var configPath = GetOption(args, "--config") ?? "photobooth-device.json";
        var config = await PhotoboothApiClient.LoadConfigAsync(configPath, ct);

        using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
        var apiClient = new PhotoboothApiClient(httpClient, config);
        var runner = new PhotoboothDeviceRunner(apiClient, config);

        await runner.RunAsync(ct);
        return 0;
    }

    private static async Task<int> UploadFileAsync(string[] args, CancellationToken ct)
    {
        var configPath = GetOption(args, "--config") ?? "photobooth-device.json";
        var filePath = RequireOption(args, "--file");
        var config = await PhotoboothApiClient.LoadConfigAsync(configPath, ct);

        using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
        var apiClient = new PhotoboothApiClient(httpClient, config);
        var runner = new PhotoboothDeviceRunner(apiClient, config);

        await runner.UploadSingleFileAsync(filePath, ct);
        return 0;
    }

    private static string? GetOption(string[] args, params string[] keys)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (keys.Contains(args[i], StringComparer.OrdinalIgnoreCase))
            {
                return args[i + 1];
            }
        }

        return null;
    }

    private static string RequireOption(string[] args, params string[] keys) =>
        GetOption(args, keys) ?? throw new InvalidOperationException($"Missing required option {string.Join(" or ", keys)}.");

    private static int ExitWithUsage(string message)
    {
        Console.Error.WriteLine(message);
        Console.Error.WriteLine();
        PrintUsage();
        return 1;
    }

    private static void PrintUsage()
    {
        Console.WriteLine(
            """
            Photobooth device client

            Commands:
              register --server-url <url> --device-name <name> [--config photobooth-device.json] [--watch-dir /path]
              run --config photobooth-device.json
              upload-file --config photobooth-device.json --file /path/to/capture.jpg

            Examples:
              dotnet run --project apps/client/Photobooth.Client.csproj -- register --server-url http://localhost:5000 --device-name "Booth 01" --config ./device.json --watch-dir /photos/out
              dotnet run --project apps/client/Photobooth.Client.csproj -- run --config ./device.json
              dotnet run --project apps/client/Photobooth.Client.csproj -- upload-file --config ./device.json --file ./capture.jpg
            """);
    }
}
