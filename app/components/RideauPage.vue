<script setup lang="ts">
const { visible } = useRideau();
</script>

<template>
  <Transition name="rideau">
    <div
      v-if="visible"
      class="fixed inset-0 z-[200] grid place-items-center bg-brand"
      aria-hidden="true"
    >
      <img src="/abeille.png" alt="" class="abeille size-24" >
    </div>
  </Transition>
</template>

<style scoped>
.rideau-enter-active {
  transition: transform 220ms cubic-bezier(0.65, 0, 0.35, 1);
}

.rideau-leave-active {
  transition: transform 280ms cubic-bezier(0.65, 0, 0.35, 1);
}

.rideau-enter-from {
  transform: translateY(-100%);
}

.rideau-leave-to {
  transform: translateY(100%);
}

.abeille {
  animation: bourdonne 0.5s ease-in-out infinite;
}

@keyframes bourdonne {
  50% {
    transform: translateY(-8px) rotate(-5deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .abeille {
    animation: none;
  }
}
</style>
