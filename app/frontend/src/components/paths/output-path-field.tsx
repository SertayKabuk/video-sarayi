import { useOutputDialog } from "@/hooks/use-dialog";
import { useAppContext } from "@/state/app-context";

export function OutputPathField() {
    const { state, dispatch } = useAppContext();

    const dialogMutation = useOutputDialog((path) =>
        dispatch({ type: "SET_OUTPUT_PATH", path, mode: "manual" }),
    );

    const suggestedPath =
        state.outputMode === "manual" ? state.outputPath : (state.currentOutputPath || null);

    return (
        <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                Output file
            </label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={state.outputPath}
                    placeholder="Leave blank to auto-name inside output/"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => {
                        const path = e.target.value.trim();
                        dispatch({ type: "SET_OUTPUT_PATH", path, mode: path ? "manual" : "auto" });
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-secondary bg-secondary px-3 py-2 font-mono text-sm text-primary placeholder:text-placeholder focus:border-brand focus:outline-none"
                />
                <button
                    type="button"
                    disabled={dialogMutation.isPending}
                    onClick={() => dialogMutation.mutate(suggestedPath)}
                    className="shrink-0 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-secondary transition duration-100 hover:border-primary hover:text-primary disabled:opacity-50"
                >
                    {dialogMutation.isPending ? "…" : "Browse…"}
                </button>
            </div>
        </div>
    );
}
