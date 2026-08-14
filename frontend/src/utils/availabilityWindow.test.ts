import { describe, expect, it } from 'vitest'
import {
  combineServiceDateAndTime,
  createDefaultServiceSelection,
  getLatestStartTime,
  getServiceDate,
  getServiceTime,
} from './availabilityWindow'

describe('fixed Malaysia service window helpers', () => {
  it('suggests opening time before the service day starts', () => {
    const now = new Date('2026-08-13T00:00:00Z') // 08:00 Malaysia time

    expect(createDefaultServiceSelection(now)).toEqual({
      serviceDate: '2026-08-13',
      startTime: '09:00',
    })
  })

  it('moves to the next service day when a default booking cannot fit', () => {
    const now = new Date('2026-08-13T08:30:00Z') // 16:30 Malaysia time

    expect(createDefaultServiceSelection(now, 60)).toEqual({
      serviceDate: '2026-08-14',
      startTime: '09:00',
    })
  })

  it('converts selected Malaysia time to UTC without browser-timezone drift', () => {
    const start = combineServiceDateAndTime('2026-08-13', '11:00')

    expect(start.toISOString()).toBe('2026-08-13T03:00:00.000Z')
    expect(getServiceDate(start)).toBe('2026-08-13')
    expect(getServiceTime(start)).toBe('11:00')
  })

  it('limits a 120-minute reservation to a latest start of 15:00', () => {
    expect(getLatestStartTime(120)).toBe('15:00')
  })
})
