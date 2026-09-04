<script setup lang="ts">
import type { VisitRating, Property } from '~/types'

const props = defineProps<{ bien: Property }>()

const emit = defineEmits<{ maj: [patch: Partial<Property>] }>()

const { saveChecklist, saveReport } = useVisit()

const checklist = ref(normalizeChecklist(props.bien.checklist))
const report = ref(props.bien.compte_rendu ?? '')
const saved = ref(false)
const error = ref('')

watch(
  () => props.bien.id,
  () => {
    checklist.value = normalizeChecklist(props.bien.checklist)
    report.value = props.bien.compte_rendu ?? ''
  }
)

const summary = computed(() => visitSummary(checklist.value))

function flash() {
  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}

async function save() {
  error.value = ''
  const value = { ...checklist.value }
  try {
    await saveChecklist(props.bien.id, value)
    emit('maj', { checklist: value })
    flash()
  } catch {
    error.value = 'Enregistrement impossible.'
  }
}

function rate(criterion: string, rating: VisitRating) {
  const cleared = checklist.value.notes[criterion] === rating
  const notes = Object.fromEntries(
    Object.entries(checklist.value.notes).filter(([id]) => id !== criterion)
  ) as Record<string, VisitRating>
  if (!cleared) notes[criterion] = rating

  checklist.value = { ...checklist.value, notes }
  save()
}

function toggleQuestion(id: string) {
  const questions = checklist.value.questions.includes(id)
    ? checklist.value.questions.filter((q) => q !== id)
    : [...checklist.value.questions, id]
  checklist.value = { ...checklist.value, questions }
  save()
}

async function saveReportText() {
  if (report.value === (props.bien.compte_rendu ?? '')) return
  error.value = ''
  try {
    await saveReport(props.bien.id, report.value)
    emit('maj', { compte_rendu: report.value })
    flash()
  } catch {
    error.value = 'Enregistrement impossible.'
  }
}
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-5 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">
          Checklist de visite
        </h2>
        <p class="mt-1 text-xs text-stone">
          {{ summary.filled }}/{{ summary.total }} critères jugés
          <span v-if="summary.failing.length" class="text-[#600000]">
            · points noirs : {{ summary.failing.join(', ') }}
          </span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span v-if="saved" class="text-xs font-medium text-success">Enregistré</span>
        <span
          v-if="summary.score !== null"
          class="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
          :class="
            summary.score >= 70
              ? 'bg-teal text-[#0a4a42]'
              : summary.score >= 40
                ? 'bg-brand-light text-[#8a6d1c]'
                : 'bg-coral text-[#600000]'
          "
        >
          {{ summary.score }}/100
        </span>
      </div>
    </div>

    <ul class="mt-4 divide-y divide-hairline-soft">
      <li
        v-for="c in VISIT_CRITERIA"
        :key="c.id"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
      >
        <div class="min-w-[9rem] flex-1">
          <p class="text-sm font-medium text-ink">{{ c.label }}</p>
          <p class="text-xs text-stone">{{ c.help }}</p>
        </div>

        <!-- Sur mobile les trois avis passent sous le libellé : côte à côte ils
             tombaient sous la largeur de doigt (44 px). -->
        <div class="flex w-full shrink-0 items-center gap-1.5 sm:w-auto sm:gap-1">
          <button
            v-for="a in RATINGS"
            :key="a.value"
            class="flex-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition sm:flex-none sm:py-1"
            :class="
              checklist.notes[c.id] === a.value
                ? a.className
                : 'border border-hairline text-steel hover:bg-surface'
            "
            :aria-pressed="checklist.notes[c.id] === a.value"
            @click="rate(c.id, a.value)"
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
      <li v-for="q in AGENT_QUESTIONS" :key="q.id">
        <label
          class="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-surface"
          :class="checklist.questions.includes(q.id) ? 'text-stone line-through' : 'text-slate'"
        >
          <input
            type="checkbox"
            class="mt-0.5 size-4 shrink-0 cursor-pointer accent-ink"
            :checked="checklist.questions.includes(q.id)"
            @change="toggleQuestion(q.id)"
          >
          {{ q.label }}
        </label>
      </li>
    </ul>

    <h3 class="mt-6 text-xs font-semibold uppercase tracking-wider text-stone">
      Compte-rendu
    </h3>
    <textarea
      v-model="report"
      rows="4"
      placeholder="Ce que tu as vu, ce que l’agent a répondu, ce qui te fait hésiter…"
      class="mt-2 w-full resize-none rounded-lg border border-hairline-strong bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
      @blur="saveReportText"
    />

    <p v-if="error" class="mt-2 text-xs text-[#600000]">{{ error }}</p>
  </section>
</template>
