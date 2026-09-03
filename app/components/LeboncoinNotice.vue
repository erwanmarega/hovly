<script setup lang="ts">
withDefaults(defineProps<{ contexte?: "annonce" | "veille" }>(), {
  contexte: "annonce",
});
</script>

<template>
  <div
    class="rounded-xl border border-brand-deep/30 bg-brand-light px-3.5 py-2.5"
  >
    <p class="text-xs font-semibold text-[#8a6d1c]">
      Leboncoin : extraction moins fiable
    </p>
    <p class="mt-1 text-xs leading-relaxed text-ink/70">
      <template v-if="contexte === 'veille'">
        Leboncoin bloque les robots : Hovly passe par un service d'extraction
        tiers pour cette recherche. Les scans sont plus lents et peuvent revenir
        incomplets. Si la même recherche existe sur SeLoger, PAP ou Bien'ici,
        crée plutôt la veille là-bas.
      </template>
      <template v-else>
        Leboncoin bloque les robots : Hovly passe par un service d'extraction
        tiers, plus lent et parfois incomplet — il arrive que des champs soient
        à compléter à la main. Si l'annonce existe aussi sur SeLoger, PAP ou
        Bien'ici, colle plutôt ce lien-là.
      </template>
    </p>
  </div>
</template>
