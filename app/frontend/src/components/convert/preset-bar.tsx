import { usePresets } from "@/hooks/use-presets";
import { useAppContext } from "@/state/app-context";
import { useState } from "react";

export function PresetBar() {
    const { state, dispatch } = useAppContext();
    const { presets, createMutation, updateMutation, duplicateMutation, deleteMutation } = usePresets();
    const [saving, setSaving] = useState(false);

    const forPipeline = presets.filter((p) => p.pipeline === state.currentPipeline);
    const builtins = forPipeline.filter((p) => p.built_in);
    const userPresets = forPipeline.filter((p) => !p.built_in);
    const isUserPreset = !!state.currentPresetId && !state.currentPresetId.startsWith("builtin:");

    const handlePresetChange = (id: string) => {
        if (!id) return;
        const preset = presets.find((p) => p.id === id);
        if (!preset) return;
        dispatch({ type: "SET_PRESET_ID", id });
        dispatch({ type: "SET_PARAMS", params: { ...preset.params } });
    };

    const handleSaveAs = async () => {
        const name = window.prompt("Preset name:", "My preset");
        if (!name?.trim()) return;
        setSaving(true);
        try {
            const preset = await createMutation.mutateAsync({
                name: name.trim(),
                pipeline: state.currentPipeline,
                params: state.params,
            });
            dispatch({ type: "SET_PRESET_ID", id: preset.id });
        } catch (e: unknown) {
            window.alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!isUserPreset) return;
        try {
            await updateMutation.mutateAsync({ id: state.currentPresetId!, body: { params: state.params } });
        } catch (e: unknown) {
            window.alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handleDuplicate = async () => {
        const src = state.currentPresetId || `builtin:${state.currentPipeline}`;
        const srcPreset = presets.find((p) => p.id === src);
        const name = window.prompt("Name for copy:", srcPreset ? `${srcPreset.name} (copy)` : "Copy");
        if (!name?.trim()) return;
        try {
            const preset = await duplicateMutation.mutateAsync({ id: src, name: name.trim() });
            dispatch({ type: "SET_PRESET_ID", id: preset.id });
            dispatch({ type: "SET_PARAMS", params: { ...preset.params } });
        } catch (e: unknown) {
            window.alert(`Duplicate failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handleDelete = async () => {
        if (!isUserPreset) return;
        const srcPreset = presets.find((p) => p.id === state.currentPresetId);
        if (!window.confirm(`Delete preset "${srcPreset?.name || state.currentPresetId}"?`)) return;
        try {
            await deleteMutation.mutateAsync(state.currentPresetId!);
            dispatch({ type: "SET_PRESET_ID", id: null });
        } catch (e: unknown) {
            window.alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const btnClass =
        "rounded-lg border border-secondary bg-primary px-2.5 py-1.5 text-[12px] text-secondary transition duration-100 hover:border-primary hover:text-primary disabled:opacity-40";

    return (
        <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                    Preset
                </label>
                <select
                    value={state.currentPresetId || ""}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full rounded-lg border border-secondary bg-secondary px-3 py-2 text-sm text-primary focus:border-brand focus:outline-none"
                >
                    {!state.currentPresetId && (
                        <option value="">(modified — unsaved)</option>
                    )}
                    {builtins.length > 0 && (
                        <optgroup label="Research defaults">
                            {builtins.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </optgroup>
                    )}
                    {userPresets.length > 0 && (
                        <optgroup label="Saved">
                            {userPresets.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </optgroup>
                    )}
                </select>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-0.5">
                <button type="button" onClick={handleSaveAs} disabled={saving} className={btnClass}>
                    Save as…
                </button>
                <button type="button" onClick={handleSave} disabled={!isUserPreset || updateMutation.isPending} className={btnClass}>
                    Save
                </button>
                <button type="button" onClick={handleDuplicate} disabled={duplicateMutation.isPending} className={btnClass}>
                    Duplicate
                </button>
                <button type="button" onClick={handleDelete} disabled={!isUserPreset || deleteMutation.isPending} className={btnClass}>
                    Delete
                </button>
            </div>
        </div>
    );
}
