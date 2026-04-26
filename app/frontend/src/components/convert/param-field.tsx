import type { ParamField } from "@/lib/param-groups";
import { useAppContext } from "@/state/app-context";

interface Props {
    field: ParamField;
}

export function ParamFieldCell({ field }: Props) {
    const { state, dispatch } = useAppContext();
    const val = state.params[field.key];

    const onChange = (value: unknown) => {
        dispatch({ type: "PATCH_PARAM", key: field.key, value });

        if (field.key === "v360_enabled") {
            const defaults = state.params;
            if (value) {
                dispatch({ type: "PATCH_PARAM", key: "scale_width", value: defaults.scale_width ?? 0 });
                dispatch({ type: "PATCH_PARAM", key: "scale_height", value: defaults.scale_height ?? 0 });
            } else {
                dispatch({ type: "PATCH_PARAM", key: "scale_width", value: 0 });
                dispatch({ type: "PATCH_PARAM", key: "scale_height", value: 0 });
                const preset = Number(defaults.av1_preset);
                if (!isNaN(preset) && preset < 5) {
                    dispatch({ type: "PATCH_PARAM", key: "av1_preset", value: 5 });
                }
            }
        }
    };

    const inputClass =
        "w-full rounded-lg border border-secondary bg-secondary px-2.5 py-1.5 text-[12px] text-primary focus:border-brand focus:outline-none";

    return (
        <div className={`flex flex-col gap-1${field.wide ? " col-span-full" : ""}`}>
            {field.type === "checkbox" ? (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-primary">
                    <input
                        type="checkbox"
                        checked={!!val}
                        onChange={(e) => onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-secondary accent-brand-600"
                    />
                    {field.label}
                </label>
            ) : (
                <>
                    <label className="text-[11px] text-tertiary">{field.label}</label>
                    {field.type === "select" ? (
                        <select
                            value={String(val ?? "")}
                            onChange={(e) => onChange(e.target.value)}
                            className={inputClass}
                        >
                            {field.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type={field.type === "number" ? "number" : "text"}
                            value={val === null || val === undefined ? "" : String(val)}
                            step={field.step}
                            min={field.min}
                            max={field.max}
                            onChange={(e) => {
                                if (field.type === "number") {
                                    onChange(e.target.value === "" ? null : Number(e.target.value));
                                } else {
                                    onChange(e.target.value);
                                }
                            }}
                            className={inputClass}
                        />
                    )}
                </>
            )}
            {field.hint && (
                <span className="text-[10px] leading-tight text-tertiary">{field.hint}</span>
            )}
        </div>
    );
}
