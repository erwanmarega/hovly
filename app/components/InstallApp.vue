<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'card' | 'line'
  }>(),
  { variant: 'card' }
)

const { state, install } = useInstallApp()

const busy = ref(false)
const dismissed = ref(false)

async function trigger() {
  busy.value = true
  const accepted = await install()
  if (!accepted) dismissed.value = true
  busy.value = false
}

const explanation = computed(() => {
  switch (state.value) {
    case 'installed':
      return 'Hovly est déjà installée sur cet appareil.'
    case 'ios':
      return 'Sur iPhone : appuie sur Partager, puis « Sur l’écran d’accueil ».'
    case 'available':
      return 'Accède à Hovly comme une app, en un tap depuis ton écran d’accueil.'
    default:
      return 'L’installation n’est pas proposée par ce navigateur.'
  }
})
</script>

<template>
  <div
    v-if="state !== 'unavailable'"
    class="flex flex-wrap items-center gap-3"
    :class="
      variant === 'card'
        ? 'rounded-2xl border border-hairline-soft bg-white p-4'
        : 'border-b border-hairline-soft px-3 py-3'
    "
  >
    <span
      class="grid size-9 shrink-0 place-items-center rounded-xl bg-surface"
      :class="state === 'available' ? 'text-steel' : 'text-stone'"
    >
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3v12m0 0-4-4m4 4 4-4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
    </span>

    <div class="min-w-[10rem] flex-1">
      <p class="text-sm font-medium text-ink">
        Installer l'app
        <span v-if="state === 'installed'" class="ml-1 text-xs font-semibold text-[#0a4a42]">installée</span>
      </p>
      <p class="mt-0.5 text-xs text-stone">{{ explanation }}</p>
      <p v-if="dismissed" class="mt-1 text-xs text-stone">Installation annulée.</p>
    </div>

    <div v-if="state === 'available'" class="flex shrink-0 items-center gap-2">
      <button
        :disabled="busy"
        class="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
        @click="trigger"
      >
        {{ busy ? '…' : 'Installer' }}
      </button>
    </div>
  </div>
</template>
