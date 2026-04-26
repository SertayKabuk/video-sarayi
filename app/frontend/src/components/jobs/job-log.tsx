import { useEffect, useRef } from "react";

interface Props {
    logs: string[];
    open: boolean;
}

export function JobLog({ logs, open }: Props) {
    const ref = useRef<HTMLPreElement>(null);

    useEffect(() => {
        if (open && ref.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    }, [logs, open]);

    if (!open) return null;

    return (
        <pre
            ref={ref}
            className="max-h-44 overflow-auto rounded-lg border border-secondary bg-[#0c1116] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#b6c0cc] whitespace-pre-wrap"
        >
            {logs.slice(-200).join("\n")}
        </pre>
    );
}
