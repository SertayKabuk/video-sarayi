import { useHealth } from "@/hooks/use-health";
import { CheckCircle, XCircle } from "@untitledui/icons";
import { cx } from "@/utils/cx";

export function HealthPills() {
    const { data } = useHealth();

    if (!data) return null;

    return (
        <div className="flex flex-wrap gap-1.5">
            {data.checks.map((c) => (
                <span
                    key={c.name}
                    title={c.detail || ""}
                    className={cx(
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
                        c.ok
                            ? "bg-utility-green-50 text-utility-green-700 ring-utility-green-200"
                            : "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
                    )}
                >
                    {c.ok
                        ? <CheckCircle className="size-3 shrink-0" aria-hidden />
                        : <XCircle className="size-3 shrink-0" aria-hidden />
                    }
                    {c.name}
                </span>
            ))}
        </div>
    );
}
