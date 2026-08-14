namespace MiniSlotReservation.Api.Models;

public sealed class Reservation
{
    public Guid Id { get; set; }

    public required string SlotId { get; set; }

    public required string UserId { get; set; }

    public int DurationMinutes { get; set; }

    public long StartUtcMilliseconds { get; set; }

    public long EndUtcMilliseconds { get; set; }
}

