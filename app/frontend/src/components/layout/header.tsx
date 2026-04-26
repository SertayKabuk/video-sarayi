import { HealthPills } from "./health-pills";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
    return (
        <header className="flex items-center justify-between border-b border-secondary bg-primary px-5 py-3.5">
            <h1 className="text-sm font-semibold tracking-wide text-primary">Video Sarayi</h1>
            <div className="flex items-center gap-3">
                <HealthPills />
                <ThemeToggle />
            </div>
        </header>
    );
}
