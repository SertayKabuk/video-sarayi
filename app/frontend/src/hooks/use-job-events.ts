import type { Job, JobStatus } from "@/types/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

const TERMINAL: JobStatus[] = ["done", "failed", "canceled"];
const MAX_LOG_LINES = 400;

export interface JobEventState {
    status: JobStatus | null;
    percent: number | null;
    frame: number | null;
    fps: number | null;
    speed: string | null;
    logs: string[];
}

export function useJobEvents(jobId: string, initialStatus: JobStatus) {
    const queryClient = useQueryClient();
    const [events, setEvents] = useState<JobEventState>({
        status: initialStatus,
        percent: null,
        frame: null,
        fps: null,
        speed: null,
        logs: [],
    });
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (TERMINAL.includes(initialStatus)) return;
        if (wsRef.current) return;

        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${proto}//${location.host}/api/jobs/${jobId}/events`);
        wsRef.current = ws;

        ws.addEventListener("message", (e) => {
            const msg = JSON.parse(e.data as string);
            if (msg.type === "status") {
                const job: Job = msg.job;
                setEvents((prev) => ({ ...prev, status: job.status }));
                queryClient.setQueryData<{ jobs: Job[] }>(["jobs"], (old) => {
                    if (!old) return old;
                    return { jobs: old.jobs.map((j) => (j.id === job.id ? job : j)) };
                });
            } else if (msg.type === "progress") {
                setEvents((prev) => ({
                    ...prev,
                    percent: msg.percent ?? prev.percent,
                    frame: msg.frame ?? prev.frame,
                    fps: msg.fps ?? prev.fps,
                    speed: msg.speed ?? prev.speed,
                }));
            } else if (msg.type === "log") {
                setEvents((prev) => {
                    const next = [...prev.logs, msg.line as string];
                    return { ...prev, logs: next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next };
                });
            }
        });

        ws.addEventListener("close", () => {
            wsRef.current = null;
        });

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [jobId, initialStatus, queryClient]);

    return events;
}
