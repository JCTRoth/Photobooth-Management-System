namespace Photobooth.Api.Configuration;

public sealed class RetentionSettings
{
    public const string SectionName = "Retention";

    public int WarningDaysBeforeExpiry { get; init; } = 3;

    public string? ArchiveRootPath { get; init; }
}
