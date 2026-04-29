import { del, get, post } from "./client";
import type { Job, Rotation, TestRenderResponse } from "@/types/api";

export const fetchJobs = () => get<{ jobs: Job[] }>("/api/jobs");

export const createJob = (body: {
    input_path: string;
    pipeline: string;
    params: Record<string, unknown>;
    output_path?: string;
    argv_override?: string[];
}) => post<Job>("/api/jobs", body);

export const createTestRender = (body: {
    input_path: string;
    pipeline: string;
    params: Record<string, unknown>;
    start_s: number;
    duration_s: number;
}) => post<TestRenderResponse>("/api/test-render", body);

export const createConcatJob = (body: {
    input_paths: string[];
    output_path?: string;
}) => post<Job>("/api/jobs/concat", body);

export const createRotateJob = (body: {
    input_path: string;
    output_path?: string;
    rotation: Rotation;
}) => post<Job>("/api/jobs/rotate", body);

export const createLutJob = (body: {
    input_path: string;
    output_path?: string;
    lut: "x5" | "dji" | "custom";
    lut_path?: string;
    interp?: "tetrahedral" | "trilinear" | "nearest";
}) => post<Job>("/api/jobs/lut", body);

export const cancelJob = (id: string) => del<{ ok: boolean }>(`/api/jobs/${id}`);
