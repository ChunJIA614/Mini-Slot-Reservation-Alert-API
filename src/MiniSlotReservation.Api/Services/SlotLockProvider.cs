using System.Collections.Concurrent;

namespace MiniSlotReservation.Api.Services;

public sealed class SlotLockProvider : ISlotLockProvider
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks =
        new(StringComparer.Ordinal);

    public async ValueTask<IAsyncDisposable> AcquireAsync(
        string slotId,
        CancellationToken cancellationToken = default)
    {
        var semaphore = _locks.GetOrAdd(
            slotId,
            static _ => new SemaphoreSlim(1, 1));

        await semaphore.WaitAsync(cancellationToken);
        return new Releaser(semaphore);
    }

    private sealed class Releaser(SemaphoreSlim semaphore) : IAsyncDisposable
    {
        private SemaphoreSlim? _semaphore = semaphore;

        public ValueTask DisposeAsync()
        {
            Interlocked.Exchange(ref _semaphore, null)?.Release();
            return ValueTask.CompletedTask;
        }
    }
}

