export interface CreateReservationRequest {
  slotId: string
  userId: string
  startUtc: string
  durationMinutes: number
}

export interface Reservation {
  id: string
  slotId: string
  userId: string
  durationMinutes: number
  startUtc: string
  endUtc: string
}

export interface AvailableWindow {
  slotId: string
  serviceDate: string
  timeZoneId: string
  searchFromUtc: string
  searchToUtc: string
  availableFromUtc: string | null
  availableToUtc: string | null
  durationMinutes: number
}

export interface ApiProblem {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  code?: string
  errors?: Record<string, string[]>
  traceId?: string
}
