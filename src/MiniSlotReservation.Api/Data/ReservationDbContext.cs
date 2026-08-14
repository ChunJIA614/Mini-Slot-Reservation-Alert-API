using Microsoft.EntityFrameworkCore;
using MiniSlotReservation.Api.Models;

namespace MiniSlotReservation.Api.Data;

public sealed class ReservationDbContext(
    DbContextOptions<ReservationDbContext> options) : DbContext(options)
{
    public DbSet<Reservation> Reservations => Set<Reservation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var reservation = modelBuilder.Entity<Reservation>();

        reservation.ToTable("Reservations", table =>
        {
            table.HasCheckConstraint(
                "CK_Reservations_EndAfterStart",
                "EndUtcMilliseconds > StartUtcMilliseconds");
            table.HasCheckConstraint(
                "CK_Reservations_PositiveDuration",
                "DurationMinutes BETWEEN 1 AND 480");
        });

        reservation.HasKey(item => item.Id);
        reservation.Property(item => item.SlotId).HasMaxLength(100).IsRequired();
        reservation.Property(item => item.UserId).HasMaxLength(100).IsRequired();

        // This unique index is the database-level backstop for two application
        // instances attempting the same slot at exactly the same millisecond.
        reservation
            .HasIndex(item => new { item.SlotId, item.StartUtcMilliseconds })
            .IsUnique();

        reservation.HasIndex(item => new
        {
            item.SlotId,
            item.StartUtcMilliseconds,
            item.EndUtcMilliseconds
        });
    }
}
