<script setup lang="ts">
const user = useSupabaseUser()
const to = computed(() => (user.value ? '/dashboard' : '/'))
</script>

<template>
  <NuxtLink :to="to" class="text-xl font-bold tracking-tight">Hovly</NuxtLink>
</template>
