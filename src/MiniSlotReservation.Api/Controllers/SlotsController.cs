using System.ComponentModel.DataAnnotations;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using MiniSlotReservation.Api.Contracts;
using MiniSlotReservation.Api.Services;
using MiniSlotReservation.Api.Validation;

namespace MiniSlotReservation.Api.Controllers;

[ApiController]
[Route("api/slots")]
public sealed class SlotsController(
    IReservationService reservationService,
    IReservationSchedule reservationSchedule) : ControllerBase
{
    [HttpGet("{slotId}/availability/longest")]
    [ProducesResponseType<LongestAvailableWindowResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<LongestAvailableWindowResponse>> GetLongestWindow(
        [FromRoute, MaxLength(100)] string slotId,
        [FromQuery] string? serviceDate,
        CancellationToken cancellationToken)
    {
        var normalizedSlotId = slotId.Trim();

        if (!ReservationIdRules.IsValid(normalizedSlotId))
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid slot",
                Detail = $"SlotId can contain only " +
                    $"{ReservationIdRules.AllowedCharactersDescription}, up to " +
                    $"{ReservationIdRules.MaxLength} characters."
            });
        }

        if (!DateOnly.TryParseExact(
                serviceDate,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsedServiceDate))
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid service date",
                Detail = "serviceDate is required in YYYY-MM-DD format."
            });
        }

        var serviceWindow = reservationSchedule.GetWindow(parsedServiceDate);
        var fromMilliseconds = serviceWindow.StartUtcMilliseconds;
        var toMilliseconds = serviceWindow.EndUtcMilliseconds;

        var window = await reservationService.FindLongestAvailableWindowAsync(
            normalizedSlotId,
            fromMilliseconds,
            toMilliseconds,
            cancellationToken);

        var response = new LongestAvailableWindowResponse(
            normalizedSlotId,
            serviceWindow.ServiceDate,
            serviceWindow.TimeZoneId,
            serviceWindow.StartUtc,
            serviceWindow.EndUtc,
            window is null
                ? null
                : DateTimeOffset.FromUnixTimeMilliseconds(
                    window.Value.StartUtcMilliseconds),
            window is null
                ? null
                : DateTimeOffset.FromUnixTimeMilliseconds(
                    window.Value.EndUtcMilliseconds),
            window?.DurationMilliseconds / 60_000d ?? 0d);

        return Ok(response);
    }
}
