namespace Photobooth.Api.Configuration;

public class JwtSettings
{
    public const string SectionName = "Jwt";

    public required string Secret { get; set; }
    public required string Issuer { get; set; }
    public required string Audience { get; set; }
    /// <summary>Access token lifetime in minutes. Default: 15.</summary>
    public int AccessTokenMinutes { get; set; } = 15;
    /// <summary>Refresh token lifetime in hours. Max 72h session.</summary>
    public int RefreshTokenHours { get; set; } = 72;
}
