using System.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MiniSlotReservation.Api.Contracts;
using MiniSlotReservation.Api.Data;
using MiniSlotReservation.Api.Models;
using MiniSlotReservation.Api.Validation;

namespace MiniSlotReservation.Api.Services;

public sealed class ReservationService(
    IDbContextFactory<ReservationDbContext> contextFactory,
    IClock clock,
    ISlotLockProvider slotLockProvider,
    IReservationSchedule reservationSchedule) : IReservationService
{
    public async Task<ReservationCreationResult> CreateAsync(
        CreateReservationRequest request,
        CancellationToken cancellationToken = default)
    {
        var slotId = request.SlotId?.Trim();
        var userId = request.UserId?.Trim();

        if (string.IsNullOrWhiteSpace(slotId) || string.IsNullOrWhiteSpace(userId))
        {
            return ReservationCreationResult.Invalid(
                "SlotId and UserId must contain non-whitespace characters.");
        }

        if (!ReservationIdRules.IsValid(slotId) || !ReservationIdRules.IsValid(userId))
        {
            return ReservationCreationResult.Invalid(
                $"SlotId and UserId can contain only " +
                $"{ReservationIdRules.AllowedCharactersDescription}, up to " +
                $"{ReservationIdRules.MaxLength} characters.");
        }

        if (request.DurationMinutes is < 1 or > 480)
        {
            return ReservationCreationResult.Invalid(
                "DurationMinutes must be between 1 and 480.");
        }

        if (request.StartUtc is null)
        {
            return ReservationCreationResult.Invalid(
                "StartUtc is required.");
        }

        var requestedStartUtc = request.StartUtc.Value.ToUniversalTime();

        if (requestedStartUtc.Ticks % TimeSpan.TicksPerMinute != 0)
        {
            return ReservationCreationResult.Invalid(
                "StartUtc must be aligned to a whole minute.");
        }

        if (requestedStartUtc < clock.UtcNow)
        {
            return ReservationCreationResult.Invalid(
                "StartUtc cannot be in the past.");
        }

        DateTimeOffset requestedEndUtc;

        try
        {
            requestedEndUtc = requestedStartUtc.AddMinutes(
                request.DurationMinutes);
        }
        catch (ArgumentOutOfRangeException)
        {
            return ReservationCreationResult.Invalid(
                "The requested reservation end is outside the supported date range.");
        }

        var serviceDate = reservationSchedule.GetServiceDate(requestedStartUtc);
        var serviceWindow = reservationSchedule.GetWindow(serviceDate);

        // Reservation intervals are half-open: [start, end). Starting exactly
        // when another reservation ends is therefore valid.
        if (requestedStartUtc < serviceWindow.StartUtc ||
            requestedStartUtc >= serviceWindow.EndUtc ||
            requestedEndUtc > serviceWindow.EndUtc)
        {
            return ReservationCreationResult.Invalid(
                $"The reservation must fit entirely within the configured " +
                $"{reservationSchedule.TimeZoneId} service window for " +
                $"{serviceDate:yyyy-MM-dd}.");
        }

        var start = requestedStartUtc.ToUnixTimeMilliseconds();
        var end = requestedEndUtc.ToUnixTimeMilliseconds();

        await using var slotLease = await slotLockProvider.AcquireAsync(
            slotId,
            cancellationToken);

        await using var db = await contextFactory.CreateDbContextAsync(
            cancellationToken);

        // SQLite starts a write transaction here. Together with the keyed
        // process lock, the overlap check and insert form one critical section.
        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var overlaps = await db.Reservations.AnyAsync(
            existing =>
                existing.SlotId == slotId &&
                existing.StartUtcMilliseconds < end &&
                existing.EndUtcMilliseconds > start,
            cancellationToken);

        if (overlaps)
        {
            return ReservationCreationResult.Conflict(
                "The slot is already reserved during the requested time window.");
        }

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            SlotId = slotId,
            UserId = userId,
            DurationMinutes = request.DurationMinutes,
            StartUtcMilliseconds = start,
            EndUtcMilliseconds = end
        };

        db.Reservations.Add(reservation);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return ReservationCreationResult.Created(reservation);
        }
        catch (DbUpdateException exception)
            when (IsUniqueConstraintViolation(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            return ReservationCreationResult.Conflict(
                "Another request reserved this slot at the same millisecond.");
        }
    }

    public async Task<Reservation?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(
            cancellationToken);

        return await db.Reservations
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
    }

    public async Task<TimeWindow?> FindLongestAvailableWindowAsync(
        string slotId,
        long searchFromUtcMilliseconds,
        long searchToUtcMilliseconds,
        CancellationToken cancellationToken = default)
    {
        var normalizedSlotId = slotId.Trim();

        await using var db = await contextFactory.CreateDbContextAsync(
            cancellationToken);

        var occupied = await db.Reservations
            .AsNoTracking()
            .Where(item =>
                item.SlotId == normalizedSlotId &&
                item.StartUtcMilliseconds < searchToUtcMilliseconds &&
                item.EndUtcMilliseconds > searchFromUtcMilliseconds)
            .Select(item => new TimeWindow(
                item.StartUtcMilliseconds,
                item.EndUtcMilliseconds))
            .ToListAsync(cancellationToken);

        return AvailabilityWindowCalculator.FindLongest(
            searchFromUtcMilliseconds,
            searchToUtcMilliseconds,
            occupied);
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException exception) =>
        exception.InnerException is SqliteException
        {
            // SQLITE_CONSTRAINT_UNIQUE. Other constraint failures indicate a
            // programming/data problem and should not be mislabeled as a race.
            SqliteExtendedErrorCode: 2067
        };
}
