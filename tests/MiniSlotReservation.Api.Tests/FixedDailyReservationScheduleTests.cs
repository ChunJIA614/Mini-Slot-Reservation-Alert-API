using Microsoft.Extensions.Options;
using MiniSlotReservation.Api.Configuration;
using MiniSlotReservation.Api.Services;

namespace MiniSlotReservation.Api.Tests;

public sealed class FixedDailyReservationScheduleTests
{
    [Fact]
    public void GetWindow_DerivesKualaLumpurUtcBoundsFromServiceDate()
    {
        var schedule = new FixedDailyReservationSchedule(
            Options.Create(new ReservationScheduleOptions()));

        var result = schedule.GetWindow(new DateOnly(2026, 8, 13));

        Assert.Equal(new DateOnly(2026, 8, 13), result.ServiceDate);
        Assert.Equal("Asia/Kuala_Lumpur", result.TimeZoneId);
        Assert.Equal(
            new DateTimeOffset(2026, 8, 13, 1, 0, 0, TimeSpan.Zero),
            result.StartUtc);
        Assert.Equal(
            new DateTimeOffset(2026, 8, 13, 9, 0, 0, TimeSpan.Zero),
            result.EndUtc);
    }

    [Fact]
    public void GetServiceDate_UsesConfiguredTimeZoneRatherThanUtcDate()
    {
        var schedule = new FixedDailyReservationSchedule(
            Options.Create(new ReservationScheduleOptions()));

        var result = schedule.GetServiceDate(
            new DateTimeOffset(2026, 8, 12, 17, 0, 0, TimeSpan.Zero));

        Assert.Equal(new DateOnly(2026, 8, 13), result);
    }
}
