<script setup lang="ts">
import type { Ancre, DPE, Preferences } from '~/types'

useHead({ title: 'Mon profil — Hovly' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { biens, refresh } = useBiens()

useAsyncData('biens-profil', () => refresh(), { server: false })

const email = computed(() => user.value?.email ?? '')
const provider = computed(() => user.value?.app_metadata?.provider ?? 'email')
const initiale = computed(() =>
  (fullName.value || email.value || '?').charAt(0).toUpperCase()
)
const membreDepuis = computed(() => {
  const d = user.value?.created_at
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
})

const actifs = computed(() => biens.value.filter((b) => b.actif))
const stats = computed(() => ({
  suivis: actifs.value.length,
  coups: actifs.value.filter((b) => b.statut === 'coup_de_coeur').length,
  villes: new Set(actifs.value.map((b) => b.ville).filter(Boolean)).size,
  archives: biens.value.length - actifs.value.length
}))

const fullName = ref('')
watchEffect(() => {
  fullName.value = (user.value?.user_metadata?.full_name as string) ?? ''
})

const savingName = ref(false)
const nameMsg = ref('')
const nameErr = ref(false)

function messageEphemere(cible: Ref<string>) {
  setTimeout(() => (cible.value = ''), 3500)
}

async function saveName() {
  nameMsg.value = ''
  savingName.value = true
  const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.value } })
  savingName.value = false
  nameErr.value = !!error
  nameMsg.value = error ? 'Erreur. Réessaie.' : 'Nom mis à jour'
  messageEphemere(nameMsg)
}

const newPassword = ref('')
const motDePasseVisible = ref(false)
const savingPwd = ref(false)
const pwdMsg = ref('')
const pwdErr = ref(false)

const forceMotDePasse = computed(() => {
  const p = newPassword.value
  if (!p) return { niveau: 0, label: '', couleur: '' }
  let n = 0
  if (p.length >= 6) n++
  if (p.length >= 10) n++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) n++
  if (/\d/.test(p)) n++
  if (/[^\w\s]/.test(p)) n++
  const echelle = [
    { label: 'Trop court', couleur: 'bg-coral-soft' },
    { label: 'Faible', couleur: 'bg-coral-soft' },
    { label: 'Correct', couleur: 'bg-brand-deep' },
    { label: 'Bon', couleur: 'bg-brand-deep' },
    { label: 'Solide', couleur: 'bg-teal-deep' },
    { label: 'Excellent', couleur: 'bg-teal-deep' }
  ]
  return { niveau: n, ...echelle[n]! }
})

async function savePassword() {
  pwdMsg.value = ''
  if (newPassword.value.length < 6) {
    pwdErr.value = true
    pwdMsg.value = '6 caractères minimum.'
    return
  }
  savingPwd.value = true
  const { error } = await supabase.auth.updateUser({ password: newPassword.value })
  savingPwd.value = false
  pwdErr.value = !!error
  pwdMsg.value = error ? error.message : 'Mot de passe modifié'
  if (!error) newPassword.value = ''
  messageEphemere(pwdMsg)
}

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const { preferences, personnalise, enregistrement, enregistrer, reinitialiser } = usePreferences()

const DPE_OPTIONS: DPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const brouillon = reactive<Preferences>({ ...PREFERENCES_DEFAUT })
watchEffect(() => Object.assign(brouillon, preferences.value))

const prefsMsg = ref('')

const repartition = computed(() => {
  const somme = brouillon.poidsPrix + brouillon.poidsDpe + brouillon.poidsCharges
  if (!somme) return { prix: 0, dpe: 0, charges: 0 }
  return {
    prix: Math.round((brouillon.poidsPrix / somme) * 100),
    dpe: Math.round((brouillon.poidsDpe / somme) * 100),
    charges: Math.round((brouillon.poidsCharges / somme) * 100)
  }
})

const apercu = computed(() => {
  const actifsAvecScore = actifs.value.map((b) => scoreBien(b, biens.value, brouillon))
  if (!actifsAvecScore.length) return null
  const hors = actifsAvecScore.filter((s) => s.criteres.some((c) => !c.ok)).length
  return {
    moyenne: Math.round(actifsAvecScore.reduce((s, x) => s + x.total, 0) / actifsAvecScore.length),
    hors
  }
})

const {
  calcul: calculTrajets,
  erreur: erreurTrajets,
  calculer: calculerTrajets,
  calculable: trajetsCalculables,
  chargerEtat: chargerEtatTrajets
} = useTrajets()

onMounted(chargerEtatTrajets)
const trajetsMsg = ref('')

async function enregistrerPrefs() {
  const ok = await enregistrer({ ...brouillon })
  prefsMsg.value = ok ? 'Critères enregistrés' : 'Erreur. Réessaie.'
  messageEphemere(prefsMsg)
}

async function majAncres(ancres: Ancre[]) {
  brouillon.ancres = ancres
  trajetsMsg.value = ''
  const ok = await enregistrer({ ...brouillon })
  trajetsMsg.value = ok ? 'Points d’ancrage enregistrés' : 'Enregistrement impossible.'
  messageEphemere(trajetsMsg)
}

async function majTrajets() {
  trajetsMsg.value = ''
  const ok = await enregistrer({ ...brouillon })
  if (!ok) {
    trajetsMsg.value = 'Enregistrement impossible.'
    return
  }
  const fait = await calculerTrajets()
  trajetsMsg.value = fait ? 'Trajets à jour.' : ''
  messageEphemere(trajetsMsg)
}

async function reinitialiserPrefs() {
  await reinitialiser()
  Object.assign(brouillon, PREFERENCES_DEFAUT)
  prefsMsg.value = 'Critères réinitialisés'
  messageEphemere(prefsMsg)
}

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-stone mb-1.5'
const inputCls =
  'h-11 w-full rounded-xl border border-hairline-strong bg-white px-4 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20'
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-4xl px-6 py-8">
      <section
        class="bandeau relative isolate overflow-hidden rounded-feature bg-brand px-7 py-8 md:px-10 md:py-10"
      >
        <span class="quadrillage pointer-events-none absolute inset-0" />

        <div class="relative flex flex-wrap items-center gap-5">
          <div
            class="avatar grid size-20 shrink-0 place-items-center rounded-3xl bg-ink-deep text-3xl font-bold text-brand"
          >
            {{ initiale }}
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Mon compte</p>
            <h1 class="mt-1.5 truncate text-3xl font-light tracking-tight text-ink md:text-4xl">
              {{ fullName || 'Mon profil' }}
            </h1>
            <p class="mt-1 truncate text-ink/60">{{ email }}</p>
          </div>

          <button
            class="deco ml-auto flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
            @click="logout"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Se déconnecter
          </button>
        </div>

        <dl class="tuiles relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink/10 lg:grid-cols-4">
          <div class="tuile bg-white px-5 py-4" style="--i: 0">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-stone">Biens suivis</dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">{{ stats.suivis }}</dd>
          </div>
          <div class="tuile bg-white px-5 py-4" style="--i: 1">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-stone">Coups de cœur</dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">{{ stats.coups }}</dd>
          </div>
          <div class="tuile bg-white px-5 py-4" style="--i: 2">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-stone">Villes</dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">{{ stats.villes }}</dd>
          </div>
          <div class="tuile bg-white px-5 py-4" style="--i: 3">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-stone">Archivés</dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">{{ stats.archives }}</dd>
          </div>
        </dl>
      </section>

      <section class="mt-6 rounded-feature border border-hairline-soft bg-white p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-ink-deep">Mes critères</h2>
            <p class="mt-1 text-sm text-slate">
              Le score Hovly s’adapte à ce qui compte pour toi.
            </p>
          </div>
          <span
            v-if="personnalise"
            class="rounded-full bg-teal/40 px-3 py-1 text-xs font-semibold text-[#0a4a42]"
          >
            Score personnalisé actif
          </span>
          <span v-else class="rounded-full bg-surface px-3 py-1 text-xs font-medium text-stone">
            Réglages par défaut
          </span>
        </div>

        <div class="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-stone">
              Ce qui compte le plus
            </p>

            <div class="mt-4 space-y-4">
              <div v-for="axe in [
                { cle: 'poidsPrix' as const, label: 'Prix au m²', part: repartition.prix },
                { cle: 'poidsDpe' as const, label: 'Performance énergétique', part: repartition.dpe },
                { cle: 'poidsCharges' as const, label: 'Charges', part: repartition.charges }
              ]" :key="axe.cle">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium">{{ axe.label }}</span>
                  <span class="tabular-nums text-stone">{{ axe.part }} %</span>
                </div>
                <input
                  v-model.number="brouillon[axe.cle]"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  class="curseur mt-2 w-full"
                >
              </div>
            </div>

            <p class="mt-3 text-xs text-stone">
              Les trois poids sont ramenés à 100 % au calcul du score.
            </p>
          </div>

          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-stone">
              Mes minimums
            </p>
            <p class="mt-1 text-xs text-stone">
              Chaque critère non respecté retire 12 points au score.
            </p>

            <div class="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label :class="labelCls">Budget max €/mois</label>
                <input
                  v-model.number="brouillon.budgetMax"
                  type="number"
                  min="0"
                  placeholder="—"
                  :class="inputCls"
                >
              </div>
              <div>
                <label :class="labelCls">Surface min m²</label>
                <input
                  v-model.number="brouillon.surfaceMin"
                  type="number"
                  min="0"
                  placeholder="—"
                  :class="inputCls"
                >
              </div>
              <div>
                <label :class="labelCls">Pièces min</label>
                <input
                  v-model.number="brouillon.piecesMin"
                  type="number"
                  min="0"
                  placeholder="—"
                  :class="inputCls"
                >
              </div>
              <div>
                <label :class="labelCls">DPE min</label>
                <select v-model="brouillon.dpeMin" :class="inputCls">
                  <option :value="null">Peu importe</option>
                  <option v-for="d in DPE_OPTIONS" :key="d" :value="d">{{ d }} ou mieux</option>
                </select>
              </div>
            </div>

            <div v-if="apercu" class="mt-4 rounded-xl bg-surface px-4 py-3 text-sm">
              <p class="text-slate">
                Sur tes {{ stats.suivis }} biens : score moyen
                <span class="font-semibold text-ink">{{ apercu.moyenne }}</span>
                <template v-if="apercu.hors">
                  , <span class="font-semibold text-ink">{{ apercu.hors }}</span> hors critères
                </template>
              </p>
            </div>

            <div class="mt-6 border-t border-hairline-soft pt-5">
              <p class="text-xs font-semibold uppercase tracking-wide text-stone">
                Calcul du coût réel
              </p>
              <p class="mt-1 text-xs text-stone">
                Loyer + charges + énergie estimée depuis le DPE + assurance habitation.
              </p>

              <div class="mt-4 grid grid-cols-2 items-end gap-4">
                <div>
                  <label :class="labelCls">Prix du kWh (c€)</label>
                  <input
                    v-model.number="brouillon.prixKwh"
                    type="number"
                    min="1"
                    :placeholder="String(PRIX_KWH_DEFAUT)"
                    :class="inputCls"
                  >
                </div>
                <label class="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-slate">
                  <input
                    v-model="brouillon.chauffageDansCharges"
                    type="checkbox"
                    class="size-4 cursor-pointer accent-ink"
                  >
                  Chauffage compris dans les charges
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline-soft pt-5">
          <button
            :disabled="enregistrement"
            class="action rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
            @click="enregistrerPrefs"
          >
            {{ enregistrement ? 'Enregistrement…' : 'Enregistrer mes critères' }}
          </button>
          <button
            class="text-sm font-medium text-steel transition hover:text-ink"
            @click="reinitialiserPrefs"
          >
            Réinitialiser
          </button>
          <Transition name="msg">
            <span v-if="prefsMsg" class="text-sm font-medium text-success">{{ prefsMsg }}</span>
          </Transition>
        </div>
      </section>

      <section class="mt-6 rounded-feature border border-hairline-soft bg-white p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-ink-deep">Mes points d’ancrage</h2>
            <p class="mt-1 text-sm text-slate">
              Boulot, école, gare : Hovly calcule le temps de trajet depuis chaque bien.
            </p>
          </div>
          <button
            v-if="trajetsCalculables"
            :disabled="calculTrajets || enregistrement"
            class="action rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
            @click="majTrajets"
          >
            {{ calculTrajets ? 'Calcul…' : 'Calculer les trajets' }}
          </button>
          <p v-else-if="brouillon.ancres.length" class="max-w-xs text-xs text-stone">
            Calcul indisponible : la clé <code>ORS_API_KEY</code> (voiture, vélo, marche)
            n’est pas configurée sur le serveur. Les transports en commun, eux, ne
            demandent aucune clé.
          </p>
        </div>

        <ReglageAncres
          class="mt-5"
          :ancres="brouillon.ancres"
          @update:ancres="majAncres"
        />

        <p v-if="erreurTrajets" class="mt-3 text-xs text-[#600000]">{{ erreurTrajets }}</p>
        <p v-else-if="trajetsMsg" class="mt-3 text-xs text-[#0a4a42]">{{ trajetsMsg }}</p>

        <MentionTransitous class="mt-3" />
      </section>

      <section class="mt-6 rounded-feature border border-hairline-soft bg-white p-6">
        <h2 class="text-sm font-semibold text-ink-deep">Notifications</h2>
        <p class="mt-1 text-sm text-slate">
          Les alertes arrivent par email. Active le push pour être prévenu sur cet appareil.
        </p>
        <ReglagePush class="mt-5" />
      </section>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="rounded-feature border border-hairline-soft bg-white p-6">
          <h2 class="text-sm font-semibold text-ink-deep">Informations</h2>

          <div class="mt-5">
            <label :class="labelCls">Nom affiché</label>
            <div class="flex gap-2.5">
              <input v-model="fullName" type="text" placeholder="Ton nom" :class="[inputCls, 'flex-1']">
              <button
                :disabled="savingName"
                class="action h-11 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
                @click="saveName"
              >
                {{ savingName ? '…' : 'Enregistrer' }}
              </button>
            </div>
            <Transition name="msg">
              <p
                v-if="nameMsg"
                class="mt-2 flex items-center gap-1.5 text-sm font-medium"
                :class="nameErr ? 'text-[#600000]' : 'text-success'"
              >
                <svg
                  v-if="!nameErr"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                >
                  <path d="m5 13 4 4L19 7" />
                </svg>
                {{ nameMsg }}
              </p>
            </Transition>
          </div>

          <div class="mt-5">
            <label :class="labelCls">Email</label>
            <input :value="email" type="email" disabled :class="[inputCls, 'bg-surface text-steel']">
          </div>

          <dl class="mt-5 space-y-2 border-t border-hairline-soft pt-4 text-sm">
            <div class="flex items-center justify-between">
              <dt class="text-stone">Membre depuis</dt>
              <dd class="font-medium">{{ membreDepuis || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-stone">Méthode de connexion</dt>
              <dd class="flex items-center gap-1.5 font-medium capitalize">
                <span class="size-1.5 rounded-full bg-success" />
                {{ provider }}
              </dd>
            </div>
          </dl>
        </section>

        <section
          v-if="provider === 'email'"
          class="rounded-feature border border-hairline-soft bg-white p-6"
        >
          <h2 class="text-sm font-semibold text-ink-deep">Sécurité</h2>

          <div class="mt-5">
            <label :class="labelCls">Nouveau mot de passe</label>
            <div class="flex gap-2.5">
              <div class="relative flex-1">
                <input
                  v-model="newPassword"
                  :type="motDePasseVisible ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="••••••••"
                  :class="[inputCls, 'pr-11']"
                >
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-stone transition hover:text-ink"
                  :aria-label="motDePasseVisible ? 'Masquer' : 'Afficher'"
                  @click="motDePasseVisible = !motDePasseVisible"
                >
                  <svg
                    class="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      v-if="!motDePasseVisible"
                      d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
                    />
                    <circle v-if="!motDePasseVisible" cx="12" cy="12" r="3" />
                    <path v-else d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                    <path
                      v-if="motDePasseVisible"
                      d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 3.5-.65"
                    />
                  </svg>
                </button>
              </div>
              <button
                :disabled="savingPwd"
                class="action h-11 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
                @click="savePassword"
              >
                {{ savingPwd ? '…' : 'Changer' }}
              </button>
            </div>

            <div v-if="newPassword" class="mt-3">
              <div class="flex gap-1">
                <span
                  v-for="n in 5"
                  :key="n"
                  class="h-1 flex-1 rounded-full transition-all duration-300"
                  :class="n <= forceMotDePasse.niveau ? forceMotDePasse.couleur : 'bg-hairline'"
                />
              </div>
              <p class="mt-1.5 text-xs text-stone">{{ forceMotDePasse.label }}</p>
            </div>

            <Transition name="msg">
              <p
                v-if="pwdMsg"
                class="mt-2 text-sm font-medium"
                :class="pwdErr ? 'text-[#600000]' : 'text-success'"
              >
                {{ pwdMsg }}
              </p>
            </Transition>
          </div>

          <p class="mt-5 border-t border-hairline-soft pt-4 text-xs text-stone">
            Change de mot de passe si tu penses qu’il a pu être compromis. Tu resteras connecté sur
            cet appareil.
          </p>
        </section>

        <section
          v-else
          class="rounded-feature border border-hairline-soft bg-white p-6"
        >
          <h2 class="text-sm font-semibold text-ink-deep">Sécurité</h2>
          <p class="mt-4 text-sm text-slate">
            Ton compte utilise la connexion <span class="font-medium capitalize">{{ provider }}</span>.
            Le mot de passe se gère directement chez ce fournisseur.
          </p>
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

.quadrillage {
  background-image:
    linear-gradient(to right, rgb(5 0 56 / 6%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(5 0 56 / 6%) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 25% 0%, black, transparent 75%);
}

.curseur {
  height: 4px;
  appearance: none;
  border-radius: 999px;
  background: var(--color-hairline);
  outline: none;
}
.curseur::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 3px solid var(--color-ink);
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  transition: transform 0.2s ease;
}
.curseur::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
.curseur::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 3px solid var(--color-ink);
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
}

.avatar {
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.avatar:hover {
  transform: rotate(-6deg) scale(1.05);
}

.tuile {
  opacity: 0;
  animation: monter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(0.15s + var(--i) * 0.07s);
}

.deco,
.action {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.3s ease;
}
.deco:hover,
.action:not(:disabled):hover {
  transform: translateY(-2px);
}

.msg-enter-active,
.msg-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.msg-enter-from,
.msg-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .bandeau,
  .tuile {
    opacity: 1;
    animation: none;
  }
  .avatar:hover,
  .deco:hover,
  .action:not(:disabled):hover {
    transform: none;
  }
  .msg-enter-active,
  .msg-leave-active {
    transition: none;
  }
}
</style>
