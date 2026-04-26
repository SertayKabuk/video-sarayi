import { post } from "./client";

export const openInputDialog = () => post<{ path: string | null }>("/api/dialogs/input");

export const openOutputDialog = (suggested_path?: string | null) =>
    post<{ path: string | null }>("/api/dialogs/output", { suggested_path });
