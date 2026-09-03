export function formatPrice(centimes: number | null | undefined): string {
  if (centimes == null) return ''
  return Math.round(centimes / 100).toLocaleString('fr-FR') + ' €'
}
