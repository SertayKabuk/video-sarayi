import { cx } from "@/utils/cx";
import type { ReactNode } from "react";

export type MainTabId = "render" | "join" | "rotate" | "lut";

interface TabSpec {
    id: MainTabId;
    label: string;
}

const TABS: TabSpec[] = [
    { id: "render", label: "Render" },
    { id: "join", label: "Join" },
    { id: "rotate", label: "Rotate" },
    { id: "lut", label: "LUT" },
];

interface MainTabsProps {
    active: MainTabId;
    onChange: (id: MainTabId) => void;
    children: ReactNode;
}

export function MainTabs({ active, onChange, children }: MainTabsProps) {
    return (
        <div className="flex flex-col gap-4">
            <div role="tablist" aria-label="Main sections" className="flex gap-1 rounded-xl border border-secondary bg-primary p-1">
                {TABS.map((t) => {
                    const isActive = t.id === active;
                    return (
                        <button
                            key={t.id}
                            role="tab"
                            type="button"
                            aria-selected={isActive}
                            onClick={() => onChange(t.id)}
                            className={cx(
                                "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition duration-100",
                                isActive
                                    ? "bg-brand-solid text-white"
                                    : "text-tertiary hover:bg-secondary hover:text-primary",
                            )}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>
            {children}
        </div>
    );
}
