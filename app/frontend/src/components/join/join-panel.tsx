import { useState } from "react";
import { ApiError } from "@/api/client";
import { openInputMultiDialog, openOutputDialog } from "@/api/dialogs";
import { createConcatJob } from "@/api/jobs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, FilePlus02, Trash01 } from "@untitledui/icons";
import { baseName } from "@/lib/format";
import { cx } from "@/utils/cx";

export function JoinPanel() {
    const [inputs, setInputs] = useState<string[]>([]);
    const [outputPath, setOutputPath] = useState("");
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const addMutation = useMutation({
        mutationFn: openInputMultiDialog,
        onSuccess: (data) => {
            if (data.paths.length === 0) return;
            setInputs((prev) => {
                const next = [...prev];
                for (const p of data.paths) if (!next.includes(p)) next.push(p);
                return next;
            });
        },
    });

    const outputDialog = useMutation({
        mutationFn: () => openOutputDialog(outputPath || null),
        onSuccess: (data) => { if (data.path) setOutputPath(data.path); },
    });

    const submitMutation = useMutation({
        mutationFn: createConcatJob,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            setError(null);
        },
        onError: (err) => {
            setError(err instanceof ApiError ? err.message : String(err));
        },
    });

    const move = (i: number, dir: -1 | 1) => {
        setInputs((prev) => {
            const j = i + dir;
            if (j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
    };

    const remove = (i: number) => {
        setInputs((prev) => prev.filter((_, k) => k !== i));
    };

    const onSubmit = () => {
        setError(null);
        if (inputs.length < 2) {
            setError("Pick at least 2 videos to join.");
            return;
        }
        submitMutation.mutate({
            input_paths: inputs,
            output_path: outputPath.trim() || undefined,
        });
    };

    const canSubmit = inputs.length >= 2 && !submitMutation.isPending;

    return (
        <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-5">
            <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-tertiary">
                    Join
                </h2>
                <p className="mt-1 text-[12px] text-tertiary">
                    Concatenate clips with no re-encoding (lossless, near-instant). All inputs must share the same codec, resolution, and pixel format.
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                        Inputs ({inputs.length})
                    </label>
                    <button
                        type="button"
                        onClick={() => addMutation.mutate()}
                        disabled={addMutation.isPending}
                        className="flex items-center gap-1.5 rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm text-secondary transition duration-100 hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                        <FilePlus02 className="size-3.5" aria-hidden />
                        {addMutation.isPending ? "…" : "Add files"}
                    </button>
                </div>

                {inputs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-secondary bg-secondary/30 px-3 py-6 text-center text-[12px] text-tertiary">
                        No videos yet — click "Add files" to pick clips. Order top to bottom is the join order.
                    </div>
                ) : (
                    <ul className="flex flex-col gap-1.5">
                        {inputs.map((p, i) => (
                            <li
                                key={`${p}:${i}`}
                                className="flex items-center gap-2 rounded-lg border border-secondary bg-secondary px-3 py-2"
                            >
                                <span className="w-6 shrink-0 font-mono text-[11px] text-tertiary">
                                    {i + 1}.
                                </span>
                                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-primary" title={p}>
                                    {baseName(p)}
                                </span>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => move(i, -1)}
                                        disabled={i === 0}
                                        aria-label="Move up"
                                        className={cx(
                                            "rounded-md p-1 text-secondary transition duration-100",
                                            "hover:bg-primary hover:text-primary",
                                            "disabled:opacity-30",
                                        )}
                                    >
                                        <ArrowUp className="size-3.5" aria-hidden />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(i, 1)}
                                        disabled={i === inputs.length - 1}
                                        aria-label="Move down"
                                        className={cx(
                                            "rounded-md p-1 text-secondary transition duration-100",
                                            "hover:bg-primary hover:text-primary",
                                            "disabled:opacity-30",
                                        )}
                                    >
                                        <ArrowDown className="size-3.5" aria-hidden />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => remove(i)}
                                        aria-label="Remove"
                                        className="rounded-md p-1 text-error-primary transition duration-100 hover:bg-error-50 dark:hover:bg-error-950"
                                    >
                                        <Trash01 className="size-3.5" aria-hidden />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                    Output file
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={outputPath}
                        placeholder="Leave blank to auto-name inside output/"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setOutputPath(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-secondary bg-secondary px-3 py-2 font-mono text-sm text-primary placeholder:text-placeholder focus:border-brand focus:outline-none"
                    />
                    <button
                        type="button"
                        disabled={outputDialog.isPending}
                        onClick={() => outputDialog.mutate()}
                        className="shrink-0 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-secondary transition duration-100 hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                        {outputDialog.isPending ? "…" : "Browse…"}
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-[12px] text-error-primary dark:border-error-800 dark:bg-error-950">
                    {error}
                </div>
            )}

            <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                className="rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white transition duration-100 hover:bg-brand-solid_hover disabled:opacity-50"
            >
                {submitMutation.isPending ? "Submitting…" : `Join ${inputs.length || ""} videos`}
            </button>
        </section>
    );
}
