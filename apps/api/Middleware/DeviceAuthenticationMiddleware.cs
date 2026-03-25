using Photobooth.Api.Services;

namespace Photobooth.Api.Middleware;

public class DeviceAuthenticationMiddleware
{
    private readonly RequestDelegate _next;

    public DeviceAuthenticationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IDeviceAuthenticationService auth, ILogger<DeviceAuthenticationMiddleware> logger)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            await _next(context);
            return;
        }

        if (!auth.HasDeviceSignatureHeaders(context.Request))
        {
            await _next(context);
            return;
        }

        var result = await auth.AuthenticateAsync(context, context.RequestAborted);
        if (!result.Success || result.Principal is null)
        {
            logger.LogWarning("Device authentication failed for {Path}: {Error}", context.Request.Path, result.Error);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { error = result.Error ?? "Device authentication failed." });
            return;
        }

        context.User = result.Principal;
        await _next(context);
    }
}
