<script setup lang="ts">
const props = defineProps<{
  page: number
  total: number
  parPage: number
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

const nbPages = computed(() => Math.max(1, Math.ceil(props.total / props.parPage)))
const premier = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.parPage + 1))
const dernier = computed(() => Math.min(props.page * props.parPage, props.total))

const pages = computed<(number | '…')[]>(() => {
  const n = nbPages.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)

  const p = props.page
  const out: (number | '…')[] = [1]
  const debut = Math.max(2, p - 1)
  const fin = Math.min(n - 1, p + 1)

  if (debut > 2) out.push('…')
  for (let i = debut; i <= fin; i++) out.push(i)
  if (fin < n - 1) out.push('…')
  out.push(n)
  return out
})

function aller(p: number) {
  const cible = Math.min(nbPages.value, Math.max(1, p))
  if (cible !== props.page) emit('update:page', cible)
}
</script>

<template>
  <div
    v-if="nbPages > 1"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3"
  >
    <p class="text-xs text-stone">
      {{ premier }}–{{ dernier }} sur {{ total }} bien{{ total > 1 ? 's' : '' }}
    </p>

    <div class="flex items-center gap-1">
      <button
        class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-steel transition hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
        :disabled="page === 1"
        aria-label="Page précédente"
        @click="aller(page - 1)"
      >
        ‹
      </button>

      <template v-for="(p, i) in pages" :key="`${p}-${i}`">
        <span v-if="p === '…'" class="px-1.5 text-sm text-stone">…</span>
        <button
          v-else
          class="min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-medium transition"
          :class="p === page ? 'bg-ink text-white' : 'text-steel hover:bg-surface'"
          :aria-current="p === page ? 'page' : undefined"
          @click="aller(p)"
        >
          {{ p }}
        </button>
      </template>

      <button
        class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-steel transition hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
        :disabled="page === nbPages"
        aria-label="Page suivante"
        @click="aller(page + 1)"
      >
        ›
      </button>
    </div>
  </div>
</template>
