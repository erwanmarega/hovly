<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    id: string
    label: string
    type?: string
    autocomplete?: string
    placeholder?: string
    invalide?: boolean
    autofocus?: boolean
  }>(),
  { type: 'text', autocomplete: undefined, placeholder: undefined, invalide: false, autofocus: false }
)

const valeur = defineModel<string>({ required: true })

const demasque = ref(false)

const estMotDePasse = computed(() => props.type === 'password')
const typeEffectif = computed(() =>
  estMotDePasse.value ? (demasque.value ? 'text' : 'password') : props.type
)
</script>

<template>
  <div>
    <div class="mb-1.5 flex items-center justify-between gap-3">
      <label :for="id" class="block text-sm font-medium text-ink">{{ label }}</label>
      <slot name="action" />
    </div>

    <div class="relative">
      <input
        :id="id"
        v-model="valeur"
        :type="typeEffectif"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :autofocus="autofocus"
        :aria-invalid="invalide"
        class="h-12 w-full rounded-xl border bg-white px-4 text-sm outline-none transition placeholder:text-stone focus:ring-4"
        :class="[
          invalide
            ? 'border-coral-soft focus:border-coral-soft focus:ring-coral/40'
            : 'border-hairline-strong hover:border-stone focus:border-ink-deep focus:ring-ink-deep/10',
          estMotDePasse && 'pr-12'
        ]"
      >

      <button
        v-if="estMotDePasse"
        type="button"
        class="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-stone transition hover:text-ink"
        :aria-label="demasque ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        :aria-pressed="demasque"
        @click="demasque = !demasque"
      >
        <svg
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <template v-if="demasque">
            <path d="M3 3l18 18" />
            <path d="M10.6 5.2A9.7 9.7 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-2.4 3.5" />
            <path d="M6.6 6.8A11.6 11.6 0 0 0 3 12c0 2.5 4 7 9 7a9.4 9.4 0 0 0 4.2-1" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </template>
          <template v-else>
            <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
            <circle cx="12" cy="12" r="3" />
          </template>
        </svg>
      </button>
    </div>
  </div>
</template>
