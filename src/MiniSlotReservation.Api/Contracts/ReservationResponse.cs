using MiniSlotReservation.Api.Models;

namespace MiniSlotReservation.Api.Contracts;

public sealed record ReservationResponse(
    Guid Id,
    string SlotId,
    string UserId,
    int DurationMinutes,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc)
{
    public static ReservationResponse From(Reservation reservation) => new(
        reservation.Id,
        reservation.SlotId,
        reservation.UserId,
        reservation.DurationMinutes,
        DateTimeOffset.FromUnixTimeMilliseconds(
            reservation.StartUtcMilliseconds),
        DateTimeOffset.FromUnixTimeMilliseconds(
            reservation.EndUtcMilliseconds));
}

