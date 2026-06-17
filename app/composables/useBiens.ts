import type { Bien, Statut, SiteSource } from '~/types'

export const STATUTS: { value: Statut; label: string }[] = [
  { value: 'a_visiter', label: 'À visiter' },
  { value: 'planifie', label: 'Visite planifiée' },
  { value: 'visite', label: 'Visité' },
  { value: 'coup_de_coeur', label: 'Coup de cœur' },
  { value: 'elimine', label: 'Éliminé' }
]

export function useBiens() {
  const biens = useState<Bien[]>('biens', () => [])

  function prixMensuel(b: Bien): number {
    return Math.round(b.prix / 100)
  }

  function prixM2(b: Bien): number {
    if (!b.surface) return 0
    return Math.round(b.prix / 100 / b.surface)
  }

  async function refresh() {
    biens.value = await $fetch<Bien[]>('/api/biens')
  }

  async function ajouter(payload: Partial<Bien>): Promise<Bien> {
    const row = await $fetch<Bien>('/api/biens', {
      method: 'POST',
      body: payload
    })
    biens.value = [row, ...biens.value]
    return row
  }

  async function setStatut(id: string, statut: Statut) {
    const b = biens.value.find((x) => x.id === id)
    const prev = b?.statut
    if (b) b.statut = statut
    try {
      await $fetch(`/api/biens/${id}`, { method: 'PATCH', body: { statut } })
    } catch {
      if (b && prev) b.statut = prev
    }
  }

  async function setNote(id: string, note: string) {
    const b = biens.value.find((x) => x.id === id)
    if (b) b.note_perso = note
    await $fetch(`/api/biens/${id}`, { method: 'PATCH', body: { note_perso: note } })
  }

  async function supprimer(id: string) {
    const snapshot = biens.value
    biens.value = biens.value.filter((x) => x.id !== id)
    try {
      await $fetch(`/api/biens/${id}`, { method: 'DELETE' })
    } catch {
      biens.value = snapshot
    }
  }

  return { biens, refresh, prixMensuel, prixM2, setStatut, setNote, supprimer, ajouter }
}

export function detecterSource(url: string): SiteSource | null {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  if (host.includes('seloger')) return 'seloger'
  if (host.includes('leboncoin')) return 'leboncoin'
  if (host.includes('pap.fr')) return 'pap'
  if (host.includes('logic-immo')) return 'logic-immo'
  if (host.includes('bienici')) return 'bienici'
  return null
}
