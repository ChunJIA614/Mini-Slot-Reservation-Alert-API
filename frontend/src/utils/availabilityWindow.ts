export const SERVICE_TIME_ZONE = 'Asia/Kuala_Lumpur'
export const SERVICE_UTC_OFFSET = '+08:00'
export const FIXED_WINDOW_START_TIME = '09:00'
export const FIXED_WINDOW_END_TIME = '17:00'
export const FIXED_WINDOW_DURATION_MINUTES = 480

export interface DefaultServiceSelection {
  serviceDate: string
  startTime: string
}

const serviceDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const serviceTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SERVICE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function createDefaultServiceSelection(
  now = new Date(),
  durationMinutes = 60,
): DefaultServiceSelection {
  let serviceDate = getServiceDate(now)
  const currentMinutes = getServiceMinutes(now)
  const nextMinute = currentMinutes + 1
  const openingMinutes = 9 * 60
  const closingMinutes = 17 * 60

  if (nextMinute + durationMinutes > closingMinutes) {
    serviceDate = addServiceDays(serviceDate, 1)
    return { serviceDate, startTime: FIXED_WINDOW_START_TIME }
  }

  return {
    serviceDate,
    startTime: toTimeValue(Math.max(openingMinutes, nextMinute)),
  }
}

export function combineServiceDateAndTime(
  serviceDate: string,
  startTime: string,
): Date {
  return new Date(`${serviceDate}T${startTime}:00${SERVICE_UTC_OFFSET}`)
}

export function getLatestStartTime(durationMinutes: number): string {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    return FIXED_WINDOW_END_TIME
  }

  return toTimeValue(17 * 60 - Math.min(durationMinutes, FIXED_WINDOW_DURATION_MINUTES))
}

export function createSelectedStartFromWindow(
  searchFromUtc: string,
  startTime: string,
  timeZoneId: string,
): Date {
  const windowStart = new Date(searchFromUtc)
  const openingMinutes = parseTimeValue(
    getServiceTime(windowStart, timeZoneId),
  )
  const selectedMinutes = parseTimeValue(startTime)

  return new Date(
    windowStart.getTime() + (selectedMinutes - openingMinutes) * 60_000,
  )
}

export function getLatestStartTimeFromWindow(
  searchToUtc: string,
  durationMinutes: number,
  timeZoneId: string,
): string {
  const windowEnd = new Date(searchToUtc)
  if (
    Number.isNaN(windowEnd.getTime()) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1
  ) {
    return getServiceTime(windowEnd, timeZoneId)
  }

  return getServiceTime(
    new Date(windowEnd.getTime() - durationMinutes * 60_000),
    timeZoneId,
  )
}

export function getWindowDurationMinutes(
  searchFromUtc: string,
  searchToUtc: string,
): number {
  return Math.floor(
    (new Date(searchToUtc).getTime() - new Date(searchFromUtc).getTime()) /
      60_000,
  )
}

export function getServiceDate(
  value: Date | string,
  timeZoneId = SERVICE_TIME_ZONE,
): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const formatter =
    timeZoneId === SERVICE_TIME_ZONE
      ? serviceDateFormatter
      : new Intl.DateTimeFormat('en-CA', {
          timeZone: timeZoneId,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
  return partsToDate(formatter.formatToParts(date))
}

export function getServiceTime(
  value: Date | string,
  timeZoneId = SERVICE_TIME_ZONE,
): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const formatter =
    timeZoneId === SERVICE_TIME_ZONE
      ? serviceTimeFormatter
      : new Intl.DateTimeFormat('en-GB', {
          timeZone: timeZoneId,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
  const parts = formatter.formatToParts(date)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

function getServiceMinutes(date: Date): number {
  const [hour, minute] = getServiceTime(date).split(':').map(Number)
  return hour * 60 + minute
}

function addServiceDays(serviceDate: string, days: number): string {
  const date = new Date(`${serviceDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function partsToDate(parts: Intl.DateTimeFormatPart[]): string {
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

function toTimeValue(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${hour.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}`
}

function parseTimeValue(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}
