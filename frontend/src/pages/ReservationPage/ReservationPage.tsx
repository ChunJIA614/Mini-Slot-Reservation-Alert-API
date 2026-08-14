import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from '../../components/Alert/Alert'
import { AvailabilityCard } from '../../components/AvailabilityCard/AvailabilityCard'
import {
  ReservationForm,
  type ReservationFormValues,
} from '../../components/ReservationForm/ReservationForm'
import { ReservationList } from '../../components/ReservationList/ReservationList'
import {
  ApiError,
  createReservation,
  getLongestAvailableWindow,
} from '../../services/reservationService'
import type {
  AvailableWindow,
  CreateReservationRequest,
  Reservation,
} from '../../types/reservation'
import {
  createDefaultServiceSelection,
  getServiceDate,
  getServiceTime,
} from '../../utils/availabilityWindow'
import { formatDateTime, formatDurationMinutes } from '../../utils/formatters'
import './ReservationPage.css'

function createInitialFormValues(): ReservationFormValues {
  const selection = createDefaultServiceSelection()

  return {
    slotId: 'slot-1',
    userId: 'user-101',
    serviceDate: selection.serviceDate,
    startTime: selection.startTime,
    durationMinutes: '60',
  }
}

type ApiStatus = 'checking' | 'connected' | 'unavailable'

type Notice =
  | { type: 'success'; reservation: Reservation }
  | { type: 'error'; title: string; message: string }
  | null

export function ReservationPage() {
  const [initialFormValues] = useState(createInitialFormValues)
  const [formValues, setFormValues] = useState(initialFormValues)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [availability, setAvailability] = useState<AvailableWindow | null>(null)
  const [serviceWindow, setServiceWindow] = useState<AvailableWindow | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const availabilityRequestId = useRef(0)

  const selectedSlotId = formValues.slotId.trim()
  const activeServiceWindow =
    serviceWindow?.serviceDate === formValues.serviceDate
      ? serviceWindow
      : null

  const refreshAvailability = useCallback(async (
    slotId: string,
    serviceDate: string,
  ) => {
    const normalizedSlotId = slotId.trim()
    if (!normalizedSlotId || !serviceDate) {
      setAvailability(null)
      setAvailabilityError(
        'Enter a slot ID and service date before checking availability.',
      )
      return
    }

    const requestId = ++availabilityRequestId.current

    setIsLoadingAvailability(true)
    setAvailabilityError(null)
    setApiStatus('checking')

    try {
      const result = await getLongestAvailableWindow(
        normalizedSlotId,
        serviceDate,
      )

      if (requestId === availabilityRequestId.current) {
        setAvailability(result)
        setServiceWindow(result)
        setApiStatus('connected')
      }
    } catch (error) {
      if (requestId === availabilityRequestId.current) {
        setAvailability(null)
        setAvailabilityError(getErrorMessage(error, 'Could not retrieve availability.'))
        setApiStatus(isReachableApiError(error) ? 'connected' : 'unavailable')
      }
    } finally {
      if (requestId === availabilityRequestId.current) {
        setIsLoadingAvailability(false)
      }
    }
  }, [])

  useEffect(() => {
    void refreshAvailability(
      initialFormValues.slotId,
      initialFormValues.serviceDate,
    )
  }, [initialFormValues, refreshAvailability])

  function handleFormChange(values: ReservationFormValues) {
    const serviceDateChanged = values.serviceDate !== formValues.serviceDate

    if (
      values.slotId !== formValues.slotId ||
      values.serviceDate !== formValues.serviceDate
    ) {
      availabilityRequestId.current += 1
      setAvailability(null)
      setAvailabilityError(null)
      setIsLoadingAvailability(false)
    }

    if (serviceDateChanged) {
      setServiceWindow(null)
    }

    setFormValues(values)

    if (serviceDateChanged) {
      void refreshAvailability(values.slotId, values.serviceDate)
    }
  }

  async function handleCreateReservation(request: CreateReservationRequest) {
    setIsSubmitting(true)
    setNotice(null)
    setApiStatus('checking')

    try {
      const created = await createReservation(request)
      setReservations((current) => [created, ...current])
      setFormValues((current) => ({
        ...current,
        slotId: created.slotId,
        userId: created.userId,
        serviceDate: getServiceDate(created.startUtc),
        startTime: getServiceTime(created.startUtc),
      }))
      setNotice({ type: 'success', reservation: created })
      setApiStatus('connected')
      setIsSubmitting(false)
      void refreshAvailability(created.slotId, getServiceDate(created.startUtc))
    } catch (error) {
      setApiStatus(isReachableApiError(error) ? 'connected' : 'unavailable')

      if (error instanceof ApiError && error.status === 409) {
        setNotice({
          type: 'error',
          title: 'Reservation conflict',
          message:
            error.problem?.detail ??
            'That selected time is no longer available. Choose another opening.',
        })
        void refreshAvailability(
          request.slotId,
          getServiceDate(request.startUtc),
        )
      } else {
        setNotice({
          type: 'error',
          title: 'Reservation failed',
          message: getErrorMessage(error, 'The reservation could not be created.'),
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="reservation-page">
      <div className="dashboard-shell">
        <header className="page-header">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">
              <span>R</span>
            </div>
            <div>
              <p className="product-label">Slot operations</p>
              <h1>Reservation System</h1>
              <p className="page-subtitle">ASP.NET Core Web API + React TypeScript</p>
            </div>
          </div>

          <div
            className={`api-status api-status--${apiStatus}`}
            role="status"
            aria-live="polite"
            title="Reflects the most recent real API request"
          >
            <span className="api-status__dot" aria-hidden="true" />
            <span>{getApiStatusLabel(apiStatus)}</span>
          </div>
        </header>

        <div className="header-rule">
          <span>Selected-time reservations</span>
          <span>Fixed 09:00–17:00 · Malaysia time</span>
        </div>

        {notice?.type === 'success' && (
          <Alert
            variant="success"
            title="Reservation confirmed"
            message="The backend accepted and persisted this reservation."
            onDismiss={() => setNotice(null)}
          >
            <dl className="alert__details">
              <div>
                <dt>Reservation ID</dt>
                <dd>{notice.reservation.id}</dd>
              </div>
              <div>
                <dt>User ID</dt>
                <dd>{notice.reservation.userId}</dd>
              </div>
              <div>
                <dt>Slot ID</dt>
                <dd>{notice.reservation.slotId}</dd>
              </div>
              <div>
                <dt>Start time</dt>
                <dd>{formatDateTime(notice.reservation.startUtc)}</dd>
              </div>
              <div>
                <dt>End time</dt>
                <dd>{formatDateTime(notice.reservation.endUtc)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDurationMinutes(notice.reservation.durationMinutes)}</dd>
              </div>
            </dl>
          </Alert>
        )}

        {notice?.type === 'error' && (
          <Alert
            variant="error"
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        )}

        <div className="primary-grid">
          <ReservationForm
            values={formValues}
            serviceWindow={activeServiceWindow}
            isSubmitting={isSubmitting}
            onChange={handleFormChange}
            onSubmit={handleCreateReservation}
          />
          <AvailabilityCard
            slotId={selectedSlotId}
            serviceDate={formValues.serviceDate}
            window={availability}
            isLoading={isLoadingAvailability}
            error={availabilityError}
            onRefresh={() =>
              void refreshAvailability(selectedSlotId, formValues.serviceDate)
            }
          />
        </div>

        <ReservationList reservations={reservations} />

        <footer className="page-footer">
          <p>
            The reservation table is session-only because the current API does not
            expose a collection endpoint.
          </p>
          <p>Backend response data remains the source of truth.</p>
        </footer>
      </div>
    </main>
  )
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function isReachableApiError(error: unknown): boolean {
  return error instanceof ApiError && error.status !== null
}

function getApiStatusLabel(status: ApiStatus): string {
  if (status === 'connected') {
    return 'API connected'
  }

  if (status === 'unavailable') {
    return 'API unavailable'
  }

  return 'Checking API'
}
