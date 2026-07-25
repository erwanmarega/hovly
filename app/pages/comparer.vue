<script setup lang="ts">
import type { Bien } from '~/types'

useHead({ title: 'Comparer — Hovly' })

const { biens, refresh } = useBiens()
const { pending } = useAsyncData('biens-comparer', () => refresh(), { server: false })

const { selection, retirer, vider } = useComparateur()
const { preferences } = usePreferences()

const choisis = computed(() =>
  selection.value
    .map((id) => biens.value.find((b) => b.id === id))
    .filter((b): b is Bien => Boolean(b))
)

const contexte = computed(() => representants(biens.value))
const scores = computed(() => choisis.value.map((b) => scoreBien(b, contexte.value, preferences.value)))
const lignes = computed(() => comparer(choisis.value, scores.value))

const gagnant = computed(() => {
  if (choisis.value.length < 2) return null
  let idx = 0
  scores.value.forEach((s, i) => {
    if (s.total > scores.value[idx]!.total) idx = i
  })
  return { bien: choisis.value[idx]!, score: scores.value[idx]!, index: idx }
})

const sourceLabels: Record<string, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'Bien’ici'
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-7xl px-6 py-8">
      <section
        class="bandeau relative isolate overflow-hidden rounded-feature bg-brand px-7 py-8 md:px-10 md:py-10"
      >
        <span class="quadrillage pointer-events-none absolute inset-0" />

        <div class="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
              Face à face
            </p>
            <h1 class="mt-2 text-4xl font-light tracking-tight text-ink md:text-5xl">Comparer</h1>
            <p class="mt-2 max-w-md text-ink/60">
              Jusqu’à {{ MAX_COMPARAISON }} biens côte à côte. La meilleure valeur de chaque ligne
              est surlignée.
            </p>
          </div>

          <div class="flex items-center gap-2.5">
            <NuxtLink
              to="/dashboard"
              class="action rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium text-ink"
            >
              Choisir des biens
            </NuxtLink>
            <button
              v-if="choisis.length"
              class="action rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white"
              @click="vider"
            >
              Tout retirer
            </button>
          </div>
        </div>
      </section>

      <div v-if="pending" class="mt-6 h-96 animate-pulse rounded-feature border border-hairline-soft bg-white" />

      <div
        v-else-if="choisis.length < 2"
        class="mt-6 rounded-feature border border-hairline-soft bg-white py-20 text-center"
      >
        <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-light text-2xl">⚖️</div>
        <p class="mt-4 text-lg font-medium text-ink-deep">
          {{ choisis.length === 1 ? 'Encore un bien à choisir' : 'Sélectionne au moins deux biens' }}
        </p>
        <p class="mx-auto mt-1 max-w-sm text-sm text-slate">
          Depuis le tableau de bord, coche les biens à confronter — loyer, surface, DPE, score.
        </p>
        <NuxtLink
          to="/dashboard"
          class="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
        >
          Aller au tableau de bord
        </NuxtLink>
      </div>

      <template v-else>
        <div
          v-if="gagnant"
          class="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-teal-deep/30 bg-teal/30 px-4 py-3"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-teal text-sm">★</span>
          <p class="text-sm text-ink">
            <span class="font-semibold">{{ gagnant.bien.titre }}</span>
            mène avec {{ gagnant.score.total }} points{{ gagnant.score.personnalise ? ' selon tes critères' : '' }}.
          </p>
        </div>

        <div class="mt-5 overflow-x-auto rounded-feature border border-hairline-soft bg-white">
          <table class="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th class="sticky left-0 z-10 w-40 bg-white p-4 text-left align-bottom">
                  <span class="text-xs font-semibold uppercase tracking-wide text-stone">
                    {{ choisis.length }} biens
                  </span>
                </th>
                <th
                  v-for="(b, i) in choisis"
                  :key="b.id"
                  class="border-l border-hairline-soft p-4 text-left align-top"
                  :class="gagnant?.index === i && 'bg-teal/15'"
                >
                  <div class="relative">
                    <button
                      class="absolute right-0 top-0 grid size-6 place-items-center rounded-full text-stone transition hover:bg-surface hover:text-ink"
                      :aria-label="`Retirer ${b.titre}`"
                      @click="retirer(b.id)"
                    >
                      ×
                    </button>

                    <NuxtLink :to="`/bien/${b.id}`" class="group block">
                      <img
                        v-if="b.photos?.[0]"
                        :src="b.photos[0]"
                        :alt="b.titre"
                        loading="lazy"
                        class="aspect-[4/3] w-full rounded-xl bg-surface object-cover"
                      >
                      <div
                        v-else
                        class="grid aspect-[4/3] w-full place-items-center rounded-xl bg-surface text-xs text-stone"
                      >
                        Aucune photo
                      </div>

                      <p class="mt-3 line-clamp-2 pr-6 font-medium text-ink transition group-hover:text-blue">
                        {{ b.titre }}
                      </p>
                    </NuxtLink>

                    <p class="mt-1 flex items-center gap-1.5 text-xs font-normal text-stone">
                      <LogoSource :source="b.site_source" :avec-nom="false" :taille="14" />
                      {{ sourceLabels[b.site_source] }} · {{ b.ville }}
                    </p>
                    <div class="mt-2">
                      <BadgeStatut :statut="b.statut" />
                    </div>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="l in lignes"
                :key="l.cle"
                class="border-t border-hairline-soft transition hover:bg-surface-soft"
              >
                <th
                  class="sticky left-0 z-10 bg-white p-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-stone"
                >
                  {{ l.label }}
                  <span v-if="l.sens" class="ml-1 font-normal normal-case text-stone/70">
                    {{ l.sens === 'min' ? '↓ mieux' : '↑ mieux' }}
                  </span>
                </th>
                <td
                  v-for="(valeur, i) in l.affichage"
                  :key="i"
                  class="border-l border-hairline-soft p-4 align-middle tabular-nums"
                  :class="[
                    gagnant?.index === i && 'bg-teal/10',
                    l.meilleurs.includes(i) ? 'font-semibold text-[#0a4a42]' : 'text-slate'
                  ]"
                >
                  <span
                    v-if="l.meilleurs.includes(i)"
                    class="mr-1.5 inline-block rounded-full bg-teal/60 px-1.5 py-0.5 text-[10px] font-bold"
                  >★</span>
                  {{ valeur }}
                </td>
              </tr>

              <tr class="border-t border-hairline-soft">
                <th
                  class="sticky left-0 z-10 bg-white p-4 text-left text-xs font-semibold uppercase tracking-wide text-stone"
                >
                  Ma note
                </th>
                <td
                  v-for="b in choisis"
                  :key="b.id"
                  class="border-l border-hairline-soft p-4 align-top text-sm text-slate"
                >
                  {{ b.note_perso || '—' }}
                </td>
              </tr>

              <tr class="border-t border-hairline-soft">
                <th class="sticky left-0 z-10 bg-white p-4" />
                <td v-for="b in choisis" :key="b.id" class="border-l border-hairline-soft p-4">
                  <div class="flex flex-wrap items-center gap-2">
                    <NuxtLink
                      :to="`/bien/${b.id}`"
                      class="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-black"
                    >
                      Détails
                    </NuxtLink>
                    <a
                      :href="b.url_source"
                      target="_blank"
                      rel="noopener"
                      class="rounded-full border border-hairline px-3.5 py-1.5 text-xs font-medium text-steel transition hover:bg-surface"
                    >
                      L’annonce
                    </a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.bandeau {
  opacity: 0;
  animation: monter 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes monter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.quadrillage {
  background-image: linear-gradient(to right, rgb(5 0 56 / 8%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(5 0 56 / 8%) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 20% 0%, black, transparent 80%);
}

.action {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.35s ease;
}
.action:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgb(5 0 56 / 12%);
}

@media (prefers-reduced-motion: reduce) {
  .bandeau {
    opacity: 1;
    animation: none;
  }
  .action:hover {
    transform: none;
  }
}
</style>
