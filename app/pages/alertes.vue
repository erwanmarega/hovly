<script setup lang="ts">
import type { Alerte } from '~/types'

useHead({ title: 'Alertes — Hovly' })

const { alertes, nonVues, refresh, marquerLues, verifierMaintenant } = useAlertes()

const { pending } = useAsyncData('alertes', () => refresh(), { server: false })

const FILTRES = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'non_lues', label: 'Non lues' },
  { value: 'baisse_prix', label: 'Baisses' },
  { value: 'annonce_supprimee', label: 'Disparues' }
] as const

const filtre = ref<(typeof FILTRES)[number]['value']>('toutes')

const checking = ref(false)
const checkMsg = ref('')
const checkErr = ref(false)

const stats = computed(() => {
  const baisses = alertes.value.filter((a) => a.type === 'baisse_prix')
  const economie = baisses.reduce(
    (s, a) => s + Math.max(0, (a.ancien_prix ?? 0) - (a.nouveau_prix ?? 0)),
    0
  )
  return {
    total: alertes.value.length,
    nonLues: nonVues.value,
    baisses: baisses.length,
    supprimees: alertes.value.filter((a) => a.type === 'annonce_supprimee').length,
    economie
  }
})

const compteurs = computed(() => ({
  toutes: alertes.value.length,
  non_lues: nonVues.value,
  baisse_prix: stats.value.baisses,
  annonce_supprimee: stats.value.supprimees
}))

const filtrees = computed(() => {
  if (filtre.value === 'toutes') return alertes.value
  if (filtre.value === 'non_lues') return alertes.value.filter((a) => !a.vue)
  return alertes.value.filter((a) => a.type === filtre.value)
})

function cleJour(iso: string) {
  const d = new Date(iso)
  const aujourdhui = new Date()
  const hier = new Date(aujourdhui)
  hier.setDate(hier.getDate() - 1)
  const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString()

  if (memeJour(d, aujourdhui)) return "Aujourd'hui"
  if (memeJour(d, hier)) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const groupes = computed(() => {
  const map = new Map<string, Alerte[]>()
  for (const a of filtrees.value) {
    const cle = cleJour(a.envoyee_le)
    const liste = map.get(cle) ?? []
    liste.push(a)
    map.set(cle, liste)
  }
  return [...map.entries()]
})

async function lancerVerif() {
  checking.value = true
  checkMsg.value = ''
  checkErr.value = false
  try {
    const r = await verifierMaintenant()
    const base =
      r.alertes.length > 0
        ? `${r.baisses} baisse(s), ${r.supprimes} annonce(s) disparue(s) sur ${r.verifies} bien(s) vérifié(s).`
        : `Aucun changement sur ${r.verifies} bien(s) vérifié(s).`
    const mails = r.envois?.echecs
      ? ` ${r.envois.echecs} email(s) non envoyé(s) : ${r.envois.raisons.join(', ')}.`
      : r.envois?.envoyes
        ? ` ${r.envois.envoyes} email(s) envoyé(s).`
        : ''
    checkMsg.value = base + mails
    checkErr.value = !!r.envois?.echecs || r.erreurs > 0
  } catch {
    checkErr.value = true
    checkMsg.value = 'Vérification impossible (clé service Supabase manquante ?).'
  }
  checking.value = false
}

const eur = (c: number | null) =>
  c == null ? '—' : Math.round(c / 100).toLocaleString('fr-FR') + ' €'

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

function ecart(a: Alerte) {
  if (a.type !== 'baisse_prix' || !a.ancien_prix || !a.nouveau_prix) return null
  return Math.round(((a.nouveau_prix - a.ancien_prix) / a.ancien_prix) * 100)
}

const libelle = (a: Alerte) =>
  a.type === 'baisse_prix' ? 'Baisse de prix' : 'Annonce supprimée'
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-5xl px-6 py-8">
      <section
        class="bandeau relative isolate overflow-hidden rounded-feature bg-brand px-7 py-8 md:px-10 md:py-10"
      >
        <span
          class="halo pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-white/50 blur-3xl"
        />
        <span class="quadrillage pointer-events-none absolute inset-0" />

        <div class="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
              Surveillance
            </p>
            <h1 class="mt-2 text-4xl font-light tracking-tight text-ink md:text-5xl">Alertes</h1>
            <p class="mt-2 max-w-sm text-ink/60">
              Baisses de prix et annonces disparues, détectées automatiquement.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <button
              v-if="nonVues > 0"
              class="action rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium text-ink"
              @click="marquerLues"
            >
              Tout marquer comme lu
            </button>
            <button
              :disabled="checking"
              class="action flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              @click="lancerVerif"
            >
              <span
                v-if="checking"
                class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
              <svg
                v-else
                class="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
              {{ checking ? 'Vérification…' : 'Vérifier maintenant' }}
            </button>
          </div>
        </div>

        <dl
          class="tuiles relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink/10 lg:grid-cols-4"
        >
          <div class="tuile bg-white px-5 py-4" style="--i: 0">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-stone">Alertes</dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">{{ stats.total }}</dd>
          </div>
          <div class="tuile bg-white px-5 py-4" style="--i: 1">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-stone">Non lues</dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">{{ stats.nonLues }}</dd>
          </div>
          <div class="tuile bg-white px-5 py-4" style="--i: 2">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-stone">Baisses</dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">{{ stats.baisses }}</dd>
          </div>
          <div class="tuile bg-white px-5 py-4" style="--i: 3">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-stone">
              Cumul des baisses
            </dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums text-[#0a4a42]">
              {{ stats.economie ? '−' + eur(stats.economie) : '—' }}
            </dd>
          </div>
        </dl>
      </section>

      <Transition name="msg">
        <p
          v-if="checkMsg"
          class="mt-5 rounded-2xl border px-4 py-3 text-sm"
          :class="checkErr ? 'border-coral bg-coral/20 text-[#600000]' : 'border-hairline-soft bg-white text-slate'"
        >
          {{ checkMsg }}
        </p>
      </Transition>

      <div
        class="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-hairline-soft bg-white p-3"
      >
        <button
          v-for="f in FILTRES"
          :key="f.value"
          class="filtre flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition"
          :class="filtre === f.value ? 'bg-ink text-white' : 'border border-hairline bg-white text-steel hover:bg-surface'"
          @click="filtre = f.value"
        >
          {{ f.label }}
          <span
            class="rounded-full px-1.5 text-[11px] tabular-nums"
            :class="filtre === f.value ? 'bg-white/20' : 'bg-surface'"
          >{{ compteurs[f.value] }}</span>
        </button>
      </div>

      <div v-if="pending" class="mt-5 space-y-3">
        <div
          v-for="n in 4"
          :key="n"
          class="flex items-center gap-4 rounded-2xl border border-hairline-soft bg-white p-4"
        >
          <span class="squelette size-12 shrink-0 rounded-xl" :style="{ animationDelay: `${n * 0.1}s` }" />
          <span class="squelette h-3 w-40 rounded-full" :style="{ animationDelay: `${n * 0.1}s` }" />
          <span class="squelette ml-auto h-3 w-24 rounded-full" :style="{ animationDelay: `${n * 0.1}s` }" />
        </div>
      </div>

      <div
        v-else-if="!alertes.length"
        class="mt-5 rounded-feature border border-hairline-soft bg-white py-20 text-center"
      >
        <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-teal text-2xl">🔔</div>
        <p class="mt-4 text-lg font-medium text-ink-deep">Aucune alerte pour l’instant</p>
        <p class="mx-auto mt-1 max-w-xs text-sm text-slate">
          Hovly surveille tes biens chaque jour. Tu peux aussi lancer une vérification manuelle.
        </p>
      </div>

      <div
        v-else-if="!filtrees.length"
        class="mt-5 rounded-feature border border-hairline-soft bg-white py-16 text-center"
      >
        <p class="text-slate">Aucune alerte dans ce filtre.</p>
        <button class="mt-3 text-sm font-medium text-blue hover:underline" @click="filtre = 'toutes'">
          Voir toutes les alertes
        </button>
      </div>

      <div v-else class="mt-5 space-y-7">
        <section v-for="[jour, liste] in groupes" :key="jour">
          <div class="mb-2.5 flex items-center gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-stone">{{ jour }}</h2>
            <span class="h-px flex-1 bg-hairline-soft" />
            <span class="text-xs text-stone">{{ liste.length }}</span>
          </div>

          <ul class="space-y-2.5">
            <li v-for="(a, i) in liste" :key="a.id" class="alerte" :style="{ '--i': i }">
              <NuxtLink
                :to="`/bien/${a.bien_id}`"
                class="carte flex items-center gap-4 rounded-2xl border bg-white p-4"
                :class="a.vue ? 'border-hairline-soft' : 'border-blue/40 ring-1 ring-blue/10'"
              >
                <div class="relative shrink-0">
                  <img
                    v-if="a.biens?.photos?.[0]"
                    :src="a.biens.photos[0]"
                    alt=""
                    loading="lazy"
                    class="size-12 rounded-xl bg-surface object-cover"
                  >
                  <div
                    v-else
                    class="grid size-12 place-items-center rounded-xl text-lg"
                    :class="a.type === 'baisse_prix' ? 'bg-teal' : 'bg-coral'"
                  >
                    {{ a.type === 'baisse_prix' ? '📉' : '⚠️' }}
                  </div>
                  <span
                    class="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full text-[10px] ring-2 ring-white"
                    :class="a.type === 'baisse_prix' ? 'bg-teal' : 'bg-coral'"
                  >
                    {{ a.type === 'baisse_prix' ? '↓' : '!' }}
                  </span>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold">{{ libelle(a) }}</span>
                    <span v-if="!a.vue" class="size-2 rounded-full bg-blue" />
                  </div>
                  <p class="truncate text-sm text-slate">{{ a.biens?.titre ?? 'Bien' }}</p>
                  <p v-if="a.biens?.ville" class="truncate text-xs text-stone">
                    {{ a.biens.ville }}
                  </p>
                </div>

                <div class="shrink-0 text-right">
                  <p v-if="a.type === 'baisse_prix'" class="flex items-center justify-end gap-2">
                    <s class="text-xs font-normal text-stone">{{ eur(a.ancien_prix) }}</s>
                    <span class="text-sm font-semibold">{{ eur(a.nouveau_prix) }}</span>
                    <span
                      v-if="ecart(a) !== null"
                      class="rounded-full bg-teal/50 px-2 py-0.5 text-[11px] font-bold text-[#0a4a42]"
                    >{{ ecart(a) }} %</span>
                  </p>
                  <p v-else class="text-sm font-medium text-[#600000]">Plus disponible</p>
                  <p class="mt-1 text-xs text-stone">{{ heure(a.envoyee_le) }}</p>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
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

.halo {
  animation: respirer 9s ease-in-out infinite;
}
@keyframes respirer {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(-16px, 14px) scale(1.07);
  }
}

.quadrillage {
  background-image: linear-gradient(to right, rgb(5 0 56 / 8%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(5 0 56 / 8%) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 20% 0%, black, transparent 80%);
}

.tuile {
  opacity: 0;
  animation: monter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(0.15s + var(--i) * 0.07s);
  transition: background-color 0.3s ease;
}
.tuile:hover {
  background-color: var(--color-surface-soft);
}

.action {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.35s ease;
}
.action:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgb(5 0 56 / 12%);
}

.filtre:hover {
  transform: translateY(-1px);
}

.alerte {
  opacity: 0;
  animation: monter 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--i) * 0.05s);
}

.carte {
  transition:
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}
.carte:hover {
  transform: translateX(3px);
  border-color: var(--color-hairline-strong);
  box-shadow: 0 10px 26px rgb(5 0 56 / 7%);
}

.squelette {
  display: block;
  background: linear-gradient(
    90deg,
    var(--color-hairline-soft) 0%,
    var(--color-hairline) 40%,
    var(--color-hairline-soft) 80%
  );
  background-size: 200% 100%;
  animation: scintiller 1.6s ease-in-out infinite;
}
@keyframes scintiller {
  to {
    background-position: -200% 0;
  }
}

.msg-enter-active,
.msg-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.msg-enter-from,
.msg-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .bandeau,
  .tuile,
  .alerte {
    opacity: 1;
    animation: none;
  }
  .halo,
  .squelette {
    animation: none;
  }
  .action:not(:disabled):hover,
  .filtre:hover,
  .carte:hover {
    transform: none;
  }
}
</style>
