import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AppProvider } from "@/state/app-context";
import { App } from "@/App";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="video-sarayi:theme">
            <QueryProvider>
                <AppProvider>
                    <App />
                </AppProvider>
            </QueryProvider>
        </ThemeProvider>
    </StrictMode>,
);
