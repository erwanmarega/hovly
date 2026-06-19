<script setup lang="ts">
import type { Bien, DPE, Statut } from '~/types'
import { detecterSource, STATUTS } from '~/composables/useBiens'

useHead({ title: 'Ajouter un bien — Hovly' })

const { ajouter } = useBiens()

const sources = [
  { value: 'seloger', label: 'SeLoger' },
  { value: 'leboncoin', label: 'Leboncoin' },
  { value: 'pap', label: 'PAP' },
  { value: 'logic-immo', label: 'Logic-Immo' },
  { value: 'bienici', label: 'BienIci' }
]

const dpeOptions: DPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const etape = ref<'url' | 'edition'>('url')
const url = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const sourceDetectee = computed(() => detecterSource(url.value))

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

async function analyser() {
  error.value = ''
  const source = detecterSource(url.value)
  if (!source) {
    error.value = "URL non reconnue. Sources : SeLoger, Leboncoin, PAP, Logic-Immo, BienIci."
    return
  }
  loading.value = true
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
  } catch (e: any) {
    error.value = e?.statusMessage || 'Extraction impossible. Complète à la main.'
    etape.value = 'edition'
  } finally {
    loading.value = false
  }
}

const prixM2 = computed(() =>
  draft.surface ? Math.round(draft.prix / draft.surface) : 0
)

async function enregistrer() {
  error.value = ''
  if (!draft.titre || !draft.prix || !draft.surface) {
    error.value = 'Titre, prix et surface sont requis.'
    return
  }
  const source = detecterSource(url.value)!
  const payload: Partial<Bien> = {
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
  }
  saving.value = true
  try {
    await ajouter(payload)
    await navigateTo('/dashboard')
  } catch {
    error.value = "Échec de l'enregistrement. Réessaie."
    saving.value = false
  }
}

const inputCls =
  'h-11 w-full rounded-lg border border-hairline-strong bg-white px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition'
const labelCls = 'block text-sm font-medium text-ink mb-1.5'
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">

    <header class="sticky top-0 z-20 border-b border-hairline bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <HovlyLink />
        <NuxtLink
          to="/dashboard"
          class="rounded-full border border-hairline bg-white px-4 py-2 text-sm font-medium text-steel hover:bg-surface transition"
        >
          ← Mes biens
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-2xl px-6 py-10">
      <h1 class="text-3xl font-light tracking-tight text-ink-deep">Ajouter un bien</h1>
      <p class="mt-1 text-slate">
        Colle l'URL d'une annonce, Hovly extrait tout automatiquement.
      </p>

      <div v-if="etape === 'url'" class="mt-8">
        <form @submit.prevent="analyser">
          <label for="url" :class="labelCls">Lien de l'annonce</label>
          <div class="flex flex-col gap-3 sm:flex-row">
            <input
              id="url"
              v-model="url"
              type="url"
              placeholder="https://www.seloger.com/annonces/..."
              :class="inputCls + ' flex-1'"
            />
            <button
              type="submit"
              :disabled="loading || !url"
              class="h-11 shrink-0 rounded-full bg-ink px-6 text-sm font-medium text-white hover:bg-black transition disabled:opacity-60"
            >
              {{ loading ? 'Analyse…' : "Analyser l'annonce" }}
            </button>
          </div>

          <p v-if="sourceDetectee" class="mt-2 text-xs font-medium text-success">
            ✓ Source détectée : {{ sources.find((s) => s.value === sourceDetectee)?.label }}
          </p>
          <p v-if="error" class="mt-2 text-sm font-medium text-coral-soft">{{ error }}</p>
        </form>

        <div class="mt-8">
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">Sources supportées</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="s in sources"
              :key="s.value"
              class="rounded-full border border-hairline bg-white px-3.5 py-1.5 text-sm font-medium text-steel"
            >
              {{ s.label }}
            </span>
          </div>
        </div>

        <div v-if="loading" class="mt-8 rounded-2xl border border-hairline bg-white p-6 text-center text-slate">
          <div class="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
          Extraction des données en cours…
        </div>
      </div>

      <div v-else class="mt-8">
        <div class="rounded-2xl border border-hairline bg-white p-6">
          <div class="flex items-center justify-between">
            <p v-if="error" class="text-xs font-semibold uppercase tracking-wide text-coral-soft">
              ⚠ Extraction impossible — saisis à la main
            </p>
            <p v-else class="text-xs font-semibold uppercase tracking-wide text-success">
              ✓ Annonce extraite — vérifie et complète
            </p>
            <button
              @click="etape = 'url'"
              class="text-xs font-medium text-blue hover:underline"
            >
              Changer d'URL
            </button>
          </div>

          <p v-if="error" class="mt-3 rounded-lg bg-coral/30 px-4 py-2.5 text-sm text-[#600000]">
            {{ error }}
          </p>

          <div class="mt-5 flex gap-4">
            <img
              v-if="draft.photo"
              :src="draft.photo"
              alt=""
              class="size-20 shrink-0 rounded-xl object-cover bg-surface"
            />
            <div class="flex-1">
              <label :class="labelCls">Titre</label>
              <input v-model="draft.titre" type="text" :class="inputCls" />
            </div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label :class="labelCls">Loyer (€/mois)</label>
              <input v-model.number="draft.prix" type="number" min="0" :class="inputCls" />
            </div>
            <div>
              <label :class="labelCls">Charges (€)</label>
              <input v-model.number="draft.charges" type="number" min="0" :class="inputCls" />
            </div>
            <div>
              <label :class="labelCls">Surface (m²)</label>
              <input v-model.number="draft.surface" type="number" min="0" :class="inputCls" />
            </div>
            <div>
              <label :class="labelCls">Pièces</label>
              <input v-model.number="draft.nb_pieces" type="number" min="0" :class="inputCls" />
            </div>
            <div>
              <label :class="labelCls">Étage</label>
              <input v-model.number="draft.etage" type="number" :class="inputCls" />
            </div>
            <div>
              <label :class="labelCls">DPE</label>
              <select v-model="draft.dpe" :class="inputCls">
                <option :value="null">—</option>
                <option v-for="d in dpeOptions" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="sm:col-span-2">
              <label :class="labelCls">Adresse</label>
              <input v-model="draft.adresse" type="text" :class="inputCls" />
            </div>
            <div>
              <label :class="labelCls">Ville</label>
              <input v-model="draft.ville" type="text" :class="inputCls" />
            </div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label :class="labelCls">Code postal</label>
              <input v-model="draft.code_postal" type="text" :class="inputCls" />
            </div>
            <div>
              <label :class="labelCls">€/m²</label>
              <div class="grid h-11 place-items-center rounded-lg bg-surface text-sm font-semibold text-slate">
                {{ prixM2.toLocaleString('fr-FR') }} €
              </div>
            </div>
          </div>

          <div class="mt-4">
            <label :class="labelCls">Statut</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="s in STATUTS"
                :key="s.value"
                type="button"
                @click="draft.statut = s.value"
                class="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
                :class="draft.statut === s.value ? 'bg-ink text-white' : 'border border-hairline bg-white text-steel hover:bg-surface'"
              >
                {{ s.label }}
              </button>
            </div>
          </div>

          <div class="mt-4">
            <label :class="labelCls">Note personnelle</label>
            <textarea
              v-model="draft.note_perso"
              rows="2"
              placeholder="Quartier, points forts, points faibles…"
              class="w-full rounded-lg border border-hairline-strong bg-white px-4 py-2.5 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
            ></textarea>
          </div>

          <p v-if="error" class="mt-3 text-sm font-medium text-coral-soft">{{ error }}</p>
        </div>

        <div class="mt-5 flex items-center justify-end gap-3">
          <NuxtLink
            to="/dashboard"
            class="rounded-full border border-hairline bg-white px-5 py-2.5 text-sm font-medium text-steel hover:bg-surface transition"
          >
            Annuler
          </NuxtLink>
          <button
            @click="enregistrer"
            :disabled="saving"
            class="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-white hover:bg-black transition disabled:opacity-60"
          >
            {{ saving ? 'Enregistrement…' : 'Ajouter à mon tableau' }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
