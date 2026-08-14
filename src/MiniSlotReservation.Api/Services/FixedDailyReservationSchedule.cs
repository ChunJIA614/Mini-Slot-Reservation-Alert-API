using Microsoft.Extensions.Options;
using MiniSlotReservation.Api.Configuration;

namespace MiniSlotReservation.Api.Services;

public sealed class FixedDailyReservationSchedule : IReservationSchedule
{
    private readonly TimeZoneInfo _timeZone;
    private readonly TimeSpan _opensAtLocal;
    private readonly TimeSpan _closesAtLocal;

    public FixedDailyReservationSchedule(
        IOptions<ReservationScheduleOptions> options)
    {
        var schedule = options.Value;
        if (!ReservationScheduleOptions.TryResolveTimeZone(
                schedule,
                out var resolvedTimeZone))
        {
            throw new InvalidOperationException(
                "The configured reservation time zone could not be resolved.");
        }

        _timeZone = resolvedTimeZone!;
        _opensAtLocal = schedule.OpensAtLocal;
        _closesAtLocal = schedule.ClosesAtLocal;
        TimeZoneId = schedule.TimeZoneId;
    }

    public string TimeZoneId { get; }

    public DateOnly GetServiceDate(DateTimeOffset instant)
    {
        var localInstant = TimeZoneInfo.ConvertTime(instant, _timeZone);
        return DateOnly.FromDateTime(localInstant.DateTime);
    }

    public ServiceDayWindow GetWindow(DateOnly serviceDate)
    {
        var localMidnight = serviceDate.ToDateTime(
            TimeOnly.MinValue,
            DateTimeKind.Unspecified);
        var localStart = localMidnight.Add(_opensAtLocal);
        var localEnd = localMidnight.Add(_closesAtLocal);

        var startUtc = new DateTimeOffset(
            TimeZoneInfo.ConvertTimeToUtc(localStart, _timeZone));
        var endUtc = new DateTimeOffset(
            TimeZoneInfo.ConvertTimeToUtc(localEnd, _timeZone));

        return new ServiceDayWindow(
            serviceDate,
            TimeZoneId,
            startUtc,
            endUtc);
    }
}
