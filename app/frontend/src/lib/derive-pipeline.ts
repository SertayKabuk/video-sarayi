import type { CameraId, PipelineId, PlatformId } from "@/types/api";

export function derivePipeline(camera: CameraId, platform: PlatformId): PipelineId {
    return `${camera}-${platform}` as PipelineId;
}
