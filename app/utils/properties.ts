import type { Property } from '~/types'

export function isPurchase(b: Pick<Property, 'transaction'>): boolean {
  return b.transaction === 'achat'
}
