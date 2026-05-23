import { TagColor } from "@juspay/blend-design-system";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers3,
  LoaderCircle,
} from "lucide-react";
import { useMemo } from "react";
import type React from "react";
import "../blend-react-compat";
import { InlineNotice, MetaTag, RecordDetailHeader, Surface } from "../components";
import { useApi } from "../hooks/useApi";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type {
  DefaultConfig,
  JsonValue,
  MergeStrategy,
  ResolvedConfigExplanation,
  ResolvedConfigExplanationTimelineItem,
} from "../types";
import { FeatureUnavailable, getMessage, isFeatureEnabled } from "./FeatureGate";

export interface ConfigDetailPageProps {
  /** Default config key to display. */
  configKey: string;
  /** Optional context for explain resolution. Defaults to the active embedded scope. */
  context?: Record<string, JsonValue>;
  /** Called when the user clicks Back. If omitted, no back action is rendered. */
  onBack?: () => void;
  backLabel?: string;
  mergeStrategy?: MergeStrategy;
  version?: string;
  contextId?: string;
  resolveRemote?: boolean;
}

function formatTimestamp(value: unknown): string {
  if (!value) return "Not provided";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  const datePart = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${datePart} · ${timePart}`;
}

function formatDisplayValue(value: JsonValue | undefined): string {
  if (value === undefined) return "Not provided";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value) ?? String(value);
}

function getResolvedValue(
  config: DefaultConfig | null,
  explanation: ResolvedConfigExplanation | null,
): JsonValue | undefined {
  const timeline = explanation?.timeline ?? [];
  const lastStep = timeline.length > 0 ? timeline[timeline.length - 1] : undefined;

  return (lastStep?.value_after ?? config?.value) as JsonValue | undefined;
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Surface padded={false}>
      <div className="sp-config-detail-section">
        <div className="sp-detail-section__header">
          <span className="sp-detail-section__icon" aria-hidden="true">
            {icon}
          </span>
          <h3>{title}</h3>
        </div>
        {children}
      </div>
    </Surface>
  );
}

function SummaryItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["sp-config-summary-item", className].filter(Boolean).join(" ")}>
      <span className="sp-config-summary-item__label">{label}</span>
      <div className="sp-config-summary-item__value">{children}</div>
    </div>
  );
}

function JsonCode({ value }: { value: unknown }) {
  const formatted = JSON.stringify(value) ?? String(value);

  return (
    <code className="sp-config-json-code" title={formatted}>
      {formatted}
    </code>
  );
}

function ValueBadge({
  value,
  tone,
}: {
  value: JsonValue | undefined;
  tone: "before" | "after";
}) {
  return (
    <span className={`sp-config-value-badge sp-config-value-badge--${tone}`}>
      {formatDisplayValue(value)}
    </span>
  );
}

function SummarySection({ config }: { config: DefaultConfig }) {
  const hasFunctions = Boolean(
    config.value_validation_function_name || config.value_compute_function_name,
  );

  return (
    <DetailSection title="Summary" icon={<FileText size={22} strokeWidth={2} />}>
      <div className="sp-config-summary-grid">
        <SummaryItem label="Description" className="sp-config-summary-item--description">
          <p>{config.description?.trim() || "Not provided"}</p>
        </SummaryItem>
        <SummaryItem label="Value">
          <ValueBadge value={config.value} tone="after" />
        </SummaryItem>
        <SummaryItem label="Schema">
          <JsonCode value={config.schema} />
        </SummaryItem>
        <SummaryItem label="Reason">
          <p>{config.change_reason?.trim() || "Not provided"}</p>
        </SummaryItem>
        <SummaryItem label="Created">
          <p>{formatTimestamp(config.created_at)}</p>
        </SummaryItem>
        <SummaryItem label="Modified">
          <p>{formatTimestamp(config.last_modified_at)}</p>
        </SummaryItem>
      </div>

      {hasFunctions ? (
        <div className="sp-config-summary-functions">
          <span>Functions</span>
          <div className="sp-detail-tag-row">
            {config.value_validation_function_name ? (
              <MetaTag
                text={`Validation: ${config.value_validation_function_name}`}
                color={TagColor.PRIMARY}
              />
            ) : null}
            {config.value_compute_function_name ? (
              <MetaTag
                text={`Compute: ${config.value_compute_function_name}`}
                color={TagColor.PRIMARY}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </DetailSection>
  );
}

function ExplanationTable({
  timeline,
}: {
  timeline: ResolvedConfigExplanationTimelineItem[];
}) {
  return (
    <div className="sp-config-explanation-table-shell">
      <table
        className="sp-config-explanation-table"
        aria-label="Config resolution explanation"
      >
        <thead>
          <tr>
            <th scope="col">Override ID</th>
            <th scope="col">Condition</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map((step, index) => (
            <tr key={`${step.context_id}-${step.override_id}-${index}`}>
              <td>
                <code className="sp-config-override-id">{step.override_id}</code>
              </td>
              <td>
                <JsonCode value={step.condition} />
              </td>
              <td>
                <ValueBadge value={step.value_before} tone="before" />
              </td>
              <td>
                <ValueBadge value={step.value_after} tone="after" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExplainSection({
  explanation,
  loading,
  error,
}: {
  explanation: ResolvedConfigExplanation | null;
  loading: boolean;
  error: string | null;
}) {
  const timeline = explanation?.timeline ?? [];

  return (
    <DetailSection title="Explanation" icon={<Layers3 size={22} strokeWidth={2} />}>
      {error ? (
        <div className="sp-config-detail-section__body">
          <InlineNotice
            title="Could not load explanation"
            description={error}
            tone="warning"
          />
        </div>
      ) : loading && timeline.length === 0 ? (
        <div className="sp-config-explanation-loading" aria-label="Loading explanation">
          <span />
          <span />
          <span />
        </div>
      ) : timeline.length > 0 ? (
        <ExplanationTable timeline={timeline} />
      ) : (
        <div className="sp-config-explanation-empty">
          <CheckCircle2 aria-hidden="true" size={20} />
          <span>No overrides apply in this scope.</span>
        </div>
      )}
    </DetailSection>
  );
}

function ResolutionStatus({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  const tone = error ? "warning" : loading ? "loading" : "resolved";
  const label = error ? "Unavailable" : loading ? "Resolving" : "Resolved";
  const Icon = error ? AlertTriangle : loading ? LoaderCircle : CheckCircle2;

  return (
    <span
      className={`sp-config-resolution-status sp-config-resolution-status--${tone}`}
      role="status"
      aria-live="polite"
    >
      <Icon aria-hidden="true" size={15} />
      {label}
    </span>
  );
}

function ConfigDetailContent({
  configKey,
  context,
  onBack,
  backLabel = "Back",
  mergeStrategy,
  version,
  contextId,
  resolveRemote,
}: ConfigDetailPageProps) {
  const { defaultConfigs, resolve, scope } = useSuperposition();
  const explainContext = useMemo(
    () => context ?? scope.effectiveContext ?? {},
    [context, scope.effectiveContext],
  );
  const explainContextKey = JSON.stringify(explainContext);

  const configRequest = useApi(
    () => defaultConfigs.get(configKey),
    [defaultConfigs, configKey],
  );

  const explanationRequest = useApi(
    () =>
      resolve.explain(configKey, explainContext, {
        mergeStrategy,
        version,
        contextId,
        resolveRemote,
      }),
    [
      resolve,
      configKey,
      explainContextKey,
      mergeStrategy,
      version,
      contextId,
      resolveRemote,
    ],
  );

  const defaultConfig = configRequest.data;
  const explanation = explanationRequest.data;
  const resolvedValue = getResolvedValue(defaultConfig, explanation);

  return (
    <div className="sp-detail-page sp-record-detail-page sp-config-detail-page">
      <RecordDetailHeader
        title={configKey}
        status={
          <ResolutionStatus
            loading={explanationRequest.loading}
            error={explanationRequest.error}
          />
        }
        onBack={onBack}
        backLabel={backLabel}
      />

      {configRequest.error ? (
        <InlineNotice
          title="Could not load config"
          description={configRequest.error}
          tone="danger"
        />
      ) : null}

      {configRequest.loading && !defaultConfig ? (
        <Surface padded={false}>
          <div className="sp-config-detail-loading" aria-label="Loading config">
            <span />
            <span />
            <span />
          </div>
        </Surface>
      ) : null}

      {defaultConfig ? (
        <>
          <SummarySection
            config={{ ...defaultConfig, value: resolvedValue ?? defaultConfig.value }}
          />

          <ExplainSection
            explanation={explanation}
            loading={explanationRequest.loading}
            error={explanationRequest.error}
          />
        </>
      ) : null}
    </div>
  );
}

export function ConfigDetailPage(props: ConfigDetailPageProps) {
  const { config } = useSuperposition();

  if (!isFeatureEnabled(config.features, "config")) {
    return (
      <FeatureUnavailable
        feature="Configs"
        message={getMessage(
          config,
          "feature.disabled",
          "{feature} is not enabled for this embed.",
          { feature: "Configs" },
        )}
      />
    );
  }

  return <ConfigDetailContent {...props} />;
}
