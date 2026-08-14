using Microsoft.EntityFrameworkCore;
using MiniSlotReservation.Api.Configuration;
using MiniSlotReservation.Api.Data;
using MiniSlotReservation.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Console logging is enough for this lightweight API and avoids depending on
// Windows Event Log permissions when it runs under a restricted account.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

builder.Services.AddControllers();
builder.Services.AddProblemDetails();

builder.Services
    .AddOptions<ReservationScheduleOptions>()
    .Bind(builder.Configuration.GetSection(
        ReservationScheduleOptions.SectionName))
    .Validate(
        ReservationScheduleOptions.HasValidDailyWindow,
        "ReservationSchedule must define one daily window within 00:00-24:00.")
    .Validate(
        ReservationScheduleOptions.HasResolvableTimeZone,
        "ReservationSchedule:TimeZoneId must identify an installed time zone.")
    .ValidateOnStart();

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReservationFrontend", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy
                .WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    });
});

var connectionString = builder.Configuration.GetConnectionString("Reservations")
    ?? "Data Source=reservations.db;Default Timeout=5";

builder.Services.AddDbContextFactory<ReservationDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<ISlotLockProvider, SlotLockProvider>();
builder.Services.AddSingleton<IReservationSchedule, FixedDailyReservationSchedule>();
builder.Services.AddScoped<IReservationService, ReservationService>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors("ReservationFrontend");
app.MapControllers();

// EnsureCreated keeps this exercise self-contained. A production application
// should replace it with versioned EF Core migrations.
await using (var scope = app.Services.CreateAsyncScope())
{
    var factory = scope.ServiceProvider
        .GetRequiredService<IDbContextFactory<ReservationDbContext>>();
    await using var db = await factory.CreateDbContextAsync();
    await db.Database.EnsureCreatedAsync();
}

await app.RunAsync();

public partial class Program;
