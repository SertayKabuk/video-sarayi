import { get } from "./client";
import type { HealthResponse } from "@/types/api";

export const fetchHealth = () => get<HealthResponse>("/api/health");
