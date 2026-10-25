// Must match the API's PaymentStatus enum.
export const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export type Payment = {
  id: number
  sourceAccount: string
  destinationAccount: string
  amount: number
  currency: string
  status: PaymentStatus
  createdAt: string
}

// One page of a list. page is zero-based.
export type Page<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type PaymentInput = {
  sourceAccount: string
  destinationAccount: string
  amount: string
  currency: string
}

// The refresh token is not in the body: the API sets it as an HttpOnly cookie.
export type AccessTokenResponse = {
  accessToken: string
  tokenType: string
  expiresIn: number
}

export type UserResponse = {
  id: number
  email: string
  roles: string[]
}

export type LogEntry = {
  id: number
  time: Date
  method: string
  path: string
  status: number | null
  durationMs: number
  idempotencyKey?: string
  requestBody?: unknown
  responseBody?: unknown
  note?: string
}

export type Session =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; email: string; roles: string[]; expiresAt: number }
