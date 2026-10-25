import { useState, type FormEvent } from 'react'
import { ApiError, getPayment } from '../api'
import type { Payment } from '../types'
import { formatAmount } from '../format'

export default function LookupCard() {
  const [id, setId] = useState('')
  const [result, setResult] = useState<Payment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    setError(null)
    try {
      setResult(await getPayment(Number(id)))
    } catch (err) {
      setError(err instanceof ApiError ? `${err.status || 'Error'}: ${err.message}` : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Look up by ID</h2>
      <p className="hint">Try the ID of a deleted payment: it should return 404.</p>
      <form onSubmit={handleSubmit} className="inline" noValidate>
        <input inputMode="numeric" placeholder="Payment ID" value={id} onChange={(e) => setId(e.target.value)} />
        <button type="submit" disabled={busy || id.trim() === ''}>
          Get
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <dl className="details">
          <dt>ID</dt>
          <dd className="mono">#{result.id}</dd>
          <dt>From → To</dt>
          <dd className="mono">
            {result.sourceAccount} → {result.destinationAccount}
          </dd>
          <dt>Amount</dt>
          <dd>{formatAmount(result.amount, result.currency)}</dd>
          <dt>Status</dt>
          <dd>{result.status}</dd>
          <dt>Created</dt>
          <dd>{new Date(result.createdAt).toLocaleString()}</dd>
        </dl>
      )}
    </section>
  )
}
