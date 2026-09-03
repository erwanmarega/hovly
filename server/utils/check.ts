import type { Property } from '~/types'
import type { CreatedAlert, CheckSummary, SendSummary } from '~/types/check'
import { scrapeUrl } from './scrape'
import { sendAlertEmail } from './email'
import { sendAlertPush, pushAvailable } from './push'

export type { CreatedAlert, CheckSummary, SendSummary }

// Un re-scrape peut produire un prix aberrant (repli regex sur une page mal
// rendue). Au-delà d'un ratio ×0,5–×2 la variation est considérée suspecte :
// mieux vaut rater une vraie grosse baisse que persister un prix fantaisiste.
export function isPricePlausible(previous: number, updated: number): boolean {
  if (previous <= 0) return true
  const ratio = updated / previous
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

    const newPrice = res.data.prix ?? null
    if (newPrice == null) continue

    if (!isPricePlausible(bien.prix, newPrice)) {
      console.warn('[check] prix aberrant ignoré', {
        bien_id: bien.id,
        previous: bien.prix,
        updated: newPrice
      })
      continue
    }

    if (newPrice === bien.prix) continue

    await client.from('prix_historique').insert({ bien_id: bien.id, prix: newPrice })

    if (newPrice < bien.prix) {
      await client.from('alertes').insert({
        bien_id: bien.id,
        type: 'baisse_prix',
        ancien_prix: bien.prix,
        nouveau_prix: newPrice
      })
      await client.from('biens').update({ prix: newPrice }).eq('id', bien.id)
      summary.priceDrops++
      summary.alerts.push({
        bien_id: bien.id,
        type: 'baisse_prix',
        ancien_prix: bien.prix,
        nouveau_prix: newPrice,
        titre: bien.titre
      })
    } else if (newPrice !== bien.prix) {
      await client.from('biens').update({ prix: newPrice }).eq('id', bien.id)
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
