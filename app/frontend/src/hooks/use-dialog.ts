import { openInputDialog, openOutputDialog } from "@/api/dialogs";
import { useMutation } from "@tanstack/react-query";

export function useInputDialog(onPath: (path: string) => void) {
    return useMutation({
        mutationFn: openInputDialog,
        onSuccess: (data) => { if (data.path) onPath(data.path); },
    });
}

export function useOutputDialog(onPath: (path: string) => void) {
    return useMutation({
        mutationFn: (suggestedPath?: string | null) => openOutputDialog(suggestedPath),
        onSuccess: (data) => { if (data.path) onPath(data.path); },
    });
}
