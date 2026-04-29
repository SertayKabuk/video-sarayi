import { useState } from "react";
import { useJobs } from "@/hooks/use-jobs";
import { useAppContext } from "@/state/app-context";

function parseTimecode(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    const parts = trimmed.split(":");
    if (parts.length < 2 || parts.length > 3) return null;
    const nums = parts.map(Number);
    if (nums.some((n) => Number.isNaN(n) || n < 0)) return null;
    if (parts.length === 2) return nums[0] * 60 + nums[1];
    return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

export function TestRenderPanel() {
    const { state } = useAppContext();
    const { testRenderMutation } = useJobs();
    const [startInput, setStartInput] = useState("0");
    const [durationInput, setDurationInput] = useState("30");
    const [error, setError] = useState<string | null>(null);

    const handleRun = async () => {
        setError(null);
        if (!state.inputPath) {
            setError("Choose an input file first.");
            return;
        }
        const startS = parseTimecode(startInput);
        if (startS === null) {
            setError("Start time format: seconds (90), MM:SS (1:30), or HH:MM:SS (0:01:30).");
            return;
        }
        const durationS = Number(durationInput);
        if (!Number.isFinite(durationS) || durationS <= 0 || durationS > 600) {
            setError("Duration must be between 1 and 600 seconds.");
            return;
        }
        try {
            await testRenderMutation.mutateAsync({
                input_path: state.inputPath,
                pipeline: state.currentPipeline,
                params: state.params,
                start_s: startS,
                duration_s: durationS,
            });
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const inputClass =
        "w-full rounded-lg border border-secondary bg-secondary px-2.5 py-1.5 text-[12px] text-primary focus:border-brand focus:outline-none";

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-secondary bg-secondary_alt p-3">
            <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-tertiary">
                    Test render
                </span>
                <span className="text-[11px] text-tertiary">
                    Renders a short clip with your current settings AND an untouched
                    stream-copy of the same window for side-by-side comparison.
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-tertiary">Start time</label>
                    <input
                        type="text"
                        value={startInput}
                        onChange={(e) => setStartInput(e.target.value)}
                        placeholder="0 or 1:30 or 0:01:30"
                        className={inputClass}
                    />
                    <span className="text-[10px] leading-tight text-tertiary">
                        Seconds, MM:SS, or HH:MM:SS.
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-tertiary">Duration (s)</label>
                    <input
                        type="number"
                        min={1}
                        max={600}
                        step={1}
                        value={durationInput}
                        onChange={(e) => setDurationInput(e.target.value)}
                        className={inputClass}
                    />
                    <span className="text-[10px] leading-tight text-tertiary">
                        Default 30s. Max 600s.
                    </span>
                </div>
            </div>

            <button
                type="button"
                disabled={!state.inputPath || testRenderMutation.isPending}
                onClick={handleRun}
                className="w-full rounded-lg border border-secondary bg-primary px-4 py-2 text-[12px] font-semibold text-primary shadow-xs transition duration-100 hover:bg-primary_hover disabled:cursor-not-allowed disabled:opacity-50"
            >
                {testRenderMutation.isPending ? "Queuing test render…" : "Run test render"}
            </button>

            {error && (
                <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-[12px] text-error-primary dark:border-error-800 dark:bg-error-950">
                    {error}
                </div>
            )}
        </div>
    );
}
