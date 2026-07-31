import "./blend-react-compat";

export type { ClientConfig } from "./api/client";
export { AuditTrail } from "./pages/AuditTrail";
export type {
  AuditTrailDateRange,
  AuditTrailFilters,
  AuditTrailProps,
} from "./pages/AuditTrail";
export {
  SuperpositionUIProvider,
  useOptionalSuperposition,
  useSuperposition,
  useSuperpositionTheme,
} from "./providers/SuperpositionUIProvider";
export type { SuperpositionUIProviderProps } from "./providers/SuperpositionUIProvider";
export type { SuperpositionThemeValue } from "./providers/theme-context";
export type {
  AuditAction,
  AuditLog,
  SuperpositionEmbeddableConfig,
  SuperpositionFeatureCapabilities,
  SuperpositionFilterConfig,
  SuperpositionScopeConfig,
  SuperpositionThemeConfig,
  SuperpositionThemeMode,
  SuperpositionThemeTokens,
} from "./types";
