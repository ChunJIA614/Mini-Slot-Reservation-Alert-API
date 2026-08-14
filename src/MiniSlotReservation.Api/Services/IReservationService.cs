using MiniSlotReservation.Api.Contracts;
using MiniSlotReservation.Api.Models;

namespace MiniSlotReservation.Api.Services;

public interface IReservationService
{
    Task<ReservationCreationResult> CreateAsync(
        CreateReservationRequest request,
        CancellationToken cancellationToken = default);

    Task<Reservation?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);

    Task<TimeWindow?> FindLongestAvailableWindowAsync(
        string slotId,
        long searchFromUtcMilliseconds,
        long searchToUtcMilliseconds,
        CancellationToken cancellationToken = default);
}

