using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MiniSlotReservation.Api.Configuration;
using MiniSlotReservation.Api.Contracts;
using MiniSlotReservation.Api.Services;
using MiniSlotReservation.Api.Tests.Infrastructure;

namespace MiniSlotReservation.Api.Tests;

public sealed class ReservationServiceTests
{
    [Fact]
    public async Task CreateAsync_WithSelectedStart_CreatesRequestedTwoHourReservation()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var start = AtLocal(9);
        var service = CreateService(database, start);

        var result = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-a",
                start,
                120));

        Assert.Equal(ReservationCreationStatus.Created, result.Status);
        Assert.NotNull(result.Reservation);
        Assert.Equal("slot-1", result.Reservation.SlotId);
        Assert.Equal("user-a", result.Reservation.UserId);
        Assert.Equal(start.ToUnixTimeMilliseconds(), result.Reservation.StartUtcMilliseconds);
        Assert.Equal(
            start.AddMinutes(120).ToUnixTimeMilliseconds(),
            result.Reservation.EndUtcMilliseconds);

        await using var verificationContext =
            await database.ContextFactory.CreateDbContextAsync();
        var stored = await verificationContext.Reservations.SingleAsync();
        Assert.Equal(result.Reservation.Id, stored.Id);
    }

    [Fact]
    public async Task FindLongestAvailableWindow_AfterTwoHourOpeningBooking_ReturnsRestOfDay()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var schedule = CreateSchedule();
        var service = CreateService(database, AtLocal(8), schedule: schedule);

        var creation = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-a",
                AtLocal(9),
                120));
        var serviceWindow = schedule.GetWindow(ServiceDate);

        var longest = await service.FindLongestAvailableWindowAsync(
            "slot-1",
            serviceWindow.StartUtcMilliseconds,
            serviceWindow.EndUtcMilliseconds);

        Assert.Equal(ReservationCreationStatus.Created, creation.Status);
        Assert.Equal(
            new TimeWindow(
                AtLocal(11).ToUnixTimeMilliseconds(),
                AtLocal(17).ToUnixTimeMilliseconds()),
            longest);
        Assert.Equal(360 * 60_000L, longest?.DurationMilliseconds);
    }

    [Fact]
    public async Task CreateAsync_OverlapIsRejected_ButAdjacentStartIsAccepted()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var service = CreateService(database, AtLocal(8));

        var original = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-a",
                AtLocal(9),
                120));
        var overlap = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-b",
                AtLocal(10),
                60));
        var adjacent = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-c",
                AtLocal(11),
                60));

        Assert.Equal(ReservationCreationStatus.Created, original.Status);
        Assert.Equal(ReservationCreationStatus.Conflict, overlap.Status);
        Assert.Equal(ReservationCreationStatus.Created, adjacent.Status);
    }

    [Theory]
    [InlineData(9, 0, 480, ReservationCreationStatus.Created)]
    [InlineData(8, 59, 1, ReservationCreationStatus.Invalid)]
    [InlineData(17, 0, 1, ReservationCreationStatus.Invalid)]
    [InlineData(16, 1, 60, ReservationCreationStatus.Invalid)]
    public async Task CreateAsync_EnforcesFixedServiceWindow(
        int hour,
        int minute,
        int durationMinutes,
        ReservationCreationStatus expectedStatus)
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var service = CreateService(database, AtLocal(8));

        var result = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-a",
                AtLocal(hour, minute),
                durationMinutes));

        Assert.Equal(expectedStatus, result.Status);
    }

    [Fact]
    public async Task CreateAsync_WithNonMinuteAlignedStart_ReturnsInvalid()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var service = CreateService(database, AtLocal(8));

        var result = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-a",
                AtLocal(9).AddSeconds(1),
                30));

        Assert.Equal(ReservationCreationStatus.Invalid, result.Status);
    }

    [Fact]
    public async Task CreateAsync_WithPastStart_ReturnsInvalid()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var service = CreateService(database, AtLocal(10));

        var result = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-a",
                AtLocal(9),
                30));

        Assert.Equal(ReservationCreationStatus.Invalid, result.Status);
    }

    [Fact]
    public async Task CreateAsync_TwoUsersSameSelectedInterval_AllowsExactlyOne()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var sharedSlotLocks = new SlotLockProvider();
        var firstService = CreateService(database, AtLocal(8), sharedSlotLocks);
        var secondService = CreateService(database, AtLocal(8), sharedSlotLocks);

        var results = await RunConcurrentlyAsync(
            () => firstService.CreateAsync(
                new CreateReservationRequest(
                    "slot-1",
                    "user-a",
                    AtLocal(9),
                    120)),
            () => secondService.CreateAsync(
                new CreateReservationRequest(
                    "slot-1",
                    "user-b",
                    AtLocal(9),
                    120)));

        AssertExactlyOneCreatedAndOneConflict(results);

        await using var verificationContext =
            await database.ContextFactory.CreateDbContextAsync();
        Assert.Equal(1, await verificationContext.Reservations.CountAsync());
    }

    [Fact]
    public async Task CreateAsync_TwoUsersWithDifferentOverlappingStarts_AllowsExactlyOne()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var sharedSlotLocks = new SlotLockProvider();
        var firstService = CreateService(database, AtLocal(8), sharedSlotLocks);
        var secondService = CreateService(database, AtLocal(8), sharedSlotLocks);

        var results = await RunConcurrentlyAsync(
            () => firstService.CreateAsync(
                new CreateReservationRequest(
                    "slot-1",
                    "user-a",
                    AtLocal(9),
                    120)),
            () => secondService.CreateAsync(
                new CreateReservationRequest(
                    "slot-1",
                    "user-b",
                    AtLocal(10),
                    120)));

        AssertExactlyOneCreatedAndOneConflict(results);
    }

    [Fact]
    public async Task CreateAsync_TwoInstancesWithoutSharedLock_UsesDatabaseSerialization()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var firstService = CreateService(
            database,
            AtLocal(8),
            new SlotLockProvider());
        var secondService = CreateService(
            database,
            AtLocal(8),
            new SlotLockProvider());

        var results = await RunConcurrentlyAsync(
            () => firstService.CreateAsync(
                new CreateReservationRequest(
                    "slot-1",
                    "user-a",
                    AtLocal(9),
                    120)),
            () => secondService.CreateAsync(
                new CreateReservationRequest(
                    "slot-1",
                    "user-b",
                    AtLocal(10),
                    120)));

        AssertExactlyOneCreatedAndOneConflict(results);

        await using var verificationContext =
            await database.ContextFactory.CreateDbContextAsync();
        Assert.Equal(1, await verificationContext.Reservations.CountAsync());
    }

    [Fact]
    public async Task CreateAsync_DifferentSlotsAtSameSelectedTime_AllowsBoth()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var service = CreateService(database, AtLocal(8));

        var results = await Task.WhenAll(
            service.CreateAsync(new CreateReservationRequest(
                "slot-1",
                "user-a",
                AtLocal(9),
                30)),
            service.CreateAsync(new CreateReservationRequest(
                "slot-2",
                "user-b",
                AtLocal(9),
                30)));

        Assert.All(results, result =>
            Assert.Equal(ReservationCreationStatus.Created, result.Status));
    }

    [Theory]
    [InlineData("slot/with/slash")]
    [InlineData("slot with space")]
    [InlineData("slot?query")]
    public async Task CreateAsync_WithPathUnsafeSlotId_ReturnsInvalid(string slotId)
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var service = CreateService(database, AtLocal(8));

        var result = await service.CreateAsync(
            new CreateReservationRequest(
                slotId,
                "user-a",
                AtLocal(9),
                30));

        Assert.Equal(ReservationCreationStatus.Invalid, result.Status);

        await using var verificationContext =
            await database.ContextFactory.CreateDbContextAsync();
        Assert.Equal(0, await verificationContext.Reservations.CountAsync());
    }

    private static readonly DateOnly ServiceDate = new(2026, 8, 13);

    private static DateTimeOffset AtLocal(
        int hour,
        int minute = 0) => new(
            ServiceDate.Year,
            ServiceDate.Month,
            ServiceDate.Day,
            hour,
            minute,
            0,
            TimeSpan.FromHours(8));

    private static FixedDailyReservationSchedule CreateSchedule() => new(
        Options.Create(new ReservationScheduleOptions()));

    private static ReservationService CreateService(
        SqliteTestDatabase database,
        DateTimeOffset now,
        ISlotLockProvider? slotLockProvider = null,
        IReservationSchedule? schedule = null) => new(
            database.ContextFactory,
            new FixedClock(now),
            slotLockProvider ?? new SlotLockProvider(),
            schedule ?? CreateSchedule());

    private static async Task<ReservationCreationResult[]> RunConcurrentlyAsync(
        Func<Task<ReservationCreationResult>> firstAttempt,
        Func<Task<ReservationCreationResult>> secondAttempt)
    {
        var startGate = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously);
        using var ready = new CountdownEvent(2);

        async Task<ReservationCreationResult> AttemptAsync(
            Func<Task<ReservationCreationResult>> attempt)
        {
            ready.Signal();
            await startGate.Task;
            return await attempt();
        }

        var first = Task.Run(() => AttemptAsync(firstAttempt));
        var second = Task.Run(() => AttemptAsync(secondAttempt));
        Assert.True(ready.Wait(TimeSpan.FromSeconds(5)));
        startGate.SetResult();

        return await Task.WhenAll(first, second)
            .WaitAsync(TimeSpan.FromSeconds(5));
    }

    private static void AssertExactlyOneCreatedAndOneConflict(
        ReservationCreationResult[] results)
    {
        Assert.Single(results, result =>
            result.Status == ReservationCreationStatus.Created);
        Assert.Single(results, result =>
            result.Status == ReservationCreationStatus.Conflict);
    }
}
