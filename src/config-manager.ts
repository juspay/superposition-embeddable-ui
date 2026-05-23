import "./blend-react-compat";

export type { ClientConfig } from "./api/client";
export {
  ConfigDetailPage,
  ConfigDetailPage as ConfigPage,
  ConfigDetailPage as DefaultConfigPage,
} from "./pages/ConfigDetailPage";
export type { ConfigDetailPageProps } from "./pages/ConfigDetailPage";
export { ConfigManager } from "./pages/ConfigManager";
export type { ConfigManagerProps } from "./pages/ConfigManager";
export {
  SuperpositionUIProvider,
  useOptionalSuperposition,
  useSuperposition,
  useSuperpositionTheme,
} from "./providers/SuperpositionUIProvider";
export type { SuperpositionThemeValue } from "./providers/theme-context";
export type { SuperpositionUIProviderProps } from "./providers/SuperpositionUIProvider";
export type {
  DefaultConfig,
  JsonValue,
  ResolvedConfigExplanation,
  ResolvedConfigExplanationTimelineItem,
  SuperpositionEmbeddableConfig,
  SuperpositionFeatureCapabilities,
  SuperpositionFilterConfig,
  SuperpositionScopeConfig,
  SuperpositionThemeConfig,
  SuperpositionThemeMode,
  SuperpositionThemeTokens,
} from "./types";
