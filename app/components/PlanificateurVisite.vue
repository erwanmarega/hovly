<script setup lang="ts">
import type { Bien } from '~/types'

const props = defineProps<{ bien: Bien }>()

const emit = defineEmits<{ maj: [patch: Partial<Bien>] }>()

const { planifier } = useVisite()
const { setStatut } = useBiens()
const maintenant = useMaintenant()

const brouillon = ref(versInputLocal(props.bien.visite_le))
const edition = ref(!props.bien.visite_le)
const occupe = ref(false)
const erreur = ref('')

watch(
  () => props.bien.visite_le,
  (v) => {
    brouillon.value = versInputLocal(v)
    edition.value = !v
  }
)

const etat = computed(() => etatVisite(props.bien, maintenant.value))
const creneaux = computed(() => creneauxRapides(maintenant.value))

const minimum = computed(() => versInputLocal(maintenant.value.toISOString()))

async function enregistrer(iso: string | null) {
  occupe.value = true
  erreur.value = ''
  try {
    await planifier(props.bien.id, iso)
    emit('maj', iso ? { visite_le: iso, statut: 'planifie' } : { visite_le: null })
    edition.value = !iso
  } catch {
    erreur.value = 'Enregistrement impossible.'
  } finally {
    occupe.value = false
  }
}

function valider() {
  const iso = depuisInputLocal(brouillon.value)
  if (!iso) {
    erreur.value = 'Choisis une date et une heure.'
    return
  }
  enregistrer(iso)
}

async function marquerVisite() {
  occupe.value = true
  try {
    await setStatut(props.bien.id, 'visite')
    emit('maj', { statut: 'visite' })
  } finally {
    occupe.value = false
  }
}
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-6">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Visite</h2>
      <BadgeVisite :visite-le="bien.visite_le" />
    </div>

    <template v-if="bien.visite_le && !edition">
      <p class="mt-3 text-sm text-ink">
        {{ dateVisiteLongue(bien.visite_le) }}
      </p>
      <p v-if="etat === 'passee'" class="mt-1 text-xs text-stone">
        Visite passée — remplis la checklist tant que c’est frais.
      </p>
      <p v-else class="mt-1 text-xs text-stone">
        Rappel envoyé automatiquement 24 h avant, par email et notification.
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-if="etat === 'passee' && bien.statut !== 'visite'"
          :disabled="occupe"
          class="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
          @click="marquerVisite"
        >
          Marquer comme visité
        </button>
        <button
          :disabled="occupe"
          class="rounded-full border border-hairline px-4 py-2 text-xs font-medium text-steel transition hover:bg-surface disabled:opacity-50"
          @click="edition = true"
        >
          Replanifier
        </button>
        <button
          :disabled="occupe"
          class="rounded-full px-3 py-2 text-xs font-medium text-stone transition hover:text-[#600000] disabled:opacity-50"
          @click="enregistrer(null)"
        >
          Annuler la visite
        </button>
      </div>
    </template>

    <template v-else>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="c in creneaux"
          :key="c.iso"
          :disabled="occupe"
          class="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-steel transition hover:bg-surface disabled:opacity-50"
          @click="enregistrer(c.iso)"
        >
          {{ c.label }}
        </button>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <input
          v-model="brouillon"
          type="datetime-local"
          :min="minimum"
          class="min-w-[13rem] flex-1 rounded-lg border border-hairline-strong bg-white px-3 py-2 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
        >
        <button
          :disabled="occupe"
          class="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
          @click="valider"
        >
          {{ occupe ? '…' : 'Planifier' }}
        </button>
        <button
          v-if="bien.visite_le"
          class="rounded-full px-3 py-2 text-xs font-medium text-stone transition hover:text-ink"
          @click="edition = false"
        >
          Annuler
        </button>
      </div>

      <p v-if="erreur" class="mt-2 text-xs text-[#600000]">{{ erreur }}</p>
    </template>
  </section>
</template>
