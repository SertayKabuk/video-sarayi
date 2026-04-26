import { useJobEvents } from "@/hooks/use-job-events";
import { baseName, fmtDuration } from "@/lib/format";
import type { Job, JobStatus } from "@/types/api";
import { cx } from "@/utils/cx";
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Download01,
    Film01,
    Loading01,
    Terminal,
    XCircle,
    XClose,
} from "@untitledui/icons";
import { useState } from "react";
import { JobLog } from "./job-log";
import { JobProgress } from "./job-progress";

const STATUS_CONFIG: Record<JobStatus, { label: string; badge: string; icon: React.FC<{ className?: string }> }> = {
    queued: {
        label: "Queued",
        badge: "bg-secondary text-tertiary border border-secondary",
        icon: Clock,
    },
    running: {
        label: "Running",
        badge: "bg-brand-50 text-brand-secondary border border-brand-200 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-400",
        icon: Loading01,
    },
    done: {
        label: "Done",
        badge: "bg-success-50 text-success-700 border border-success-200 dark:bg-success-950 dark:border-success-800 dark:text-success-400",
        icon: CheckCircle,
    },
    failed: {
        label: "Failed",
        badge: "bg-error-50 text-error-primary border border-error-200 dark:bg-error-950 dark:border-error-800",
        icon: XCircle,
    },
    canceled: {
        label: "Canceled",
        badge: "bg-warning-50 text-warning-primary border border-warning-200 dark:bg-warning-950 dark:border-warning-800",
        icon: AlertCircle,
    },
};

const PIPELINE_LABELS: Record<string, string> = {
    "x5-reel": "X5 → Reel",
    "x5-yt": "X5 → YouTube",
    "a6-reel": "A6 → Reel",
    "a6-yt": "A6 → YouTube",
};

interface CancelButtonProps {
    jobId: string;
}

function CancelButton({ jobId }: CancelButtonProps) {
    const [pending, setPending] = useState(false);

    const handleCancel = async () => {
        setPending(true);
        try {
            await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
        } finally {
            setPending(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-error-200 bg-error-50 px-3 py-1.5 text-sm font-medium text-error-primary transition duration-100 hover:bg-error-100 disabled:opacity-50 dark:border-error-800 dark:bg-error-950 dark:hover:bg-error-900"
        >
            <XClose className="size-3.5" aria-hidden />
            Cancel
        </button>
    );
}

export function JobCard({ job }: { job: Job }) {
    const [logOpen, setLogOpen] = useState(false);
    const events = useJobEvents(job.id, job.status);

    const currentStatus = (events.status ?? job.status) as JobStatus;
    const config = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.queued;
    const StatusIcon = config.icon;

    const inputFile = baseName(job.input_path || job.input);
    const pipelineLabel = PIPELINE_LABELS[job.pipeline] ?? job.pipeline;
    const isActive = currentStatus === "queued" || currentStatus === "running";
    const isDone = currentStatus === "done";

    return (
        <li className="overflow-hidden rounded-xl border border-secondary bg-primary shadow-xs">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-secondary px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Film01 className="size-4 shrink-0 text-fg-quaternary" aria-hidden />
                        <span className="truncate text-sm font-semibold text-primary" title={inputFile}>
                            {inputFile}
                        </span>
                    </div>
                    <span className="ml-6 font-mono text-[11px] text-tertiary">
                        {pipelineLabel}
                    </span>
                </div>

                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                    <span className={cx("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", config.badge)}>
                        <StatusIcon
                            className={cx("size-3", currentStatus === "running" && "animate-spin")}
                            aria-hidden
                        />
                        {config.label}
                    </span>
                </div>
            </div>

            {/* Progress (queued or running) */}
            {isActive && (
                <div className="border-b border-secondary px-4 py-3">
                    <JobProgress job={job} events={events} />
                </div>
            )}

            {/* Error */}
            {job.error && (
                <div className="flex items-start gap-2.5 border-b border-secondary bg-error-50 px-4 py-3 dark:bg-error-950">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-error-primary" aria-hidden />
                    <p className="text-sm text-error-primary">{job.error}</p>
                </div>
            )}

            {/* Paths */}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-4 py-3">
                <span className="mt-0.5 text-[11px] font-medium uppercase tracking-widest text-tertiary">In</span>
                <span className="break-all font-mono text-[11px] text-secondary" title={job.input_path || job.input}>
                    {job.input_path || job.input}
                </span>
                <span className="mt-0.5 text-[11px] font-medium uppercase tracking-widest text-tertiary">Out</span>
                <span className={cx("break-all font-mono text-[11px]", isDone ? "text-success-700 dark:text-success-400" : "text-secondary")} title={job.output_path || job.output}>
                    {job.output_path || job.output}
                </span>
            </div>

            {/* Video preview */}
            {isDone && job.output_url && (
                <div className="border-t border-secondary px-4 pb-4 pt-3">
                    <video
                        controls
                        preload="metadata"
                        src={job.output_url}
                        className="w-full rounded-lg border border-secondary bg-black"
                        style={{ maxHeight: 360 }}
                    />
                </div>
            )}

            {/* Log */}
            {logOpen && (
                <div className="border-t border-secondary px-4 pb-3 pt-3">
                    <JobLog logs={events.logs} open={logOpen} />
                </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 border-t border-secondary bg-secondary/40 px-4 py-2.5">
                <div className="flex items-center gap-2">
                    {isActive && <CancelButton jobId={job.id} />}
                    {isDone && job.output_url && (
                        <a
                            href={job.output_url}
                            download
                            className="flex items-center gap-1.5 rounded-lg bg-brand-solid px-3 py-1.5 text-sm font-medium text-white transition duration-100 hover:bg-brand-solid_hover"
                        >
                            <Download01 className="size-3.5" aria-hidden />
                            Download
                        </a>
                    )}
                    {isDone && job.duration_s != null && (
                        <span className="flex items-center gap-1 text-[11px] text-tertiary">
                            <Clock className="size-3" aria-hidden />
                            {fmtDuration(job.duration_s)}
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setLogOpen((v) => !v)}
                    className={cx(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition duration-100",
                        logOpen
                            ? "border-brand-200 bg-brand-50 text-brand-secondary dark:border-brand-800 dark:bg-brand-950"
                            : "border-secondary bg-primary text-tertiary hover:border-primary hover:text-secondary",
                    )}
                >
                    <Terminal className="size-3.5" aria-hidden />
                    {logOpen ? "Hide log" : "Show log"}
                </button>
            </div>
        </li>
    );
}
