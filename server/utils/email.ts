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
    subject = `📉 Baisse de prix — ${alerte.titre}`
    html = `<p>Bonne nouvelle ! Le prix de <strong>${alerte.titre}</strong> a baissé.</p>
      <p>Ancien prix : <s>${eur(alerte.ancien_prix)}</s><br/>
      Nouveau prix : <strong>${eur(alerte.nouveau_prix)}</strong></p>`
  } else {
    subject = `⚠️ Annonce supprimée — ${alerte.titre}`
    html = `<p>L'annonce <strong>${alerte.titre}</strong> n'est plus disponible (bien probablement loué ou vendu).</p>
      <p>Le bien reste consultable dans Hovly, filtre « Archivés ».</p>`
  }

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
