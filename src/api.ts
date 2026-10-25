import type {
  AccessTokenResponse,
  LogEntry,
  Page,
  Payment,
  PaymentInput,
  PaymentStatus,
  Session,
  UserResponse,
} from './types'

const REFRESH_LOCK_NAME = 'payment-ui.refresh'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

// ---------- Activity log (shown in the UI so you can see every request) ----------

let logEntries: LogEntry[] = []
let nextLogId = 1
const logListeners = new Set<() => void>()

function addLog(entry: Omit<LogEntry, 'id' | 'time'>) {
  logEntries = [{ ...entry, id: nextLogId++, time: new Date() }, ...logEntries].slice(0, 100)
  logListeners.forEach((listener) => listener())
}

export const activityLog = {
  subscribe(listener: () => void) {
    logListeners.add(listener)
    return () => logListeners.delete(listener)
  },
  getSnapshot: () => logEntries,
  clear() {
    logEntries = []
    logListeners.forEach((listener) => listener())
  },
}

// ---------- Session ----------
// The access token is kept in memory only, so it is gone after a reload.
// The refresh token is an HttpOnly cookie set by the API: JavaScript can't read
// it, and the browser sends it automatically to /api/auth. On page load we call
// /api/auth/refresh to find out whether there is still a valid session.

let accessToken: string | null = null
let session: Session = { status: 'loading' }

// Earlier versions kept the refresh token in sessionStorage. Remove any leftover
// copy so it isn't exposed to page scripts.
sessionStorage.removeItem('payment-ui.refreshToken')
const sessionListeners = new Set<() => void>()

function setSession(next: Session) {
  session = next
  sessionListeners.forEach((listener) => listener())
}

export const sessionStore = {
  subscribe(listener: () => void) {
    sessionListeners.add(listener)
    return () => sessionListeners.delete(listener)
  },
  getSnapshot: () => session,
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? ''
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
}

function storeAccessToken(tokens: AccessTokenResponse) {
  accessToken = tokens.accessToken

  const claims = decodeJwtPayload(tokens.accessToken)
  setSession({
    status: 'signedIn',
    email: String(claims.email ?? ''),
    roles: Array.isArray(claims.roles) ? claims.roles.map(String) : [],
    expiresAt: Number(claims.exp) * 1000,
  })
}

function clearSession() {
  accessToken = null
  setSession({ status: 'signedOut' })
}

// ---------- HTTP ----------

type RequestOptions = {
  body?: unknown
  headers?: Record<string, string>
  auth?: boolean
  retryOnUnauthorized?: boolean
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers = {}, auth = true, retryOnUnauthorized = true } = options

  const requestHeaders: Record<string, string> = { ...headers }
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
  if (auth && accessToken) requestHeaders.Authorization = `Bearer ${accessToken}`

  const started = performance.now()
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    addLog({
      method,
      path,
      status: null,
      durationMs: Math.round(performance.now() - started),
      idempotencyKey: headers['Idempotency-Key'],
      requestBody: redact(body),
      note: 'Network error: is the payment-api running on port 8080?',
    })
    throw new ApiError(0, 'Could not reach the API. Is payment-api running on port 8080?', null)
  }

  const text = await response.text()
  let responseBody: unknown = undefined
  if (text) {
    try {
      responseBody = JSON.parse(text)
    } catch {
      responseBody = text
    }
  }

  addLog({
    method,
    path,
    status: response.status,
    durationMs: Math.round(performance.now() - started),
    idempotencyKey: headers['Idempotency-Key'],
    requestBody: redact(body),
    responseBody: redact(responseBody),
  })

  // Access token expired or invalid: get a new one with the refresh token, then retry once.
  if (response.status === 401 && auth && retryOnUnauthorized) {
    if (await refreshSession()) {
      return request<T>(method, path, { ...options, retryOnUnauthorized: false })
    }
    throw new ApiError(401, 'Your session has expired. Please sign in again.', responseBody)
  }

  if (!response.ok) {
    const detail =
      typeof responseBody === 'object' && responseBody !== null && 'detail' in responseBody
        ? String((responseBody as { detail: unknown }).detail)
        : `${response.status} ${response.statusText}`
    throw new ApiError(response.status, detail, responseBody)
  }

  return responseBody as T
}

// Hide passwords and tokens in the activity log.
function redact(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const key of ['password', 'accessToken']) {
    if (typeof copy[key] === 'string') copy[key] = `${(copy[key] as string).slice(0, 8)}…`
  }
  return copy
}

// Only one refresh may run at a time. Refresh tokens are single-use, and the API
// treats a reused token as theft and signs the user out everywhere.
// - Within this tab, concurrent callers share one in-flight refresh.
// - Across tabs (which share the cookie), a Web Lock makes them take turns, so a
//   waiting tab sends the already-rotated cookie, not the one just used.
let refreshInFlight: Promise<boolean> | null = null

export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = navigator.locks
      .request(REFRESH_LOCK_NAME, doRefresh)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

async function doRefresh(): Promise<boolean> {
  try {
    const tokens = await request<AccessTokenResponse>('POST', '/api/auth/refresh', { auth: false })
    storeAccessToken(tokens)
    return true
  } catch {
    clearSession()
    return false
  }
}

// ---------- Auth endpoints ----------

export function register(email: string, password: string) {
  return request<UserResponse>('POST', '/api/auth/register', {
    body: { email, password },
    auth: false,
  })
}

export async function login(email: string, password: string) {
  const tokens = await request<AccessTokenResponse>('POST', '/api/auth/login', {
    body: { email, password },
    auth: false,
  })
  storeAccessToken(tokens)
}

// The API revokes the refresh token and deletes the cookie.
export async function logout() {
  try {
    await request<void>('POST', '/api/auth/logout', { auth: false })
  } finally {
    clearSession()
  }
}

// For testing: replace the access token with garbage so the next call gets a 401
// and the client has to refresh.
export function breakAccessToken() {
  accessToken = 'invalid-access-token'
  addLog({
    method: '—',
    path: '(local)',
    status: null,
    durationMs: 0,
    note: 'Access token replaced with an invalid one. The next request will trigger a refresh.',
  })
}

// ---------- Payment endpoints ----------

function toRequestBody(input: PaymentInput) {
  return {
    sourceAccount: input.sourceAccount.trim(),
    destinationAccount: input.destinationAccount.trim(),
    // Send what was typed; an empty or invalid amount is left for the API to reject.
    amount: input.amount.trim() === '' ? null : Number(input.amount),
    currency: input.currency.trim(),
  }
}

// Newest first. Leave status out to list every status.
export function listPayments({ status, page, size }: { status?: PaymentStatus; page: number; size: number }) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (status) params.set('status', status)
  return request<Page<Payment>>('GET', `/api/payments?${params}`)
}

export function getPayment(id: number) {
  return request<Payment>('GET', `/api/payments/${id}`)
}

export function createPayment(input: PaymentInput, idempotencyKey: string) {
  const headers: Record<string, string> = {}
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  return request<Payment>('POST', '/api/payments', { body: toRequestBody(input), headers })
}

export function updatePayment(id: number, input: PaymentInput) {
  return request<Payment>('PUT', `/api/payments/${id}`, { body: toRequestBody(input) })
}

export function deletePayment(id: number) {
  return request<void>('DELETE', `/api/payments/${id}`)
}
