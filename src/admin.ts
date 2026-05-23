import "./blend-react-compat";

export type { ClientConfig } from "./api/client";
export { AuditTrail } from "./pages/AuditTrail";
export type { AuditTrailProps } from "./pages/AuditTrail";
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
export {
  SuperpositionUIProvider,
  useOptionalSuperposition,
  useSuperposition,
  useSuperpositionTheme,
} from "./providers/SuperpositionUIProvider";
export type { SuperpositionUIProviderProps } from "./providers/SuperpositionUIProvider";
export type { SuperpositionThemeValue } from "./providers/theme-context";
export { SUPERPOSITION_FEATURE_LABELS, SUPERPOSITION_FEATURES } from "./types";
export type {
  AuditAction,
  AuditLog,
  AuthMode,
  Condition,
  Config,
  ContextOverride,
  DefaultConfig,
  Dimension,
  JsonValue,
  Overrides,
  PaginatedResponse,
  PaginationParams,
  ResolvedConfigExplanation,
  ResolvedConfigExplanationTimelineItem,
  RouteMode,
  SuperpositionAuthConfig,
  SuperpositionCapabilitiesConfig,
  SuperpositionEmbeddableConfig,
  SuperpositionFeature,
  SuperpositionFeatureCapabilities,
  SuperpositionFilterConfig,
  SuperpositionLayoutConfig,
  SuperpositionNetworkHooks,
  SuperpositionRequestContext,
  SuperpositionResponseContext,
  SuperpositionRoutingConfig,
  SuperpositionScopeConfig,
  SuperpositionThemeConfig,
  SuperpositionThemeMode,
  SuperpositionThemeTokens,
  SuperpositionUiAdapters,
} from "./types";
