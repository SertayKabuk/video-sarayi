import type { PipelineTraits } from "@/types/api";

export type FieldType = "checkbox" | "select" | "number" | "text";

export interface ParamField {
    key: string;
    label: string;
    type: FieldType;
    options?: string[];
    step?: number;
    min?: number;
    max?: number;
    hint?: string;
    wide?: boolean;
}

export interface ParamGroup {
    label: string;
    when?: (traits: PipelineTraits) => boolean;
    grid?: "cols-2" | "cols-3";
    fields: ParamField[];
}

export const PARAM_GROUPS: ParamGroup[] = [
    {
        label: "Reframe (Insta360 X5 360→flat)",
        when: (t) => t.uses_v360,
        grid: "cols-3",
        fields: [
            {
                key: "v360_enabled",
                label: "Reframe 360→flat",
                type: "checkbox",
                wide: true,
                hint: "Off = keep equirectangular 360 output (skips v360 filter). Yaw/Pitch/Roll/FOV below are ignored when off.",
            },
            { key: "yaw", label: "Yaw", type: "number", step: 1, hint: "0–360, pan around sphere" },
            { key: "pitch", label: "Pitch", type: "number", step: 1, hint: "-90 (down) to 90 (up)" },
            { key: "roll", label: "Roll", type: "number", step: 1, hint: "Horizon leveling" },
            { key: "h_fov", label: "H FOV °", type: "number", step: 1, min: 1, max: 360 },
            { key: "v_fov", label: "V FOV °", type: "number", step: 1, min: 1, max: 180 },
            {
                key: "v360_interp",
                label: "Interp",
                type: "select",
                options: ["lanczos", "bilinear", "nearest", "spline16"],
            },
        ],
    },
    {
        label: "Crop (DJI Action 6)",
        when: (t) => t.lut === "dji",
        grid: "cols-2",
        fields: [
            {
                key: "crop_enabled",
                label: "Enable crop",
                type: "checkbox",
                hint: "Reel: always on (9:16). YouTube: enable only for square-sensor footage.",
            },
            {
                key: "crop_expr",
                label: "Crop expression",
                type: "text",
                hint: "9:16 vertical: ih*(9/16):ih   16:9 from square: iw:iw*(9/16)",
            },
        ],
    },
    {
        label: "Stabilization (Gyroflow)",
        when: (t) => t.lut === "dji",
        grid: "cols-2",
        fields: [
            {
                key: "gyroflow_enabled",
                label: "Enable Gyroflow stabilization",
                type: "checkbox",
                hint: "Requires Gyroflow installed. Runs as a pre-processing step before encoding.",
            },
            {
                key: "gyroflow_smoothness",
                label: "Smoothness",
                type: "number",
                step: 0.05,
                min: 0,
                max: 1,
                hint: "0 = no smoothing, 1 = maximum. Default 0.5.",
            },
        ],
    },
    {
        label: "Framerate",
        grid: "cols-2",
        fields: [
            {
                key: "fps_enabled",
                label: "Force output framerate",
                type: "checkbox",
                hint: "Resample (drop/duplicate frames) to hit target. Audio stays in sync.",
            },
            {
                key: "fps_value",
                label: "Target fps",
                type: "number",
                step: 1,
                min: 1,
                max: 240,
                hint: "Instagram/TikTok: 30 recommended — preserves per-frame bitrate.",
            },
        ],
    },
    {
        label: "LUT",
        grid: "cols-2",
        fields: [
            {
                key: "lut_enabled",
                label: "Apply LUT",
                type: "checkbox",
                hint: "Off = skip lut3d filter (use when footage is already Rec.709 or you want raw log).",
            },
            {
                key: "lut_interp",
                label: "Interpolation",
                type: "select",
                options: ["tetrahedral", "trilinear", "nearest"],
            },
        ],
    },
    {
        label: "Scale",
        grid: "cols-3",
        fields: [
            { key: "scale_width", label: "Width", type: "number", step: 2, hint: "0 = skip scale" },
            { key: "scale_height", label: "Height", type: "number", step: 2, hint: "0 = skip scale" },
            {
                key: "scale_flags",
                label: "Flags",
                type: "select",
                options: ["lanczos", "bilinear", "bicubic", "neighbor", "spline"],
            },
        ],
    },
    {
        label: "Pixel format",
        grid: "cols-2",
        fields: [
            {
                key: "pix_fmt",
                label: "pix_fmt",
                type: "select",
                options: ["yuv420p10le", "yuv420p", "yuv444p10le"],
            },
        ],
    },
    {
        label: "x265 encoder",
        when: (t) => t.encoder === "x265",
        grid: "cols-3",
        fields: [
            {
                key: "x265_preset",
                label: "Preset",
                type: "select",
                options: ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow", "placebo"],
            },
            { key: "x265_profile", label: "Profile", type: "select", options: ["main", "main10", "main12"] },
            { key: "x265_crf", label: "CRF", type: "number", step: 1, min: 0, max: 51 },
            { key: "x265_vbv_maxrate", label: "VBV maxrate kbps", type: "number", step: 500 },
            { key: "x265_vbv_bufsize", label: "VBV bufsize kbps", type: "number", step: 500 },
            { key: "x265_aq_mode", label: "AQ mode", type: "select", options: ["0", "1", "2", "3", "4"] },
            { key: "x265_aq_strength", label: "AQ strength", type: "number", step: 0.1, min: 0, max: 3 },
            { key: "x265_psy_rd", label: "psy-rd", type: "number", step: 0.1, min: 0, max: 4 },
            { key: "x265_psy_rdoq", label: "psy-rdoq", type: "number", step: 0.1, min: 0, max: 50 },
            {
                key: "x265_extra",
                label: "Extra x265-params",
                type: "text",
                hint: "colon-separated, appended verbatim",
                wide: true,
            },
        ],
    },
    {
        label: "SVT-AV1 encoder",
        when: (t) => t.encoder === "av1",
        grid: "cols-3",
        fields: [
            { key: "av1_preset", label: "Preset (0=slow…13=fast)", type: "number", step: 1, min: 0, max: 13 },
            { key: "av1_crf", label: "CRF", type: "number", step: 1, min: 1, max: 63 },
            { key: "av1_tune", label: "Tune (0=VQ, 1=PSNR)", type: "select", options: ["0", "1"] },
            {
                key: "av1_extra",
                label: "Extra svtav1-params",
                type: "text",
                hint: "colon-separated, appended verbatim",
                wide: true,
            },
        ],
    },
    {
        label: "Audio",
        grid: "cols-3",
        fields: [
            {
                key: "audio_codec",
                label: "Codec",
                type: "select",
                options: ["aac", "libopus", "libfdk_aac", "mp3", "copy"],
            },
            { key: "audio_bitrate", label: "Bitrate", type: "text", hint: "e.g. 256k, 384k, 192k" },
            { key: "audio_rate", label: "Rate Hz", type: "number", step: 8000 },
        ],
    },
    {
        label: "Color metadata",
        grid: "cols-3",
        fields: [
            {
                key: "color_primaries",
                label: "Primaries",
                type: "select",
                options: ["bt709", "bt2020", "smpte170m", "bt470bg"],
            },
            {
                key: "color_trc",
                label: "Transfer",
                type: "select",
                options: ["bt709", "smpte2084", "arib-std-b67", "smpte170m", "bt2020-10", "linear"],
            },
            {
                key: "colorspace",
                label: "Color space",
                type: "select",
                options: ["bt709", "bt2020nc", "bt2020c", "smpte170m"],
            },
        ],
    },
    {
        label: "Container",
        grid: "cols-2",
        fields: [{ key: "faststart", label: "movflags +faststart", type: "checkbox" }],
    },
];
