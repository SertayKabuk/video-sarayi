import { useState } from "react";
import { ApiError } from "@/api/client";
import { openInputDialog, openOutputDialog } from "@/api/dialogs";
import { createLutJob } from "@/api/jobs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cx } from "@/utils/cx";
import { Palette } from "@untitledui/icons";

type LutChoice = "x5" | "dji" | "custom";
type Interp = "tetrahedral" | "trilinear" | "nearest";

const LUTS: { value: LutChoice; label: string; sub: string }[] = [
    { value: "x5", label: "Insta360 X5", sub: "I-Log → Rec.709" },
    { value: "dji", label: "DJI Osmo Action 6", sub: "D-LogM → Rec.709" },
    { value: "custom", label: "Custom", sub: "Provide a .cube path" },
];

const INTERPS: { value: Interp; label: string }[] = [
    { value: "tetrahedral", label: "Tetrahedral" },
    { value: "trilinear", label: "Trilinear" },
    { value: "nearest", label: "Nearest" },
];

export function LutPanel() {
    const [inputPath, setInputPath] = useState("");
    const [outputPath, setOutputPath] = useState("");
    const [lut, setLut] = useState<LutChoice>("x5");
    const [lutPath, setLutPath] = useState("");
    const [interp, setInterp] = useState<Interp>("tetrahedral");
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
        mutationFn: createLutJob,
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
            setError("Pick a video to color-grade.");
            return;
        }
        if (lut === "custom" && !lutPath.trim()) {
            setError("Provide a path to a .cube LUT file.");
            return;
        }
        submitMutation.mutate({
            input_path: inputPath.trim(),
            output_path: outputPath.trim() || undefined,
            lut,
            lut_path: lut === "custom" ? lutPath.trim() : undefined,
            interp,
        });
    };

    return (
        <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-5">
            <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-tertiary">
                    Apply LUT
                </h2>
                <p className="mt-1 text-[12px] text-tertiary">
                    Apply a 3D LUT (color grade) to a clip and re-encode to 10-bit HEVC. Audio is copied through unchanged.
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
                    LUT
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {LUTS.map((l) => {
                        const isActive = lut === l.value;
                        return (
                            <button
                                key={l.value}
                                type="button"
                                onClick={() => setLut(l.value)}
                                className={cx(
                                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition duration-100",
                                    isActive
                                        ? "border-brand bg-brand-50 dark:bg-brand-950"
                                        : "border-secondary bg-secondary hover:border-primary",
                                )}
                            >
                                <span className={cx("text-sm font-semibold", isActive ? "text-brand-secondary" : "text-primary")}>
                                    {l.label}
                                </span>
                                <span className="text-[11px] text-tertiary">{l.sub}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {lut === "custom" && (
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                        Custom LUT (.cube)
                    </label>
                    <input
                        type="text"
                        value={lutPath}
                        placeholder="/absolute/path/to/your-lut.cube"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setLutPath(e.target.value)}
                        className="rounded-lg border border-secondary bg-secondary px-3 py-2 font-mono text-sm text-primary placeholder:text-placeholder focus:border-brand focus:outline-none"
                    />
                </div>
            )}

            <div className="flex flex-col gap-2">
                <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                    Interpolation
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {INTERPS.map((i) => {
                        const isActive = interp === i.value;
                        return (
                            <button
                                key={i.value}
                                type="button"
                                onClick={() => setInterp(i.value)}
                                className={cx(
                                    "rounded-lg border px-3 py-2 text-sm transition duration-100",
                                    isActive
                                        ? "border-brand bg-brand-50 text-brand-secondary dark:bg-brand-950"
                                        : "border-secondary bg-secondary text-primary hover:border-primary",
                                )}
                            >
                                {i.label}
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
                <Palette className="size-4" aria-hidden />
                {submitMutation.isPending ? "Submitting…" : "Apply LUT"}
            </button>
        </section>
    );
}
