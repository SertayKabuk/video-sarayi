import { PARAM_GROUPS } from "@/lib/param-groups";
import { useAppContext } from "@/state/app-context";
import { usePipelines } from "@/hooks/use-pipelines";
import { ParamFieldCell } from "./param-field";

export function ParamsForm() {
    const { state } = useAppContext();
    const { pipelineMap } = usePipelines();
    const traits = pipelineMap[state.currentPipeline]?.traits;

    const visibleGroups = PARAM_GROUPS.filter((g) => !g.when || !traits || g.when(traits));

    return (
        <div className="flex flex-col gap-0">
            {visibleGroups.map((group) => (
                <fieldset
                    key={group.label}
                    className="my-1.5 rounded-xl border border-secondary px-3.5 pb-3.5 pt-1"
                >
                    <legend className="px-1.5 text-[11px] font-medium uppercase tracking-widest text-tertiary">
                        {group.label}
                    </legend>
                    <div
                        className={`grid gap-2 ${group.grid === "cols-2" ? "grid-cols-2" : "grid-cols-3"}`}
                    >
                        {group.fields.map((field) => (
                            <ParamFieldCell key={field.key} field={field} />
                        ))}
                    </div>
                </fieldset>
            ))}
        </div>
    );
}
