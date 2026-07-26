<script setup lang="ts">
import type { Bien } from '~/types'

const props = defineProps<{ bien: Bien }>()

const { calculer } = useCoutReel()

const cout = computed(() => calculer(props.bien))
const eur = (centimes: number) => Math.round(centimes / 100).toLocaleString('fr-FR')

const detailsOuverts = ref(false)

const parts = computed(() =>
  cout.value.postes
    .filter((p) => (p.montant ?? 0) > 0)
    .map((p) => ({
      ...p,
      pourcent: cout.value.total ? ((p.montant ?? 0) / cout.value.total) * 100 : 0
    }))
)

const TEINTES: Record<string, string> = {
  loyer: 'bg-ink',
  charges: 'bg-steel',
  energie: 'bg-brand-deep',
  assurance: 'bg-stone'
}
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-6">
    <div class="flex items-start justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Coût réel</h2>
      <span
        v-if="cout.ecartPourcent > 0"
        class="rounded-full bg-coral px-2.5 py-1 text-xs font-bold text-[#600000]"
        title="Écart avec le loyer charges comprises affiché dans l’annonce"
      >
        +{{ cout.ecartPourcent }} %
      </span>
    </div>

    <p class="mt-2 text-3xl font-bold tracking-tight">
      {{ eur(cout.total) }} €<span class="text-base font-medium text-stone">/mois</span>
    </p>
    <p class="mt-1 text-xs text-stone">
      Annonce : {{ eur(cout.affiche) }} € charges comprises
    </p>

    <div class="mt-4 flex h-2 overflow-hidden rounded-full bg-surface">
      <span
        v-for="p in parts"
        :key="p.cle"
        :class="TEINTES[p.cle]"
        :style="{ width: `${p.pourcent}%` }"
        :title="`${p.label} — ${eur(p.montant ?? 0)} €`"
      />
    </div>

    <ul class="mt-4 space-y-2 text-sm">
      <li v-for="p in cout.postes" :key="p.cle" class="flex items-center justify-between gap-3">
        <span class="flex min-w-0 items-center gap-2">
          <span class="size-2 shrink-0 rounded-full" :class="TEINTES[p.cle]" />
          <span class="truncate text-steel">{{ p.label }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums">
          <template v-if="p.montant == null">—</template>
          <template v-else>{{ eur(p.montant) }} €</template>
        </span>
      </li>
    </ul>

    <p v-if="cout.incomplet" class="mt-3 text-xs text-stone">
      Estimation basse : une donnée manque
      <template v-if="bien.charges == null">(charges non renseignées)</template>
      <template v-else>(DPE non renseigné)</template>.
    </p>

    <button
      class="mt-3 text-xs font-medium text-blue hover:underline"
      @click="detailsOuverts = !detailsOuverts"
    >
      {{ detailsOuverts ? 'Masquer les hypothèses' : 'Comment c’est calculé ?' }}
    </button>

    <div v-if="detailsOuverts" class="mt-2 space-y-1.5 rounded-xl bg-surface px-3 py-2.5">
      <p v-for="p in cout.postes" :key="p.cle" class="text-xs text-stone">
        <span class="font-medium text-steel">{{ p.label }}</span> — {{ p.detail }}
      </p>
      <p v-for="h in cout.hypotheses" :key="h" class="text-xs text-stone">{{ h }}</p>
      <NuxtLink to="/profil" class="block text-xs font-medium text-blue hover:underline">
        Ajuster depuis mon profil
      </NuxtLink>
    </div>
  </section>
</template>
