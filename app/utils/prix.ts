export function formaterPrix(centimes: number | null | undefined): string {
  if (centimes == null) return ''
  return Math.round(centimes / 100).toLocaleString('fr-FR') + ' €'
}

export function formaterNombre(n: number): string {
  return n.toLocaleString('fr-FR')
}
