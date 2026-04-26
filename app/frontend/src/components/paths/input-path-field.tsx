import { useAppContext } from "@/state/app-context";
import { detectCameraFromPath } from "@/lib/camera-detect";
import { derivePipeline } from "@/lib/derive-pipeline";
import { useInputDialog } from "@/hooks/use-dialog";
import type { CameraId } from "@/types/api";
import { usePipelines } from "@/hooks/use-pipelines";

export function InputPathField() {
    const { state, dispatch } = useAppContext();
    const { pipelineMap } = usePipelines();

    const setPath = (path: string, autodetect = true) => {
        dispatch({ type: "SET_INPUT_PATH", path });
        if (!autodetect) return;
        const detected = detectCameraFromPath(path);
        if (detected && detected !== state.camera) {
            const newCamera = detected as CameraId;
            const newPipeline = derivePipeline(newCamera, state.platform);
            dispatch({ type: "SET_CAMERA", camera: newCamera });
            dispatch({ type: "SET_PIPELINE", pipeline: newPipeline });
            const defaults = pipelineMap[newPipeline]?.defaults as Record<string, unknown> | undefined;
            if (defaults) dispatch({ type: "SET_PARAMS", params: { ...defaults } });
        }
    };

    const dialogMutation = useInputDialog((path) => setPath(path, true));

    return (
        <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                Input file
            </label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={state.inputPath}
                    placeholder="Paste a video path or browse for one…"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setPath(e.target.value, false)}
                    onBlur={(e) => setPath(e.target.value, true)}
                    className="min-w-0 flex-1 rounded-lg border border-secondary bg-secondary px-3 py-2 font-mono text-sm text-primary placeholder:text-placeholder focus:border-brand focus:outline-none"
                />
                <button
                    type="button"
                    disabled={dialogMutation.isPending}
                    onClick={() => dialogMutation.mutate()}
                    className="shrink-0 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-secondary transition duration-100 hover:border-primary hover:text-primary disabled:opacity-50"
                >
                    {dialogMutation.isPending ? "…" : "Browse…"}
                </button>
            </div>
        </div>
    );
}
