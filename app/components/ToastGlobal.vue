<script setup lang="ts">
const { toast, fermer } = useToast()

let minuteur: ReturnType<typeof setTimeout> | undefined

watch(toast, (t) => {
  clearTimeout(minuteur)
  if (t) minuteur = setTimeout(fermer, 4000)
})
onBeforeUnmount(() => clearTimeout(minuteur))
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toast"
        class="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2.5 rounded-full border border-hairline bg-white/95 py-2.5 pl-3 pr-4 shadow-[0_12px_40px_rgba(5,0,56,0.16)] backdrop-blur-xl"
        role="status"
      >
        <span
          class="grid size-7 shrink-0 place-items-center rounded-full"
          :class="toast.type === 'erreur' ? 'bg-coral text-[#600000]' : 'bg-teal text-[#0a4a42]'"
        >
          <svg
            v-if="toast.type === 'erreur'"
            class="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          <svg
            v-else
            class="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
        <p class="text-sm font-medium text-ink">{{ toast.texte }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(14px);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
