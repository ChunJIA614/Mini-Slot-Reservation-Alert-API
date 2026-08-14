namespace MiniSlotReservation.Api.Configuration;

public sealed class ReservationScheduleOptions
{
    public const string SectionName = "ReservationSchedule";

    public string TimeZoneId { get; set; } = "Asia/Kuala_Lumpur";

    public string FallbackTimeZoneId { get; set; } = "Singapore Standard Time";

    public TimeSpan OpensAtLocal { get; set; } = TimeSpan.FromHours(9);

    public TimeSpan ClosesAtLocal { get; set; } = TimeSpan.FromHours(17);

    public static bool HasValidDailyWindow(ReservationScheduleOptions options) =>
        options.OpensAtLocal >= TimeSpan.Zero &&
        options.ClosesAtLocal <= TimeSpan.FromDays(1) &&
        options.OpensAtLocal < options.ClosesAtLocal;

    public static bool HasResolvableTimeZone(ReservationScheduleOptions options)
    {
        return TryResolveTimeZone(options, out _);
    }

    public static bool TryResolveTimeZone(
        ReservationScheduleOptions options,
        out TimeZoneInfo? timeZone)
    {
        if (TryResolveTimeZone(options.TimeZoneId, out timeZone))
        {
            return true;
        }

        return TryResolveTimeZone(options.FallbackTimeZoneId, out timeZone);
    }

    private static bool TryResolveTimeZone(
        string? timeZoneId,
        out TimeZoneInfo? timeZone)
    {
        timeZone = null;

        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return false;
        }

        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            return true;
        }
        catch (TimeZoneNotFoundException)
        {
            return false;
        }
        catch (InvalidTimeZoneException)
        {
            return false;
        }
    }
}
