import { usePreview } from "./use-preview";
import { useAppContext } from "@/state/app-context";
import { useEffect } from "react";

export function usePreviewSync() {
    const { state, dispatch } = useAppContext();

    const { data, error } = usePreview({
        inputPath: state.inputPath || null,
        outputPath: state.outputMode === "manual" ? state.outputPath || null : null,
        pipeline: state.currentPipeline,
        params: state.params,
    });

    useEffect(() => {
        if (data) {
            dispatch({
                type: "SET_PREVIEW",
                argv: data.argv,
                outputPath: data.output_path,
                outputUrl: data.output_url,
            });
            if (state.overrideActive) {
                dispatch({ type: "SET_ARGV_OVERRIDE", value: data.argv.join("\n") });
            }
        }
    }, [data]);

    useEffect(() => {
        if (error) {
            dispatch({ type: "SET_PATH_ERROR", error: error.message });
        }
    }, [error]);
}
