import type { JobEventState } from "@/hooks/use-job-events";
import type { Job } from "@/types/api";

interface Props {
    job: Job;
    events: JobEventState;
}

export function JobProgress({ job, events }: Props) {
    const pct = events.percent ?? job.percent ?? 0;
    const clamped = Math.max(0, Math.min(100, pct));

    const stats = [
        events.frame != null ? { label: "Frame", value: events.frame.toLocaleString() } : null,
        events.fps != null ? { label: "FPS", value: events.fps.toFixed(1) } : null,
        events.speed ? { label: "Speed", value: events.speed } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    return (
        <div className="flex flex-col gap-3">
            {/* Percentage + bar */}
            <div className="flex items-end gap-3">
                <span className="text-2xl font-bold tabular-nums text-primary">
                    {clamped.toFixed(1)}
                    <span className="text-sm font-medium text-tertiary">%</span>
                </span>
                <div className="mb-1.5 flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-quaternary">
                        <div
                            className="h-full rounded-full bg-brand-solid transition-[width] duration-150 ease-linear"
                            style={{ width: `${clamped}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Stats row */}
            {stats.length > 0 && (
                <div className="flex gap-4">
                    {stats.map((s) => (
                        <div key={s.label} className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium uppercase tracking-widest text-tertiary">
                                {s.label}
                            </span>
                            <span className="font-mono text-sm font-semibold text-primary">
                                {s.value}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
