import { cancelJob, createJob, fetchJobs } from "@/api/jobs";
import type { Job } from "@/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useJobs() {
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["jobs"] });

    const query = useQuery({
        queryKey: ["jobs"],
        queryFn: fetchJobs,
        refetchInterval: 5_000,
    });

    const jobs: Job[] = query.data?.jobs ?? [];

    const submitMutation = useMutation({
        mutationFn: createJob,
        onSuccess: invalidate,
    });

    const cancelMutation = useMutation({
        mutationFn: cancelJob,
        onSuccess: invalidate,
    });

    return { ...query, jobs, submitMutation, cancelMutation, queryClient };
}
