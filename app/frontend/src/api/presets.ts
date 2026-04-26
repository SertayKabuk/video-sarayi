import { del, get, patch, post } from "./client";
import type { Preset } from "@/types/api";

export const fetchPresets = () => get<{ presets: Preset[] }>("/api/presets");

export const createPreset = (body: {
    name: string;
    pipeline: string;
    params: Record<string, unknown>;
    description?: string;
}) => post<Preset>("/api/presets", body);

export const updatePreset = (
    id: string,
    body: { name?: string; params?: Record<string, unknown>; description?: string },
) => patch<Preset>(`/api/presets/${id}`, body);

export const duplicatePreset = (id: string, name?: string) =>
    post<Preset>(`/api/presets/${id}/duplicate`, { name });

export const deletePreset = (id: string) => del<{ ok: boolean }>(`/api/presets/${id}`);
