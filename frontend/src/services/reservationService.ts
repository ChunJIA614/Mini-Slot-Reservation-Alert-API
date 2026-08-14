import type {
  ApiProblem,
  AvailableWindow,
  CreateReservationRequest,
  Reservation,
} from '../types/reservation'

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, '')

export class ApiError extends Error {
  public readonly status: number | null
  public readonly problem?: ApiProblem

  constructor(
    message: string,
    status: number | null,
    problem?: ApiProblem,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

export async function createReservation(
  request: CreateReservationRequest,
  signal?: AbortSignal,
): Promise<Reservation> {
  const payload = await requestJson(`${apiBaseUrl}/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  })

  if (!isReservation(payload)) {
    throw new ApiError('The API returned an unexpected reservation response.', 201)
  }

  return payload
}

export async function getLongestAvailableWindow(
  slotId: string,
  serviceDate: string,
  signal?: AbortSignal,
): Promise<AvailableWindow> {
  const search = new URLSearchParams({ serviceDate })
  const encodedSlotId = encodeURIComponent(slotId.trim())
  const payload = await requestJson(
    `${apiBaseUrl}/slots/${encodedSlotId}/availability/longest?${search}`,
    { signal },
  )

  if (!isAvailableWindow(payload)) {
    throw new ApiError('The API returned an unexpected availability response.', 200)
  }

  return payload
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(
      'Unable to reach the reservation API. Confirm that the backend is running.',
      null,
    )
  }

  const payload = await parseBody(response)

  if (!response.ok) {
    const problem = isApiProblem(payload) ? payload : undefined
    throw new ApiError(
      getProblemMessage(problem, response.status),
      response.status,
      problem,
    )
  }

  return payload
}

async function parseBody(response: Response): Promise<unknown> {
  const body = await response.text()

  if (!body) {
    return null
  }

  try {
    return JSON.parse(body) as unknown
  } catch {
    return body
  }
}

function getProblemMessage(problem: ApiProblem | undefined, status: number): string {
  if (problem?.detail) {
    return problem.detail
  }

  if (problem?.errors) {
    const firstValidationMessage = Object.values(problem.errors).flat()[0]
    if (firstValidationMessage) {
      return firstValidationMessage
    }
  }

  if (problem?.title) {
    return problem.title
  }

  if (status === 502 || status === 503 || status === 504) {
    return (
      'The frontend cannot reach the ASP.NET API. Start the backend on ' +
      'http://localhost:5050, or run npm run dev:full.'
    )
  }

  return `The reservation API returned HTTP ${status}.`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isApiProblem(value: unknown): value is ApiProblem {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.title === undefined || typeof value.title === 'string') &&
    (value.detail === undefined || typeof value.detail === 'string') &&
    (value.status === undefined || typeof value.status === 'number')
  )
}

function isReservation(value: unknown): value is Reservation {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slotId === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.durationMinutes === 'number' &&
    typeof value.startUtc === 'string' &&
    typeof value.endUtc === 'string'
  )
}

function isAvailableWindow(value: unknown): value is AvailableWindow {
  return (
    isRecord(value) &&
    typeof value.slotId === 'string' &&
    typeof value.serviceDate === 'string' &&
    typeof value.timeZoneId === 'string' &&
    typeof value.searchFromUtc === 'string' &&
    typeof value.searchToUtc === 'string' &&
    (typeof value.availableFromUtc === 'string' ||
      value.availableFromUtc === null) &&
    (typeof value.availableToUtc === 'string' || value.availableToUtc === null) &&
    typeof value.durationMinutes === 'number'
  )
}
