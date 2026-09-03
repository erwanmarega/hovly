import type { Property } from '~/types'
import type { CreatedAlert } from '~/types/check'
import { formatPrice } from './price'

export interface SendResult {
  envoye: boolean
  raison?: string
}

export async function sendAlertEmail(
  to: string,
  alerte: CreatedAlert
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY absente — alerte non envoyée à', to)
    return { envoye: false, raison: 'RESEND_API_KEY absente' }
  }

  const from = process.env.RESEND_FROM || 'Hovly <onboarding@resend.dev>'

  let subject: string
  let html: string
  if (alerte.type === 'baisse_prix') {
    subject = `Baisse de prix — ${alerte.titre}`
    html = `<p>Bonne nouvelle ! Le prix de <strong>${alerte.titre}</strong> a baissé.</p>
      <p>Ancien prix : <s>${formatPrice(alerte.ancien_prix)}</s><br/>
      Nouveau prix : <strong>${formatPrice(alerte.nouveau_prix)}</strong></p>`
  } else {
    subject = `Annonce supprimée — ${alerte.titre}`
    html = `<p>L'annonce <strong>${alerte.titre}</strong> n'est plus disponible (bien probablement loué ou vendu).</p>
      <p>Le bien reste consultable dans Hovly, filtre « Archivés ».</p>`
  }

  return send(apiKey, from, to, subject, html)
}

export async function sendReminderEmail(
  to: string | null,
  bien: Property
): Promise<SendResult> {
  if (!to) return { envoye: false, raison: 'aucune adresse email' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY absente — rappel non envoyé à', to)
    return { envoye: false, raison: 'RESEND_API_KEY absente' }
  }

  const from = process.env.RESEND_FROM || 'Hovly <onboarding@resend.dev>'
  const when = bien.visite_le
    ? new Date(bien.visite_le).toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''

  const subject = `Visite demain — ${bien.titre}`
  const html = `<p>Rappel : tu visites <strong>${bien.titre}</strong>.</p>
      <p><strong>${when}</strong><br/>
      ${[bien.adresse, bien.code_postal, bien.ville].filter(Boolean).join(' ')}</p>
      <p>Pense à la checklist de visite dans Hovly : luminosité, bruit, humidité,
      vis-à-vis, et les questions à poser à l'agent.</p>`

  return send(apiKey, from, to, subject, html)
}

export interface WatchEmailRow {
  url: string
  titre: string | null
  prix: number | null
  surface: number | null
  nb_pieces: number | null
}

export async function sendWatchEmail(
  to: string | null,
  label: string,
  lignes: WatchEmailRow[]
): Promise<SendResult> {
  if (!to) return { envoye: false, raison: 'aucune adresse email' }
  if (!lignes.length) return { envoye: false, raison: 'aucune nouveauté' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY absente — veille non envoyée à', to)
    return { envoye: false, raison: 'RESEND_API_KEY absente' }
  }

  const from = process.env.RESEND_FROM || 'Hovly <onboarding@resend.dev>'
  const site = process.env.SITE_URL || 'https://hovly.app'

  const items = lignes
    .map((l) => {
      const details = [
        formatPrice(l.prix),
        l.surface ? `${l.surface} m²` : '',
        l.nb_pieces ? `${l.nb_pieces} pièces` : ''
      ]
        .filter(Boolean)
        .join(' · ')
      return `<li><a href="${l.url}">${l.titre || 'Annonce'}</a>${details ? ` — ${details}` : ''}</li>`
    })
    .join('')

  const subject =
    lignes.length === 1
      ? `1 nouveau bien — ${label}`
      : `${lignes.length} nouveaux biens — ${label}`

  const html = `<p>Ta veille <strong>${label}</strong> a trouvé ${lignes.length} annonce(s).</p>
      <ul>${items}</ul>
      <p><a href="${site}/veilles">Garder ou ignorer dans Hovly</a></p>`

  return send(apiKey, from, to, subject, html)
}

async function send(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<SendResult> {
  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { from, to, subject, html }
    })
    return { envoye: true }
  } catch (e: unknown) {
    const err = e as { statusCode?: number; data?: { message?: string }; message?: string }
    const raison = `${err.statusCode ?? ''} ${err.data?.message ?? err.message ?? 'erreur inconnue'}`.trim()
    console.error('[email] échec Resend pour', to, '—', raison)
    return { envoye: false, raison }
  }
}
