namespace MiniSlotReservation.Api.Contracts;

public sealed record LongestAvailableWindowResponse(
    string SlotId,
    DateOnly ServiceDate,
    string TimeZoneId,
    DateTimeOffset SearchFromUtc,
    DateTimeOffset SearchToUtc,
    DateTimeOffset? AvailableFromUtc,
    DateTimeOffset? AvailableToUtc,
    double DurationMinutes);
