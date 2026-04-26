import { useTheme } from "@/providers/theme-provider";
import { Moon01, Sun } from "@untitledui/icons";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded-lg border border-secondary p-2 text-fg-tertiary transition duration-100 ease-linear hover:border-primary hover:text-fg-primary"
        >
            {isDark ? <Sun className="size-4" aria-hidden /> : <Moon01 className="size-4" aria-hidden />}
        </button>
    );
}
