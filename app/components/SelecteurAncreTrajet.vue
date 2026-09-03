<script setup lang="ts">
const { ancres, selectedAnchor: ancreChoisie, selectAnchor: choisirAncre } = useCommutes()

const utile = computed(() => ancres.value.length > 1)
</script>

<template>
  <div v-if="utile" class="flex items-center gap-2">
    <label class="whitespace-nowrap text-xs font-medium text-stone" for="ancre-trajet">
      Commute
    </label>
    <select
      id="ancre-trajet"
      class="min-w-0 rounded-full border border-hairline bg-white px-3 py-1.5 text-sm text-steel outline-none transition hover:bg-surface focus:border-blue"
      :value="ancreChoisie?.id ?? ''"
      @change="choisirAncre(($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">Le plus long</option>
      <option v-for="a in ancres" :key="a.id" :value="a.id">
        {{ a.label }} — {{ MODE_LABELS[a.mode] }}
      </option>
    </select>
  </div>
</template>
