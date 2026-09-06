import type {
  AuditLogFull,
  ContextFilterSortOn,
  ContextPut,
  ContextResponse,
  ConcludeExperimentInput,
  CreateExperimentRequest as SdkCreateExperimentRequest,
  CreateDefaultConfigInput,
  CreateDimensionInput,
  DefaultConfigResponse,
  DimensionMatchStrategy,
  DimensionResponse,
  DimensionType,
  DiscardExperimentInput,
  ExperimentResponse,
  ExperimentSortOn,
  ExperimentStatusType,
  GetResolvedConfigOutput,
  ListAuditLogsInput,
  ListContextsInput,
  ListContextsOutput,
  ListDefaultConfigsInput,
  MergeStrategy,
  AuditAction as SmithyAuditAction,
  ListExperimentInput,
  PauseExperimentInput,
  RampExperimentInput,
  ResumeExperimentInput,
  SortBy,
  UpdateDefaultConfigInput,
  UpdateDimensionInput,
  WorkspaceResponse,
} from "superposition-sdk";

type ServiceContextKeys = "workspace_id" | "org_id";

type RequestBody<T, ExtraKeys extends keyof T = never> = Omit<
  T,
  Extract<ServiceContextKeys | ExtraKeys, keyof T>
>;

type Defined<T> = Exclude<T, undefined>;
type ApiTimestamp = Date | string;
type OptionalFunctionKeys =
  | "value_validation_function_name"
  | "value_compute_function_name";

type RawResponse<T, OptionalKeys extends keyof T = never> = {
  [Key in Exclude<keyof T, OptionalKeys>]-?: Key extends
    | "created_at"
    | "last_modified_at"
    | "last_modified"
    ? ApiTimestamp
    : Defined<T[Key]>;
} & {
  [Key in OptionalKeys]?: Defined<T[Key]> | null;
};

// ── Shared primitives ──────────────────────────────────────────────

export type JsonValue = Defined<CreateDefaultConfigInput["value"]>;
export type Condition = Defined<ContextPut["context"]>;
export type Overrides = Defined<ContextPut["override"]>;
export type DependencyGraph = Defined<DimensionResponse["dependency_graph"]>;

export type { MergeStrategy, SortBy };

// ── Audit Logs ─────────────────────────────────────────────────────

export type AuditAction = SmithyAuditAction;
export type AuditLog = RawResponse<AuditLogFull, "original_data" | "new_data">;
export type AuditLogListFilters = Omit<
  RequestBody<ListAuditLogsInput>,
  keyof PaginationParams
>;

// ── Pagination ─────────────────────────────────────────────────────

export type PaginationParams = Pick<ListContextsInput, "page" | "count" | "all">;

export interface PaginatedResponse<T> {
  total_pages: Defined<ListContextsOutput["total_pages"]>;
  total_items: Defined<ListContextsOutput["total_items"]>;
  data: T[];
}

// ── Dimension ──────────────────────────────────────────────────────

export type { DimensionType };
export type Dimension = RawResponse<
  DimensionResponse,
  Extract<OptionalFunctionKeys, keyof DimensionResponse>
>;
export type CreateDimensionRequest = RequestBody<CreateDimensionInput>;
export type UpdateDimensionRequest = RequestBody<UpdateDimensionInput, "dimension">;

// ── Default Config ─────────────────────────────────────────────────

export type DefaultConfig = RawResponse<
  DefaultConfigResponse,
  Extract<OptionalFunctionKeys, keyof DefaultConfigResponse>
>;
export type CreateDefaultConfigRequest = RequestBody<CreateDefaultConfigInput>;
export type UpdateDefaultConfigRequest = RequestBody<UpdateDefaultConfigInput, "key">;
export type DefaultConfigFilters = Pick<ListDefaultConfigsInput, "name"> & {
  prefix?: string[];
};

// ── Experiment ─────────────────────────────────────────────────────

type OptionalExperimentKeys =
  | "chosen_variant"
  | "started_at"
  | "started_by"
  | "metrics_url"
  | "metrics"
  | "experiment_group_id";

export type { ExperimentSortOn, ExperimentStatusType };
type RawExperiment = RawResponse<
  ExperimentResponse,
  Extract<OptionalExperimentKeys, keyof ExperimentResponse>
>;
export type Experiment = Omit<RawExperiment, "metrics"> & {
  metrics?: ExperimentMetrics | null;
};
export type ExperimentListFilters = Pick<
  ListExperimentInput,
  | "status"
  | "from_date"
  | "to_date"
  | "experiment_name"
  | "experiment_ids"
  | "experiment_group_ids"
  | "created_by"
  | "sort_on"
  | "sort_by"
  | "global_experiments_only"
>;
export type MetricDirection = "maximize" | "minimize";

export interface MetricDefinition {
  name: string;
  direction: MetricDirection;
}

export interface MetricSelection {
  primary: MetricDefinition;
  secondary?: MetricDefinition | null;
  /**
   * The guardrail metric's NAME, not a definition — the server models this as a bare
   * string and rejects an object with `invalid type: map, expected a string`.
   */
  guardrail: string;
  /**
   * Accepted by the API but not modelled by it: the server's MetricSelection has no
   * hypothesis field, so serde ignores this and it does not round-trip. Kept so the value
   * starts persisting for free if the server ever gains the field.
   */
  hypothesis?: string | null;
}

/**
 * How the server actually shapes experiment metrics: a flag plus EITHER a selection or a
 * source. Sending the selection's fields flat alongside `enabled` is rejected with
 * "Experiment metrics cannot be enabled without a source or selection".
 */
export interface ExperimentMetrics {
  enabled: boolean;
  selection?: MetricSelection | null;
  source?: WorkspaceMetrics["source"];
}

export interface WorkspaceMetrics {
  enabled: boolean;
  source?: {
    grafana: {
      base_url: string;
      dashboard_uid: string;
      dashboard_slug: string;
      variant_id_alias?: string | null;
    };
  } | null;
  definitions?: MetricDefinition[] | null;
}

export type Workspace = Omit<RawResponse<WorkspaceResponse>, "metrics"> & {
  metrics: WorkspaceMetrics;
};

export type CreateExperimentRequest = Omit<
  RequestBody<SdkCreateExperimentRequest>,
  "metrics"
> & {
  metrics?: { enabled: true; selection: MetricSelection } | { enabled: false };
};
export type ConcludeExperimentRequest = RequestBody<ConcludeExperimentInput, "id">;
export type DiscardExperimentRequest = RequestBody<DiscardExperimentInput, "id">;
export type PauseExperimentRequest = RequestBody<PauseExperimentInput, "id">;
export type RampExperimentRequest = RequestBody<RampExperimentInput, "id">;
export type ResumeExperimentRequest = RequestBody<ResumeExperimentInput, "id">;

// ── Context / Override ─────────────────────────────────────────────

export type ContextOverride = Omit<RawResponse<ContextResponse>, "override"> & {
  override_: Overrides;
  override?: ContextResponse["override"];
};

export type PutContextRequest = ContextPut;
export type ContextDimensionMatchStrategy =
  | Extract<DimensionMatchStrategy, string>
  | "non_conflicting";

export type ContextListFilters = Pick<
  ListContextsInput,
  "prefix" | "sort_by" | "created_by" | "last_modified_by" | "plaintext"
> & {
  dimension?: Condition;
  dimension_match_strategy?: ContextDimensionMatchStrategy;
  sort_on?: ContextFilterSortOn;
};

// ── Config Resolution ──────────────────────────────────────────────

export interface Config {
  contexts: ContextOverride[];
  overrides: Record<string, Record<string, JsonValue>>;
  default_configs: Record<string, JsonValue>;
  dimensions?: Record<string, JsonValue>;
  version?: string;
  last_modified?: ApiTimestamp;
}

export type ResolvedConfigResponse = GetResolvedConfigOutput;

export interface ResolvedConfigExplanationTimelineItem {
  context_id: string;
  condition: JsonValue;
  override_id: string;
  value_before: JsonValue;
  value_after: JsonValue;
}

export interface ResolvedConfigExplanation {
  key: string;
  timeline: ResolvedConfigExplanationTimelineItem[];
}
