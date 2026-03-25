using System.Security.Claims;

namespace Photobooth.Api.Middleware;

public class ForcePasswordChangeMiddleware
{
    private readonly RequestDelegate _next;

    public ForcePasswordChangeMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var user = context.User;
        var isAdmin = user.Identity?.IsAuthenticated == true && user.IsInRole("Admin");

        if (isAdmin)
        {
            var mustChange = user.FindFirst("mustChangePassword")?.Value == "true";
            if (mustChange)
            {
                var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
                var allowed = path == "/api/auth/admin/change-password"
                    || path == "/api/auth/logout"
                    || path == "/api/auth/refresh";

                if (!allowed)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        error = "Password change required before using admin features."
                    });
                    return;
                }
            }
        }

        await _next(context);
    }
}
