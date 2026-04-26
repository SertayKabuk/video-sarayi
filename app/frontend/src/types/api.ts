export type PipelineId = "x5-reel" | "x5-yt" | "a6-reel" | "a6-yt";
export type CameraId = "x5" | "a6";
export type PlatformId = "reel" | "yt";
export type JobStatus = "queued" | "running" | "done" | "failed" | "canceled";
export type OutputMode = "auto" | "manual";

export interface PipelineTraits {
    encoder: "x265" | "av1";
    uses_v360: boolean;
    uses_crop: boolean;
    lut: "x5" | "dji";
}

export interface Pipeline {
    id: PipelineId;
    label: string;
    defaults: Record<string, unknown>;
    traits: PipelineTraits;
}

export interface Preset {
    id: string;
    name: string;
    pipeline: PipelineId;
    params: Record<string, unknown>;
    built_in: boolean;
    description?: string;
}

export interface Job {
    id: string;
    status: JobStatus;
    pipeline: PipelineId;
    input: string;
    output: string;
    input_path: string;
    output_path: string;
    percent: number | null;
    frame: number | null;
    fps: number | null;
    speed: string | null;
    duration_s: number | null;
    error: string | null;
    output_url: string | null;
}

export interface HealthCheck {
    name: string;
    ok: boolean;
    detail: string;
}

export interface HealthResponse {
    ok: boolean;
    checks: HealthCheck[];
}

export interface PreviewResponse {
    argv: string[];
    output: string;
    output_path: string;
    output_url: string | null;
    input_path: string;
    merged_params: Record<string, unknown>;
}
