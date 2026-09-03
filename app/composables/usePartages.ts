import type { Share } from "~/types";

export function usePartages() {
  const partages = useState<Share[]>("partages", () => []);

  async function refresh() {
    partages.value = await $fetch<Share[]>("/api/partages");
    return partages.value;
  }

  async function creer(bienIds: string[], titre?: string): Promise<Share> {
    const partage = await $fetch<Share>("/api/partages", {
      method: "POST",
      body: { bien_ids: bienIds, titre },
    });
    partages.value = [partage, ...partages.value];
    return partage;
  }

  async function revoquer(id: string) {
    const snapshot = partages.value;
    partages.value = partages.value.filter((p) => p.id !== id);
    try {
      await $fetch(`/api/partages/${id}`, { method: "DELETE" });
    } catch (e) {
      partages.value = snapshot;
      throw e;
    }
  }

  return { partages, refresh, creer, revoquer };
}
