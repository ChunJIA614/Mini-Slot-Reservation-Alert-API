namespace MiniSlotReservation.Api.Services;

public interface ISlotLockProvider
{
    ValueTask<IAsyncDisposable> AcquireAsync(
        string slotId,
        CancellationToken cancellationToken = default);
}

