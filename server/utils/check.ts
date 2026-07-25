import type { Bien } from '~/types'
import type { AlerteCreee, CheckResume, ResumeEnvois } from '~/types/check'
import { scrapeUrl } from './scrape'
import { envoyerAlerteEmail } from './email'
import { envoyerAlertePush, pushDisponible } from './push'

export type { AlerteCreee, CheckResume, ResumeEnvois }

export async function verifierBiens(client: any, biens: Bien[]): Promise<CheckResume> {
  const resume: CheckResume = { verifies: 0, baisses: 0, supprimes: 0, erreurs: 0, alertes: [] }

  for (const bien of biens) {
    let res
    try {
      res = await scrapeUrl(bien.url_source)
    } catch {
      resume.erreurs++
      continue
    }
    resume.verifies++

    if (res.indisponible) {
      await client.from('biens').update({ actif: false }).eq('id', bien.id)
      await client.from('alertes').insert({
        bien_id: bien.id,
        type: 'annonce_supprimee',
        ancien_prix: bien.prix,
        nouveau_prix: null
      })
      resume.supprimes++
      resume.alertes.push({
        bien_id: bien.id,
        type: 'annonce_supprimee',
        ancien_prix: bien.prix,
        nouveau_prix: null,
        titre: bien.titre
      })
      continue
    }

    const nouveauPrix = res.data.prix ?? null
    if (nouveauPrix == null) continue

    await client.from('prix_historique').insert({ bien_id: bien.id, prix: nouveauPrix })

    if (nouveauPrix < bien.prix) {
      await client.from('alertes').insert({
        bien_id: bien.id,
        type: 'baisse_prix',
        ancien_prix: bien.prix,
        nouveau_prix: nouveauPrix
      })
      await client.from('biens').update({ prix: nouveauPrix }).eq('id', bien.id)
      resume.baisses++
      resume.alertes.push({
        bien_id: bien.id,
        type: 'baisse_prix',
        ancien_prix: bien.prix,
        nouveau_prix: nouveauPrix,
        titre: bien.titre
      })
    } else if (nouveauPrix !== bien.prix) {
      await client.from('biens').update({ prix: nouveauPrix }).eq('id', bien.id)
    }
  }

  return resume
}

export async function notifier(
  email: string | null,
  resume: CheckResume
): Promise<ResumeEnvois> {
  const envois: ResumeEnvois = { envoyes: 0, echecs: 0, raisons: [] }
  if (resume.alertes.length === 0) return envois

  if (!email) {
    console.warn('[check]', resume.alertes.length, 'alerte(s) sans adresse email destinataire')
    envois.echecs = resume.alertes.length
    envois.raisons.push('aucune adresse email')
    return envois
  }

  for (const a of resume.alertes) {
    const res = await envoyerAlerteEmail(email, a).catch((e: Error) => ({
      envoye: false,
      raison: e.message
    }))
    if (res.envoye) {
      envois.envoyes++
    } else {
      envois.echecs++
      if (res.raison && !envois.raisons.includes(res.raison)) envois.raisons.push(res.raison)
    }
  }
  return envois
}

/**
 * Notifications push, un envoi par alerte et par appareil abonné.
 * Sans clés VAPID configurées, ne fait rien (le push est optionnel).
 */
export async function notifierPush(
  client: any,
  userId: string,
  resume: CheckResume
): Promise<ResumeEnvois> {
  const envois: ResumeEnvois = { envoyes: 0, echecs: 0, raisons: [] }
  if (resume.alertes.length === 0 || !pushDisponible()) return envois

  for (const a of resume.alertes) {
    const res = await envoyerAlertePush(client, userId, a).catch((e: Error) => ({
      envoyes: 0,
      echecs: 1,
      raisons: [e.message]
    }))
    envois.envoyes += res.envoyes
    envois.echecs += res.echecs
    for (const r of res.raisons) if (!envois.raisons.includes(r)) envois.raisons.push(r)
  }
  return envois
}
