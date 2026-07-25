<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string;
    showLinks?: boolean;
  }>(),
  { width: "max-w-6xl", showLinks: false }
);

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const route = useRoute();

const userEmail = computed(() => user.value?.email ?? "");

const { nonVues, refresh: refreshAlertes } = useAlertes();
useAsyncData("nav-alertes", () => refreshAlertes(), {
  server: false,
  immediate: !!user.value,
});

const anchors = [
  { href: "#features", label: "Fonctionnalités" },
  { href: "#how", label: "Comment ça marche" },
  { href: "#sources", label: "Sources" },
];

async function logout() {
  await supabase.auth.signOut();
  await navigateTo("/");
}
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b border-hairline-soft bg-white/80 backdrop-blur"
  >
    <div
      :class="['mx-auto flex h-16 items-center justify-between px-6', width]"
    >
      <div class="flex items-center gap-8">
        <HovlyLink />

        <nav
          v-if="user"
          class="hidden md:flex items-center gap-1 text-sm font-medium text-steel"
        >
          <NuxtLink
            to="/dashboard"
            class="rounded-full px-3.5 py-1.5 transition"
            :class="
              route.path === '/dashboard'
                ? 'bg-ink text-white'
                : 'hover:bg-surface'
            "
          >
            Mes biens
          </NuxtLink>
          <NuxtLink
            to="/alertes"
            class="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition"
            :class="
              route.path === '/alertes'
                ? 'bg-ink text-white'
                : 'hover:bg-surface'
            "
          >
            Alertes
            <span
              v-if="nonVues > 0"
              class="grid min-w-5 place-items-center rounded-full bg-coral-soft px-1.5 text-xs font-bold text-white"
            >
              {{ nonVues }}
            </span>
          </NuxtLink>
          <NuxtLink
            to="/comparer"
            class="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition"
            :class="
              route.path === '/comparer'
                ? 'bg-ink text-white'
                : 'hover:bg-surface'
            "
          >
            Comparer
            <span
              v-if="nonVues > 0"
              class="grid min-w-5 place-items-center rounded-full bg-coral-soft px-1.5 text-xs font-bold text-white"
            >
              {{ nonVues }}
            </span>
          </NuxtLink>
        </nav>

        <div
          v-else-if="showLinks"
          class="hidden md:flex items-center gap-8 text-sm text-slate"
        >
          <a
            v-for="a in anchors"
            :key="a.href"
            :href="a.href"
            class="hover:text-ink transition"
            >{{ a.label }}</a
          >
        </div>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="user">
          <NuxtLink
            to="/ajouter"
            class="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-black transition"
          >
            <span class="text-base leading-none">+</span> Ajouter un bien
          </NuxtLink>
          <NuxtLink
            to="/profil"
            class="grid size-9 place-items-center rounded-full bg-brand text-sm font-bold text-ink hover:opacity-90 transition"
            :title="userEmail"
          >
            {{ (userEmail || "?").charAt(0).toUpperCase() }}
          </NuxtLink>
          <button
            class="grid size-9 place-items-center rounded-full border border-hairline bg-white text-stone hover:bg-surface hover:text-ink transition"
            title="Se déconnecter"
            @click="logout"
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </template>
        <NuxtLink
          v-else
          to="/login"
          class="hidden sm:inline text-sm font-medium hover:text-slate transition"
        >
          Se connecter
        </NuxtLink>
      </div>
    </div>
  </header>
</template>
