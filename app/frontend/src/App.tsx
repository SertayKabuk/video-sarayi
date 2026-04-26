import { Header } from "@/components/layout/header";
import { PrepTipsPanel } from "@/components/tips/prep-tips-panel";
import { PathsPanel } from "@/components/paths/paths-panel";
import { ConvertPanel } from "@/components/convert/convert-panel";
import { JobsPanel } from "@/components/jobs/jobs-panel";
import { usePreviewSync } from "@/hooks/use-preview-sync";
import { usePipelines } from "@/hooks/use-pipelines";
import { usePresets } from "@/hooks/use-presets";
import { useAppContext } from "@/state/app-context";
import { useEffect } from "react";

function AppContent() {
    const { state, dispatch } = useAppContext();
    const { pipelineMap } = usePipelines();
    const { presets } = usePresets();

    usePreviewSync();

    useEffect(() => {
        if (!pipelineMap[state.currentPipeline]) return;
        if (state.currentPresetId || Object.keys(state.params).length > 0) return;
        const builtin = presets.find((p) => p.built_in && p.pipeline === state.currentPipeline);
        if (builtin) {
            dispatch({ type: "SET_PRESET_ID", id: builtin.id });
            dispatch({ type: "SET_PARAMS", params: { ...builtin.params } });
        } else {
            const defaults = pipelineMap[state.currentPipeline]?.defaults as Record<string, unknown>;
            if (defaults) dispatch({ type: "SET_PARAMS", params: { ...defaults } });
        }
    }, [pipelineMap, presets]);

    return (
        <div className="flex min-h-screen flex-col bg-secondary">
            <Header />
            <main className="grid grid-cols-[300px_1fr] gap-4 p-5">
                <div className="col-span-2">
                    <PrepTipsPanel />
                </div>
                <PathsPanel />
                <ConvertPanel />
                <div className="col-span-2">
                    <JobsPanel />
                </div>
            </main>
        </div>
    );
}

export function App() {
    return <AppContent />;
}
