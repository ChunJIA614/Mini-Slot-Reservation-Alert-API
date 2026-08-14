import type { Reservation } from '../../types/reservation'
import { formatDateTime, formatDurationMinutes } from '../../utils/formatters'
import './ReservationList.css'

interface ReservationListProps {
  reservations: Reservation[]
}

export function ReservationList({ reservations }: ReservationListProps) {
  return (
    <section className="dashboard-card reservation-list" aria-labelledby="reservations-title">
      <div className="list-heading">
        <div>
          <div className="list-title-row">
            <h2 id="reservations-title">Existing Reservations</h2>
            <span className="session-badge">This session</span>
          </div>
          <p>
            Successful reservations returned by the API since this page was opened.
          </p>
        </div>
        <span className="reservation-count" aria-label={`${reservations.length} reservations`}>
          {reservations.length.toString().padStart(2, '0')}
        </span>
      </div>

      {reservations.length === 0 ? (
        <div className="empty-reservations">
          <span aria-hidden="true">—</span>
          <strong>No reservations yet.</strong>
          <p>Your confirmed reservations will appear here.</p>
        </div>
      ) : (
        <div className="table-scroll" tabIndex={0} aria-label="Session reservations table">
          <table>
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Slot</th>
                <th scope="col">Start Time</th>
                <th scope="col">End Time</th>
                <th scope="col">Duration</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>
                    <strong>{reservation.userId}</strong>
                    <span className="row-id">{reservation.id.slice(0, 8)}</span>
                  </td>
                  <td>{reservation.slotId}</td>
                  <td>
                    <time dateTime={reservation.startUtc}>
                      {formatDateTime(reservation.startUtc)}
                    </time>
                  </td>
                  <td>
                    <time dateTime={reservation.endUtc}>
                      {formatDateTime(reservation.endUtc)}
                    </time>
                  </td>
                  <td>{formatDurationMinutes(reservation.durationMinutes)}</td>
                  <td>
                    <span className="reserved-status">
                      <span aria-hidden="true" />
                      Reserved
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

