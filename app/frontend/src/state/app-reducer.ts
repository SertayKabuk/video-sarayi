import type { CameraId, OutputMode, PipelineId, PlatformId } from "@/types/api";

export interface AppState {
    camera: CameraId;
    platform: PlatformId;
    currentPipeline: PipelineId;
    params: Record<string, unknown>;
    currentPresetId: string | null;
    inputPath: string;
    outputPath: string;
    outputMode: OutputMode;
    overrideActive: boolean;
    argvOverride: string;
    currentArgv: string[];
    currentOutputPath: string;
    currentOutputUrl: string | null;
    pathError: string | null;
    convertError: string | null;
}

export const initialState: AppState = {
    camera: "x5",
    platform: "reel",
    currentPipeline: "x5-reel",
    params: {},
    currentPresetId: null,
    inputPath: "",
    outputPath: "",
    outputMode: "auto",
    overrideActive: false,
    argvOverride: "",
    currentArgv: [],
    currentOutputPath: "",
    currentOutputUrl: null,
    pathError: null,
    convertError: null,
};

export type AppAction =
    | { type: "SET_CAMERA"; camera: CameraId }
    | { type: "SET_PLATFORM"; platform: PlatformId }
    | { type: "SET_PIPELINE"; pipeline: PipelineId }
    | { type: "SET_PARAMS"; params: Record<string, unknown> }
    | { type: "PATCH_PARAM"; key: string; value: unknown }
    | { type: "SET_PRESET_ID"; id: string | null }
    | { type: "SET_INPUT_PATH"; path: string }
    | { type: "SET_OUTPUT_PATH"; path: string; mode: OutputMode }
    | { type: "SET_OVERRIDE_ACTIVE"; active: boolean }
    | { type: "SET_ARGV_OVERRIDE"; value: string }
    | { type: "SET_PREVIEW"; argv: string[]; outputPath: string; outputUrl: string | null }
    | { type: "SET_PATH_ERROR"; error: string | null }
    | { type: "SET_CONVERT_ERROR"; error: string | null };

export function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case "SET_CAMERA":
            return { ...state, camera: action.camera };
        case "SET_PLATFORM":
            return { ...state, platform: action.platform };
        case "SET_PIPELINE":
            return { ...state, currentPipeline: action.pipeline };
        case "SET_PARAMS":
            return { ...state, params: action.params };
        case "PATCH_PARAM":
            return { ...state, params: { ...state.params, [action.key]: action.value }, currentPresetId: null };
        case "SET_PRESET_ID":
            return { ...state, currentPresetId: action.id };
        case "SET_INPUT_PATH":
            return { ...state, inputPath: action.path, pathError: null };
        case "SET_OUTPUT_PATH":
            return { ...state, outputPath: action.path, outputMode: action.mode, pathError: null };
        case "SET_OVERRIDE_ACTIVE":
            return { ...state, overrideActive: action.active };
        case "SET_ARGV_OVERRIDE":
            return { ...state, argvOverride: action.value };
        case "SET_PREVIEW":
            return {
                ...state,
                currentArgv: action.argv,
                currentOutputPath: action.outputPath,
                currentOutputUrl: action.outputUrl,
                pathError: null,
            };
        case "SET_PATH_ERROR":
            return { ...state, pathError: action.error };
        case "SET_CONVERT_ERROR":
            return { ...state, convertError: action.error };
        default:
            return state;
    }
}
