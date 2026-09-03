import type { Property, Status, SiteSource } from '~/types'
import { prixAuM2 } from './useMarche'

export const STATUTS: { value: Status; label: string }[] = [
  { value: 'a_visiter', label: 'À visiter' },
  { value: 'planifie', label: 'Visite planifiée' },
  { value: 'visite', label: 'Visité' },
  { value: 'coup_de_coeur', label: 'Coup de cœur' },
  { value: 'elimine', label: 'Éliminé' }
]

export function estAchat(b: Pick<Property, 'transaction'>): boolean {
  return b.transaction === 'achat'
}

export function useBiens() {
  const biens = useState<Property[]>('biens', () => [])

  function prixMensuel(b: Property): number {
    return Math.round(b.prix / 100)
  }

  function prixM2(b: Property): number {
    return prixAuM2(b) ?? 0
  }

  async function refresh() {
    biens.value = await $fetch<Property[]>('/api/biens')
  }

  async function ajouter(payload: Partial<Property>): Promise<Property> {
    const row = await $fetch<Property>('/api/biens', {
      method: 'POST',
      body: payload
    })
    biens.value = [row, ...biens.value]
    return row
  }

  async function setStatut(id: string, statut: Status) {
    const b = biens.value.find((x) => x.id === id)
    const prev = b?.statut
    if (b) b.statut = statut
    try {
      await $fetch(`/api/biens/${id}`, { method: 'PATCH', body: { statut } })
    } catch {
      if (b && prev) b.statut = prev
    }
  }

  async function mettreAJour(id: string, patch: Partial<Property>) {
    const b = biens.value.find((x) => x.id === id)
    const avant = b ? { ...b } : null
    if (b) Object.assign(b, patch)
    try {
      await $fetch(`/api/biens/${id}`, { method: 'PATCH', body: patch })
    } catch (e) {
      if (b && avant) Object.assign(b, avant)
      throw e
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

  return {
    biens,
    refresh,
    prixMensuel,
    prixM2,
    setStatut,
    setNote,
    mettreAJour,
    supprimer,
    ajouter
  }
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
  if (host.includes('century21')) return 'century21'
  if (host.includes('orpi.com')) return 'orpi'
  return null
}
