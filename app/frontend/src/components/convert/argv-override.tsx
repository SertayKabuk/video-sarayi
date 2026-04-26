import { useAppContext } from "@/state/app-context";
import { ArgvPreview } from "./argv-preview";

export function ArgvOverride() {
    const { state, dispatch } = useAppContext();

    return (
        <fieldset className="rounded-xl border border-secondary px-3.5 pb-3.5 pt-1">
            <legend className="px-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-primary">
                    <input
                        type="checkbox"
                        checked={state.overrideActive}
                        onChange={(e) => {
                            dispatch({ type: "SET_OVERRIDE_ACTIVE", active: e.target.checked });
                            if (e.target.checked) {
                                dispatch({ type: "SET_ARGV_OVERRIDE", value: state.currentArgv.join("\n") });
                            }
                        }}
                        className="h-4 w-4 accent-brand-600"
                    />
                    Edit ffmpeg command directly
                </label>
            </legend>

            {state.overrideActive ? (
                <textarea
                    rows={14}
                    value={state.argvOverride}
                    placeholder="One argv token per line…"
                    onChange={(e) => dispatch({ type: "SET_ARGV_OVERRIDE", value: e.target.value })}
                    className="mt-2 w-full resize-y rounded-lg border border-secondary bg-[#0c1116] px-3 py-2 font-mono text-[12px] text-[#c5cfda] focus:border-brand focus:outline-none"
                />
            ) : (
                <ArgvPreview />
            )}
        </fieldset>
    );
}
