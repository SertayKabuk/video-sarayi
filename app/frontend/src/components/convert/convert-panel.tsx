import { useAppContext } from "@/state/app-context";
import { baseName } from "@/lib/format";
import { ArgvOverride } from "./argv-override";
import { CameraPlatformSelector } from "./camera-platform-selector";
import { ConvertButton } from "./convert-button";
import { ParamsForm } from "./params-form";
import { PresetBar } from "./preset-bar";
import { PresetDescription } from "./preset-description";
import { TestRenderPanel } from "./test-render-panel";

export function ConvertPanel() {
    const { state } = useAppContext();
    const fileName = baseName(state.inputPath);

    return (
        <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-tertiary">
                Convert
            </h2>

            <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-widest text-tertiary">
                    Selected file
                </span>
                <div className={`truncate rounded-lg bg-secondary px-3 py-2 font-mono text-[12px] ${fileName ? "text-primary" : "text-tertiary"}`}>
                    {fileName || "(choose an input file)"}
                </div>
            </div>

            <CameraPlatformSelector />
            <PresetBar />
            <PresetDescription />
            <ParamsForm />
            <ArgvOverride />
            <TestRenderPanel />
            <ConvertButton />
        </section>
    );
}
