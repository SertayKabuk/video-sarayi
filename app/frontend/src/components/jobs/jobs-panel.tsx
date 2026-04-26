import { useJobs } from "@/hooks/use-jobs";
import { Film01 } from "@untitledui/icons";
import { JobCard } from "./job-card";

export function JobsPanel() {
    const { jobs } = useJobs();
    const reversed = [...jobs].reverse();

    const runningCount = jobs.filter((j) => j.status === "running" || j.status === "queued").length;

    return (
        <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-tertiary">
                        Jobs
                    </h2>
                    {jobs.length > 0 && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-tertiary">
                            {jobs.length}
                        </span>
                    )}
                </div>
                {runningCount > 0 && (
                    <span className="flex items-center gap-1.5 text-[11px] text-brand-secondary">
                        <span className="size-1.5 animate-pulse rounded-full bg-brand-solid" />
                        {runningCount} active
                    </span>
                )}
            </div>

            {reversed.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex size-12 items-center justify-center rounded-xl border border-secondary bg-secondary">
                        <Film01 className="size-5 text-fg-quaternary" aria-hidden />
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-secondary">No jobs yet</p>
                        <p className="text-[12px] text-tertiary">
                            Pick an input file and click Convert to start.
                        </p>
                    </div>
                </div>
            ) : (
                <ul className="flex flex-col gap-3">
                    {reversed.map((job) => (
                        <JobCard key={job.id} job={job} />
                    ))}
                </ul>
            )}
        </section>
    );
}
