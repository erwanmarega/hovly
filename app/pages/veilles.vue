<script setup lang="ts">
import type { Recherche } from '~/types'

useHead({ title: 'Veilles — Hovly' })

const route = useRoute()
const {
  recherches,
  resultats,
  nouveaux,
  refresh,
  creer,
  modifier,
  supprimer,
  scanner,
  chargerResultats,
  garder,
  ignorer
} = useVeilles()

const { pending } = useAsyncData('veilles', () => refresh(), { server: false })

const formulaireOuvert = ref(false)
const urlInitiale = ref(String(route.query.url ?? ''))
const creation = ref(false)
const erreurCreation = ref('')

const ouverte = ref<string | null>(String(route.query.recherche ?? '') || null)
const scanEnCours = ref<string | null>(null)
const resultatOccupe = ref<string | null>(null)
const message = ref('')
const messageErreur = ref(false)

if (urlInitiale.value) formulaireOuvert.value = true

function annoncer(texte: string, erreur = false) {
  message.value = texte
  messageErreur.value = erreur
}

const erreurLisible = (e: unknown) =>
  (e as { statusMessage?: string; data?: { statusMessage?: string } })?.statusMessage ??
  (e as { data?: { statusMessage?: string } })?.data?.statusMessage ??
  'Une erreur est survenue.'

async function basculer(id: string) {
  if (ouverte.value === id) {
    ouverte.value = null
    return
  }
  ouverte.value = id
  if (!resultats.value[id]) {
    await chargerResultats(id, 'nouveau').catch(() => annoncer('Chargement impossible.', true))
  }
}

async function creerVeille(payload: Partial<Recherche>) {
  creation.value = true
  erreurCreation.value = ''
  try {
    const r = await creer(payload)
    formulaireOuvert.value = false
    urlInitiale.value = ''
    annoncer(`Veille « ${r.label} » créée. Premier scan en cours…`)
    await lancerScan(r.id)
  } catch (e) {
    erreurCreation.value = erreurLisible(e)
  }
  creation.value = false
}

async function lancerScan(id: string) {
  scanEnCours.value = id
  try {
    const resume = await scanner(id)
    ouverte.value = id
    annoncer(
      resume.nouvelles.length
        ? `${resume.nouvelles.length} nouveauté(s) sur ${resume.trouvees} annonce(s) lues.`
        : `Aucune nouveauté — ${resume.trouvees} annonce(s) lues, ${resume.connues} déjà connue(s), ${resume.filtrees} hors filtres.`
    )
  } catch (e) {
    await refresh()
    annoncer(erreurLisible(e), true)
  }
  scanEnCours.value = null
}

async function basculerPause(id: string, active: boolean) {
  await modifier(id, { active }).catch(() => annoncer('Modification impossible.', true))
}

async function supprimerVeille(id: string) {
  const r = recherches.value.find((x) => x.id === id)
  if (!confirm(`Supprimer la veille « ${r?.label ?? ''} » et ses résultats en attente ?`)) return

  await supprimer(id).catch(() => annoncer('Suppression impossible.', true))
}

async function garderResultat(rechercheId: string, resultatId: string) {
  resultatOccupe.value = resultatId
  try {
    const bien = await garder(rechercheId, resultatId)
    annoncer(`« ${bien.titre} » ajouté à tes biens.`)
  } catch (e) {
    annoncer(erreurLisible(e), true)
  }
  resultatOccupe.value = null
}

async function ignorerResultat(rechercheId: string, resultatId: string) {
  resultatOccupe.value = resultatId
  await ignorer(rechercheId, resultatId).catch(() => annoncer('Action impossible.', true))
  resultatOccupe.value = null
}
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

        <div class="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
              Recherche automatique
            </p>
            <h1 class="mt-2 text-4xl font-light tracking-tight text-ink md:text-5xl">Veilles</h1>
            <p class="mt-2 max-w-sm text-ink/60">
              Hovly rescanne tes pages de résultats et te prévient dès qu'une annonce
              correspond.
            </p>
          </div>

          <button
            v-if="!formulaireOuvert"
            class="action flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
            @click="formulaireOuvert = true"
          >
            <span class="text-base leading-none">+</span>
            Nouvelle veille
          </button>
        </div>

        <div v-if="recherches.length" class="relative mt-7 flex flex-wrap gap-6 text-ink">
          <p>
            <span class="text-2xl font-semibold tabular-nums">{{ recherches.length }}</span>
            <span class="ml-1.5 text-sm text-ink/60">veille(s)</span>
          </p>
          <p>
            <span class="text-2xl font-semibold tabular-nums">{{ nouveaux }}</span>
            <span class="ml-1.5 text-sm text-ink/60">nouveauté(s) en attente</span>
          </p>
        </div>
      </section>

      <p
        v-if="message"
        class="mt-5 rounded-xl px-4 py-3 text-sm"
        :class="messageErreur ? 'bg-coral/20 text-[#600000]' : 'bg-teal/30 text-[#0a4a42]'"
      >
        {{ message }}
      </p>

      <FormulaireVeille
        v-if="formulaireOuvert"
        class="mt-5"
        :url-initiale="urlInitiale"
        :en-cours="creation"
        :erreur="erreurCreation"
        @soumettre="creerVeille"
        @annuler="formulaireOuvert = false"
      />

      <div v-if="pending" class="mt-6 space-y-3">
        <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-2xl bg-white" />
      </div>

      <div
        v-else-if="!recherches.length && !formulaireOuvert"
        class="mt-6 rounded-2xl border border-dashed border-hairline-strong bg-white p-10 text-center"
      >
        <h2 class="font-medium text-ink">Aucune veille pour l'instant</h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-slate">
          En location, la vitesse fait tout. Colle l'URL d'une page de résultats SeLoger,
          Leboncoin ou PAP : Hovly la surveille pour toi et te notifie des nouvelles annonces.
        </p>
        <button
          class="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
          @click="formulaireOuvert = true"
        >
          Créer ma première veille
        </button>
      </div>

      <div v-else class="mt-6 space-y-3">
        <CarteVeille
          v-for="r in recherches"
          :key="r.id"
          :recherche="r"
          :ouverte="ouverte === r.id"
          :scan-en-cours="scanEnCours === r.id"
          @basculer="basculer"
          @scanner="lancerScan"
          @pause="basculerPause"
          @supprimer="supprimerVeille"
        >
          <div v-if="!resultats[r.id]" class="h-16 animate-pulse rounded-xl bg-white" />

          <p v-else-if="!resultats[r.id]?.length" class="px-1 py-3 text-center text-sm text-stone">
            Rien en attente. Le prochain scan te préviendra.
          </p>

          <div v-else class="space-y-2.5">
            <CarteResultat
              v-for="res in resultats[r.id]"
              :key="res.id"
              :resultat="res"
              :occupe="resultatOccupe === res.id"
              @garder="garderResultat(r.id, $event)"
              @ignorer="ignorerResultat(r.id, $event)"
            />
          </div>
        </CarteVeille>
      </div>
    </main>
  </div>
</template>

<style scoped>
.action {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease;
}
.action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgb(5 0 56 / 12%);
}

@media (prefers-reduced-motion: reduce) {
  .action:hover:not(:disabled) {
    transform: none;
  }
}
</style>
