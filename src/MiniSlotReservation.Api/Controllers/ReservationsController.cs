using Microsoft.AspNetCore.Mvc;
using MiniSlotReservation.Api.Contracts;
using MiniSlotReservation.Api.Services;

namespace MiniSlotReservation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ReservationsController(
    IReservationService reservationService) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType<ReservationResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateReservationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await reservationService.CreateAsync(
            request,
            cancellationToken);

        return result.Status switch
        {
            ReservationCreationStatus.Created => CreatedAtAction(
                nameof(GetById),
                new { id = result.Reservation!.Id },
                ReservationResponse.From(result.Reservation)),
            ReservationCreationStatus.Conflict => Conflict(CreateProblem(
                StatusCodes.Status409Conflict,
                "Slot unavailable",
                result.Error!,
                "slot_unavailable")),
            _ => BadRequest(CreateProblem(
                StatusCodes.Status400BadRequest,
                "Invalid reservation",
                result.Error!,
                "invalid_reservation"))
        };
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<ReservationResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ReservationResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var reservation = await reservationService.GetByIdAsync(
            id,
            cancellationToken);

        return reservation is null
            ? NotFound()
            : Ok(ReservationResponse.From(reservation));
    }

    private static ProblemDetails CreateProblem(
        int status,
        string title,
        string detail,
        string code)
    {
        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail
        };
        problem.Extensions["code"] = code;
        return problem;
    }
}

