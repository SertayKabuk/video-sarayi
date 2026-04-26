export function fmtSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function fmtDuration(sec: number): string {
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h
        ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
        : `${m}:${String(r).padStart(2, "0")}`;
}

export function baseName(path: string): string {
    return String(path || "")
        .split(/[/\\]/)
        .filter(Boolean)
        .pop() ?? "";
}
