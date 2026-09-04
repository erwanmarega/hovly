<script setup lang="ts">
const { ancres, selectedAnchor, selectAnchor } = useCommutes()

const relevant = computed(() => ancres.value.length > 1)
</script>

<template>
  <div v-if="relevant" class="flex items-center gap-2">
    <label class="whitespace-nowrap text-xs font-medium text-stone" for="commute-anchor">
      Commute
    </label>
    <select
      id="commute-anchor"
      class="min-w-0 rounded-full border border-hairline bg-white px-3 py-1.5 text-sm text-steel outline-none transition hover:bg-surface focus:border-blue"
      :value="selectedAnchor?.id ?? ''"
      @change="selectAnchor(($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">Le plus long</option>
      <option v-for="a in ancres" :key="a.id" :value="a.id">
        {{ a.label }} — {{ MODE_LABELS[a.mode] }}
      </option>
    </select>
  </div>
</template>
