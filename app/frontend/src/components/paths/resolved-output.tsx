import { useAppContext } from "@/state/app-context";

export function ResolvedOutput() {
    const { state } = useAppContext();
    const text = state.currentOutputPath || "(preview will show the output path)";

    return (
        <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                Resolved output
            </span>
            <div
                title={text}
                className="break-all rounded-lg bg-secondary px-3 py-2 font-mono text-[12px] text-tertiary"
            >
                {text}
            </div>
        </div>
    );
}
