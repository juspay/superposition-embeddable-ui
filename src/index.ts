// Minimal convenience entrypoint.
// Prefer explicit subpaths such as ./admin or ./config-manager for real usage.
export { AuditTrail } from "./pages/AuditTrail";
export type { AuditTrailProps } from "./pages/AuditTrail";
export { SuperpositionAdmin } from "./pages/SuperpositionAdmin";
export type { SuperpositionAdminProps } from "./pages/SuperpositionAdmin";
export { AlertBar, AlertProvider, useAlerts } from "./providers";
export { SuperpositionUIProvider } from "./providers/SuperpositionUIProvider";
export type { SuperpositionUIProviderProps } from "./providers/SuperpositionUIProvider";
export type {
    SuperpositionEmbeddableConfig
} from "./types";
