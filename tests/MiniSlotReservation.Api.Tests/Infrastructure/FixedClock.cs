using MiniSlotReservation.Api.Services;

namespace MiniSlotReservation.Api.Tests.Infrastructure;

internal sealed class FixedClock(DateTimeOffset utcNow) : IClock
{
    public DateTimeOffset UtcNow { get; } = utcNow;
}

