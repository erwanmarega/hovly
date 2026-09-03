import type { Property } from '~/types'
import type { SendSummary } from '~/types/check'
import { sendReminderEmail } from './email'
import { sendPush, pushAvailable } from './push'

export interface ResumeRappels {
  candidats: number
  envoyes: number
  echecs: number
  raisons: string[]
}

export const FENETRE_MS = 24 * 60 * 60 * 1000

export function aRappeler(bien: Property, maintenant = new Date()): boolean {
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

export async function envoyerRappels(
  client: any,
  biens: Property[],
  email: string | null,
  maintenant = new Date()
): Promise<ResumeRappels> {
  const resume: ResumeRappels = { candidats: 0, envoyes: 0, echecs: 0, raisons: [] }
  const aTraiter = biens.filter((b) => aRappeler(b, maintenant))
  resume.candidats = aTraiter.length

  for (const bien of aTraiter) {
    let envoye = false

    const mail = await sendReminderEmail(email, bien).catch((e: Error) => ({
      envoye: false,
      raison: e.message
    }))
    if (mail.envoye) envoye = true
    else if (mail.raison && !resume.raisons.includes(mail.raison)) resume.raisons.push(mail.raison)

    if (pushAvailable()) {
      const push: SendSummary = await sendPush(client, bien.user_id, {
        titre: 'Visite demain',
        corps: `${bien.titre} — ${heure(bien.visite_le!)}`,
        url: `/bien/${bien.id}`,
        tag: `visite-${bien.id}`
      }).catch((e: Error) => ({ sent: 0, failed: 1, reasons: [e.message] }))

      if (push.sent > 0) envoye = true
      for (const r of push.reasons) if (!resume.raisons.includes(r)) resume.raisons.push(r)
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
