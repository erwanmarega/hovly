<script setup lang="ts">
import type { AvisVisite, Bien } from '~/types'

const props = defineProps<{ bien: Bien }>()

const emit = defineEmits<{ maj: [patch: Partial<Bien>] }>()

const { enregistrerChecklist, enregistrerCompteRendu } = useVisite()

const checklist = ref(normaliserChecklist(props.bien.checklist))
const compteRendu = ref(props.bien.compte_rendu ?? '')
const enregistre = ref(false)
const erreur = ref('')

watch(
  () => props.bien.id,
  () => {
    checklist.value = normaliserChecklist(props.bien.checklist)
    compteRendu.value = props.bien.compte_rendu ?? ''
  }
)

const bilan = computed(() => bilanVisite(checklist.value))

function flash() {
  enregistre.value = true
  setTimeout(() => (enregistre.value = false), 1500)
}

async function sauver() {
  erreur.value = ''
  const valeur = { ...checklist.value }
  try {
    await enregistrerChecklist(props.bien.id, valeur)
    emit('maj', { checklist: valeur })
    flash()
  } catch {
    erreur.value = 'Enregistrement impossible.'
  }
}

function noter(critere: string, avis: AvisVisite) {
  const efface = checklist.value.notes[critere] === avis
  const notes = Object.fromEntries(
    Object.entries(checklist.value.notes).filter(([id]) => id !== critere)
  ) as Record<string, AvisVisite>
  if (!efface) notes[critere] = avis

  checklist.value = { ...checklist.value, notes }
  sauver()
}

function basculerQuestion(id: string) {
  const questions = checklist.value.questions.includes(id)
    ? checklist.value.questions.filter((q) => q !== id)
    : [...checklist.value.questions, id]
  checklist.value = { ...checklist.value, questions }
  sauver()
}

async function sauverCompteRendu() {
  if (compteRendu.value === (props.bien.compte_rendu ?? '')) return
  erreur.value = ''
  try {
    await enregistrerCompteRendu(props.bien.id, compteRendu.value)
    emit('maj', { compte_rendu: compteRendu.value })
    flash()
  } catch {
    erreur.value = 'Enregistrement impossible.'
  }
}
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">
          Checklist de visite
        </h2>
        <p class="mt-1 text-xs text-stone">
          {{ bilan.remplis }}/{{ bilan.total }} critères jugés
          <span v-if="bilan.mauvais.length" class="text-[#600000]">
            · points noirs : {{ bilan.mauvais.join(', ') }}
          </span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span v-if="enregistre" class="text-xs font-medium text-success">Enregistré</span>
        <span
          v-if="bilan.note !== null"
          class="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
          :class="
            bilan.note >= 70
              ? 'bg-teal text-[#0a4a42]'
              : bilan.note >= 40
                ? 'bg-brand-light text-[#8a6d1c]'
                : 'bg-coral text-[#600000]'
          "
        >
          {{ bilan.note }}/100
        </span>
      </div>
    </div>

    <ul class="mt-4 divide-y divide-hairline-soft">
      <li
        v-for="c in CRITERES_VISITE"
        :key="c.id"
        class="flex flex-wrap items-center gap-3 py-2.5"
      >
        <div class="min-w-[9rem] flex-1">
          <p class="text-sm font-medium text-ink">{{ c.label }}</p>
          <p class="text-xs text-stone">{{ c.aide }}</p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <button
            v-for="a in AVIS"
            :key="a.value"
            class="rounded-full px-2.5 py-1 text-xs font-medium transition"
            :class="
              checklist.notes[c.id] === a.value
                ? a.classe
                : 'border border-hairline text-steel hover:bg-surface'
            "
            :aria-pressed="checklist.notes[c.id] === a.value"
            @click="noter(c.id, a.value)"
          >
            {{ a.label }}
          </button>
        </div>
      </li>
    </ul>

    <h3 class="mt-6 text-xs font-semibold uppercase tracking-wider text-stone">
      Questions à l’agent
    </h3>
    <ul class="mt-2 grid gap-1.5 sm:grid-cols-2">
      <li v-for="q in QUESTIONS_AGENT" :key="q.id">
        <label
          class="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-surface"
          :class="checklist.questions.includes(q.id) ? 'text-stone line-through' : 'text-slate'"
        >
          <input
            type="checkbox"
            class="mt-0.5 size-4 shrink-0 cursor-pointer accent-ink"
            :checked="checklist.questions.includes(q.id)"
            @change="basculerQuestion(q.id)"
          >
          {{ q.label }}
        </label>
      </li>
    </ul>

    <h3 class="mt-6 text-xs font-semibold uppercase tracking-wider text-stone">
      Compte-rendu
    </h3>
    <textarea
      v-model="compteRendu"
      rows="4"
      placeholder="Ce que tu as vu, ce que l’agent a répondu, ce qui te fait hésiter…"
      class="mt-2 w-full resize-none rounded-lg border border-hairline-strong bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
      @blur="sauverCompteRendu"
    />

    <p v-if="erreur" class="mt-2 text-xs text-[#600000]">{{ erreur }}</p>
  </section>
</template>
