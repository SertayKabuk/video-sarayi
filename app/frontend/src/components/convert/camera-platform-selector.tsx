import { derivePipeline } from "@/lib/derive-pipeline";
import { useAppContext } from "@/state/app-context";
import type { CameraId, PlatformId } from "@/types/api";
import { usePipelines } from "@/hooks/use-pipelines";
import { usePresets } from "@/hooks/use-presets";

export function CameraPlatformSelector() {
    const { state, dispatch } = useAppContext();
    const { pipelineMap } = usePipelines();
    const { presets } = usePresets();

    const handleChange = (camera: CameraId, platform: PlatformId) => {
        const newPipeline = derivePipeline(camera, platform);
        dispatch({ type: "SET_CAMERA", camera });
        dispatch({ type: "SET_PLATFORM", platform });
        dispatch({ type: "SET_PIPELINE", pipeline: newPipeline });

        const builtin = presets.find((p) => p.built_in && p.pipeline === newPipeline);
        if (builtin) {
            dispatch({ type: "SET_PRESET_ID", id: builtin.id });
            dispatch({ type: "SET_PARAMS", params: { ...builtin.params } });
        } else {
            const defaults = pipelineMap[newPipeline]?.defaults as Record<string, unknown> | undefined;
            if (defaults) dispatch({ type: "SET_PARAMS", params: { ...defaults } });
            dispatch({ type: "SET_PRESET_ID", id: null });
        }
    };

    const selectClass =
        "rounded-lg border border-secondary bg-secondary px-3 py-2 text-sm text-primary focus:border-brand focus:outline-none w-full";

    return (
        <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                    Camera
                </label>
                <select
                    value={state.camera}
                    onChange={(e) => handleChange(e.target.value as CameraId, state.platform)}
                    className={selectClass}
                >
                    <option value="x5">Insta360 X5</option>
                    <option value="a6">DJI Osmo Action 6</option>
                </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                    Target platform
                </label>
                <select
                    value={state.platform}
                    onChange={(e) => handleChange(state.camera, e.target.value as PlatformId)}
                    className={selectClass}
                >
                    <option value="reel">Instagram Reel</option>
                    <option value="yt">YouTube 4K</option>
                </select>
            </div>
        </div>
    );
}
