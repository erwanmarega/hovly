import type { Share } from "~/types";

export function useShares() {
  const shares = useState<Share[]>("partages", () => []);

  async function refresh() {
    shares.value = await $fetch<Share[]>("/api/partages");
    return shares.value;
  }

  async function create(bienIds: string[], title?: string): Promise<Share> {
    const share = await $fetch<Share>("/api/partages", {
      method: "POST",
      body: { bien_ids: bienIds, titre: title },
    });
    shares.value = [share, ...shares.value];
    return share;
  }

  async function revoke(id: string) {
    const snapshot = shares.value;
    shares.value = shares.value.filter((p) => p.id !== id);
    try {
      await $fetch(`/api/partages/${id}`, { method: "DELETE" });
    } catch (e) {
      shares.value = snapshot;
      throw e;
    }
  }

  return { shares, refresh, create, revoke };
}
