import type {
  ComponentTokenType as BlendComponentTokenType,
  ThemeType as BlendThemeType,
} from "@juspay/blend-design-system";
import type React from "react";
import type { JsonValue } from "./api";
export * from "./api";

export const SUPERPOSITION_FEATURES = [
  "config",
  "overrides",
  "dimensions",
  "audit",
  "experiments",
] as const;

export type SuperpositionFeature = (typeof SUPERPOSITION_FEATURES)[number];

export const SUPERPOSITION_FEATURE_LABELS: Record<SuperpositionFeature, string> = {
  config: "Configs",
  overrides: "Overrides",
  dimensions: "Dimensions",
  audit: "Audit Trail",
  experiments: "Experiments",
};

export type RouteMode = "internal" | "external";
type InternalTransportMode = "same-origin" | "cross-origin" | "host-proxy";
export type AuthMode = "cookie" | "bearer" | "custom";
export type SuperpositionThemeMode = "light" | "dark" | "system";
export type SuperpositionSearchAlign = "left" | "center" | "right";

export interface SuperpositionStyleConfig {
  padding?: string;
  margin?: string;
  width?: string;
  height?: string;
  opacity?: string;
  textColor?: string;
  bgColor?: string;
  borderColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  shadow?: string;
  textTransform?: string;
}

export interface SuperpositionThemeColors {
  bg?: string;
  panel?: string;
  surfaceMuted?: string;
  text?: string;
  muted?: string;
  border?: string;
  primary?: string;
  success?: string;
  warning?: string;
  danger?: string;
}

export interface SuperpositionScaleConfig {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
}

export interface SuperpositionShadowConfig {
  sm?: string;
  md?: string;
}

export interface SuperpositionTypographyConfig {
  fontFamily?: string;
  fontSize?: string;
}

export interface SuperpositionButtonThemeConfig extends SuperpositionStyleConfig {
  primary?: SuperpositionStyleConfig;
  secondary?: SuperpositionStyleConfig;
  danger?: SuperpositionStyleConfig;
  disabledOpacity?: string;
}

export interface SuperpositionTableThemeConfig extends SuperpositionStyleConfig {
  header?: SuperpositionStyleConfig;
}

export interface SuperpositionFormThemeConfig extends SuperpositionStyleConfig {
  label?: SuperpositionStyleConfig;
  removeButton?: SuperpositionStyleConfig;
  helperTextColor?: string;
}

export interface SuperpositionExperimentMetricsThemeConfig extends SuperpositionStyleConfig {
  labelColumnWidth?: string;
  controlMaxWidth?: string;
  helperTextColor?: string;
  gap?: string;
}

/** Host styling for the experiment comparison surface and mobile viewport. */
export interface SuperpositionExperimentComparisonThemeConfig extends SuperpositionStyleConfig {
  deviceBorderRadius?: string;
  deviceShadow?: string;
}

export interface SuperpositionDropdownThemeConfig extends SuperpositionStyleConfig {
  control?: SuperpositionStyleConfig;
  menu?: SuperpositionStyleConfig;
  option?: {
    hoverBgColor?: string;
    selectedBgColor?: string;
    selectedTextColor?: string;
  };
}

export interface SuperpositionIconThemeConfig {
  size?: string;
  color?: string;
  lock?: {
    size?: string;
    color?: string;
  };
}

export interface SuperpositionSearchThemeConfig extends SuperpositionStyleConfig {
  align?: SuperpositionSearchAlign;
  placeholderColor?: string;
  placeholderOpacity?: string;
  hoverBgColor?: string;
  hoverTextColor?: string;
  hoverBorderColor?: string;
  hoverIconColor?: string;
  hoverShadow?: string;
  focusBgColor?: string;
  focusTextColor?: string;
  focusBorderColor?: string;
  focusIconColor?: string;
  focusShadow?: string;
  focusOutline?: string;
  focusOutlineOffset?: string;
  icon?: SuperpositionIconThemeConfig;
}

export type SuperpositionDeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends object ? SuperpositionDeepPartial<T[Key]> : T[Key];
};

export interface SuperpositionBlendThemeConfig {
  foundationTokens?: SuperpositionDeepPartial<BlendThemeType>;
  componentTokens?: SuperpositionDeepPartial<BlendComponentTokenType>;
}

export interface SuperpositionTableSerialNumberConfig {
  enabled?: boolean;
  header?: string;
  width?: string;
  startAt?: number;
  align?: "left" | "center" | "right";
}

export interface SuperpositionTablePageConfig {
  searchAlign?: SuperpositionSearchAlign;
}

export interface SuperpositionTableConfig {
  serialNumber?: boolean | SuperpositionTableSerialNumberConfig;
  searchAlign?: SuperpositionSearchAlign;
  defaultConfig?: SuperpositionTablePageConfig;
  overrides?: SuperpositionTablePageConfig;
  dimensions?: SuperpositionTablePageConfig;
  audit?: SuperpositionTablePageConfig;
}

export interface SuperpositionToastThemeConfig extends SuperpositionStyleConfig {
  success?: SuperpositionStyleConfig;
  error?: SuperpositionStyleConfig;
  warning?: SuperpositionStyleConfig;
  info?: SuperpositionStyleConfig;
}

export interface SuperpositionBannerThemeConfig extends SuperpositionStyleConfig {
  warning?: SuperpositionStyleConfig;
  info?: SuperpositionStyleConfig;
  error?: SuperpositionStyleConfig;
  success?: SuperpositionStyleConfig;
}

export interface SuperpositionRequestContext {
  url: string;
  init: RequestInit;
}

export interface SuperpositionResponseContext {
  request: SuperpositionRequestContext;
  response: Response;
}

export interface SuperpositionAuthConfig {
  mode: AuthMode;
  token?: string;
  headers?: Record<string, string>;
}

interface InternalTransportConfig {
  mode: InternalTransportMode;
  baseUrl: string;
  apiBasePath?: string;
  credentials?: RequestCredentials;
  workspaceHeaderName?: "x-workspace" | "x-tenant";
}

export interface SuperpositionRoutingConfig {
  mode: RouteMode;
  initialFeature?: SuperpositionFeature;
  currentFeature?: SuperpositionFeature;
  onNavigate?: (feature: SuperpositionFeature) => void;
  getFeatureHref?: (feature: SuperpositionFeature) => string;
}

export interface SuperpositionThemeTokens {
  colors?: SuperpositionThemeColors;
  radius?: SuperpositionScaleConfig;
  spacing?: SuperpositionScaleConfig;
  shadow?: SuperpositionShadowConfig;
  typography?: SuperpositionTypographyConfig;
  button?: SuperpositionButtonThemeConfig;
  card?: SuperpositionStyleConfig;
  table?: SuperpositionTableThemeConfig;
  form?: SuperpositionFormThemeConfig;
  dropdown?: SuperpositionDropdownThemeConfig;
  icon?: SuperpositionIconThemeConfig;
  search?: SuperpositionSearchThemeConfig;
  toast?: SuperpositionToastThemeConfig;
  banner?: SuperpositionBannerThemeConfig;
  pageTitle?: SuperpositionStyleConfig;
  jsonValue?: SuperpositionStyleConfig;
  tooltip?: SuperpositionStyleConfig;
  blend?: SuperpositionBlendThemeConfig;
  experimentMetrics?: SuperpositionExperimentMetricsThemeConfig;
  experimentComparison?: SuperpositionExperimentComparisonThemeConfig;
}

export interface SuperpositionThemeConfig extends SuperpositionThemeTokens {
  mode?: SuperpositionThemeMode;
}

export interface SuperpositionScopeConfig {
  context?: Record<string, JsonValue>;
  locked?: boolean;
}

export interface SuperpositionFilterConfig {
  defaultConfigPrefix?: string | string[];
  dimensions?: string[];
}

export interface ConfirmInput {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

export interface SuperpositionFeatureUiControlConfig {
  editable?: boolean;
  /** Enable row-click navigation to single-item detail pages. Defaults to true. */
  detailPage?: boolean;
}

export type SuperpositionFeatureUiControls = Partial<
  Record<SuperpositionFeature, SuperpositionFeatureUiControlConfig>
>;

export interface SuperpositionUiAdapters {
  notify?: (input: {
    tone: "info" | "success" | "warning" | "error";
    title: string;
    description?: string;
  }) => void;
  confirm?: (input: ConfirmInput) => Promise<boolean>;
  renderModal?: (input: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => React.ReactNode;
  portalContainer?: Element | string | (() => Element | null);
  modalZIndex?: number;
  alertZIndex?: number;
  showBoundaryFilter?: boolean;
  featureControls?: SuperpositionFeatureUiControls;
}

export interface SuperpositionFeatureCapabilities {
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  execute?: boolean;
  ramp?: boolean;
}

export type SuperpositionCapabilitiesConfig = Partial<
  Record<SuperpositionFeature, SuperpositionFeatureCapabilities>
>;

export interface SuperpositionLayoutConfig {
  adminContentMinHeight?: string;
  modalWidth?: string;
  modalMinWidth?: string;
  modalMaxWidth?: string;
  modalMaxHeight?: string;
  overrideEditorModalWidth?: string;
  overrideEditorModalMaxWidth?: string;
  overrideEditorModalMaxHeight?: string;
  overrideDetailsModalWidth?: string;
  overrideDetailsModalMaxWidth?: string;
  overrideDetailsModalMaxHeight?: string;
  overrideListGap?: string;
  overrideCardPadding?: string;
  confirmWidth?: string;
  alertMinWidth?: string;
  tableMinWidth?: string;
  tableEmptyMinHeight?: string;
  compactControlPadding?: string;
  experimentWizardMaxWidth?: string;
}

export interface SuperpositionExperimentVariantField {
  key: string;
  label: string;
  type: "color" | "choice" | "text";
  controlValue: string;
  options?: Array<{ label: string; value: string }>;
}

export type SuperpositionExperimentTemplateKey =
  | string
  | (Pick<SuperpositionExperimentVariantField, "key"> &
      Partial<Pick<SuperpositionExperimentVariantField, "label" | "type" | "options">>);

export interface SuperpositionExperimentTemplate {
  id: string;
  label: string;
  description?: string;
  keys: SuperpositionExperimentTemplateKey[];
  iconUrl?: string;
  statusLabel?: string;
  impactLabel?: string;
  impactTone?: "info" | "success" | "warning";
  disabled?: boolean;
}

/**
 * Directional result for a single metric in an experiment.
 * All values are supplied by the host's analytics service; the embed only renders them.
 */
export interface ExperimentMetricResult {
  /** Metric identifier matching the experiment's configured metric name. */
  name: string;
  /** Display label. Falls back to the configured metric name when omitted. */
  label?: string;
  control: number;
  variant: number;
  /** Pre-formatted display values. When omitted the embed formats the raw numbers. */
  controlDisplay?: string;
  variantDisplay?: string;
  /** Relative change as a ratio (0.12 = +12%). Used when `changeDisplay` is omitted. */
  relativeChange?: number;
  /** Pre-formatted change label (e.g. "+12.4%"). */
  changeDisplay?: string;
  /**
   * Whether the change is favourable, accounting for metric directionality.
   * `true` = favourable (green), `false` = unfavourable (red), `null`/`undefined` = neutral.
   * The host computes this; the embed never infers favourability from the sign of the change.
   */
  favorable?: boolean | null;
  /** Sample sizes, if the host tracks them. */
  controlSampleSize?: number;
  variantSampleSize?: number;
}

export type ExperimentResultsStatus = "collecting" | "available" | "no_data" | "error";

/**
 * The host-supplied analytics payload for one experiment. The embed renders this
 * verbatim and never derives winners or significance on its own.
 */
export interface ExperimentResults {
  status: ExperimentResultsStatus;
  /**
   * Outcome banner. `tone` drives the colour; `title`/`description` are host-authored.
   * The embed never fabricates a winner — omit `banner` to show no banner.
   */
  banner?: {
    tone: "success" | "warning" | "danger" | "info" | "neutral";
    title: string;
    description?: string;
  } | null;
  /** The primary metric highlighted as Control vs Variant cards. */
  primaryMetric?: ExperimentMetricResult | null;
  /** Full comparison table rows (primary + secondary + guardrail). */
  metrics?: ExperimentMetricResult[];
  /** Optional free-text note shown beneath the table (e.g. data freshness). */
  note?: string;
}

export interface ExperimentResultsRequest {
  experiment: import("./api").Experiment;
  /** Headers the host should forward (auth, tenant, shop id, …). */
  headers: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Host hook that resolves the analytics payload for an experiment.
 * Either return the data directly, or point the embed at a URL it can fetch.
 */
export type ExperimentResultsSource =
  | ((request: ExperimentResultsRequest) => Promise<ExperimentResults | null>)
  | {
      /** URL template; `{experimentId}` is replaced with the experiment id. */
      url: string;
      /** Map an arbitrary host response body to the results contract. */
      transform?: (
        body: unknown,
        experiment: import("./api").Experiment,
      ) => ExperimentResults | null;
    };

export interface SuperpositionExperimentManagerConfig {
  variantFields?: SuperpositionExperimentVariantField[];
  experimentTemplates?: SuperpositionExperimentTemplate[];
  comparisonUrls?: string[];
  comparisonBaseConfig?: Record<string, JsonValue>;
  contextMode?: "editable" | "host-managed";
  /** Show the metrics form independently of workspace enablement. Defaults to true.
   * When false, skip the metrics step and explicitly disable experiment metrics.
   */
  showMetricsForm?: boolean;
  disablePrimaryMetricSelection?: boolean;
  disableSecondaryMetric?: boolean;
  /** Hide guardrail selection and use the first workspace metric. Defaults to false. */
  disableGuardrailMetric?: boolean;
  /**
   * Supplies the Results tab. When omitted the Results tab shows a
   * "no analytics configured" empty state instead of fabricated data.
   */
  resultsSource?: ExperimentResultsSource;
  /** Optional host-owned detail route; `{experimentId}` is replaced on row selection. */
  detailUrlTemplate?: string;
}

export interface SuperpositionAssetsConfig {
  emptyStateImageUrl?: string;
}

export interface SuperpositionNetworkHooks {
  interceptRequest?: (
    context: SuperpositionRequestContext,
  ) => Promise<SuperpositionRequestContext> | SuperpositionRequestContext;
  interceptResponse?: (
    context: SuperpositionResponseContext,
  ) => Promise<Response> | Response;
  onUnauthorized?: (response: Response) => void;
  onForbidden?: (response: Response) => void;
  onApiError?: (error: unknown) => void;
}

export interface SuperpositionEmbeddableConfig {
  apiBaseUrl: string;
  apiBasePath?: string;
  credentials?: RequestCredentials;
  workspaceHeaderName?: "x-workspace" | "x-tenant";
  orgId: string;
  workspace: string;
  auth?: SuperpositionAuthConfig;
  network?: SuperpositionNetworkHooks;
  scope?: SuperpositionScopeConfig;
  filters?: SuperpositionFilterConfig;
  capabilities?: SuperpositionCapabilitiesConfig;
  readOnly?: boolean;
  strict?: boolean;
  features?: SuperpositionFeature[];
  routing?: SuperpositionRoutingConfig;
  table?: SuperpositionTableConfig;
  theme?: SuperpositionThemeConfig;
  layout?: SuperpositionLayoutConfig;
  assets?: SuperpositionAssetsConfig;
  experimentManager?: SuperpositionExperimentManagerConfig;
  ui?: SuperpositionUiAdapters;
  messages?: Record<string, string>;
}

export interface NormalizedSuperpositionConfig extends Omit<
  SuperpositionEmbeddableConfig,
  "apiBaseUrl" | "apiBasePath" | "credentials" | "workspaceHeaderName" | "scope"
> {
  transport: InternalTransportConfig;
  context?: Record<string, JsonValue>;
  lockScopedDimensions: boolean;
}
