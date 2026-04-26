import { useAppContext } from "@/state/app-context";
import { InputPathField } from "./input-path-field";
import { OutputPathField } from "./output-path-field";
import { ResolvedOutput } from "./resolved-output";

export function PathsPanel() {
    const { state } = useAppContext();

    return (
        <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-4">
            <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-tertiary">
                    Paths
                </h2>
            </div>

            <InputPathField />
            <OutputPathField />
            <ResolvedOutput />

            <p className="text-[12px] text-tertiary">
                You can paste paths manually or use Browse for native file dialogs.
            </p>

            {state.pathError && (
                <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-[12px] text-error-primary dark:border-error-800 dark:bg-error-950">
                    {state.pathError}
                </div>
            )}
        </section>
    );
}
