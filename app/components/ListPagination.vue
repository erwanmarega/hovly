<script setup lang="ts">
const props = defineProps<{
  page: number
  total: number
  perPage: number
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))
const first = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1))
const last = computed(() => Math.min(props.page * props.perPage, props.total))

const pages = computed<(number | '…')[]>(() => {
  const n = pageCount.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)

  const p = props.page
  const out: (number | '…')[] = [1]
  const start = Math.max(2, p - 1)
  const end = Math.min(n - 1, p + 1)

  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < n - 1) out.push('…')
  out.push(n)
  return out
})

function goTo(p: number) {
  const target = Math.min(pageCount.value, Math.max(1, p))
  if (target !== props.page) emit('update:page', target)
}
</script>

<template>
  <div
    v-if="pageCount > 1"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3"
  >
    <p class="text-xs text-stone">
      {{ first }}–{{ last }} sur {{ total }} bien{{ total > 1 ? 's' : '' }}
    </p>

    <div class="flex items-center gap-1">
      <button
        class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-steel transition hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
        :disabled="page === 1"
        aria-label="Page précédente"
        @click="goTo(page - 1)"
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
          @click="goTo(p)"
        >
          {{ p }}
        </button>
      </template>

      <button
        class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-steel transition hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
        :disabled="page === pageCount"
        aria-label="Page suivante"
        @click="goTo(page + 1)"
      >
        ›
      </button>
    </div>
  </div>
</template>
