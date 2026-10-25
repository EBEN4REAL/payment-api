import { formatAmount } from '../format'
import type { Payment } from '../types'

type Props = {
  payments: Payment[]
  emptyMessage: string
  busyId: number | null
  onEdit: (payment: Payment) => void
  onDelete: (payment: Payment) => void
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function PaymentsTable({ payments, emptyMessage, busyId, onEdit, onDelete }: Props) {
  if (payments.length === 0) {
    return <p className="muted">{emptyMessage}</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>From</th>
            <th>To</th>
            <th className="num">Amount</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td className="mono">#{payment.id}</td>
              <td className="mono">{payment.sourceAccount}</td>
              <td className="mono">{payment.destinationAccount}</td>
              <td className="num">{formatAmount(payment.amount, payment.currency)}</td>
              <td>
                <span className="badge">{payment.status}</span>
              </td>
              <td>{dateFormat.format(new Date(payment.createdAt))}</td>
              <td className="row-actions">
                <button type="button" onClick={() => onEdit(payment)} disabled={busyId === payment.id}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDelete(payment)}
                  disabled={busyId === payment.id}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
