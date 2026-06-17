<script setup lang="ts">
import type { DPE } from '~/types'

const props = defineProps<{ dpe: DPE | null }>()

const colors: Record<DPE, string> = {
  A: '#319834',
  B: '#33cc31',
  C: '#cbfc34',
  D: '#fbfe06',
  E: '#fbcc05',
  F: '#fc9935',
  G: '#fc0205'
}

const bg = computed(() => (props.dpe ? colors[props.dpe] : '#e0e2e8'))
const isDark = computed(() => props.dpe === 'A' || props.dpe === 'B' || props.dpe === 'G')
</script>

<template>
  <span
    class="inline-flex size-6 items-center justify-center rounded-md text-xs font-bold"
    :style="{ backgroundColor: bg, color: isDark ? '#fff' : '#1c1c1e' }"
  >
    {{ dpe ?? '—' }}
  </span>
</template>
