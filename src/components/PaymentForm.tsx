import { useState, type FormEvent, type ReactNode } from 'react'
import type { PaymentInput } from '../types'

type Props = {
  initial: PaymentInput
  submitLabel: string
  busy: boolean
  onSubmit: (input: PaymentInput) => void
  onCancel?: () => void
  children?: ReactNode
}

export default function PaymentForm({ initial, submitLabel, busy, onSubmit, onCancel, children }: Props) {
  const [values, setValues] = useState<PaymentInput>(initial)

  function update(field: keyof PaymentInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(values)
  }

  // noValidate: let the API validate, so its error messages can be tested.
  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="row">
        <label>
          Source account
          <input
            inputMode="numeric"
            placeholder="10 digits"
            value={values.sourceAccount}
            onChange={(e) => update('sourceAccount', e.target.value)}
          />
        </label>
        <label>
          Destination account
          <input
            inputMode="numeric"
            placeholder="10 digits"
            value={values.destinationAccount}
            onChange={(e) => update('destinationAccount', e.target.value)}
          />
        </label>
      </div>
      <div className="row">
        <label>
          Amount
          <input
            inputMode="decimal"
            placeholder="5000.00"
            value={values.amount}
            onChange={(e) => update('amount', e.target.value)}
          />
        </label>
        <label>
          Currency
          <input value={values.currency} onChange={(e) => update('currency', e.target.value)} />
        </label>
      </div>

      {children}

      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Sending…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
