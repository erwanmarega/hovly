<script setup lang="ts">
import type { Bien, DPE, SiteSource, Statut } from '~/types'
import type { EntreeImport } from '~/composables/useImportMasse'
import { detecterSource, STATUTS } from '~/composables/useBiens'

useHead({ title: 'Ajouter un bien — Hovly' })

const { biens, refresh, ajouter } = useBiens()
const { preferences } = usePreferences()
useAsyncData('biens-ajout', () => refresh(), { server: false })

const SOURCES: SiteSource[] = ['seloger', 'leboncoin', 'pap', 'logic-immo', 'bienici']
const LABELS: Record<SiteSource, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'Bien’ici'
}
const dpeOptions: DPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const ETAPES_EXTRACTION = [
  'Connexion à l’annonce',
  'Lecture de la page',
  'Extraction des caractéristiques',
  'Localisation du bien'
]

const mode = ref<'simple' | 'masse'>('simple')
const etape = ref<'url' | 'edition'>('url')

const collageMasse = ref('')
const entrees = ref<EntreeImport[]>([])
const importEnCours = ref(false)
const indexCourant = ref(0)

const resume = computed(() => resumeImport(entrees.value))

watch(collageMasse, (texte) => {
  if (importEnCours.value) return
  entrees.value = parserUrls(
    texte,
    biens.value.map((b) => b.url_source)
  )
})

async function lancerImport() {
  importEnCours.value = true
  const aTraiter = entrees.value.filter((e) => e.statut === 'prete')

  for (const entree of aTraiter) {
    indexCourant.value = entrees.value.indexOf(entree)
    entree.statut = 'analyse'
    try {
      const b = await $fetch<Partial<Bien>>('/api/scrape', {
        method: 'POST',
        body: { url: entree.url }
      })
      if (!b.titre && !b.prix) throw new Error('Aucune donnée extraite')

      await ajouter({
        url_source: entree.url,
        site_source: entree.source!,
        titre: b.titre ?? 'Sans titre',
        prix: b.prix ?? 0,
        surface: b.surface ?? 0,
        nb_pieces: b.nb_pieces ?? 0,
        etage: b.etage ?? null,
        charges: b.charges ?? null,
        dpe: b.dpe ?? null,
        adresse: b.adresse ?? null,
        ville: b.ville ?? '',
        code_postal: b.code_postal ?? '',
        photos: b.photos ?? [],
        description: b.description ?? null,
        statut: 'a_visiter'
      })
      entree.statut = 'ajoutee'
      entree.titre = b.titre ?? undefined
    } catch (e: unknown) {
      const err = e as { statusMessage?: string; message?: string }
      entree.statut = 'echec'
      entree.message = err?.statusMessage || err?.message || 'Extraction impossible'
    }
  }

  importEnCours.value = false
}
const url = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const etapeExtraction = ref(0)
const collage = ref(false)
let minuteur: ReturnType<typeof setInterval> | undefined

const sourceDetectee = computed(() => (url.value.trim() ? detecterSource(url.value.trim()) : null))
const urlInvalide = computed(() => url.value.trim().length > 8 && !sourceDetectee.value)

const draft = reactive({
  titre: '',
  prix: 0,
  charges: 0,
  surface: 0,
  nb_pieces: 0,
  etage: null as number | null,
  dpe: null as DPE | null,
  adresse: '',
  ville: '',
  code_postal: '',
  photo: '',
  statut: 'a_visiter' as Statut,
  note_perso: ''
})

const prixM2 = computed(() => (draft.surface ? Math.round(draft.prix / draft.surface) : 0))

const scoreApercu = computed(() => {
  if (!draft.prix || !draft.surface) return null
  const provisoire = {
    id: 'apercu',
    user_id: '',
    url_source: url.value,
    site_source: sourceDetectee.value ?? 'pap',
    titre: draft.titre,
    prix: Math.round(draft.prix * 100),
    surface: draft.surface,
    nb_pieces: draft.nb_pieces,
    etage: draft.etage,
    charges: draft.charges ? Math.round(draft.charges * 100) : null,
    dpe: draft.dpe,
    adresse: draft.adresse || null,
    ville: draft.ville,
    code_postal: draft.code_postal,
    lat: null,
    lon: null,
    geo_precision: null,
    geocode_le: null,
    photos: draft.photo ? [draft.photo] : [],
    description: null,
    statut: draft.statut,
    note_perso: null,
    actif: true,
    created_at: new Date().toISOString()
  } satisfies Bien
  return scoreBien(provisoire, representants(biens.value), preferences.value)
})

async function collerDepuisPressePapier() {
  try {
    const texte = await navigator.clipboard.readText()
    if (texte) {
      url.value = texte.trim()
      collage.value = true
      setTimeout(() => (collage.value = false), 1200)
    }
  } catch {
    error.value = 'Accès au presse-papier refusé. Colle l’URL à la main.'
  }
}

async function analyser() {
  error.value = ''
  const source = detecterSource(url.value)
  if (!source) {
    error.value = 'URL non reconnue. Sources : SeLoger, Leboncoin, PAP, Logic-Immo, Bien’ici.'
    return
  }

  loading.value = true
  etapeExtraction.value = 0
  minuteur = setInterval(() => {
    if (etapeExtraction.value < ETAPES_EXTRACTION.length - 1) etapeExtraction.value++
  }, 1400)

  try {
    const b = await $fetch<Partial<Bien>>('/api/scrape', {
      method: 'POST',
      body: { url: url.value }
    })
    draft.titre = b.titre ?? ''
    draft.prix = b.prix ? Math.round(b.prix / 100) : 0
    draft.charges = b.charges ? Math.round(b.charges / 100) : 0
    draft.surface = b.surface ?? 0
    draft.nb_pieces = b.nb_pieces ?? 0
    draft.etage = b.etage ?? null
    draft.dpe = b.dpe ?? null
    draft.adresse = b.adresse ?? ''
    draft.ville = b.ville ?? ''
    draft.code_postal = b.code_postal ?? ''
    draft.photo = b.photos?.[0] ?? ''
    etape.value = 'edition'
  } catch (e: unknown) {
    const err = e as { statusMessage?: string }
    error.value = err?.statusMessage || 'Extraction impossible. Complète à la main.'
    etape.value = 'edition'
  } finally {
    clearInterval(minuteur)
    loading.value = false
  }
}

onMounted(() => {
  const depuisLanding = useRoute().query.url
  if (typeof depuisLanding !== 'string' || !depuisLanding) return
  url.value = depuisLanding
  if (detecterSource(depuisLanding)) analyser()
})

onBeforeUnmount(() => clearInterval(minuteur))

const manquants = computed(() => {
  const m: string[] = []
  if (!draft.titre) m.push('titre')
  if (!draft.prix) m.push('loyer')
  if (!draft.surface) m.push('surface')
  return m
})

async function enregistrer() {
  error.value = ''
  if (manquants.value.length) {
    error.value = `Champs requis : ${manquants.value.join(', ')}.`
    return
  }
  const source = detecterSource(url.value)!
  saving.value = true
  try {
    await ajouter({
      url_source: url.value,
      site_source: source,
      titre: draft.titre,
      prix: Math.round(draft.prix * 100),
      surface: draft.surface,
      nb_pieces: draft.nb_pieces,
      etage: draft.etage,
      charges: Math.round(draft.charges * 100),
      dpe: draft.dpe,
      adresse: draft.adresse || null,
      ville: draft.ville,
      code_postal: draft.code_postal,
      photos: draft.photo ? [draft.photo] : [],
      statut: draft.statut,
      note_perso: draft.note_perso || null
    })
    await navigateTo('/dashboard')
  } catch {
    error.value = 'Échec de l’enregistrement. Réessaie.'
    saving.value = false
  }
}

const eur = (n: number) => n.toLocaleString('fr-FR')

const inputCls =
  'h-11 w-full rounded-xl border border-hairline-strong bg-white px-4 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20'
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-stone mb-1.5'
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-5xl px-6 py-10">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-light tracking-tight text-ink-deep">Ajouter un bien</h1>
          <p class="mt-1 text-slate">Colle l’URL d’une annonce, Hovly extrait tout automatiquement.</p>
        </div>

        <ol class="flex items-center gap-2 text-xs font-medium">
          <li
            v-for="(l, i) in ['Coller l’URL', 'Vérifier']"
            :key="l"
            class="flex items-center gap-2"
          >
            <span
              class="grid size-6 place-items-center rounded-full transition"
              :class="
                (i === 0 && etape === 'url') || (i === 1 && etape === 'edition')
                  ? 'bg-ink text-white'
                  : i === 0
                    ? 'bg-success/15 text-success'
                    : 'border border-hairline bg-white text-stone'
              "
            >
              <svg
                v-if="i === 0 && etape === 'edition'"
                class="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span
              :class="
                (i === 0 && etape === 'url') || (i === 1 && etape === 'edition')
                  ? 'text-ink'
                  : 'text-stone'
              "
            >{{ l }}</span>
            <span v-if="i === 0" class="ml-1 h-px w-8 bg-hairline" />
          </li>
        </ol>
      </div>

      <Transition name="etape" mode="out-in">
        <section v-if="etape === 'url'" key="url" class="mt-8">
          <div class="mb-5 flex items-center gap-1 rounded-full bg-surface p-1 w-fit">
            <button
              v-for="m in [
                { value: 'simple' as const, label: 'Une annonce' },
                { value: 'masse' as const, label: 'Plusieurs annonces' }
              ]"
              :key="m.value"
              class="rounded-full px-4 py-1.5 text-sm font-medium transition"
              :class="mode === m.value ? 'bg-ink text-white' : 'text-steel hover:text-ink'"
              @click="mode = m.value"
            >
              {{ m.label }}
            </button>
          </div>

          <div v-if="mode === 'masse'" class="rounded-feature border border-hairline-soft bg-white p-8">
            <label for="masse" :class="labelCls">Colle tes liens, un par ligne</label>
            <textarea
              id="masse"
              v-model="collageMasse"
              rows="6"
              :disabled="importEnCours"
              placeholder="https://www.pap.fr/annonces/…&#10;https://www.leboncoin.fr/ad/locations/…&#10;https://www.bienici.com/annonce/…"
              class="w-full resize-y rounded-xl border border-hairline-strong bg-white px-4 py-3 font-mono text-xs outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20 disabled:opacity-60"
            />

            <div v-if="entrees.length" class="mt-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-slate">
                  <span class="font-semibold text-ink">{{ resume.pretes }}</span> prête{{ resume.pretes > 1 ? 's' : '' }} à importer
                  <template v-if="resume.ignorees">
                    · <span class="text-stone">{{ resume.ignorees }} ignorée{{ resume.ignorees > 1 ? 's' : '' }}</span>
                  </template>
                  <template v-if="resume.ajoutees">
                    · <span class="text-success">{{ resume.ajoutees }} ajoutée{{ resume.ajoutees > 1 ? 's' : '' }}</span>
                  </template>
                  <template v-if="resume.echecs">
                    · <span class="text-[#600000]">{{ resume.echecs }} en échec</span>
                  </template>
                </p>

                <button
                  :disabled="importEnCours || !resume.pretes"
                  class="analyser h-11 shrink-0 rounded-full bg-ink px-6 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
                  @click="lancerImport"
                >
                  {{
                    importEnCours
                      ? `Import ${resume.ajoutees + resume.echecs}/${resume.total - resume.ignorees}…`
                      : `Importer ${resume.pretes} annonce${resume.pretes > 1 ? 's' : ''}`
                  }}
                </button>
              </div>

              <div
                v-if="importEnCours"
                class="mt-3 h-1 overflow-hidden rounded-full bg-surface"
              >
                <div
                  class="h-full rounded-full bg-ink transition-all duration-500"
                  :style="{
                    width: `${((resume.ajoutees + resume.echecs) / Math.max(1, resume.total - resume.ignorees)) * 100}%`
                  }"
                />
              </div>

              <ul class="mt-4 divide-y divide-hairline-soft">
                <li
                  v-for="(e, i) in entrees"
                  :key="i"
                  class="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span
                    class="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    :class="{
                      'bg-surface text-stone': e.statut === 'prete',
                      'bg-brand-light text-[#8a6d1c]': ['source_inconnue', 'deja_ajoutee', 'doublon_liste'].includes(e.statut),
                      'bg-teal text-[#0a4a42]': e.statut === 'ajoutee',
                      'bg-coral text-[#600000]': e.statut === 'echec'
                    }"
                  >
                    <span v-if="e.statut === 'analyse'" class="size-3 animate-spin rounded-full border-2 border-stone border-t-ink" />
                    <template v-else-if="e.statut === 'ajoutee'">✓</template>
                    <template v-else-if="e.statut === 'echec'">✕</template>
                    <template v-else-if="e.statut === 'prete'">{{ i + 1 }}</template>
                    <template v-else>!</template>
                  </span>

                  <LogoSource v-if="e.source" :source="e.source" :avec-nom="false" :taille="16" />
                  <span v-else class="size-4 shrink-0 rounded bg-surface" />

                  <span class="min-w-0 flex-1 truncate" :class="e.statut === 'echec' ? 'text-[#600000]' : 'text-slate'">
                    {{ e.titre || e.url }}
                  </span>

                  <span v-if="e.message" class="shrink-0 text-xs text-stone">{{ e.message }}</span>
                </li>
              </ul>

              <NuxtLink
                v-if="!importEnCours && resume.ajoutees"
                to="/dashboard"
                class="mt-5 inline-flex rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-steel transition hover:bg-surface"
              >
                Voir mes {{ resume.ajoutees }} nouveaux biens
              </NuxtLink>
            </div>

            <p v-else class="mt-4 text-sm text-stone">
              Chaque lien est vérifié avant l’import : source reconnue, annonce pas déjà suivie,
              pas de doublon dans la liste.
            </p>
          </div>

          <div v-else class="rounded-feature border border-hairline-soft bg-white p-8">
            <form @submit.prevent="analyser">
              <label for="url" :class="labelCls">Lien de l’annonce</label>
              <div class="flex flex-col gap-3 sm:flex-row">
                <div class="relative flex-1">
                  <input
                    id="url"
                    v-model="url"
                    type="url"
                    placeholder="https://www.pap.fr/annonces/…"
                    :class="[inputCls, 'pr-24']"
                    :aria-invalid="urlInvalide"
                  >
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-steel transition hover:bg-white"
                    @click="collerDepuisPressePapier"
                  >
                    {{ collage ? 'Collé ✓' : 'Coller' }}
                  </button>
                </div>
                <button
                  type="submit"
                  :disabled="loading || !url"
                  class="analyser h-11 shrink-0 rounded-full bg-ink px-6 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
                >
                  {{ loading ? 'Analyse…' : 'Analyser l’annonce' }}
                </button>
              </div>

              <Transition name="etat" mode="out-in">
                <p
                  v-if="sourceDetectee"
                  key="ok"
                  class="mt-3 inline-flex items-center gap-2 rounded-full bg-teal/40 px-3 py-1.5 text-xs font-semibold text-[#0a4a42]"
                >
                  <LogoSource :source="sourceDetectee" :avec-nom="false" :taille="16" />
                  {{ LABELS[sourceDetectee] }} reconnu
                </p>
                <p
                  v-else-if="urlInvalide"
                  key="ko"
                  class="mt-3 inline-flex rounded-full bg-coral/30 px-3 py-1.5 text-xs font-semibold text-[#600000]"
                >
                  Source non supportée
                </p>
                <span v-else key="rien" />
              </Transition>

              <p v-if="error" class="mt-3 text-sm font-medium text-[#600000]">{{ error }}</p>
            </form>

            <Transition name="etat">
              <div v-if="loading" class="mt-7 border-t border-hairline-soft pt-6">
                <ul class="space-y-2.5">
                  <li
                    v-for="(l, i) in ETAPES_EXTRACTION"
                    :key="l"
                    class="flex items-center gap-3 text-sm transition"
                    :class="i <= etapeExtraction ? 'text-ink' : 'text-stone'"
                  >
                    <span
                      v-if="i < etapeExtraction"
                      class="grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success"
                    >
                      <svg
                        class="size-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                      >
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    </span>
                    <span
                      v-else-if="i === etapeExtraction"
                      class="size-5 shrink-0 animate-spin rounded-full border-2 border-hairline border-t-ink"
                    />
                    <span v-else class="size-5 shrink-0 rounded-full border border-hairline" />
                    {{ l }}
                  </li>
                </ul>
              </div>
            </Transition>
          </div>

          <div class="mt-6">
            <p class="text-xs font-semibold uppercase tracking-wide text-stone">Sources supportées</p>
            <div class="mt-3 flex flex-wrap gap-2.5">
              <span
                v-for="s in SOURCES"
                :key="s"
                class="source-chip inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-3.5 py-2 text-sm font-medium text-steel transition"
                :class="sourceDetectee === s && 'border-ink text-ink'"
              >
                <LogoSource :source="s" :avec-nom="false" :taille="18" />
                {{ LABELS[s] }}
              </span>
            </div>
          </div>
        </section>

        <section v-else key="edition" class="mt-8 grid gap-6 lg:grid-cols-5">
          <div class="lg:col-span-3">
            <div
              class="flex items-center justify-between rounded-2xl px-4 py-3 text-xs font-semibold"
              :class="error ? 'bg-coral/30 text-[#600000]' : 'bg-teal/40 text-[#0a4a42]'"
            >
              <span>{{ error ? '⚠ Extraction incomplète — saisis à la main' : '✓ Annonce extraite — vérifie et complète' }}</span>
              <button class="font-medium text-blue hover:underline" @click="etape = 'url'">
                Changer d’URL
              </button>
            </div>

            <div class="mt-5 space-y-5">
              <div class="rounded-feature border border-hairline-soft bg-white p-6">
                <h2 class="text-sm font-semibold text-ink-deep">Le bien</h2>

                <div class="mt-4">
                  <label :class="labelCls">Titre</label>
                  <input v-model="draft.titre" type="text" :class="inputCls">
                </div>

                <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <label :class="labelCls">Loyer €/mois</label>
                    <input v-model.number="draft.prix" type="number" min="0" :class="inputCls">
                  </div>
                  <div>
                    <label :class="labelCls">Charges €</label>
                    <input v-model.number="draft.charges" type="number" min="0" :class="inputCls">
                  </div>
                  <div>
                    <label :class="labelCls">Surface m²</label>
                    <input v-model.number="draft.surface" type="number" min="0" :class="inputCls">
                  </div>
                  <div>
                    <label :class="labelCls">Pièces</label>
                    <input v-model.number="draft.nb_pieces" type="number" min="0" :class="inputCls">
                  </div>
                  <div>
                    <label :class="labelCls">Étage</label>
                    <input v-model.number="draft.etage" type="number" :class="inputCls">
                  </div>
                  <div>
                    <label :class="labelCls">€/m²</label>
                    <div
                      class="grid h-11 place-items-center rounded-xl bg-surface text-sm font-semibold text-slate"
                    >
                      {{ eur(prixM2) }} €
                    </div>
                  </div>
                </div>

                <div class="mt-4">
                  <label :class="labelCls">DPE</label>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      class="h-9 rounded-lg border px-3 text-sm font-medium transition"
                      :class="draft.dpe === null ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-steel hover:bg-surface'"
                      @click="draft.dpe = null"
                    >
                      —
                    </button>
                    <button
                      v-for="d in dpeOptions"
                      :key="d"
                      type="button"
                      class="dpe-btn rounded-lg transition"
                      :class="draft.dpe === d ? 'ring-2 ring-ink ring-offset-1' : 'opacity-60 hover:opacity-100'"
                      @click="draft.dpe = d"
                    >
                      <BadgeDPE :dpe="d" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="rounded-feature border border-hairline-soft bg-white p-6">
                <h2 class="text-sm font-semibold text-ink-deep">Localisation</h2>
                <div class="mt-4 grid gap-4 sm:grid-cols-4">
                  <div class="sm:col-span-2">
                    <label :class="labelCls">Adresse</label>
                    <input v-model="draft.adresse" type="text" :class="inputCls">
                  </div>
                  <div>
                    <label :class="labelCls">Ville</label>
                    <input v-model="draft.ville" type="text" :class="inputCls">
                  </div>
                  <div>
                    <label :class="labelCls">Code postal</label>
                    <input v-model="draft.code_postal" type="text" :class="inputCls">
                  </div>
                </div>
                <p class="mt-3 text-xs text-stone">
                  Plus l’adresse est précise, plus le bien sera bien placé sur la carte.
                </p>
              </div>

              <div class="rounded-feature border border-hairline-soft bg-white p-6">
                <h2 class="text-sm font-semibold text-ink-deep">Mon suivi</h2>

                <div class="mt-4">
                  <label :class="labelCls">Statut</label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="s in STATUTS"
                      :key="s.value"
                      type="button"
                      class="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
                      :class="draft.statut === s.value ? 'bg-ink text-white' : 'border border-hairline bg-white text-steel hover:bg-surface'"
                      @click="draft.statut = s.value"
                    >
                      {{ s.label }}
                    </button>
                  </div>
                </div>

                <div class="mt-4">
                  <label :class="labelCls">Note personnelle</label>
                  <textarea
                    v-model="draft.note_perso"
                    rows="3"
                    placeholder="Quartier, points forts, points faibles…"
                    class="w-full resize-none rounded-xl border border-hairline-strong bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
                  />
                </div>
              </div>
            </div>
          </div>

          <aside class="lg:col-span-2">
            <div class="lg:sticky lg:top-6 space-y-5">
              <div class="overflow-hidden rounded-feature border border-hairline-soft bg-white">
                <div class="relative aspect-[4/3] bg-surface">
                  <img
                    v-if="draft.photo"
                    :src="draft.photo"
                    alt=""
                    class="size-full object-cover"
                  >
                  <div v-else class="grid size-full place-items-center text-sm text-stone">
                    Aucune photo
                  </div>
                  <span
                    v-if="sourceDetectee"
                    class="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur-sm"
                  >
                    <LogoSource :source="sourceDetectee" :avec-nom="false" :taille="14" />
                    {{ LABELS[sourceDetectee] }}
                  </span>
                </div>

                <div class="p-6">
                  <p class="truncate font-medium text-ink">{{ draft.titre || 'Sans titre' }}</p>
                  <p class="mt-1 text-sm text-stone">
                    {{ [draft.ville, draft.code_postal].filter(Boolean).join(' ') || 'Localisation à compléter' }}
                  </p>

                  <p class="mt-4 text-3xl font-light tracking-tight">
                    {{ eur(draft.prix) }} €<span class="text-base text-stone">/mois</span>
                  </p>

                  <div class="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div class="rounded-xl bg-surface py-2.5">
                      <p class="text-xs text-stone">Surface</p>
                      <p class="mt-0.5 font-semibold">{{ draft.surface || '—' }} m²</p>
                    </div>
                    <div class="rounded-xl bg-surface py-2.5">
                      <p class="text-xs text-stone">Pièces</p>
                      <p class="mt-0.5 font-semibold">{{ draft.nb_pieces || '—' }}</p>
                    </div>
                    <div class="rounded-xl bg-surface py-2.5">
                      <p class="text-xs text-stone">€/m²</p>
                      <p class="mt-0.5 font-semibold">{{ eur(prixM2) }}</p>
                    </div>
                  </div>

                  <div v-if="scoreApercu" class="mt-5 border-t border-hairline-soft pt-4">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold uppercase tracking-wide text-stone">
                        Score estimé
                      </span>
                      <ScoreBien :score="scoreApercu" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="rounded-feature border border-hairline-soft bg-white p-5">
                <p v-if="manquants.length" class="text-xs text-stone">
                  Encore requis : <span class="font-semibold text-ink">{{ manquants.join(', ') }}</span>
                </p>
                <p v-else class="text-xs text-success">Tout est prêt.</p>

                <div class="mt-4 flex items-center gap-3">
                  <NuxtLink
                    to="/dashboard"
                    class="flex-1 rounded-full border border-hairline bg-white py-2.5 text-center text-sm font-medium text-steel transition hover:bg-surface"
                  >
                    Annuler
                  </NuxtLink>
                  <button
                    :disabled="saving || manquants.length > 0"
                    class="flex-1 rounded-full bg-ink py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
                    @click="enregistrer"
                  >
                    {{ saving ? 'Ajout…' : 'Ajouter' }}
                  </button>
                </div>

                <p v-if="error" class="mt-3 text-xs font-medium text-[#600000]">{{ error }}</p>
              </div>
            </div>
          </aside>
        </section>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.etape-enter-active,
.etape-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.etape-enter-from {
  opacity: 0;
  transform: translateY(14px);
}
.etape-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.etat-enter-active,
.etat-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.etat-enter-from,
.etat-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

.analyser {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.3s ease;
}
.analyser:not(:disabled):hover {
  transform: translateY(-2px);
}

.source-chip:hover {
  transform: translateY(-2px);
}

.dpe-btn:hover {
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .etape-enter-active,
  .etape-leave-active,
  .etat-enter-active,
  .etat-leave-active {
    transition: none;
  }
  .analyser:not(:disabled):hover,
  .source-chip:hover,
  .dpe-btn:hover {
    transform: none;
  }
}
</style>
