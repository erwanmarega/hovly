<script setup lang="ts">
import type { Bien, Statut } from '~/types'
import { STATUTS } from '~/composables/useBiens'

const route = useRoute()
const id = route.params.id as string

const { data: bien, pending, error } = await useAsyncData(
  `bien-${id}`,
  () => $fetch<Bien>(`/api/biens/${id}`),
  { server: false }
)

useHead({ title: () => (bien.value ? `${bien.value.titre} — Hovly` : 'Bien — Hovly') })

const sourceLabels: Record<string, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'BienIci'
}

const photoActive = ref(0)

const prixMensuel = computed(() => (bien.value ? Math.round(bien.value.prix / 100) : 0))
const charges = computed(() => (bien.value?.charges ? Math.round(bien.value.charges / 100) : 0))
const prixM2 = computed(() =>
  bien.value?.surface ? Math.round(bien.value.prix / 100 / bien.value.surface) : 0
)
const eur = (n: number) => n.toLocaleString('fr-FR')

const dateAjout = computed(() =>
  bien.value
    ? new Date(bien.value.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : ''
)

const menuStatut = ref(false)
async function setStatut(s: Statut) {
  menuStatut.value = false
  if (!bien.value) return
  const prev = bien.value.statut
  bien.value.statut = s
  try {
    await $fetch(`/api/biens/${id}`, { method: 'PATCH', body: { statut: s } })
  } catch {
    bien.value.statut = prev
  }
}

const noteDraft = ref('')
watchEffect(() => {
  noteDraft.value = bien.value?.note_perso ?? ''
})
const noteSaved = ref(false)
async function saveNote() {
  if (!bien.value || noteDraft.value === (bien.value.note_perso ?? '')) return
  await $fetch(`/api/biens/${id}`, { method: 'PATCH', body: { note_perso: noteDraft.value } })
  bien.value.note_perso = noteDraft.value
  noteSaved.value = true
  setTimeout(() => (noteSaved.value = false), 1500)
}

const deleting = ref(false)
async function supprimer() {
  if (!confirm('Supprimer ce bien ?')) return
  deleting.value = true
  await $fetch(`/api/biens/${id}`, { method: 'DELETE' })
  await navigateTo('/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">

    <header class="sticky top-0 z-20 border-b border-hairline bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <HovlyLink />
        <NuxtLink
          to="/dashboard"
          class="rounded-full border border-hairline bg-white px-4 py-2 text-sm font-medium text-steel hover:bg-surface transition"
        >
          ← Mes biens
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-8">

      <div v-if="pending" class="py-24 text-center">
        <div class="mx-auto size-7 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
      </div>

      <div v-else-if="error || !bien" class="py-24 text-center">
        <p class="text-slate">Bien introuvable.</p>
        <NuxtLink to="/dashboard" class="mt-3 inline-block text-sm font-medium text-blue hover:underline">
          Retour au tableau
        </NuxtLink>
      </div>

      <template v-else>

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <BadgeStatut :statut="bien.statut" />
              <span class="text-xs font-medium text-stone">
                {{ sourceLabels[bien.site_source] }} · ajouté le {{ dateAjout }}
              </span>
            </div>
            <h1 class="mt-2 text-3xl font-bold tracking-tight text-ink-deep">{{ bien.titre }}</h1>
            <p class="mt-1 text-slate">
              {{ [bien.adresse, bien.ville, bien.code_postal].filter(Boolean).join(', ') }}
            </p>
          </div>
          <a
            :href="bien.url_source"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-black transition"
          >
            Voir l'annonce
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" />
            </svg>
          </a>
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-5">

          <div class="lg:col-span-3">

            <div v-if="bien.photos.length" class="overflow-hidden rounded-2xl border border-hairline bg-white">
              <img
                :src="bien.photos[photoActive]"
                :alt="bien.titre"
                class="aspect-[4/3] w-full object-cover"
              />
              <div v-if="bien.photos.length > 1" class="flex gap-2 overflow-x-auto p-3">
                <button
                  v-for="(p, i) in bien.photos"
                  :key="i"
                  @click="photoActive = i"
                  class="size-16 shrink-0 overflow-hidden rounded-lg border-2 transition"
                  :class="i === photoActive ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'"
                >
                  <img :src="p" alt="" class="size-full object-cover" />
                </button>
              </div>
            </div>
            <div v-else class="grid aspect-[4/3] place-items-center rounded-2xl border border-hairline bg-white text-stone">
              Aucune photo
            </div>

            <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div class="rounded-2xl border border-hairline-soft bg-white p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-stone">Surface</p>
                <p class="mt-1 text-xl font-bold">{{ bien.surface }} m²</p>
              </div>
              <div class="rounded-2xl border border-hairline-soft bg-white p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-stone">Pièces</p>
                <p class="mt-1 text-xl font-bold">{{ bien.nb_pieces }}</p>
              </div>
              <div class="rounded-2xl border border-hairline-soft bg-white p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-stone">Étage</p>
                <p class="mt-1 text-xl font-bold">{{ bien.etage ?? '—' }}</p>
              </div>
              <div class="rounded-2xl border border-hairline-soft bg-white p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-stone">DPE</p>
                <div class="mt-1"><BadgeDPE :dpe="bien.dpe" /></div>
              </div>
            </div>

            <div v-if="bien.description" class="mt-6 rounded-2xl border border-hairline bg-white p-6">
              <h2 class="text-lg font-semibold">Description</h2>
              <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate">{{ bien.description }}</p>
            </div>
          </div>

          <div class="lg:col-span-2 space-y-6">

            <div class="rounded-2xl border border-hairline bg-white p-6">
              <p class="text-3xl font-bold tracking-tight">{{ eur(prixMensuel) }} €<span class="text-base font-medium text-stone"> /mois</span></p>
              <div class="mt-4 space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-steel">Prix au m²</span>
                  <span class="font-semibold">{{ eur(prixM2) }} €</span>
                </div>
                <div v-if="charges" class="flex justify-between">
                  <span class="text-steel">Charges</span>
                  <span class="font-semibold">{{ eur(charges) }} €</span>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-hairline bg-white p-6">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Statut</h2>
              <div class="relative mt-3">
                <button
                  @click="menuStatut = !menuStatut"
                  class="flex w-full items-center justify-between rounded-lg border border-hairline px-4 py-2.5 text-left hover:bg-surface transition"
                >
                  <BadgeStatut :statut="bien.statut" />
                  <svg class="size-4 text-stone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <div v-if="menuStatut" class="absolute z-10 mt-1 w-full rounded-xl border border-hairline bg-white p-1 shadow-lg">
                  <button
                    v-for="s in STATUTS"
                    :key="s.value"
                    @click="setStatut(s.value)"
                    class="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface"
                    :class="bien.statut === s.value ? 'font-semibold text-ink' : 'text-slate'"
                  >
                    {{ s.label }}
                  </button>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-hairline bg-white p-6">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Ma note</h2>
                <span v-if="noteSaved" class="text-xs font-medium text-success">Enregistré ✓</span>
              </div>
              <textarea
                v-model="noteDraft"
                @blur="saveNote"
                rows="4"
                placeholder="Quartier, points forts, points faibles…"
                class="mt-3 w-full rounded-lg border border-hairline-strong bg-white px-4 py-2.5 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
              ></textarea>
            </div>

            <button
              @click="supprimer"
              :disabled="deleting"
              class="flex w-full items-center justify-center gap-2 rounded-full border border-hairline bg-white px-5 py-2.5 text-sm font-medium text-steel hover:bg-coral hover:text-[#600000] transition disabled:opacity-60"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              {{ deleting ? 'Suppression…' : 'Supprimer ce bien' }}
            </button>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
