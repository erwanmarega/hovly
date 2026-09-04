<script setup lang="ts">
import type { Status } from "~/types";
import { STATUSES } from "~/composables/useProperties";

const props = defineProps<{
  status: Status;
  upward?: boolean;
}>();

const emit = defineEmits<{ change: [status: Status] }>();

const WIDTH = 176; // w-44
const MARGIN = 8;
const GAP = 4;

const open = ref(false);
const placed = ref(false);
const trigger = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const position = ref({ top: 0, left: 0 });

function updatePosition() {
  const el = trigger.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const height = menu.value?.offsetHeight ?? 0;
  position.value = {
    top: props.upward ? r.top - height - GAP : r.bottom + GAP,
    left: Math.max(
      MARGIN,
      Math.min(r.left, window.innerWidth - WIDTH - MARGIN)
    ),
  };
  placed.value = true;
}

async function toggle() {
  if (open.value) return close();
  open.value = true;
  await nextTick();
  updatePosition();
}

function close() {
  open.value = false;
  placed.value = false;
}

function select(s: Status) {
  close();
  if (s !== props.status) emit("change", s);
}

function listen(active: boolean) {
  const method = active ? "addEventListener" : "removeEventListener";
  window[method]("scroll", updatePosition, true);
  window[method]("resize", updatePosition);
}

watch(open, listen);
onBeforeUnmount(() => listen(false));
</script>
<template>
  <div class="relative">
    <button
      ref="trigger"
      type="button"
      :aria-expanded="open"
      aria-label="Changer le statut"
      @click="toggle"
    >
      <StatusBadge :status="status" />
    </button>

    <Teleport to="body">
      <template v-if="open">
        <button
          class="fixed inset-0 z-20 cursor-default"
          tabindex="-1"
          aria-label="Fermer le menu"
          @click="close"
        />
        <div
          ref="menu"
          class="fixed z-30 w-44 rounded-xl border border-hairline bg-white p-1 shadow-lg"
          :style="{
            top: `${position.top}px`,
            left: `${position.left}px`,
            visibility: placed ? 'visible' : 'hidden',
          }"
        >
          <button
            v-for="s in STATUSES"
            :key="s.value"
            class="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface"
            :class="
              status === s.value ? 'font-semibold text-ink' : 'text-slate'
            "
            @click="select(s.value)"
          >
            {{ s.label }}
          </button>
        </div>
      </template>
    </Teleport>
  </div>
</template>
