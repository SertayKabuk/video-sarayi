import { get } from "./client";
import type { Pipeline } from "@/types/api";

export const fetchPipelines = () => get<{ pipelines: Pipeline[] }>("/api/pipelines");
