using MiniSlotReservation.Api.Models;

namespace MiniSlotReservation.Api.Services;

public enum ReservationCreationStatus
{
    Created,
    Conflict,
    Invalid
}

public sealed record ReservationCreationResult(
    ReservationCreationStatus Status,
    Reservation? Reservation = null,
    string? Error = null)
{
    public static ReservationCreationResult Created(Reservation reservation) =>
        new(ReservationCreationStatus.Created, reservation);

    public static ReservationCreationResult Conflict(string error) =>
        new(ReservationCreationStatus.Conflict, Error: error);

    public static ReservationCreationResult Invalid(string error) =>
        new(ReservationCreationStatus.Invalid, Error: error);
}

