import { post } from "./client";
import type { PreviewResponse } from "@/types/api";

export const fetchPreview = (body: {
    input_path?: string | null;
    output_path?: string | null;
    pipeline: string;
    params?: Record<string, unknown>;
}) => post<PreviewResponse>("/api/preview", body);
