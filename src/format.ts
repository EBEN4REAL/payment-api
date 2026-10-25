import type { PaymentInput } from './types'

export const emptyPayment: PaymentInput = {
  sourceAccount: '',
  destinationAccount: '',
  amount: '',
  currency: 'NGN',
}

export function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}
