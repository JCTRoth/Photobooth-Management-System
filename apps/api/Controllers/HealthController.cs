using Microsoft.AspNetCore.Mvc;
using Photobooth.Api.Data;

namespace Photobooth.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly PhotoboothDbContext _db;

    public HealthController(PhotoboothDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        try
        {
            var canConnect = await _db.Database.CanConnectAsync(ct);
            if (!canConnect)
                return StatusCode(503, new { status = "unhealthy", reason = "database" });

            return Ok(new { status = "healthy" });
        }
        catch
        {
            return StatusCode(503, new { status = "unhealthy", reason = "database" });
        }
    }
}
