import { useQuery } from "@tanstack/react-query";
import type { PublicSiteStats } from "@/lib/public-site-stats";

type PublicSiteStatsResponse = {
  stats?: PublicSiteStats;
  error?: string;
};

async function readPublicSiteStatsResponse(response: Response) {
  const payload = (await response.json()) as PublicSiteStatsResponse;
  if (!response.ok || !payload.stats) {
    throw new Error(payload.error ?? "Unable to load public site stats.");
  }
  return payload.stats;
}

export function usePublicSiteStats() {
  return useQuery({
    queryKey: ["public-site-stats"],
    queryFn: async () => {
      const response = await fetch("/api/public/site-stats", { cache: "no-store" });
      return readPublicSiteStatsResponse(response);
    },
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
}
