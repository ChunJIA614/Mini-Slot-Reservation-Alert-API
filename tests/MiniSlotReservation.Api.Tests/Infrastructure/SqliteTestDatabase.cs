using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MiniSlotReservation.Api.Data;

namespace MiniSlotReservation.Api.Tests.Infrastructure;

internal sealed class SqliteTestDatabase : IAsyncDisposable
{
    private readonly SqliteConnection _anchorConnection;

    private SqliteTestDatabase(
        SqliteConnection anchorConnection,
        DbContextOptions<ReservationDbContext> options)
    {
        _anchorConnection = anchorConnection;
        ContextFactory = new TestDbContextFactory(options);
    }

    public IDbContextFactory<ReservationDbContext> ContextFactory { get; }

    public static async Task<SqliteTestDatabase> CreateAsync()
    {
        var databaseName = $"reservations-{Guid.NewGuid():N}";
        var connectionString =
            $"Data Source={databaseName};Mode=Memory;Cache=Shared;Default Timeout=5";

        var anchorConnection = new SqliteConnection(connectionString);
        await anchorConnection.OpenAsync();

        var options = new DbContextOptionsBuilder<ReservationDbContext>()
            .UseSqlite(connectionString)
            .Options;

        var database = new SqliteTestDatabase(anchorConnection, options);
        await using var context = await database.ContextFactory.CreateDbContextAsync();
        await context.Database.EnsureCreatedAsync();

        return database;
    }

    public async ValueTask DisposeAsync() =>
        await _anchorConnection.DisposeAsync();

    private sealed class TestDbContextFactory(
        DbContextOptions<ReservationDbContext> options)
        : IDbContextFactory<ReservationDbContext>
    {
        public ReservationDbContext CreateDbContext() => new(options);

        public Task<ReservationDbContext> CreateDbContextAsync(
            CancellationToken cancellationToken = default) =>
            Task.FromResult(CreateDbContext());
    }
}

