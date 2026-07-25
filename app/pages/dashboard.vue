<script setup lang="ts">
import type { Bien, Statut } from '~/types'
import { STATUTS } from '~/composables/useBiens'

useHead({ title: 'Mes biens — Hovly' })

const { biens, refresh, prixMensuel, prixM2, setStatut, supprimer } = useBiens()

const { pending } = useAsyncData('biens', () => refresh(), { server: false })

const filtreStatut = ref<Statut | 'tous'>('tous')
const recherche = ref('')
const triClef = ref<'date' | 'prix' | 'surface' | 'prix_m2' | 'score'>('date')
const triAsc = ref(false)

const scoreDe = (b: Bien) => scoreBien(b, biens.value)

const sourceLabels: Record<string, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'BienIci'
}

const biensAffiches = computed(() => {
  let list = biens.value.filter((b) => b.actif)

  if (filtreStatut.value !== 'tous') {
    list = list.filter((b) => b.statut === filtreStatut.value)
  }

  const q = recherche.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (b) =>
        b.titre.toLowerCase().includes(q) ||
        b.ville.toLowerCase().includes(q) ||
        (b.adresse ?? '').toLowerCase().includes(q)
    )
  }

  const dir = triAsc.value ? 1 : -1
  return [...list].sort((a, b) => {
    let va: number
    let vb: number
    switch (triClef.value) {
      case 'prix':
        va = a.prix; vb = b.prix; break
      case 'surface':
        va = a.surface; vb = b.surface; break
      case 'prix_m2':
        va = prixM2(a); vb = prixM2(b); break
      case 'score':
        va = scoreDe(a).total; vb = scoreDe(b).total; break
      default:
        va = new Date(a.created_at).getTime()
        vb = new Date(b.created_at).getTime()
    }
    return (va - vb) * dir
  })
})

const stats = computed(() => {
  const actifs = biens.value.filter((b) => b.actif)
  const prixMoyen = actifs.length
    ? Math.round(actifs.reduce((s, b) => s + prixMensuel(b), 0) / actifs.length)
    : 0
  const m2Moyen = actifs.length
    ? Math.round(actifs.reduce((s, b) => s + prixM2(b), 0) / actifs.length)
    : 0
  const coups = actifs.filter((b) => b.statut === 'coup_de_coeur').length
  return { total: actifs.length, prixMoyen, m2Moyen, coups }
})

function toggleTri(clef: typeof triClef.value) {
  if (triClef.value === clef) {
    triAsc.value = !triAsc.value
  } else {
    triClef.value = clef
    triAsc.value = false
  }
}

const eur = (n: number) => n.toLocaleString('fr-FR')

const menuOuvert = ref<string | null>(null)
function choisirStatut(id: string, s: Statut) {
  setStatut(id, s)
  menuOuvert.value = null
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-7xl px-6 py-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-light tracking-tight text-ink-deep">Mes biens</h1>
          <p class="mt-1 text-slate">Compare, suis les prix, prends ta décision.</p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="rounded-2xl border border-hairline-soft bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">Biens suivis</p>
          <p class="mt-2 text-3xl font-light tracking-tight">{{ stats.total }}</p>
        </div>
        <div class="rounded-2xl border border-hairline-soft bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">Loyer moyen</p>
          <p class="mt-2 text-3xl font-light tracking-tight">{{ eur(stats.prixMoyen) }} €</p>
        </div>
        <div class="rounded-2xl border border-hairline-soft bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">€/m² moyen</p>
          <p class="mt-2 text-3xl font-light tracking-tight">{{ eur(stats.m2Moyen) }} €</p>
        </div>
        <div class="rounded-2xl border border-hairline-soft bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">Coups de cœur</p>
          <p class="mt-2 text-3xl font-light tracking-tight">{{ stats.coups }}</p>
        </div>
      </div>

      <div class="mt-8 flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-[200px]">
          <input
            v-model="recherche"
            type="search"
            placeholder="Rechercher un bien, une ville…"
            class="h-10 w-full rounded-full border border-hairline bg-white pl-10 pr-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
          >
          <svg class="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        <div class="flex items-center gap-2 overflow-x-auto">
          <button
            class="rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition"
            :class="filtreStatut === 'tous' ? 'bg-ink text-white' : 'border border-hairline bg-white text-steel hover:bg-surface'"
            @click="filtreStatut = 'tous'"
          >
            Tous
          </button>
          <button
            v-for="s in STATUTS"
            :key="s.value"
            class="rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition"
            :class="filtreStatut === s.value ? 'bg-ink text-white' : 'border border-hairline bg-white text-steel hover:bg-surface'"
            @click="filtreStatut = s.value"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <div class="mt-5 overflow-hidden rounded-2xl border border-hairline bg-white">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr class="border-b border-hairline text-xs font-semibold uppercase tracking-wide text-stone">
                <th class="px-5 py-3 font-semibold">Bien</th>
                <th class="cursor-pointer px-5 py-3 font-semibold hover:text-ink" @click="toggleTri('prix')">
                  Loyer
                  <span v-if="triClef === 'prix'">{{ triAsc ? '↑' : '↓' }}</span>
                </th>
                <th class="cursor-pointer px-5 py-3 font-semibold hover:text-ink" @click="toggleTri('surface')">
                  m²
                  <span v-if="triClef === 'surface'">{{ triAsc ? '↑' : '↓' }}</span>
                </th>
                <th class="cursor-pointer px-5 py-3 font-semibold hover:text-ink" @click="toggleTri('prix_m2')">
                  €/m²
                  <span v-if="triClef === 'prix_m2'">{{ triAsc ? '↑' : '↓' }}</span>
                </th>
                <th class="px-5 py-3 font-semibold">Pièces</th>
                <th class="px-5 py-3 font-semibold">DPE</th>
                <th class="cursor-pointer px-5 py-3 font-semibold hover:text-ink" @click="toggleTri('score')">
                  Score
                  <span v-if="triClef === 'score'">{{ triAsc ? '↑' : '↓' }}</span>
                </th>
                <th class="px-5 py-3 font-semibold">Statut</th>
                <th class="px-5 py-3 font-semibold">Note</th>
                <th class="px-5 py-3"/>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in biensAffiches"
                :key="b.id"
                class="border-b border-hairline-soft last:border-0 hover:bg-surface-soft transition"
              >
                <td class="px-5 py-3">
                  <NuxtLink :to="`/bien/${b.id}`" class="flex items-center gap-3 group">
                    <img
                      v-if="b.photos?.[0]"
                      :src="b.photos[0]"
                      :alt="b.titre"
                      class="size-11 shrink-0 rounded-lg object-cover bg-surface"
                      loading="lazy"
                    >
                    <div v-else class="size-11 shrink-0 rounded-lg bg-surface"/>
                    <div class="min-w-0">
                      <p class="truncate font-medium text-ink max-w-[220px] group-hover:text-blue transition">{{ b.titre }}</p>
                      <p class="text-xs text-stone">
                        {{ b.ville }} · <span class="text-steel">{{ sourceLabels[b.site_source] }}</span>
                      </p>
                    </div>
                  </NuxtLink>
                </td>
                <td class="px-5 py-3 font-semibold whitespace-nowrap">{{ eur(prixMensuel(b)) }} €</td>
                <td class="px-5 py-3 whitespace-nowrap">{{ b.surface }} m²</td>
                <td class="px-5 py-3 whitespace-nowrap text-slate">{{ eur(prixM2(b)) }} €</td>
                <td class="px-5 py-3 whitespace-nowrap">{{ b.nb_pieces }}p</td>
                <td class="px-5 py-3"><BadgeDPE :dpe="b.dpe" /></td>
                <td class="px-5 py-3 whitespace-nowrap"><ScoreBien :score="scoreDe(b)" /></td>
                <td class="px-5 py-3">
                  <div class="relative">
                    <button @click="menuOuvert = menuOuvert === b.id ? null : b.id">
                      <BadgeStatut :statut="b.statut" />
                    </button>
                    <div
                      v-if="menuOuvert === b.id"
                      class="absolute z-10 mt-1 w-44 rounded-xl border border-hairline bg-white p-1 shadow-lg"
                    >
                      <button
                        v-for="s in STATUTS"
                        :key="s.value"
                        class="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface"
                        :class="b.statut === s.value ? 'font-semibold text-ink' : 'text-slate'"
                        @click="choisirStatut(b.id, s.value)"
                      >
                        {{ s.label }}
                      </button>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-3">
                  <span class="block max-w-[160px] truncate text-slate" :title="b.note_perso ?? ''">
                    {{ b.note_perso || '—' }}
                  </span>
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <a
                      :href="b.url_source"
                      target="_blank"
                      rel="noopener"
                      class="grid size-8 place-items-center rounded-lg text-stone hover:bg-surface hover:text-ink transition"
                      title="Voir l'annonce"
                    >
                      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" />
                      </svg>
                    </a>
                    <button
                      class="grid size-8 place-items-center rounded-lg text-stone hover:bg-coral hover:text-[#600000] transition"
                      title="Supprimer"
                      @click="supprimer(b.id)"
                    >
                      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="pending" class="py-16 text-center">
          <div class="mx-auto size-6 animate-spin rounded-full border-2 border-hairline border-t-ink"/>
        </div>
        <div v-else-if="biensAffiches.length === 0" class="py-16 text-center">
          <p class="text-slate">Aucun bien ne correspond.</p>
          <NuxtLink to="/ajouter" class="mt-3 inline-block text-sm font-medium text-blue hover:underline">
            Ajouter un bien
          </NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>
