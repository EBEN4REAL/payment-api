import { useState } from 'react'
import { ApiError, createPayment } from '../api'
import type { Payment, PaymentInput } from '../types'
import { emptyPayment } from '../format'
import PaymentForm from './PaymentForm'

type Props = {
  onCreated: (payment: Payment) => void
}

type Message = { kind: 'success' | 'error'; text: string }

export default function CreatePaymentCard({ onCreated }: Props) {
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())
  const [lastRequest, setLastRequest] = useState<{ input: PaymentInput; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  // Changing the key remounts the form, which clears it for the next payment.
  const [formVersion, setFormVersion] = useState(0)

  async function send(input: PaymentInput, key: string, isReplay: boolean) {
    setBusy(true)
    setMessage(null)
    try {
      const payment = await createPayment(input, key)
      setLastRequest({ input, key })
      onCreated(payment)
      setMessage({
        kind: 'success',
        text: isReplay
          ? `Same key sent again: the API returned the existing payment #${payment.id} instead of creating a duplicate.`
          : `Created payment #${payment.id}.`,
      })
      if (!isReplay) {
        // Each new payment gets a new key.
        setIdempotencyKey(crypto.randomUUID())
        setFormVersion((v) => v + 1)
      }
    } catch (err) {
      setMessage({ kind: 'error', text: describeError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>New payment</h2>
      <PaymentForm
        key={formVersion}
        initial={emptyPayment}
        submitLabel="Create payment"
        busy={busy}
        onSubmit={(input) => send(input, idempotencyKey, false)}
      >
        <label>
          Idempotency-Key
          <div className="inline">
            <input
              className="mono"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
            />
            <button type="button" onClick={() => setIdempotencyKey(crypto.randomUUID())}>
              New key
            </button>
            {lastRequest && (
              <button
                type="button"
                title="Put the previous key in the field, then submit different details to see a 422"
                onClick={() => setIdempotencyKey(lastRequest.key)}
              >
                Use last key
              </button>
            )}
          </div>
        </label>
      </PaymentForm>

      {lastRequest && (
        <div className="replay">
          <button type="button" disabled={busy} onClick={() => send(lastRequest.input, lastRequest.key, true)}>
            Resend last payment with the same key
          </button>
          <p className="hint">Simulates a client retry. No duplicate should be created.</p>
        </div>
      )}

      {message && <p className={message.kind}>{message.text}</p>}
    </section>
  )
}

function describeError(err: unknown) {
  if (!(err instanceof ApiError)) return 'Something went wrong'
  switch (err.status) {
    case 422:
      return `422: ${err.message}. That key was already used for a payment with different details.`
    case 409:
      return `409: ${err.message}`
    default:
      return `${err.status || 'Error'}: ${err.message}`
  }
}
