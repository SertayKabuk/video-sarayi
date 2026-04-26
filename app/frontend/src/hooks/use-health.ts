import { fetchHealth } from "@/api/health";
import { useQuery } from "@tanstack/react-query";

export function useHealth() {
    return useQuery({
        queryKey: ["health"],
        queryFn: fetchHealth,
        staleTime: 30_000,
        refetchInterval: 60_000,
    });
}
