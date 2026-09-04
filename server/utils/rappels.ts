import type { Property } from '~/types'
import type { SendSummary } from '~/types/check'
import { sendReminderEmail } from './email'
import { sendPush, pushAvailable } from './push'

export interface ReminderSummary {
  candidats: number
  envoyes: number
  echecs: number
  raisons: string[]
}

export const WINDOW_MS = 24 * 60 * 60 * 1000

export function needsReminder(bien: Property, now = new Date()): boolean {
  if (!bien.actif || !bien.visite_le || bien.rappel_envoye_le) return false

  const visitAt = new Date(bien.visite_le).getTime()
  if (Number.isNaN(visitAt)) return false

  const t = now.getTime()
  return visitAt > t && visitAt - t <= WINDOW_MS
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

export async function sendReminders(
  client: any,
  biens: Property[],
  email: string | null,
  now = new Date()
): Promise<ReminderSummary> {
  const summary: ReminderSummary = { candidats: 0, envoyes: 0, echecs: 0, raisons: [] }
  const toProcess = biens.filter((b) => needsReminder(b, now))
  summary.candidats = toProcess.length

  for (const bien of toProcess) {
    let sent = false

    const mail = await sendReminderEmail(email, bien).catch((e: Error) => ({
      envoye: false,
      raison: e.message
    }))
    if (mail.envoye) sent = true
    else if (mail.raison && !summary.raisons.includes(mail.raison)) summary.raisons.push(mail.raison)

    if (pushAvailable()) {
      const push: SendSummary = await sendPush(client, bien.user_id, {
        titre: 'Visite demain',
        corps: `${bien.titre} — ${formatTime(bien.visite_le!)}`,
        url: `/bien/${bien.id}`,
        tag: `visite-${bien.id}`
      }).catch((e: Error) => ({ sent: 0, failed: 1, reasons: [e.message] }))

      if (push.sent > 0) sent = true
      for (const r of push.reasons) if (!summary.raisons.includes(r)) summary.raisons.push(r)
    }

    if (sent) {
      summary.envoyes++
      await client
        .from('biens')
        .update({ rappel_envoye_le: now.toISOString() })
        .eq('id', bien.id)
    } else {
      summary.echecs++
    }
  }

  return summary
}
