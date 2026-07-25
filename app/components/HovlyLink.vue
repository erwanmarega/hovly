<script setup lang="ts">
const user = useSupabaseUser()
const to = computed(() => (user.value ? '/dashboard' : '/'))
</script>

<template>
  <NuxtLink :to="to" class="shrink-0" aria-label="Hovly, accueil">
    <img
      src="/hovly_logo.jpg"
      alt="Hovly"
      class="h-12 w-auto"
      width="160"
      height="48"
    >
  </NuxtLink>
</template>
