import { useAppContext } from "@/state/app-context";

export function ArgvPreview() {
    const { state } = useAppContext();
    if (state.overrideActive) return null;

    return (
        <pre className="max-h-60 overflow-auto rounded-lg border border-secondary bg-[#0c1116] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[#c5cfda] break-all whitespace-pre-wrap">
            {state.currentArgv.map((token, i) => {
                if (i === 0) return <span key={i} className="text-success-400">{token}{"\n"}</span>;
                if (token.startsWith("-")) return <span key={i} className="text-brand-400">{token}{"\n"}</span>;
                return <span key={i} className="text-[#c5cfda]">{token}{"\n"}</span>;
            })}
        </pre>
    );
}
