import type { CameraId } from "@/types/api";
import { baseName } from "./format";

export function detectCameraFromPath(path: string): CameraId | null {
    const name = baseName(path);
    if (!name) return null;
    return /^dji/i.test(name) ? "a6" : "x5";
}
