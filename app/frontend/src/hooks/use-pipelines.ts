import { fetchPipelines } from "@/api/pipelines";
import type { Pipeline } from "@/types/api";
import { useQuery } from "@tanstack/react-query";

export function usePipelines() {
    const query = useQuery({
        queryKey: ["pipelines"],
        queryFn: fetchPipelines,
        staleTime: Infinity,
    });

    const pipelines: Pipeline[] = query.data?.pipelines ?? [];
    const pipelineMap = Object.fromEntries(pipelines.map((p) => [p.id, p]));

    return { ...query, pipelines, pipelineMap };
}
