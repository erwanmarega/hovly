<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    visiteLe: string | null
    compact?: boolean
  }>(),
  { compact: false }
)

const now = useNow()

const passee = computed(
  () => !!props.visiteLe && new Date(props.visiteLe).getTime() < now.value.getTime()
)

const aujourdhui = computed(
  () =>
    !!props.visiteLe &&
    !passee.value &&
    daysUntil(props.visiteLe, now.value) === 0
)

const libelle = computed(() =>
  props.visiteLe ? visitLabel(props.visiteLe, now.value) : ''
)

const teinte = computed(() => {
  if (passee.value) return 'bg-surface text-steel'
  if (aujourdhui.value) return 'bg-brand text-ink'
  return 'bg-brand-light text-[#8a6d1c]'
})
</script>

<template>
  <span
    v-if="visiteLe"
    class="inline-flex items-center gap-1.5 rounded-full font-semibold"
    :class="[teinte, compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs']"
    :title="longVisitDate(visiteLe)"
  >
    <svg
      class="size-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
    {{ libelle }}
  </span>
</template>
