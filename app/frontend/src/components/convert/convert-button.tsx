import { useJobs } from "@/hooks/use-jobs";
import { useAppContext } from "@/state/app-context";

export function ConvertButton() {
    const { state, dispatch } = useAppContext();
    const { submitMutation } = useJobs();

    const handleConvert = async () => {
        dispatch({ type: "SET_CONVERT_ERROR", error: null });

        if (!state.inputPath) {
            dispatch({ type: "SET_CONVERT_ERROR", error: "Choose an input file first." });
            return;
        }

        const body: Parameters<typeof submitMutation.mutateAsync>[0] = {
            input_path: state.inputPath,
            pipeline: state.currentPipeline,
            params: state.params,
        };

        if (state.outputMode === "manual" && state.outputPath) {
            body.output_path = state.outputPath;
        }

        if (state.overrideActive) {
            const tokens = state.argvOverride
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
            if (!tokens.length) {
                dispatch({ type: "SET_CONVERT_ERROR", error: "Raw command is empty." });
                return;
            }
            body.argv_override = tokens;
        }

        try {
            await submitMutation.mutateAsync(body);
        } catch (e: unknown) {
            dispatch({
                type: "SET_CONVERT_ERROR",
                error: e instanceof Error ? e.message : String(e),
            });
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                disabled={!state.inputPath || submitMutation.isPending}
                onClick={handleConvert}
                className="w-full rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition duration-100 hover:bg-brand-solid_hover disabled:cursor-not-allowed disabled:opacity-50"
            >
                {submitMutation.isPending ? "Converting…" : "Convert"}
            </button>

            {state.convertError && (
                <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-[12px] text-error-primary dark:border-error-800 dark:bg-error-950">
                    {state.convertError}
                </div>
            )}
        </div>
    );
}
