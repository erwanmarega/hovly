<script setup lang="ts">
import type { ApplicationStep, ApplicationStepType, Property } from '~/types'
import {
  APPLICATION_STEP_TYPES,
  MAX_STEP_NOTE_LENGTH,
  offerAnalysis,
  stepLabel
} from '~/utils/applications'

const props = defineProps<{ bien: Property }>()

const emit = defineEmits<{ maj: [patch: Partial<Property>] }>()

const { stepsFor, load, add, remove } = useApplications()
const { load: loadMarket, get: marketFor } = useMarket()
const { announce } = useToast()

const steps = computed(() => stepsFor(props.bien.id))
const purchase = computed(() => props.bien.transaction === 'achat')

// Date locale (et non UTC) : sinon entre minuit et 2 h, « aujourd'hui » vaudrait la veille.
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const type = ref<ApplicationStepType>('candidature')
const amount = ref('')
const date = ref(today())
const note = ref('')
const busy = ref(false)

const hasAmount = computed(
  () => purchase.value && (type.value === 'candidature' || type.value === 'contre_offre')
)

onMounted(async () => {
  try {
    await load(props.bien.id)
  } catch (e) {
    announce(errorMessage(e, 'Impossible de charger le suivi.'), 'erreur')
  }
  if (purchase.value) void loadMarket(props.bien)
})

async function submit() {
  let montant: number | null = null
  if (hasAmount.value && amount.value.trim()) {
    const euros = Number(amount.value.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(euros) || euros < 0) {
      announce('Montant invalide.', 'erreur')
      return
    }
    montant = Math.round(euros * 100)
  }
  busy.value = true
  try {
    const statut = await add(props.bien.id, {
      type: type.value,
      montant,
      note: note.value.trim() || null,
      // Midi UTC : évite qu'un fuseau fasse glisser la date au jour précédent.
      fait_le: date.value === today() ? new Date().toISOString() : `${date.value}T12:00:00.000Z`
    })
    emit('maj', { statut })
    amount.value = ''
    note.value = ''
    date.value = today()
  } catch (e) {
    announce(errorMessage(e, 'Enregistrement impossible.'), 'erreur')
  } finally {
    busy.value = false
  }
}

const toDelete = ref<ApplicationStep | null>(null)

async function confirmDelete() {
  const step = toDelete.value
  if (!step) return
  busy.value = true
  try {
    const statut = await remove(step)
    emit('maj', { statut })
    toDelete.value = null
  } catch (e) {
    announce(errorMessage(e, 'Suppression impossible.'), 'erreur')
  } finally {
    busy.value = false
  }
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

// Dernière étape chiffrée (par date) : base de l'analyse de l'offre.
const lastOffer = computed(() => [...steps.value].reverse().find((s) => s.montant != null) ?? null)

const analysis = computed(() =>
  purchase.value && lastOffer.value?.montant != null
    ? offerAnalysis(lastOffer.value.montant, props.bien, marketFor(props.bien.id))
    : null
)

const percent = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`

const fieldClass =
  'h-12 w-full rounded-xl border border-hairline-strong bg-white px-4 text-sm outline-none transition hover:border-stone focus:border-ink-deep focus:ring-4 focus:ring-ink-deep/10'
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-5 sm:p-6">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Suivi de la démarche</h2>

    <ol v-if="steps.length" class="mt-4 space-y-4 border-l border-hairline pl-4">
      <li v-for="s in steps" :key="s.id" class="relative">
        <span class="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-ink" />
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink">
              {{ stepLabel(s.type, bien.transaction) }}
              <span v-if="s.montant != null" class="font-semibold">· {{ formatPrice(s.montant) }}</span>
            </p>
            <p class="text-xs text-stone">{{ dateLabel(s.fait_le) }}</p>
            <p v-if="s.note" class="mt-1 break-words text-sm text-slate">{{ s.note }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-stone transition hover:text-[#600000]"
            :aria-label="`Supprimer l’étape ${stepLabel(s.type, bien.transaction)}`"
            @click="toDelete = s"
          >
            Supprimer
          </button>
        </div>
      </li>
    </ol>
    <p v-else class="mt-3 text-sm text-stone">
      {{ purchase ? 'Offre faite, réponse reçue ?' : 'Dossier envoyé, offre faite ?' }}
      Notez chaque étape ici.
    </p>

    <div v-if="analysis" class="mt-4 rounded-2xl bg-surface px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-stone">Analyse de l’offre</p>
      <p v-if="analysis.askingGapPercent != null" class="mt-1 text-sm text-ink">
        {{ percent(analysis.askingGapPercent) }} vs prix affiché
      </p>
      <p v-if="analysis.marketGapPercent != null" class="mt-0.5 text-sm text-ink">
        {{ percent(analysis.marketGapPercent) }} vs médiane DVF du quartier
      </p>
    </div>

    <form class="mt-5 space-y-3 border-t border-hairline pt-4" @submit.prevent="submit">
      <div>
        <label for="step-type" class="mb-1.5 block text-sm font-medium text-ink">Étape</label>
        <select id="step-type" v-model="type" :class="fieldClass">
          <option v-for="t in APPLICATION_STEP_TYPES" :key="t" :value="t">
            {{ stepLabel(t, bien.transaction) }}
          </option>
        </select>
      </div>

      <TextField
        v-if="hasAmount"
        id="step-amount"
        v-model="amount"
        label="Montant (€)"
        type="text"
        placeholder="Ex. 245000"
      />

      <div>
        <label for="step-date" class="mb-1.5 block text-sm font-medium text-ink">Date</label>
        <input id="step-date" v-model="date" type="date" :max="today()" required :class="fieldClass">
      </div>

      <div>
        <label for="step-note" class="mb-1.5 block text-sm font-medium text-ink">Note</label>
        <textarea
          id="step-note"
          v-model="note"
          rows="2"
          :maxlength="MAX_STEP_NOTE_LENGTH"
          class="w-full rounded-xl border border-hairline-strong bg-white px-4 py-3 text-sm outline-none transition hover:border-stone focus:border-ink-deep focus:ring-4 focus:ring-ink-deep/10"
        />
      </div>

      <button
        type="submit"
        :disabled="busy"
        class="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
      >
        {{ busy ? '…' : 'Ajouter l’étape' }}
      </button>
    </form>

    <DeleteConfirmationModal
      :open="!!toDelete"
      title="Supprimer cette étape ?"
      :name="toDelete ? stepLabel(toDelete.type, bien.transaction) : ''"
      :subline="toDelete ? dateLabel(toDelete.fait_le) : null"
      message="Le statut du bien sera recalculé à partir des étapes restantes."
      :loading="busy"
      @cancel="toDelete = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
