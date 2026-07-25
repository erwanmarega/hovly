import type { Bien } from '~/types'
import type { AlerteCreee } from '~/types/check'

export interface ResultatEnvoi {
  envoye: boolean
  raison?: string
}

const eur = (centimes: number | null) =>
  centimes == null ? '' : Math.round(centimes / 100).toLocaleString('fr-FR') + ' €'

export async function envoyerAlerteEmail(
  to: string,
  alerte: AlerteCreee
): Promise<ResultatEnvoi> {
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
      <p>Ancien prix : <s>${eur(alerte.ancien_prix)}</s><br/>
      Nouveau prix : <strong>${eur(alerte.nouveau_prix)}</strong></p>`
  } else {
    subject = `Annonce supprimée — ${alerte.titre}`
    html = `<p>L'annonce <strong>${alerte.titre}</strong> n'est plus disponible (bien probablement loué ou vendu).</p>
      <p>Le bien reste consultable dans Hovly, filtre « Archivés ».</p>`
  }

  return envoyer(apiKey, from, to, subject, html)
}

/** Rappel J-1 avant une visite planifiée. */
export async function envoyerRappelEmail(
  to: string | null,
  bien: Bien
): Promise<ResultatEnvoi> {
  if (!to) return { envoye: false, raison: 'aucune adresse email' }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY absente — rappel non envoyé à', to)
    return { envoye: false, raison: 'RESEND_API_KEY absente' }
  }

  const from = process.env.RESEND_FROM || 'Hovly <onboarding@resend.dev>'
  const quand = bien.visite_le
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
      <p><strong>${quand}</strong><br/>
      ${[bien.adresse, bien.code_postal, bien.ville].filter(Boolean).join(' ')}</p>
      <p>Pense à la checklist de visite dans Hovly : luminosité, bruit, humidité,
      vis-à-vis, et les questions à poser à l'agent.</p>`

  return envoyer(apiKey, from, to, subject, html)
}

async function envoyer(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<ResultatEnvoi> {
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
