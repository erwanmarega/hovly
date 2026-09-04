<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    photos: string[]
    alt: string
    intervalMs?: number
    background?: string
  }>(),
  { intervalMs: 2000, background: 'bg-white' }
)

const active = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function start() {
  stop()
  if (props.photos.length <= 1) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = setInterval(() => {
    active.value = (active.value + 1) % props.photos.length
  }, props.intervalMs)
}

function select(i: number) {
  active.value = i
  start()
}

watch(
  () => props.photos.length,
  () => {
    active.value = 0
    start()
  }
)

onMounted(start)
onBeforeUnmount(stop)
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-hairline"
    :class="background"
    @mouseenter="stop"
    @mouseleave="start"
  >
    <img
      :src="photos[active]"
      :alt="alt"
      class="aspect-[4/3] w-full"
      :class="isDefaultPhoto(photos[active]) ? 'object-contain' : 'object-cover'"
    >
    <div v-if="photos.length > 1" class="flex gap-2 overflow-x-auto p-3">
      <button
        v-for="(p, i) in photos"
        :key="i"
        class="size-16 shrink-0 overflow-hidden rounded-lg border-2 transition"
        :class="i === active ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'"
        @click="select(i)"
      >
        <img :src="p" alt="" class="size-full object-cover">
      </button>
    </div>
  </div>
</template>
