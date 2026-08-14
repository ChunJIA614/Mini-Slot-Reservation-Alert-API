const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
  timeZone: 'Asia/Kuala_Lumpur',
})

const durationFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

export function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Invalid date' : dateTimeFormatter.format(date)
}

export function formatDurationMinutes(value: number): string {
  return `${durationFormatter.format(value)} min`
}
