import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/reservationService'
import type { AvailableWindow, Reservation } from '../../types/reservation'
import { ReservationPage } from './ReservationPage'

vi.mock('../../services/reservationService', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../services/reservationService')
  >()

  return {
    ...actual,
    createReservation: vi.fn(),
    getLongestAvailableWindow: vi.fn(),
  }
})

import {
  createReservation,
  getLongestAvailableWindow,
} from '../../services/reservationService'

const fullServiceWindow: AvailableWindow = {
  slotId: 'slot-1',
  serviceDate: '2026-08-13',
  timeZoneId: 'Asia/Kuala_Lumpur',
  searchFromUtc: '2026-08-13T01:00:00+00:00',
  searchToUtc: '2026-08-13T09:00:00+00:00',
  availableFromUtc: '2026-08-13T01:00:00+00:00',
  availableToUtc: '2026-08-13T09:00:00+00:00',
  durationMinutes: 480,
}

const createdReservation: Reservation = {
  id: '5f4cf7df-d183-49b0-b82d-2167c8ad6107',
  slotId: 'slot-1',
  userId: 'user-101',
  durationMinutes: 120,
  startUtc: '2026-08-13T03:00:00.000+00:00',
  endUtc: '2026-08-13T05:00:00.000+00:00',
}

const refreshedWindow: AvailableWindow = {
  ...fullServiceWindow,
  availableFromUtc: '2026-08-13T05:00:00+00:00',
  availableToUtc: '2026-08-13T09:00:00+00:00',
  durationMinutes: 240,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-13T00:00:00Z')) // 08:00 Malaysia time
  vi.clearAllMocks()
  vi.mocked(getLongestAvailableWindow).mockResolvedValue(fullServiceWindow)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ReservationPage', () => {
  it('books the selected 120-minute interval and renders the refreshed longest window', async () => {
    vi.mocked(getLongestAvailableWindow)
      .mockResolvedValueOnce(fullServiceWindow)
      .mockResolvedValue(refreshedWindow)
    vi.mocked(createReservation).mockResolvedValue(createdReservation)
    const user = userEvent.setup()
    render(<ReservationPage />)

    await waitFor(() => expect(getLongestAvailableWindow).toHaveBeenCalled())
    const startInput = screen.getByLabelText('Start Time')
    const durationInput = screen.getByLabelText('Duration Minutes')
    await user.clear(startInput)
    await user.type(startInput, '11:00')
    await user.clear(durationInput)
    await user.type(durationInput, '120')
    await user.click(screen.getByRole('button', { name: 'Reserve Slot' }))

    expect(await screen.findByText('Reservation confirmed')).toBeInTheDocument()
    expect(screen.getByText(createdReservation.id)).toBeInTheDocument()
    expect(createReservation).toHaveBeenCalledWith({
      slotId: 'slot-1',
      userId: 'user-101',
      startUtc: '2026-08-13T03:00:00.000Z',
      durationMinutes: 120,
    })
    expect(screen.getAllByText('Reserved')).toHaveLength(1)
    await waitFor(() =>
      expect(getLongestAvailableWindow).toHaveBeenCalledTimes(2),
    )
    expect(getLongestAvailableWindow).toHaveBeenNthCalledWith(
      1,
      'slot-1',
      '2026-08-13',
    )
    expect(getLongestAvailableWindow).toHaveBeenNthCalledWith(
      2,
      'slot-1',
      '2026-08-13',
    )
    expect(await screen.findByText('240 min')).toBeInTheDocument()
  })

  it('shows a concurrency conflict, refreshes availability, and adds no row', async () => {
    vi.mocked(createReservation).mockRejectedValue(
      new ApiError('Slot unavailable', 409, {
        status: 409,
        code: 'slot_unavailable',
        detail: 'The selected interval overlaps an existing reservation.',
      }),
    )
    const user = userEvent.setup()
    render(<ReservationPage />)

    await waitFor(() => expect(getLongestAvailableWindow).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Reserve Slot' }))

    expect(
      await screen.findByText(
        'The selected interval overlaps an existing reservation.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('No reservations yet.')).toBeInTheDocument()
    await waitFor(() =>
      expect(getLongestAvailableWindow).toHaveBeenCalledTimes(2),
    )
  })

  it('limits the time picker using the selected duration', async () => {
    const user = userEvent.setup()
    render(<ReservationPage />)

    await waitFor(() => expect(getLongestAvailableWindow).toHaveBeenCalled())
    const durationInput = screen.getByLabelText('Duration Minutes')
    await user.clear(durationInput)
    await user.type(durationInput, '120')

    expect(screen.getByLabelText('Start Time')).toHaveAttribute('min', '09:00')
    expect(screen.getByLabelText('Start Time')).toHaveAttribute('max', '15:00')
    expect(screen.getByLabelText('Start Time')).toHaveAttribute('step', '60')
  })

  it('blocks an interval that would finish after 17:00', async () => {
    const user = userEvent.setup()
    render(<ReservationPage />)

    await waitFor(() => expect(getLongestAvailableWindow).toHaveBeenCalled())
    const startInput = screen.getByLabelText('Start Time')
    const durationInput = screen.getByLabelText('Duration Minutes')
    await user.clear(startInput)
    await user.type(startInput, '16:00')
    await user.clear(durationInput)
    await user.type(durationInput, '120')
    await user.click(screen.getByRole('button', { name: 'Reserve Slot' }))

    expect(
      screen.getByText(
        'Choose a start time that keeps the reservation within 09:00–17:00.',
      ),
    ).toBeInTheDocument()
    expect(createReservation).not.toHaveBeenCalled()
  })

  it('blocks invalid duration before calling the API', async () => {
    const user = userEvent.setup()
    render(<ReservationPage />)

    await waitFor(() => expect(getLongestAvailableWindow).toHaveBeenCalled())
    const durationInput = screen.getByLabelText('Duration Minutes')
    await user.clear(durationInput)
    await user.type(durationInput, '0')
    await user.click(screen.getByRole('button', { name: 'Reserve Slot' }))

    expect(
      screen.getByText('Duration must be a whole number from 1 to 480.'),
    ).toBeInTheDocument()
    expect(createReservation).not.toHaveBeenCalled()
  })

  it('blocks a slot ID that cannot safely round-trip through the API route', async () => {
    const user = userEvent.setup()
    render(<ReservationPage />)

    await waitFor(() => expect(getLongestAvailableWindow).toHaveBeenCalled())
    const slotInput = screen.getByLabelText('Slot ID')
    await user.clear(slotInput)
    await user.type(slotInput, 'slot/with/slash')
    await user.click(screen.getByRole('button', { name: 'Reserve Slot' }))

    expect(
      screen.getByText('Use only letters, numbers, dots, underscores, and hyphens.'),
    ).toBeInTheDocument()
    expect(createReservation).not.toHaveBeenCalled()
  })
})
