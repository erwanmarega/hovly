import type { Property } from '~/types'
import type { CreatedAlert, CheckSummary, SendSummary } from '~/types/check'
import { scrapeUrl } from './scrape'
import { sendAlertEmail } from './email'
import { sendAlertPush, pushAvailable } from './push'

export type { CreatedAlert, CheckSummary, SendSummary }

// Un re-scrape peut produire un prix aberrant (repli regex sur une page mal
// rendue). Au-delà d'un ratio ×0,5–×2 la variation est considérée suspecte :
// mieux vaut rater une vraie grosse baisse que persister un prix fantaisiste.
export function isPricePlausible(ancien: number, nouveau: number): boolean {
  if (ancien <= 0) return true
  const ratio = nouveau / ancien
  return ratio >= 0.5 && ratio <= 2
}

export async function checkProperties(client: any, biens: Property[]): Promise<CheckSummary> {
  const summary: CheckSummary = { checked: 0, priceDrops: 0, removed: 0, errors: 0, alerts: [] }

  for (const bien of biens) {
    let res
    try {
      res = await scrapeUrl(bien.url_source)
    } catch {
      summary.errors++
      continue
    }
    summary.checked++

    if (res.indisponible) {
      await client.from('biens').update({ actif: false }).eq('id', bien.id)
      await client.from('alertes').insert({
        bien_id: bien.id,
        type: 'annonce_supprimee',
        ancien_prix: bien.prix,
        nouveau_prix: null
      })
      summary.removed++
      summary.alerts.push({
        bien_id: bien.id,
        type: 'annonce_supprimee',
        ancien_prix: bien.prix,
        nouveau_prix: null,
        titre: bien.titre
      })
      continue
    }

    const newPrix = res.data.prix ?? null
    if (newPrix == null) continue

    if (!isPricePlausible(bien.prix, newPrix)) {
      console.warn('[check] prix aberrant ignoré', {
        bien_id: bien.id,
        ancien: bien.prix,
        nouveau: newPrix
      })
      continue
    }

    if (newPrix === bien.prix) continue

    await client.from('prix_historique').insert({ bien_id: bien.id, prix: newPrix })

    if (newPrix < bien.prix) {
      await client.from('alertes').insert({
        bien_id: bien.id,
        type: 'baisse_prix',
        ancien_prix: bien.prix,
        nouveau_prix: newPrix
      })
      await client.from('biens').update({ prix: newPrix }).eq('id', bien.id)
      summary.priceDrops++
      summary.alerts.push({
        bien_id: bien.id,
        type: 'baisse_prix',
        ancien_prix: bien.prix,
        nouveau_prix: newPrix,
        titre: bien.titre
      })
    } else if (newPrix !== bien.prix) {
      await client.from('biens').update({ prix: newPrix }).eq('id', bien.id)
    }
  }

  return summary
}

export async function notify(
  email: string | null,
  summary: CheckSummary
): Promise<SendSummary> {
  const emails: SendSummary = { sent: 0, failed: 0, reasons: [] }
  if (summary.alerts.length === 0) return emails

  if (!email) {
    console.warn('[check]', summary.alerts.length, 'alerte(s) sans adresse email destinataire')
    emails.failed = summary.alerts.length
    emails.reasons.push('aucune adresse email')
    return emails
  }

  for (const a of summary.alerts) {
    const res = await sendAlertEmail(email, a).catch((e: Error) => ({
      envoye: false,
      raison: e.message
    }))
    if (res.envoye) {
      emails.sent++
    } else {
      emails.failed++
      if (res.raison && !emails.reasons.includes(res.raison)) emails.reasons.push(res.raison)
    }
  }
  return emails
}

export async function notifyPush(
  client: any,
  userId: string,
  summary: CheckSummary
): Promise<SendSummary> {
  const emails: SendSummary = { sent: 0, failed: 0, reasons: [] }
  if (summary.alerts.length === 0 || !pushAvailable()) return emails

  for (const a of summary.alerts) {
    const res = await sendAlertPush(client, userId, a).catch((e: Error) => ({
      sent: 0,
      failed: 1,
      reasons: [e.message]
    }))
    emails.sent += res.sent
    emails.failed += res.failed
    for (const r of res.reasons) if (!emails.reasons.includes(r)) emails.reasons.push(r)
  }
  return emails
}
