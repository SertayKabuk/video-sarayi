import { fetchPreview } from "@/api/preview";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface PreviewInput {
    inputPath: string | null;
    outputPath: string | null;
    pipeline: string;
    params: Record<string, unknown>;
}

function useDebounced<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

export function usePreview(input: PreviewInput) {
    const debounced = useDebounced(input, 180);

    return useQuery({
        queryKey: ["preview", debounced],
        queryFn: () =>
            fetchPreview({
                input_path: debounced.inputPath || null,
                output_path: debounced.outputPath || null,
                pipeline: debounced.pipeline,
                params: debounced.params,
            }),
        enabled: !!debounced.pipeline,
        staleTime: 0,
    });
}
