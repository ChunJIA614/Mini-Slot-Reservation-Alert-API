using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using MiniSlotReservation.Api.Configuration;
using MiniSlotReservation.Api.Contracts;
using MiniSlotReservation.Api.Controllers;
using MiniSlotReservation.Api.Services;
using MiniSlotReservation.Api.Tests.Infrastructure;

namespace MiniSlotReservation.Api.Tests;

public sealed class SlotsControllerTests
{
    [Fact]
    public async Task GetLongestWindow_DerivesFixedBoundsFromServiceDate()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var schedule = new FixedDailyReservationSchedule(
            Options.Create(new ReservationScheduleOptions()));
        var service = new ReservationService(
            database.ContextFactory,
            new FixedClock(AtLocal(8)),
            new SlotLockProvider(),
            schedule);
        var controller = new SlotsController(service, schedule);

        var creation = await service.CreateAsync(
            new CreateReservationRequest(
                "slot-1",
                "user-a",
                AtLocal(9),
                120));
        var action = await controller.GetLongestWindow(
            "slot-1",
            "2026-08-13",
            CancellationToken.None);

        Assert.Equal(ReservationCreationStatus.Created, creation.Status);
        var ok = Assert.IsType<OkObjectResult>(action.Result);
        var response = Assert.IsType<LongestAvailableWindowResponse>(ok.Value);
        Assert.Equal(new DateOnly(2026, 8, 13), response.ServiceDate);
        Assert.Equal("Asia/Kuala_Lumpur", response.TimeZoneId);
        Assert.Equal(
            new DateTimeOffset(2026, 8, 13, 1, 0, 0, TimeSpan.Zero),
            response.SearchFromUtc);
        Assert.Equal(
            new DateTimeOffset(2026, 8, 13, 9, 0, 0, TimeSpan.Zero),
            response.SearchToUtc);
        Assert.Equal(
            new DateTimeOffset(2026, 8, 13, 3, 0, 0, TimeSpan.Zero),
            response.AvailableFromUtc);
        Assert.Equal(
            new DateTimeOffset(2026, 8, 13, 9, 0, 0, TimeSpan.Zero),
            response.AvailableToUtc);
        Assert.Equal(360, response.DurationMinutes);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("2026-8-13")]
    [InlineData("2026/08/13")]
    [InlineData("2026-02-30")]
    [InlineData("2026-08-13T00:00:00Z")]
    public async Task GetLongestWindow_RequiresStrictServiceDate(string? serviceDate)
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var schedule = new FixedDailyReservationSchedule(
            Options.Create(new ReservationScheduleOptions()));
        var service = new ReservationService(
            database.ContextFactory,
            new FixedClock(AtLocal(8)),
            new SlotLockProvider(),
            schedule);
        var controller = new SlotsController(service, schedule);

        var action = await controller.GetLongestWindow(
            "slot-1",
            serviceDate,
            CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(action.Result);
        var problem = Assert.IsType<ProblemDetails>(badRequest.Value);
        Assert.Equal("Invalid service date", problem.Title);
    }

    private static DateTimeOffset AtLocal(int hour) => new(
        2026,
        8,
        13,
        hour,
        0,
        0,
        TimeSpan.FromHours(8));
}
