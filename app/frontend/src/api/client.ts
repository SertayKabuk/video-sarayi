export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
    return data as T;
}

export function get<T>(url: string): Promise<T> {
    return request<T>(url);
}

export function post<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
        method: "POST",
        headers: body !== undefined ? { "Content-Type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

export function patch<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export function del<T>(url: string): Promise<T> {
    return request<T>(url, { method: "DELETE" });
}
