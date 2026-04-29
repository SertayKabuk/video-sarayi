import { useState } from "react";
import { ApiError } from "@/api/client";
import { openInputDialog, openOutputDialog } from "@/api/dialogs";
import { createRotateJob } from "@/api/jobs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cx } from "@/utils/cx";
import { RefreshCcw01 } from "@untitledui/icons";
import type { Rotation } from "@/types/api";

const ROTATIONS: { value: Rotation; label: string; sub: string }[] = [
    { value: 90, label: "90° CW", sub: "rotate clockwise" },
    { value: 180, label: "180°", sub: "flip upside down" },
    { value: 270, label: "90° CCW", sub: "rotate counter-clockwise" },
];

export function RotatePanel() {
    const [inputPath, setInputPath] = useState("");
    const [outputPath, setOutputPath] = useState("");
    const [rotation, setRotation] = useState<Rotation>(90);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const inputDialog = useMutation({
        mutationFn: openInputDialog,
        onSuccess: (data) => { if (data.path) setInputPath(data.path); },
    });
    const outputDialog = useMutation({
        mutationFn: () => openOutputDialog(outputPath || null),
        onSuccess: (data) => { if (data.path) setOutputPath(data.path); },
    });

    const submitMutation = useMutation({
        mutationFn: createRotateJob,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["jobs"] });
            setError(null);
        },
        onError: (err) => {
            setError(err instanceof ApiError ? err.message : String(err));
        },
    });

    const onSubmit = () => {
        setError(null);
        if (!inputPath.trim()) {
            setError("Pick a video to rotate.");
            return;
        }
        submitMutation.mutate({
            input_path: inputPath.trim(),
            output_path: outputPath.trim() || undefined,
            rotation,
        });
    };

    return (
        <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-5">
            <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-tertiary">
                    Rotate
                </h2>
                <p className="mt-1 text-[12px] text-tertiary">
                    Lossless rotation via the display-matrix side data (the same trick LosslessCut uses) — no re-encoding.
                </p>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                    Input file
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputPath}
                        placeholder="Paste a video path or browse for one…"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setInputPath(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-secondary bg-secondary px-3 py-2 font-mono text-sm text-primary placeholder:text-placeholder focus:border-brand focus:outline-none"
                    />
                    <button
                        type="button"
                        disabled={inputDialog.isPending}
                        onClick={() => inputDialog.mutate()}
                        className="shrink-0 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-secondary transition duration-100 hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                        {inputDialog.isPending ? "…" : "Browse…"}
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                    Rotation
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {ROTATIONS.map((r) => {
                        const isActive = rotation === r.value;
                        return (
                            <button
                                key={r.value}
                                type="button"
                                onClick={() => setRotation(r.value)}
                                className={cx(
                                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition duration-100",
                                    isActive
                                        ? "border-brand bg-brand-50 dark:bg-brand-950"
                                        : "border-secondary bg-secondary hover:border-primary",
                                )}
                            >
                                <span className={cx("text-sm font-semibold", isActive ? "text-brand-secondary" : "text-primary")}>
                                    {r.label}
                                </span>
                                <span className="text-[11px] text-tertiary">{r.sub}</span>
                            </button>
                        );
                    })}
                </div>
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
                disabled={!inputPath.trim() || submitMutation.isPending}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white transition duration-100 hover:bg-brand-solid_hover disabled:opacity-50"
            >
                <RefreshCcw01 className="size-4" aria-hidden />
                {submitMutation.isPending ? "Submitting…" : `Rotate ${rotation}°`}
            </button>
        </section>
    );
}
