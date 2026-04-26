import { createPreset, deletePreset, duplicatePreset, fetchPresets, updatePreset } from "@/api/presets";
import type { Preset } from "@/types/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function usePresets() {
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["presets"] });

    const query = useQuery({
        queryKey: ["presets"],
        queryFn: fetchPresets,
    });

    const presets: Preset[] = query.data?.presets ?? [];

    const createMutation = useMutation({
        mutationFn: createPreset,
        onSuccess: invalidate,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updatePreset>[1] }) =>
            updatePreset(id, body),
        onSuccess: invalidate,
    });

    const duplicateMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name?: string }) => duplicatePreset(id, name),
        onSuccess: invalidate,
    });

    const deleteMutation = useMutation({
        mutationFn: deletePreset,
        onSuccess: invalidate,
    });

    return {
        ...query,
        presets,
        createMutation,
        updateMutation,
        duplicateMutation,
        deleteMutation,
    };
}
