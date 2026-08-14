using MiniSlotReservation.Api.Services;

namespace MiniSlotReservation.Api.Tests;

public sealed class AvailabilityWindowCalculatorTests
{
    [Fact]
    public void FindLongest_MergesOverlapsAndClipsToHorizon()
    {
        var day = new DateTimeOffset(2026, 8, 13, 0, 0, 0, TimeSpan.Zero);
        long At(int hour, int minute = 0) =>
            day.AddHours(hour).AddMinutes(minute).ToUnixTimeMilliseconds();

        var occupied = new[]
        {
            new TimeWindow(At(8, 30), At(9, 30)),
            new TimeWindow(At(10, 30), At(12)),
            new TimeWindow(At(10), At(11)),
            new TimeWindow(At(13), At(14)),
            new TimeWindow(At(14), At(14, 30)),
            new TimeWindow(At(16, 30), At(18))
        };

        var result = AvailabilityWindowCalculator.FindLongest(
            At(9),
            At(17),
            occupied);

        Assert.Equal(new TimeWindow(At(14, 30), At(16, 30)), result);
    }

    [Fact]
    public void FindLongest_WithNoReservations_ReturnsEntireHorizon()
    {
        const long from = 1_000;
        const long to = 481_000;

        var result = AvailabilityWindowCalculator.FindLongest(
            from,
            to,
            []);

        Assert.Equal(new TimeWindow(from, to), result);
    }

    [Fact]
    public void FindLongest_WhenFullyOccupied_ReturnsNull()
    {
        var result = AvailabilityWindowCalculator.FindLongest(
            1_000,
            2_000,
            [new TimeWindow(500, 2_500)]);

        Assert.Null(result);
    }
}

