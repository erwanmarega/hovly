<script setup lang="ts">
withDefaults(
  defineProps<{
    /** `carte` : bloc autonome (page profil). `ligne` : intégré dans un panneau. */
    variante?: 'carte' | 'ligne'
  }>(),
  { variante: 'carte' }
)

const { etat, actif, occupe, erreur, init, activer, desactiver, tester } = useNotificationsPush()

const message = ref('')

onMounted(init)

async function basculer() {
  message.value = ''
  if (actif.value) {
    await desactiver()
    return
  }
  const ok = await activer()
  if (ok) message.value = 'Notifications activées sur cet appareil.'
}

async function envoyerTest() {
  message.value = ''
  const ok = await tester()
  message.value = ok ? 'Notification de test envoyée.' : ''
}

const explication = computed(() => {
  switch (etat.value) {
    case 'non_supporte':
      return 'Ce navigateur ne gère pas les notifications push. Sur iPhone, ajoute Hovly à l’écran d’accueil.'
    case 'non_configure':
      return 'Push non configuré sur le serveur (clés VAPID absentes).'
    case 'refuse':
      return 'Notifications bloquées pour ce site. Autorise-les dans les réglages du navigateur.'
    case 'actif':
      return 'Baisses de prix et annonces disparues arrivent directement sur cet appareil.'
    default:
      return 'Reçois les baisses de prix sans attendre l’email quotidien.'
  }
})

const bloque = computed(
  () => etat.value === 'non_supporte' || etat.value === 'non_configure' || etat.value === 'refuse'
)
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3"
    :class="
      variante === 'carte'
        ? 'rounded-2xl border border-hairline-soft bg-white p-4'
        : 'border-b border-hairline-soft px-3 py-3'
    "
  >
    <span
      class="grid size-9 shrink-0 place-items-center rounded-xl bg-surface"
      :class="actif ? 'text-steel' : 'text-stone'"
    >
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        <path v-if="!actif" d="m3 3 18 18" />
      </svg>
    </span>

    <div class="min-w-[10rem] flex-1">
      <p class="text-sm font-medium text-ink">
        Notifications push
        <span v-if="actif" class="ml-1 text-xs font-semibold text-[#0a4a42]">actives</span>
      </p>
      <p class="mt-0.5 text-xs text-stone">{{ explication }}</p>
      <p v-if="erreur" class="mt-1 text-xs text-[#600000]">{{ erreur }}</p>
      <p v-else-if="message" class="mt-1 text-xs text-[#0a4a42]">{{ message }}</p>
    </div>

    <div v-if="!bloque" class="flex shrink-0 items-center gap-2">
      <button
        v-if="actif"
        :disabled="occupe"
        class="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-steel transition hover:bg-surface disabled:opacity-50"
        @click="envoyerTest"
      >
        Tester
      </button>
      <button
        :disabled="occupe"
        class="rounded-full px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
        :class="actif ? 'border border-hairline text-steel hover:bg-surface' : 'bg-ink text-white hover:bg-black'"
        @click="basculer"
      >
        {{ occupe ? '…' : actif ? 'Désactiver' : 'Activer' }}
      </button>
    </div>
  </div>
</template>
