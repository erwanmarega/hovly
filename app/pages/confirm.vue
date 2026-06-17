<script setup lang="ts">

useHead({ title: 'Connexion…' })

const user = useSupabaseUser()

watchEffect(() => {
  if (user.value) navigateTo('/dashboard')
})
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-surface text-ink">
    <div class="text-center">
      <div class="mx-auto mb-4 size-7 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
      <p class="text-slate">Connexion en cours…</p>
    </div>
  </div>
</template>
