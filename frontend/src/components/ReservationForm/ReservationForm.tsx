import { useState, type ChangeEvent, type FormEvent } from 'react'
import type {
  AvailableWindow,
  CreateReservationRequest,
} from '../../types/reservation'
import {
  createSelectedStartFromWindow,
  FIXED_WINDOW_DURATION_MINUTES,
  FIXED_WINDOW_END_TIME,
  FIXED_WINDOW_START_TIME,
  getLatestStartTime,
  getLatestStartTimeFromWindow,
  getServiceDate,
  getServiceTime,
  getWindowDurationMinutes,
} from '../../utils/availabilityWindow'
import './ReservationForm.css'

export interface ReservationFormValues {
  slotId: string
  userId: string
  serviceDate: string
  startTime: string
  durationMinutes: string
}

const idPattern = /^[A-Za-z0-9._-]+$/

interface ReservationFormProps {
  values: ReservationFormValues
  serviceWindow: AvailableWindow | null
  isSubmitting: boolean
  onChange: (values: ReservationFormValues) => void
  onSubmit: (request: CreateReservationRequest) => Promise<void>
}

type FieldErrors = Partial<Record<keyof ReservationFormValues, string>>

export function ReservationForm({
  values,
  serviceWindow,
  isSubmitting,
  onChange,
  onSubmit,
}: ReservationFormProps) {
  const [errors, setErrors] = useState<FieldErrors>({})
  const windowStartTime = serviceWindow
    ? getServiceTime(serviceWindow.searchFromUtc, serviceWindow.timeZoneId)
    : FIXED_WINDOW_START_TIME
  const windowEndTime = serviceWindow
    ? getServiceTime(serviceWindow.searchToUtc, serviceWindow.timeZoneId)
    : FIXED_WINDOW_END_TIME
  const maximumDuration = serviceWindow
    ? getWindowDurationMinutes(
        serviceWindow.searchFromUtc,
        serviceWindow.searchToUtc,
      )
    : FIXED_WINDOW_DURATION_MINUTES
  const selectedDuration = Number(values.durationMinutes)
  const latestStartTime = serviceWindow
    ? getLatestStartTimeFromWindow(
        serviceWindow.searchToUtc,
        selectedDuration,
        serviceWindow.timeZoneId,
      )
    : getLatestStartTime(selectedDuration)

  function updateField(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target.name as keyof ReservationFormValues
    const nextValues = { ...values, [field]: event.target.value }
    onChange(nextValues)
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate(values, serviceWindow)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    if (!serviceWindow) {
      return
    }

    void onSubmit({
      slotId: values.slotId.trim(),
      userId: values.userId.trim(),
      startUtc: createSelectedStartFromWindow(
        serviceWindow.searchFromUtc,
        values.startTime,
        serviceWindow.timeZoneId,
      ).toISOString(),
      durationMinutes: Number(values.durationMinutes),
    })
  }

  return (
    <section className="dashboard-card reservation-form-card" aria-labelledby="form-title">
      <div className="card-heading">
        <div>
          <p className="card-eyebrow">New booking</p>
          <h2 id="form-title">Create Reservation</h2>
        </div>
        <span className="step-badge" aria-hidden="true">
          01
        </span>
      </div>

      <p className="card-description">
        Choose a start time inside the API-defined {windowStartTime}–
        {windowEndTime} window. The API calculates the end time and enforces
        the limit.
      </p>

      <form className="reservation-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="slot-id">Slot ID</label>
          <input
            id="slot-id"
            name="slotId"
            type="text"
            value={values.slotId}
            onChange={updateField}
            disabled={isSubmitting}
            maxLength={100}
            autoComplete="off"
            placeholder="e.g. slot-1"
            aria-invalid={Boolean(errors.slotId)}
            aria-describedby={errors.slotId ? 'slot-id-error' : 'slot-id-help'}
          />
          {errors.slotId ? (
            <p className="field-error" id="slot-id-error">
              {errors.slotId}
            </p>
          ) : (
            <p className="field-help" id="slot-id-help">
              Letters, numbers, dots, underscores, and hyphens
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="user-id">User ID</label>
          <input
            id="user-id"
            name="userId"
            type="text"
            value={values.userId}
            onChange={updateField}
            disabled={isSubmitting}
            maxLength={100}
            autoComplete="off"
            placeholder="e.g. user-101"
            aria-invalid={Boolean(errors.userId)}
            aria-describedby={errors.userId ? 'user-id-error' : 'user-id-help'}
          />
          {errors.userId ? (
            <p className="field-error" id="user-id-error">
              {errors.userId}
            </p>
          ) : (
            <p className="field-help" id="user-id-help">
              Letters, numbers, dots, underscores, and hyphens
            </p>
          )}
        </div>

        <div className="form-field-row">
          <div className="form-field">
            <label htmlFor="service-date">Service Date</label>
            <input
              id="service-date"
              name="serviceDate"
              type="date"
              value={values.serviceDate}
              onChange={updateField}
              disabled={isSubmitting}
              min={getServiceDate(new Date())}
              aria-invalid={Boolean(errors.serviceDate)}
              aria-describedby={
                errors.serviceDate ? 'service-date-error' : 'service-date-help'
              }
            />
            {errors.serviceDate ? (
              <p className="field-error" id="service-date-error">
                {errors.serviceDate}
              </p>
            ) : (
              <p className="field-help" id="service-date-help">
                Fixed service day
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="start-time">Start Time</label>
            <input
              id="start-time"
              name="startTime"
              type="time"
              value={values.startTime}
              onChange={updateField}
              disabled={isSubmitting}
              min={windowStartTime}
              max={latestStartTime}
              step={60}
              aria-invalid={Boolean(errors.startTime)}
              aria-describedby={
                errors.startTime ? 'start-time-error' : 'start-time-help'
              }
            />
            {errors.startTime ? (
              <p className="field-error" id="start-time-error">
                {errors.startTime}
              </p>
            ) : (
              <p className="field-help" id="start-time-help">
                {serviceWindow?.timeZoneId ?? 'Loading API schedule'}
              </p>
            )}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="duration-minutes">Duration Minutes</label>
          <div className="number-input-wrap">
            <input
              id="duration-minutes"
              name="durationMinutes"
              type="number"
              inputMode="numeric"
              value={values.durationMinutes}
              onChange={updateField}
              disabled={isSubmitting}
              min={1}
              max={maximumDuration}
              step={1}
              placeholder="60"
              aria-invalid={Boolean(errors.durationMinutes)}
              aria-describedby={
                errors.durationMinutes ? 'duration-error' : 'duration-help'
              }
            />
            <span aria-hidden="true">min</span>
          </div>
          {errors.durationMinutes ? (
            <p className="field-error" id="duration-error">
              {errors.durationMinutes}
            </p>
          ) : (
            <p className="field-help" id="duration-help">
              Whole number between 1 and {maximumDuration}
            </p>
          )}
        </div>

        <button
          className="primary-button"
          type="submit"
          disabled={isSubmitting || !serviceWindow}
        >
          <span>{isSubmitting ? 'Reserving...' : 'Reserve Slot'}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  )
}

function validate(
  values: ReservationFormValues,
  serviceWindow: AvailableWindow | null,
): FieldErrors {
  const errors: FieldErrors = {}
  const duration = Number(values.durationMinutes)

  if (!values.slotId.trim()) {
    errors.slotId = 'Enter a slot ID.'
  } else if (values.slotId.trim().length > 100) {
    errors.slotId = 'Slot ID cannot exceed 100 characters.'
  } else if (!idPattern.test(values.slotId.trim())) {
    errors.slotId = 'Use only letters, numbers, dots, underscores, and hyphens.'
  }

  if (!values.userId.trim()) {
    errors.userId = 'Enter a user ID.'
  } else if (values.userId.trim().length > 100) {
    errors.userId = 'User ID cannot exceed 100 characters.'
  } else if (!idPattern.test(values.userId.trim())) {
    errors.userId = 'Use only letters, numbers, dots, underscores, and hyphens.'
  }

  if (!values.durationMinutes) {
    errors.durationMinutes = 'Enter a duration.'
  } else if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration >
      (serviceWindow
        ? getWindowDurationMinutes(
            serviceWindow.searchFromUtc,
            serviceWindow.searchToUtc,
          )
        : FIXED_WINDOW_DURATION_MINUTES)
  ) {
    const maximumDuration = serviceWindow
      ? getWindowDurationMinutes(
          serviceWindow.searchFromUtc,
          serviceWindow.searchToUtc,
        )
      : FIXED_WINDOW_DURATION_MINUTES
    errors.durationMinutes = `Duration must be a whole number from 1 to ${maximumDuration}.`
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.serviceDate)) {
    errors.serviceDate = 'Choose a service date.'
  }

  if (!/^\d{2}:\d{2}$/.test(values.startTime)) {
    errors.startTime = 'Choose a start time.'
  }

  if (!serviceWindow || serviceWindow.serviceDate !== values.serviceDate) {
    errors.startTime = 'Wait for the API to load this service date.'
  }

  if (
    serviceWindow &&
    !errors.serviceDate &&
    !errors.startTime &&
    !errors.durationMinutes
  ) {
    const start = createSelectedStartFromWindow(
      serviceWindow.searchFromUtc,
      values.startTime,
      serviceWindow.timeZoneId,
    )
    const windowStart = new Date(serviceWindow.searchFromUtc)
    const windowEnd = new Date(serviceWindow.searchToUtc)
    const end = new Date(start.getTime() + duration * 60_000)

    if (
      Number.isNaN(start.getTime()) ||
      start < windowStart ||
      start >= windowEnd ||
      end > windowEnd
    ) {
      errors.startTime =
        `Choose a start time that keeps the reservation within ` +
        `${getServiceTime(windowStart, serviceWindow.timeZoneId)}–` +
        `${getServiceTime(windowEnd, serviceWindow.timeZoneId)}.`
    } else if (start.getTime() < Date.now()) {
      errors.startTime = 'Choose a future start time.'
    }
  }

  return errors
}
