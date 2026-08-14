import type { AvailableWindow } from '../../types/reservation'
import { getServiceTime } from '../../utils/availabilityWindow'
import { formatDateTime, formatDurationMinutes } from '../../utils/formatters'
import './AvailabilityCard.css'

interface AvailabilityCardProps {
  slotId: string
  serviceDate: string
  window: AvailableWindow | null
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

export function AvailabilityCard({
  slotId,
  serviceDate,
  window,
  isLoading,
  error,
  onRefresh,
}: AvailabilityCardProps) {
  const hasAvailableWindow = Boolean(
    window?.availableFromUtc && window.availableToUtc,
  )
  const fixedWindowLabel = window
    ? `${getServiceTime(window.searchFromUtc, window.timeZoneId)}–${getServiceTime(
        window.searchToUtc,
        window.timeZoneId,
      )} · ${window.timeZoneId}`
    : '09:00–17:00 · Malaysia time'

  return (
    <section className="dashboard-card availability-card" aria-labelledby="availability-title">
      <div className="card-heading">
        <div>
          <p className="card-eyebrow">Fixed daily window · {fixedWindowLabel}</p>
          <h2 id="availability-title">Longest Available Window</h2>
        </div>
        <span className="step-badge" aria-hidden="true">
          02
        </span>
      </div>

      <p className="card-description">
        Largest consecutive opening for{' '}
        <strong>{(window?.slotId ?? slotId) || 'your slot'}</strong>.
      </p>

      <div className="availability-content" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          <div className="availability-state">
            <span className="state-mark state-mark--loading" aria-hidden="true">
              ···
            </span>
            <strong>Checking availability</strong>
            <p>Reading the latest reservation data from the API.</p>
          </div>
        ) : error ? (
          <div className="availability-state availability-state--error">
            <span className="state-mark" aria-hidden="true">
              !
            </span>
            <strong>Availability unavailable</strong>
            <p>{error}</p>
          </div>
        ) : window && !hasAvailableWindow ? (
          <div className="availability-state availability-state--full">
            <span className="state-mark" aria-hidden="true">
              0
            </span>
            <strong>No available window</strong>
            <p>This slot is fully reserved on {window.serviceDate}.</p>
          </div>
        ) : window && hasAvailableWindow ? (
          <>
            <div className="availability-duration">
              <span>Longest opening</span>
              <strong>{formatDurationMinutes(window.durationMinutes)}</strong>
            </div>
            <dl className="availability-times">
              <div>
                <dt>Available from</dt>
                <dd>
                  <time dateTime={window.availableFromUtc ?? undefined}>
                    {formatDateTime(window.availableFromUtc ?? '')}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Available until</dt>
                <dd>
                  <time dateTime={window.availableToUtc ?? undefined}>
                    {formatDateTime(window.availableToUtc ?? '')}
                  </time>
                </dd>
              </div>
            </dl>
            <p className="search-range">
              {window.serviceDate} · {window.timeZoneId}
              <br />
              Fixed range:{' '}
              <time dateTime={window.searchFromUtc}>
                {formatDateTime(window.searchFromUtc)}
              </time>{' '}
              –{' '}
              <time dateTime={window.searchToUtc}>
                {formatDateTime(window.searchToUtc)}
              </time>
            </p>
          </>
        ) : (
          <div className="availability-state">
            <span className="state-mark" aria-hidden="true">
              24
            </span>
            <strong>Ready to check</strong>
            <p>
              Enter a slot ID, choose {serviceDate || 'a service date'}, then
              refresh the fixed window.
            </p>
          </div>
        )}
      </div>

      <button
        className="secondary-button availability-refresh"
        type="button"
        onClick={onRefresh}
        disabled={isLoading || !slotId.trim()}
      >
        <span aria-hidden="true">↻</span>
        <span>{isLoading ? 'Refreshing...' : 'Refresh Availability'}</span>
      </button>
    </section>
  )
}
