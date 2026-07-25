import type { Bien } from '~/types'
import type { ResumeEnvois } from '~/types/check'
import { envoyerRappelEmail } from './email'
import { envoyerPush, pushDisponible } from './push'

export interface ResumeRappels {
  candidats: number
  envoyes: number
  echecs: number
  raisons: string[]
}

/** Fenêtre du rappel : la visite a lieu dans moins de 24 h et n'est pas passée. */
export const FENETRE_MS = 24 * 60 * 60 * 1000

export function aRappeler(bien: Bien, maintenant = new Date()): boolean {
  if (!bien.actif || !bien.visite_le || bien.rappel_envoye_le) return false

  const visite = new Date(bien.visite_le).getTime()
  if (Number.isNaN(visite)) return false

  const t = maintenant.getTime()
  return visite > t && visite - t <= FENETRE_MS
}

const heure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

/**
 * Envoie un rappel par bien à visiter dans les 24 h (email + push), puis marque
 * `rappel_envoye_le` pour ne pas repartir au passage suivant du cron.
 */
export async function envoyerRappels(
  client: any,
  biens: Bien[],
  email: string | null,
  maintenant = new Date()
): Promise<ResumeRappels> {
  const resume: ResumeRappels = { candidats: 0, envoyes: 0, echecs: 0, raisons: [] }
  const aTraiter = biens.filter((b) => aRappeler(b, maintenant))
  resume.candidats = aTraiter.length

  for (const bien of aTraiter) {
    let envoye = false

    const mail = await envoyerRappelEmail(email, bien).catch((e: Error) => ({
      envoye: false,
      raison: e.message
    }))
    if (mail.envoye) envoye = true
    else if (mail.raison && !resume.raisons.includes(mail.raison)) resume.raisons.push(mail.raison)

    if (pushDisponible()) {
      const push: ResumeEnvois = await envoyerPush(client, bien.user_id, {
        titre: 'Visite demain',
        corps: `${bien.titre} — ${heure(bien.visite_le!)}`,
        url: `/bien/${bien.id}`,
        tag: `visite-${bien.id}`
      }).catch((e: Error) => ({ envoyes: 0, echecs: 1, raisons: [e.message] }))

      if (push.envoyes > 0) envoye = true
      for (const r of push.raisons) if (!resume.raisons.includes(r)) resume.raisons.push(r)
    }

    if (envoye) {
      resume.envoyes++
      await client
        .from('biens')
        .update({ rappel_envoye_le: maintenant.toISOString() })
        .eq('id', bien.id)
    } else {
      resume.echecs++
    }
  }

  return resume
}
