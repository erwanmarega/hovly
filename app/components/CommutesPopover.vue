<script setup lang="ts">
const props = defineProps<{ bienId: string }>()

const { forProperty, selected, selectedAnchor, selectAnchor } = useCommutes()

const open = ref(false)
const trigger = ref<HTMLElement | null>(null)
const position = ref<{ left: number, top?: number, bottom?: number }>({ left: 0, top: 0 })

const list = computed(() => forProperty(props.bienId))
const displayed = computed(() => selected(props.bienId))

const WIDTH = 256
const ESTIMATED_HEIGHT = 280
const MARGIN = 8

function toggle() {
  if (open.value) {
    open.value = false
    return
  }

  const r = trigger.value?.getBoundingClientRect()
  if (!r) return

  const spaceBelow = window.innerHeight - r.bottom
  const upward = spaceBelow < ESTIMATED_HEIGHT && r.top > spaceBelow

  position.value = {
    left: Math.max(MARGIN, Math.min(r.left, window.innerWidth - WIDTH - MARGIN)),
    top: upward ? undefined : r.bottom + 4,
    bottom: upward ? window.innerHeight - r.top + 4 : undefined
  }
  open.value = true
}

const style = computed(() => ({
  left: `${position.value.left}px`,
  top: position.value.top != null ? `${position.value.top}px` : undefined,
  bottom: position.value.bottom != null ? `${position.value.bottom}px` : undefined
}))

function close() {
  open.value = false
}

watch(open, (o) => {
  if (o) window.addEventListener('scroll', close, { passive: true, capture: true })
  else window.removeEventListener('scroll', close, { capture: true })
})

onScopeDispose(() => window.removeEventListener('scroll', close, { capture: true }))

function showInColumn(ancreId: string | null) {
  open.value = false
  selectAnchor(ancreId)
}
</script>

<template>
  <div class="relative" @keydown.escape="close">
    <button
      ref="trigger"
      type="button"
      class="rounded-full transition hover:opacity-80"
      :aria-expanded="open"
      aria-label="Voir tous les trajets de ce bien"
      @click="toggle"
    >
      <span
        v-if="displayed"
        class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        :class="displayed.depasse ? 'bg-coral text-[#600000]' : 'bg-teal text-[#0a4a42]'"
        :title="`${displayed.ancre.label} ${MODE_LABELS[displayed.ancre.mode]}`"
      >
        <ModeIcon :mode="displayed.ancre.mode" class="size-3" />
        {{ formatDuration(displayed.duree_s) }}
      </span>
      <span v-else class="text-stone">—</span>
    </button>

    <Teleport to="body">
      <template v-if="open">
        <button
          class="fixed inset-0 z-40 cursor-default"
          tabindex="-1"
          aria-label="Fermer"
          @click="close"
        />
        <div
          class="fixed z-50 w-64 rounded-xl border border-hairline bg-white p-1 text-left shadow-lg"
          :style="style"
          @keydown.escape="close"
        >
          <p class="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-stone">
            Afficher dans la colonne
          </p>

          <button
            v-for="t in list"
            :key="t.ancre.id"
            class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition hover:bg-surface"
            :class="selectedAnchor?.id === t.ancre.id ? 'bg-surface-soft' : ''"
            @click="showInColumn(t.ancre.id)"
          >
            <ModeIcon :mode="t.ancre.mode" class="size-3.5 shrink-0 text-stone" />
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-left"
                :class="selectedAnchor?.id === t.ancre.id ? 'font-semibold text-ink' : 'text-slate'"
              >{{ t.ancre.label }}</span>
              <span class="block truncate text-left text-[11px] text-stone">
                {{ MODE_LABELS[t.ancre.mode] }}
              </span>
            </span>
            <span
              class="shrink-0 text-xs font-semibold tabular-nums"
              :class="t.depasse ? 'text-[#600000]' : 'text-steel'"
            >
              {{ formatDuration(t.duree_s) }}
            </span>
          </button>

          <div class="my-1 h-px bg-hairline-soft" />

          <button
            class="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition hover:bg-surface"
            :class="selectedAnchor ? 'text-slate' : 'bg-surface-soft font-semibold text-ink'"
            @click="showInColumn(null)"
          >
            Le plus long
            <span class="text-[11px] font-normal text-stone">par défaut</span>
          </button>

          <NuxtLink
            :to="`/bien/${bienId}`"
            class="block rounded-lg px-3 py-1.5 text-sm font-medium text-blue transition hover:bg-surface"
          >
            Voir ce bien →
          </NuxtLink>
        </div>
      </template>
    </Teleport>
  </div>
</template>
