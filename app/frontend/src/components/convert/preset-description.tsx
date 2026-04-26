import { usePresets } from "@/hooks/use-presets";
import { useAppContext } from "@/state/app-context";

export function PresetDescription() {
    const { state } = useAppContext();
    const { presets } = usePresets();

    const preset = presets.find((p) => p.id === state.currentPresetId);
    const desc = preset?.description?.trim();

    if (!desc) return null;

    return (
        <div className="rounded-r-lg border-l-2 border-brand bg-secondary/50 px-3 py-2 text-[12px] leading-relaxed text-secondary">
            {desc}
        </div>
    );
}
