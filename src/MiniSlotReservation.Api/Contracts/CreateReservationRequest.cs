using System.ComponentModel.DataAnnotations;

namespace MiniSlotReservation.Api.Contracts;

public sealed record CreateReservationRequest(
    [Required, MaxLength(100), RegularExpression("^[A-Za-z0-9._-]+$")]
    string? SlotId,
    [Required, MaxLength(100), RegularExpression("^[A-Za-z0-9._-]+$")]
    string? UserId,
    [Required] DateTimeOffset? StartUtc,
    [Range(1, 480)] int DurationMinutes);
