import "./blend-react-compat";

// Minimal convenience entrypoint.
// Prefer explicit subpaths such as ./admin or ./config-manager for real usage.
export { AuditTrail } from "./pages/AuditTrail";
export type {
  AuditTrailDateRange,
  AuditTrailFilters,
  AuditTrailProps,
} from "./pages/AuditTrail";
export {
  ConfigDetailPage,
  ConfigDetailPage as ConfigPage,
  ConfigDetailPage as DefaultConfigPage,
} from "./pages/ConfigDetailPage";
export type { ConfigDetailPageProps } from "./pages/ConfigDetailPage";
export {
  DimensionDetailPage,
  DimensionDetailPage as DimensionPage,
} from "./pages/DimensionDetailPage";
export type { DimensionDetailPageProps } from "./pages/DimensionDetailPage";
export { SuperpositionAdmin } from "./pages/SuperpositionAdmin";
export type { SuperpositionAdminProps } from "./pages/SuperpositionAdmin";
export { AlertBar, AlertProvider, useAlerts } from "./providers";
export { SuperpositionUIProvider } from "./providers/SuperpositionUIProvider";
export type { SuperpositionUIProviderProps } from "./providers/SuperpositionUIProvider";
export type {
  ResolvedConfigExplanation,
  ResolvedConfigExplanationTimelineItem,
  SuperpositionEmbeddableConfig,
} from "./types";
