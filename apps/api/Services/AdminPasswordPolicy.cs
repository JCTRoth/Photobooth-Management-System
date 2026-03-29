namespace Photobooth.Api.Services;

public static class AdminPasswordPolicy
{
    public static string? Validate(string password, string? currentPassword = null)
    {
        if (password.Length < 12)
            return "Admin passwords must be at least 12 characters long.";

        if (password.Any(char.IsWhiteSpace))
            return "Admin passwords cannot contain spaces.";

        var categoryCount = 0;
        if (password.Any(char.IsLower)) categoryCount++;
        if (password.Any(char.IsUpper)) categoryCount++;
        if (password.Any(char.IsDigit)) categoryCount++;
        if (password.Any(ch => !char.IsLetterOrDigit(ch) && !char.IsWhiteSpace(ch))) categoryCount++;

        if (categoryCount < 3)
            return "Admin passwords must use at least three of these: uppercase, lowercase, number, symbol.";

        if (!string.IsNullOrEmpty(currentPassword) && password == currentPassword)
            return "New password must be different from the current password.";

        return null;
    }
}
