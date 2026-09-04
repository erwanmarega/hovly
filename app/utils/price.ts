export function formatPrice(centimes: number | null | undefined): string {
  if (centimes == null) return ''
  return Math.round(centimes / 100).toLocaleString('fr-FR') + ' €'
}

export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}
