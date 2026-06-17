import type { Bien } from '~/types'
import { scrapeUrl } from './scrape'
import { envoyerAlerteEmail } from './email'

export interface AlerteCreee {
  bien_id: string
  type: 'baisse_prix' | 'annonce_supprimee'
  ancien_prix: number | null
  nouveau_prix: number | null
  titre: string
}

export interface CheckResume {
  verifies: number
  baisses: number
  supprimes: number
  erreurs: number
  alertes: AlerteCreee[]
}

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

export async function notifier(email: string | null, resume: CheckResume) {
  if (!email || resume.alertes.length === 0) return
  for (const a of resume.alertes) {
    await envoyerAlerteEmail(email, a).catch(() => {})
  }
}
