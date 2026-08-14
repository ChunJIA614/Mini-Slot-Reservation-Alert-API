namespace MiniSlotReservation.Api.Services;

public readonly record struct ServiceDayWindow(
    DateOnly ServiceDate,
    string TimeZoneId,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc)
{
    public long StartUtcMilliseconds => StartUtc.ToUnixTimeMilliseconds();

    public long EndUtcMilliseconds => EndUtc.ToUnixTimeMilliseconds();
}

public interface IReservationSchedule
{
    string TimeZoneId { get; }

    DateOnly GetServiceDate(DateTimeOffset instant);

    ServiceDayWindow GetWindow(DateOnly serviceDate);
}
