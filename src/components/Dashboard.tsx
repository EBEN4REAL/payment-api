import { useEffect, useState } from 'react'
import {
  ApiError,
  breakAccessToken,
  deletePayment,
  listPayments,
  logout,
  refreshSession,
  updatePayment,
} from '../api'
import { PAYMENT_STATUSES } from '../types'
import type { Page, Payment, PaymentInput, PaymentStatus, Session } from '../types'
import CreatePaymentCard from './CreatePaymentCard'
import LookupCard from './LookupCard'
import PaymentForm from './PaymentForm'
import PaymentsTable from './PaymentsTable'

type Props = {
  session: Extract<Session, { status: 'signedIn' }>
}

const PAGE_SIZE = 10

export default function Dashboard({ session }: Props) {
  const [result, setResult] = useState<Page<Payment> | null>(null)
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  // Incremented by the Reload button to fetch the list again.
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    // Ignore a response that arrives after unmount or after a newer reload started.
    let ignore = false

    listPayments({ status: statusFilter || undefined, page, size: PAGE_SIZE })
      .then((next) => {
        if (ignore) return
        // Deleting the only payment on the last page leaves us past the end: step back.
        if (next.content.length === 0 && next.page > 0) {
          setPage(Math.max(next.totalPages - 1, 0))
          return
        }
        setResult(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(errorText(err))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [page, statusFilter, reloadCount])

  const payments = result?.content ?? []

  function reloadPayments() {
    setLoading(true)
    setReloadCount((count) => count + 1)
  }

  function goToPage(next: number) {
    setLoading(true)
    setPage(next)
  }

  function changeStatusFilter(next: PaymentStatus | '') {
    setLoading(true)
    setStatusFilter(next)
    setPage(0)
  }

  async function handleUpdate(input: PaymentInput) {
    if (!editing) return
    setBusyId(editing.id)
    setEditError(null)
    try {
      const updated = await updatePayment(editing.id, input)
      setResult((current) =>
        current && { ...current, content: current.content.map((p) => (p.id === updated.id ? updated : p)) },
      )
      setEditing(null)
    } catch (err) {
      setEditError(errorText(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(payment: Payment) {
    if (!window.confirm(`Delete payment #${payment.id}? It will be soft-deleted (is_deleted = 1).`)) return
    setBusyId(payment.id)
    setError(null)
    try {
      await deletePayment(payment.id)
      if (editing?.id === payment.id) setEditing(null)
      // Refetch so the next payment moves up into this page and the totals stay right.
      reloadPayments()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusyId(null)
    }
  }

  // New payments are newest, so they appear at the top of the first page.
  // A replayed request returns an existing payment; refetching handles that too.
  function handleCreated() {
    setPage(0)
    reloadPayments()
  }

  return (
    <>
      <header className="header">
        <div>
          <h1>Payment UI</h1>
          <p className="muted">
            Signed in as <strong>{session.email}</strong> ({session.roles.join(', ')}) · access token expires at{' '}
            {new Date(session.expiresAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="actions">
          <button type="button" onClick={breakAccessToken} title="The next request gets a 401 and has to refresh">
            Break access token
          </button>
          <button type="button" onClick={() => void refreshSession()}>
            Refresh token now
          </button>
          <button type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="grid">
        <div className="stack">
          <CreatePaymentCard onCreated={handleCreated} />
          <LookupCard />
        </div>

        <div className="stack">
          {editing && (
            <section className="card highlight">
              <h2>Edit payment #{editing.id}</h2>
              <PaymentForm
                key={editing.id}
                initial={{
                  sourceAccount: editing.sourceAccount,
                  destinationAccount: editing.destinationAccount,
                  amount: String(editing.amount),
                  currency: editing.currency,
                }}
                submitLabel="Save changes"
                busy={busyId === editing.id}
                onSubmit={handleUpdate}
                onCancel={() => {
                  setEditing(null)
                  setEditError(null)
                }}
              />
              {editError && <p className="error">{editError}</p>}
            </section>
          )}

          <section className="card">
            <div className="card-header">
              <h2>Payments</h2>
              <div className="actions">
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(event) => changeStatusFilter(event.target.value as PaymentStatus | '')}
                >
                  <option value="">All statuses</option>
                  {PAYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={reloadPayments} disabled={loading}>
                  {loading ? 'Loading…' : 'Reload'}
                </button>
              </div>
            </div>
            <p className="hint">
              GET /api/payments?status=&amp;page=&amp;size=: newest first, deleted payments are excluded.
            </p>
            {error && <p className="error">{error}</p>}
            <PaymentsTable
              payments={payments}
              emptyMessage={statusFilter ? `No ${statusFilter} payments.` : 'No payments yet. Create one to get started.'}
              busyId={busyId}
              onEdit={(payment) => {
                setEditing(payment)
                setEditError(null)
              }}
              onDelete={handleDelete}
            />
            {result && result.totalPages > 1 && (
              <div className="pager">
                <button type="button" onClick={() => goToPage(result.page - 1)} disabled={loading || result.page === 0}>
                  Previous
                </button>
                <span className="muted">
                  Page {result.page + 1} of {result.totalPages} · {result.totalElements} payments
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(result.page + 1)}
                  disabled={loading || result.page + 1 >= result.totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function errorText(err: unknown) {
  return err instanceof ApiError ? `${err.status || 'Error'}: ${err.message}` : 'Something went wrong'
}
