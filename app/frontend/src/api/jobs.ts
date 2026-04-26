import { del, get, post } from "./client";
import type { Job } from "@/types/api";

export const fetchJobs = () => get<{ jobs: Job[] }>("/api/jobs");

export const createJob = (body: {
    input_path: string;
    pipeline: string;
    params: Record<string, unknown>;
    output_path?: string;
    argv_override?: string[];
}) => post<Job>("/api/jobs", body);

export const cancelJob = (id: string) => del<{ ok: boolean }>(`/api/jobs/${id}`);
