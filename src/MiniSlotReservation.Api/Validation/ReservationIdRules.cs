using System.Text.RegularExpressions;

namespace MiniSlotReservation.Api.Validation;

public static partial class ReservationIdRules
{
    public const int MaxLength = 100;

    public const string AllowedCharactersDescription =
        "letters, numbers, dots, underscores, and hyphens";

    public static bool IsValid(string value) =>
        value.Length is > 0 and <= MaxLength && IdPattern().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9._-]+$", RegexOptions.CultureInvariant)]
    private static partial Regex IdPattern();
}

