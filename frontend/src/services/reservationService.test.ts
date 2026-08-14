import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Reservation } from '../types/reservation'
import {
  createReservation,
  getLongestAvailableWindow,
} from './reservationService'

const reservation: Reservation = {
  id: '5f4cf7df-d183-49b0-b82d-2167c8ad6107',
  slotId: 'slot-1',
  userId: 'user-101',
  durationMinutes: 60,
  startUtc: '2026-08-13T09:00:00.123+00:00',
  endUtc: '2026-08-13T10:00:00.123+00:00',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reservationService', () => {
  it('sends the exact backend reservation contract', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(reservation), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await createReservation({
      slotId: 'slot-1',
      userId: 'user-101',
      startUtc: '2026-08-13T01:00:00.000Z',
      durationMinutes: 60,
    })

    expect(result).toEqual(reservation)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/reservations')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      slotId: 'slot-1',
      userId: 'user-101',
      startUtc: '2026-08-13T01:00:00.000Z',
      durationMinutes: 60,
    })
  })

  it('keeps HTTP 409 as a typed conflict error', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'Slot unavailable',
          status: 409,
          detail: 'The slot is already reserved during the requested time window.',
          code: 'slot_unavailable',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createReservation({
        slotId: 'slot-1',
        userId: 'user-102',
        startUtc: '2026-08-13T01:00:00.000Z',
        durationMinutes: 60,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'The slot is already reserved during the requested time window.',
    })
  })

  it('asks the backend to derive the fixed window for a service date', async () => {
    const response = {
      slotId: 'slot.test',
      serviceDate: '2026-08-13',
      timeZoneId: 'Asia/Kuala_Lumpur',
      searchFromUtc: '2026-08-13T01:00:00+00:00',
      searchToUtc: '2026-08-13T09:00:00+00:00',
      availableFromUtc: '2026-08-13T01:00:00+00:00',
      availableToUtc: '2026-08-13T09:00:00+00:00',
      durationMinutes: 480,
    }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getLongestAvailableWindow(
      'slot.test',
      '2026-08-13',
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe(
      '/api/slots/slot.test/availability/longest?serviceDate=2026-08-13',
    )
  })

  it('explains when the development proxy cannot reach the backend', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Bad Gateway', { status: 502 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createReservation({
        slotId: 'slot-1',
        userId: 'user-101',
        startUtc: '2026-08-13T01:00:00.000Z',
        durationMinutes: 60,
      }),
    ).rejects.toMatchObject({
      status: 502,
      message:
        'The frontend cannot reach the ASP.NET API. Start the backend on ' +
        'http://localhost:5050, or run npm run dev:full.',
    })
  })
})
