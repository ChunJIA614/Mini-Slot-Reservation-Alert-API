namespace MiniSlotReservation.Api.Services;

public readonly record struct TimeWindow(long StartUtcMilliseconds, long EndUtcMilliseconds)
{
    public long DurationMilliseconds => EndUtcMilliseconds - StartUtcMilliseconds;
}

public static class AvailabilityWindowCalculator
{
    public static TimeWindow? FindLongest(
        long searchFromUtcMilliseconds,
        long searchToUtcMilliseconds,
        IEnumerable<TimeWindow> occupiedWindows)
    {
        if (searchFromUtcMilliseconds >= searchToUtcMilliseconds)
        {
            throw new ArgumentException("The search start must be before the search end.");
        }

        var occupied = occupiedWindows
            .Where(window =>
                window.StartUtcMilliseconds < searchToUtcMilliseconds &&
                window.EndUtcMilliseconds > searchFromUtcMilliseconds)
            .Select(window => new TimeWindow(
                Math.Max(window.StartUtcMilliseconds, searchFromUtcMilliseconds),
                Math.Min(window.EndUtcMilliseconds, searchToUtcMilliseconds)))
            .OrderBy(window => window.StartUtcMilliseconds)
            .ThenBy(window => window.EndUtcMilliseconds)
            .ToArray();

        var cursor = searchFromUtcMilliseconds;
        TimeWindow? longest = null;

        foreach (var window in occupied)
        {
            if (window.StartUtcMilliseconds > cursor)
            {
                longest = ChooseLonger(
                    longest,
                    new TimeWindow(cursor, window.StartUtcMilliseconds));
            }

            cursor = Math.Max(cursor, window.EndUtcMilliseconds);

            if (cursor >= searchToUtcMilliseconds)
            {
                break;
            }
        }

        if (cursor < searchToUtcMilliseconds)
        {
            longest = ChooseLonger(
                longest,
                new TimeWindow(cursor, searchToUtcMilliseconds));
        }

        return longest;
    }

    private static TimeWindow ChooseLonger(TimeWindow? current, TimeWindow candidate)
    {
        // Keeping the current window on a tie makes the result deterministic:
        // because candidates are visited chronologically, the earliest one wins.
        return current is null ||
               candidate.DurationMilliseconds > current.Value.DurationMilliseconds
            ? candidate
            : current.Value;
    }
}

