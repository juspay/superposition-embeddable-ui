import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  FormField,
  inputStyle,
  Modal,
  Pagination,
  Table,
} from "../components";
import { resolveExperimentResults } from "../api/experiment-results";
import type { Column } from "../components/Table";
import { useApi, useMutation } from "../hooks/useApi";
import { useAlerts } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type {
  CreateExperimentRequest,
  DefaultConfig,
  Experiment,
  ExperimentMetricResult,
  ExperimentResults,
  ExperimentStatusType,
  JsonValue,
  MetricDefinition,
  SuperpositionExperimentTemplate,
  SuperpositionExperimentTemplateKey,
  SuperpositionExperimentVariantField,
} from "../types";
import {
  canUseFeatureAction,
  FeatureUnavailable,
  getMessage,
  isFeatureEnabled,
} from "./FeatureGate";

export interface ExperimentManagerProps {
  pageSize?: number;
}

const statusTone: Record<
  ExperimentStatusType,
  "info" | "warning" | "success" | "neutral"
> = {
  CREATED: "info",
  INPROGRESS: "success",
  PAUSED: "warning",
  CONCLUDED: "neutral",
  DISCARDED: "neutral",
};

function formatStatus(status: ExperimentStatusType) {
  if (status === "INPROGRESS") return "Active";
  if (status === "CREATED") return "Scheduled";
  if (status === "CONCLUDED") return "Ended";
  return status.toLowerCase();
}

const METRIC_NAME_ACRONYMS = new Set(["aov", "upi", "cod", "roi", "roas", "ctr"]);

function formatMetricDisplayName(name: string): string {
  return name
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) =>
      METRIC_NAME_ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

// Human-readable descriptions for known workspace metrics. Keyed by the raw
// metric name (lowercased). Unknown metrics return undefined so the UI can
// omit the secondary line rather than fabricate a generic description.
const METRIC_DESCRIPTIONS: Record<string, string> = {
  average_order_value: "Average value per completed order",
  aov: "Average value per completed order",
  conversion_rate: "Percentage of checkout sessions that complete payment",
  payment_success_rate: "Percentage of payment attempts that succeed",
  prepaid_share: "Percentage of orders paid via UPI/Cards/Wallets (not COD)",
  latency: "Time taken to complete the relevant operation",
};

function formatMetricDescription(metric: MetricDefinition): string | undefined {
  return METRIC_DESCRIPTIONS[metric.name.toLowerCase()];
}

function MetricSelect({
  label,
  value,
  options,
  onChange,
  optional = false,
  compact = false,
  hideRequired = false,
}: {
  label: string;
  value: string;
  options: MetricDefinition[];
  onChange: (value: string) => void;
  optional?: boolean;
  compact?: boolean;
  hideRequired?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const path = event.composedPath();
      if (rootRef.current && !path.includes(rootRef.current)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectedMetric = options.find((metric) => metric.name === value);
  const displayValue = selectedMetric
    ? formatMetricDisplayName(selectedMetric.name)
    : optional
      ? "No secondary metric"
      : `Select a ${label.toLowerCase()}`;

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <FormField
      label={label}
      required={!optional && !hideRequired}
      error={!optional && !value ? `Select a ${label.toLowerCase()}.` : undefined}
    >
      <div
        ref={rootRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: compact ? "220px" : undefined,
        }}
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((prev) => !prev)}
          style={{
            ...inputStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--sp-space-xs)",
            paddingRight: "var(--sp-space-md)",
            minHeight: 40,
            cursor: "pointer",
            textAlign: "left",
            color: selectedMetric ? "var(--sp-control-text)" : "var(--sp-color-muted)",
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayValue}
          </span>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{
              flex: "0 0 auto",
              color: "var(--sp-color-muted)",
              transition: "transform 160ms ease",
              transform: open ? "rotate(180deg)" : "none",
            }}
          >
            <path
              d="m3.5 5.25 3.5 3.5 3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open ? (
          <ul
            role="listbox"
            aria-label={label}
            style={{
              position: "absolute",
              zIndex: 30,
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              margin: 0,
              padding: 4,
              listStyle: "none",
              maxHeight: 240,
              overflowY: "auto",
              background: "var(--sp-control-bg)",
              border: "1px solid var(--sp-control-border)",
              borderRadius: "var(--sp-control-radius)",
              boxShadow: "var(--sp-shadow-md)",
            }}
          >
            {optional ? (
              <li key="__none">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === ""}
                  onClick={() => choose("")}
                  style={optionStyle(value === "")}
                >
                  No secondary metric
                </button>
              </li>
            ) : null}
            {options.map((metric) => {
              const isSelected = metric.name === value;
              return (
                <li key={`${metric.name}-${metric.direction}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(metric.name)}
                    style={optionStyle(isSelected)}
                  >
                    {formatMetricDisplayName(metric.name)}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </FormField>
  );
}

const optionStyle = (selected: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "var(--sp-space-xs) var(--sp-space-sm)",
  border: "none",
  borderRadius: "var(--sp-inline-radius, 6px)",
  background: selected ? "var(--sp-color-surface-muted)" : "transparent",
  color: "var(--sp-control-text)",
  fontSize: "1rem",
  cursor: "pointer",
});

function MetricPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(200px, var(--sp-experiment-metrics-label-width)) minmax(0, 1fr)",
        gap: "var(--sp-experiment-metrics-gap)",
        padding: "var(--sp-experiment-metrics-padding)",
        border: "1px solid var(--sp-experiment-metrics-border)",
        borderRadius: "var(--sp-experiment-metrics-radius)",
        background: "var(--sp-experiment-metrics-bg)",
      }}
    >
      <div style={{ display: "grid", alignContent: "start", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--sp-color-text)" }}>
          {title}
        </span>
        <span
          style={{
            maxWidth: "38ch",
            color: "var(--sp-experiment-metrics-helper)",
            fontSize: 12.5,
            fontWeight: 400,
            lineHeight: 1.5,
          }}
        >
          {description}
        </span>
      </div>
      <div
        style={{ width: "100%", maxWidth: "var(--sp-experiment-metrics-control-width)" }}
      >
        {children}
      </div>
    </section>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: ExperimentStatusType;
  compact?: boolean;
}) {
  const tone = statusTone[status];
  return (
    <span
      style={{
        display: "inline-flex",
        padding: compact ? "2px 7px" : "4px 9px",
        borderRadius: "var(--sp-pill-radius)",
        color: `var(--sp-feedback-${tone}-text)`,
        background: `var(--sp-feedback-${tone}-bg)`,
        border: "none",
        fontSize: compact ? 11 : 12,
        fontWeight: compact ? 600 : 700,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {formatStatus(status)}
    </span>
  );
}

// Unwrap a Superposition override value down to a displayable primitive.
// The API types overrides as Smithy `DocumentType`, which is normally a plain
// JSON scalar, but some responses wrap the scalar (e.g. `{ value: "#hex" }` or
// a tagged union). Normalize so colors and text render instead of going blank.
function unwrapOverrideValue(value: JsonValue): string | number | boolean | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? unwrapOverrideValue(value[0] as JsonValue) : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, JsonValue>;
    if ("value" in record) return unwrapOverrideValue(record.value);
    const keys = Object.keys(record);
    if (keys.length === 1) return unwrapOverrideValue(record[keys[0]]);
  }
  return null;
}

const COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function CompactConfigPreview({ data }: { data: Record<string, JsonValue> }) {
  const entries = Object.entries(data).map(
    ([key, value]) => [key, unwrapOverrideValue(value)] as const,
  );
  const visualEntries = entries.filter(
    (entry): entry is readonly [string, string] =>
      typeof entry[1] === "string" && COLOR_PATTERN.test(entry[1].trim()),
  );
  const textEntries = entries.filter(
    (entry): entry is readonly [string, string | number | boolean] =>
      entry[1] !== null &&
      !(typeof entry[1] === "string" && COLOR_PATTERN.test(entry[1].trim())),
  );

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
      {visualEntries.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          {visualEntries.slice(0, 4).map(([key, value]) => (
            <span
              key={key}
              title={`${humanizeKey(key)}: ${value}`}
              aria-label={`${humanizeKey(key)}: ${value}`}
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: "1px solid var(--sp-color-border)",
                background: value.trim(),
              }}
            />
          ))}
        </div>
      ) : null}
      {textEntries.length > 0 ? (
        <div
          style={{
            overflow: "hidden",
            color: "var(--sp-color-muted)",
            fontSize: 12,
            lineHeight: 1.4,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={textEntries
            .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`)
            .join(" · ")}
        >
          {textEntries
            .slice(0, 3)
            .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`)
            .join(" · ")}
        </div>
      ) : null}
      {entries.length === 0 ? (
        <span style={{ color: "var(--sp-color-muted)", fontSize: 12 }}>No overrides</span>
      ) : null}
    </div>
  );
}

function formatTimestamp(value: Date | string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
      }).format(date);
}

function formatExperimentPeriod(experiment: Experiment) {
  if (experiment.started_at) {
    const started = formatTimestamp(experiment.started_at);
    if (experiment.status === "CONCLUDED" || experiment.status === "DISCARDED") {
      return `${started} – ${formatTimestamp(experiment.last_modified)}`;
    }
    return `Started ${started}`;
  }
  return experiment.created_at
    ? `Created ${formatTimestamp(experiment.created_at)}`
    : "Not started";
}

function formatResultValue(metric: ExperimentMetricResult, side: "control" | "variant") {
  const display = side === "control" ? metric.controlDisplay : metric.variantDisplay;
  return display ?? new Intl.NumberFormat().format(metric[side]);
}

function formatResultChange(metric: ExperimentMetricResult) {
  if (metric.changeDisplay) return metric.changeDisplay;
  if (metric.relativeChange == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "always",
  }).format(metric.relativeChange);
}

function resultTone(metric: ExperimentMetricResult) {
  if (metric.favorable === true) return "var(--sp-color-success)";
  if (metric.favorable === false) return "var(--sp-color-danger)";
  return "var(--sp-color-muted)";
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--sp-space-md)",
        minHeight: 88,
        padding: "var(--sp-space-md)",
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-radius-sm)",
        background: "var(--sp-color-panel)",
      }}
    >
      <strong style={{ fontSize: 13 }}>{label}</strong>
      <strong style={{ fontSize: 22 }}>{value}</strong>
    </div>
  );
}

function parseJsonObject(value: string, label: string) {
  try {
    const parsed = JSON.parse(value) as JsonValue;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return { value: null, error: `${label} must be a JSON object.` };
    }
    return { value: parsed as Record<string, JsonValue>, error: null };
  } catch {
    return { value: null, error: `${label} must contain valid JSON.` };
  }
}

function getStringValue(
  value: Record<string, JsonValue> | null,
  key: string,
  fallback: string,
) {
  const current = value?.[key];
  return typeof current === "string" ? current : fallback;
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function getTemplateField(
  templateKey: SuperpositionExperimentTemplateKey,
  config: DefaultConfig,
): SuperpositionExperimentVariantField {
  const definition = typeof templateKey === "string" ? { key: templateKey } : templateKey;
  const schema = config.schema as Record<string, JsonValue>;
  const enumValues = Array.isArray(schema?.enum)
    ? schema.enum.filter((value): value is string => typeof value === "string")
    : [];
  const controlValue =
    typeof config.value === "string" ? config.value : JSON.stringify(config.value);

  return {
    key: definition.key,
    label: definition.label ?? humanizeKey(definition.key),
    type:
      definition.type ??
      (enumValues.length > 0
        ? "choice"
        : /^#[0-9a-f]{6}$/i.test(controlValue)
          ? "color"
          : "text"),
    controlValue,
    options: definition.options ?? enumValues.map((value) => ({ label: value, value })),
  };
}

function variantFieldsJson(fields: SuperpositionExperimentVariantField[]) {
  return JSON.stringify(
    Object.fromEntries(fields.map(({ key, controlValue }) => [key, controlValue])),
    null,
    2,
  );
}

function VariantFieldRow({
  label,
  type,
  value,
  options,
  readOnly,
  onChange,
}: {
  label: string;
  type: "color" | "choice" | "text";
  value: string;
  options?: Array<{ label: string; value: string }>;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  const color = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        alignItems: "center",
        gap: "var(--sp-space-md)",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      {type === "color" ? (
        readOnly ? (
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: "1px solid var(--sp-color-border)",
                background: color,
              }}
            />
            {value}
          </span>
        ) : (
          <label
            style={{
              minHeight: "var(--sp-button-height)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 var(--sp-space-sm)",
              border: "1px solid var(--sp-control-border)",
              borderRadius: "var(--sp-control-radius)",
              background: "var(--sp-control-bg)",
            }}
          >
            <input
              type="color"
              aria-label={`${label} color picker`}
              value={color}
              onChange={(event) => onChange?.(event.target.value.toUpperCase())}
              style={{ width: 20, height: 20, padding: 0, border: 0, background: "none" }}
            />
            <input
              aria-label={label}
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
              style={{ ...inputStyle, minHeight: 0, padding: 0, border: 0 }}
            />
          </label>
        )
      ) : type === "choice" && readOnly ? (
        <span style={{ fontSize: 14 }}>{value}</span>
      ) : type === "choice" ? (
        <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 20 }}>
          {(options ?? []).map((option) => (
            <label
              key={option.value}
              style={{ display: "flex", alignItems: "center", gap: 7 }}
            >
              <input
                type="radio"
                name={label}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange?.(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : readOnly ? (
        <span style={{ fontSize: 14 }}>{value}</span>
      ) : (
        <input
          aria-label={label}
          style={inputStyle}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
        />
      )}
    </div>
  );
}

function ExperimentComparison({
  urls,
  configs,
}: {
  urls: string[];
  configs: Record<string, JsonValue>[];
}) {
  const availableUrls = urls.filter(Boolean);
  const [activeIndex, setActiveIndex] = useState(availableUrls.length > 1 ? 1 : 0);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const labels = ["Control", "Variant"];
  const resolvedActiveIndex = activeIndex < availableUrls.length ? activeIndex : 0;
  const activeUrl = availableUrls[resolvedActiveIndex];

  useEffect(() => {
    setLoading(true);
    setReady(false);
    setFailed(false);
  }, [activeUrl]);

  useEffect(() => {
    const receivePreviewMessage = (event: MessageEvent) => {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        typeof event.data !== "string"
      ) {
        return;
      }
      try {
        const message = JSON.parse(event.data) as Record<string, unknown>;
        const eventName = message.eventName ?? message.message ?? message.event;
        if (eventName === "preview-error") {
          setFailed(true);
          setLoading(false);
        } else if (eventName === "app-ready") {
          setReady(true);
          setLoading(false);
        }
      } catch {
        // Ignore unrelated string messages from the checkout.
      }
    };
    window.addEventListener("message", receivePreviewMessage);
    return () => window.removeEventListener("message", receivePreviewMessage);
  }, [activeUrl]);

  useEffect(() => {
    if (!ready) return;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        eventName: "shop-configuration",
        value: configs[resolvedActiveIndex] ?? {},
      }),
      new URL(activeUrl, window.location.href).origin,
    );
  }, [activeUrl, configs, ready, resolvedActiveIndex]);

  if (!activeUrl) return null;

  return (
    <section
      aria-label="Configuration comparison"
      style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", minWidth: 0 }}
    >
      <div
        role="tablist"
        aria-label="Configuration preview"
        style={{
          display: "flex",
          gap: "var(--sp-space-md)",
          borderBottom: "1px solid var(--sp-color-border)",
        }}
      >
        {availableUrls.slice(0, 2).map((url, index) => {
          const active = index === resolvedActiveIndex;
          return (
            <button
              key={`${labels[index] ?? `Preview ${index + 1}`}-${url}`}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveIndex(index)}
              style={{
                padding: "0 var(--sp-space-xs) var(--sp-space-sm)",
                border: 0,
                borderBottom: active
                  ? "2px solid var(--sp-color-primary)"
                  : "2px solid transparent",
                background: "transparent",
                color: active ? "var(--sp-color-primary)" : "var(--sp-color-muted)",
                font: "inherit",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {labels[index] ?? `Preview ${index + 1}`}
            </button>
          );
        })}
      </div>
      <div
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          minHeight: "calc(var(--sp-experiment-comparison-device-height) + 48px)",
          padding: "var(--sp-experiment-comparison-padding)",
          overflow: "hidden",
          background: "var(--sp-experiment-comparison-bg)",
          border: "1px solid var(--sp-experiment-comparison-border)",
          borderTop: 0,
          borderRadius:
            "0 0 var(--sp-experiment-comparison-radius) var(--sp-experiment-comparison-radius)",
        }}
      >
        {loading ? (
          <span
            role="status"
            style={{ position: "absolute", color: "var(--sp-color-muted)", fontSize: 13 }}
          >
            Loading preview…
          </span>
        ) : null}
        {failed ? (
          <span
            role="alert"
            style={{ position: "absolute", color: "var(--sp-color-muted)", fontSize: 13 }}
          >
            Preview unavailable
          </span>
        ) : null}
        <iframe
          ref={iframeRef}
          key={`${resolvedActiveIndex}-${activeUrl}`}
          title={`${labels[resolvedActiveIndex] ?? "Configuration"} checkout preview`}
          src={activeUrl}
          allow="payment"
          onLoad={() => setLoading(false)}
          style={{
            width: "min(100%, var(--sp-experiment-comparison-device-width))",
            height: "var(--sp-experiment-comparison-device-height)",
            border: 0,
            borderRadius: "var(--sp-experiment-comparison-device-radius)",
            background: "var(--sp-color-panel)",
            boxShadow: "var(--sp-experiment-comparison-shadow)",
            opacity: loading || failed ? 0 : 1,
          }}
        />
      </div>
    </section>
  );
}

function ExperimentManagerContent({ pageSize = 20 }: ExperimentManagerProps) {
  const { client, config, defaultConfigs, experiments, workspaces } = useSuperposition();
  const { addAlert, confirmAction } = useAlerts();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [showReview, setShowReview] = useState(false);
  const [selected, setSelected] = useState<Experiment | null>(null);
  const [detailTab, setDetailTab] = useState<"results" | "overview">("results");
  const [detailAction, setDetailAction] = useState<
    "ramp" | "pause" | "resume" | "conclude" | "discard" | null
  >(null);
  const [experimentResults, setExperimentResults] = useState<ExperimentResults | null>(
    null,
  );
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [contextJson, setContextJson] = useState("{}");
  const [controlJson, setControlJson] = useState("{}");
  const [treatmentJson, setTreatmentJson] = useState("{}");
  const [primaryMetric, setPrimaryMetric] = useState("");
  const [secondaryMetric, setSecondaryMetric] = useState("");
  const [guardrailMetric, setGuardrailMetric] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [launchTraffic, setLaunchTraffic] = useState(50);
  const [splitMode, setSplitMode] = useState<"even" | "favor-control" | "custom">("even");
  const [actionReason, setActionReason] = useState("");
  const [traffic, setTraffic] = useState(10);
  const [chosenVariant, setChosenVariant] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<SuperpositionExperimentTemplate | null>(null);
  const [templateFields, setTemplateFields] = useState<
    SuperpositionExperimentVariantField[] | null
  >(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState("");

  const canCreate = canUseFeatureAction(config, "experiments", "create");
  const canExecute =
    !config.readOnly && canUseFeatureAction(config, "experiments", "execute");
  const canRamp = canUseFeatureAction(config, "experiments", "ramp");

  const { data, loading, error, refetch } = useApi(
    () =>
      experiments.list(
        { page, count: pageSize },
        {
          sort_on: "last_modified_at",
          sort_by: "desc",
        },
      ),
    [experiments, page, pageSize],
  );
  const {
    data: workspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useApi(() => workspaces.get(), [workspaces]);

  const parsedContext = useMemo(
    () => parseJsonObject(contextJson, "Context"),
    [contextJson],
  );
  const parsedControl = useMemo(
    () => parseJsonObject(controlJson, "Control overrides"),
    [controlJson],
  );
  const parsedTreatment = useMemo(
    () => parseJsonObject(treatmentJson, "Treatment overrides"),
    [treatmentJson],
  );
  const experimentTemplates = config.experimentManager?.experimentTemplates ?? [];
  const contextIsHostManaged = config.experimentManager?.contextMode === "host-managed";
  const variantFields = templateFields ?? config.experimentManager?.variantFields ?? [];
  const comparisonUrls = config.experimentManager?.comparisonUrls?.filter(Boolean) ?? [];
  const comparisonBaseConfig = config.experimentManager?.comparisonBaseConfig ?? {};
  const metricOptions = useMemo(() => workspace?.metrics?.definitions ?? [], [workspace]);
  const metricsEnabled = config.experimentManager?.showMetricsForm !== false;
  const disablePrimaryMetricSelection =
    config.experimentManager?.disablePrimaryMetricSelection === true;
  const disableSecondaryMetric =
    config.experimentManager?.disableSecondaryMetric === true;
  const disableGuardrailMetric =
    config.experimentManager?.disableGuardrailMetric === true;
  const metricsByName = useMemo(
    () => new Map(metricOptions.map((metric) => [metric.name, metric])),
    [metricOptions],
  );

  useEffect(() => {
    const source = config.experimentManager?.resultsSource;
    if (!selected || !source) {
      setExperimentResults(null);
      setResultsLoading(false);
      setResultsError("");
      return;
    }

    const controller = new AbortController();
    setResultsLoading(true);
    setResultsError("");
    resolveExperimentResults(client, source, selected, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setExperimentResults(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setExperimentResults(null);
          setResultsError(
            error instanceof Error ? error.message : "Failed to load experiment results.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setResultsLoading(false);
      });

    return () => controller.abort();
  }, [client, config.experimentManager?.resultsSource, selected]);

  useEffect(() => {
    if (metricsEnabled && !metricsByName.has(primaryMetric)) {
      setPrimaryMetric(metricOptions[0]?.name ?? "");
    }
  }, [metricOptions, metricsEnabled, metricsByName, primaryMetric]);

  const chooseTemplate = async (template: SuperpositionExperimentTemplate) => {
    setTemplateLoading(true);
    setTemplateError("");
    try {
      const response = await defaultConfigs.list({ all: true });
      const configsByKey = new Map(response.data.map((item) => [item.key, item]));
      const missingKeys = template.keys
        .map((item) => (typeof item === "string" ? item : item.key))
        .filter((key) => !configsByKey.has(key));
      if (missingKeys.length > 0) {
        throw new Error(`Missing configuration keys: ${missingKeys.join(", ")}`);
      }
      const fields = template.keys.map((item) => {
        const key = typeof item === "string" ? item : item.key;
        return getTemplateField(item, configsByKey.get(key)!);
      });
      const initialOverrides = variantFieldsJson(fields);
      setTemplateFields(fields);
      setControlJson(initialOverrides);
      setTreatmentJson(initialOverrides);
      setSelectedTemplate(template);
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : "Failed to load configuration keys.",
      );
    } finally {
      setTemplateLoading(false);
    }
  };

  const updateTreatmentField = (key: string, value: string) => {
    setTreatmentJson(
      JSON.stringify({ ...(parsedTreatment.value ?? {}), [key]: value }, null, 2),
    );
  };

  const createMutation = useMutation(
    useCallback(
      async (request: CreateExperimentRequest) => {
        const result = await experiments.create(request);
        addAlert("success", `Experiment "${result.name}" created`);
        return result;
      },
      [addAlert, experiments],
    ),
  );

  const lifecycleMutation = useMutation(
    useCallback(
      async (action: "ramp" | "pause" | "resume" | "conclude" | "discard") => {
        if (!selected) throw new Error("Select an experiment first.");
        const change_reason = actionReason.trim();
        if (!change_reason) throw new Error("Enter a change reason.");

        if (action === "ramp") {
          return experiments.ramp(selected.id, {
            change_reason,
            traffic_percentage: traffic,
          });
        }
        if (action === "conclude") {
          return experiments.conclude(selected.id, {
            change_reason,
            chosen_variant: chosenVariant,
          });
        }
        return experiments[action](selected.id, { change_reason });
      },
      [actionReason, chosenVariant, experiments, selected, traffic],
    ),
  );

  const resetCreateForm = () => {
    const initialOverrides = variantFieldsJson(
      config.experimentManager?.variantFields ?? [],
    );
    setName("");
    setDescription("");
    setReason("");
    setContextJson("{}");
    setControlJson(initialOverrides);
    setTreatmentJson(initialOverrides);
    setPrimaryMetric("");
    setSecondaryMetric("");
    setGuardrailMetric("");
    setHypothesis("");
    setLaunchTraffic(50);
    setCreateStep(1);
    setShowReview(false);
    setSelectedTemplate(null);
    setTemplateFields(null);
    setTemplateError("");
  };

  const resolvedGuardrail = disableGuardrailMetric
    ? metricOptions[0]
    : metricsByName.get(guardrailMetric);
  const metricSelectionIncomplete =
    metricsEnabled &&
    (!metricsByName.has(primaryMetric) ||
      !resolvedGuardrail ||
      (!disableSecondaryMetric &&
        !!secondaryMetric &&
        !metricsByName.has(secondaryMetric)));
  const controlOverrideError =
    parsedControl.error ??
    (parsedControl.value && Object.keys(parsedControl.value).length > 0
      ? null
      : "Control overrides must include at least one key.");
  const treatmentOverrideError =
    parsedTreatment.error ??
    (parsedTreatment.value && Object.keys(parsedTreatment.value).length > 0
      ? null
      : "Variant overrides must include at least one key.");
  const resolvedHypothesis = hypothesis.trim();
  const resolvedDescription = metricsEnabled
    ? resolvedHypothesis || "Description not provided"
    : description.trim();
  const resolvedChangeReason = metricsEnabled
    ? resolvedHypothesis || "Change Reason not provided"
    : reason.trim();
  const createDisabled =
    createMutation.loading ||
    !name.trim() ||
    (!metricsEnabled && (!description.trim() || !reason.trim())) ||
    !!parsedContext.error ||
    !!controlOverrideError ||
    !!treatmentOverrideError ||
    metricSelectionIncomplete;

  const handleCreate = async () => {
    if (
      !parsedContext.value ||
      !parsedControl.value ||
      !parsedTreatment.value ||
      createDisabled
    ) {
      return;
    }

    try {
      const created = await createMutation.mutate({
        name: name.trim(),
        experiment_type: "DEFAULT",
        context: parsedContext.value,
        variants: [
          { id: "control", variant_type: "CONTROL", overrides: parsedControl.value },
          {
            id: "treatment",
            variant_type: "EXPERIMENTAL",
            overrides: parsedTreatment.value,
          },
        ],
        description: resolvedDescription,
        change_reason: resolvedChangeReason,
        metrics: metricsEnabled
          ? {
              enabled: true,
              selection: {
                primary: metricsByName.get(primaryMetric)!,
                secondary:
                  !disableSecondaryMetric && secondaryMetric
                    ? metricsByName.get(secondaryMetric)!
                    : null,
                guardrail: resolvedGuardrail!.name,
                hypothesis: resolvedHypothesis || null,
              },
            }
          : { enabled: false },
      });
      if (canRamp && launchTraffic > 0) {
        await experiments.ramp(created.id, {
          change_reason: resolvedChangeReason,
          traffic_percentage: launchTraffic,
        });
      }
      setShowCreate(false);
      resetCreateForm();
      refetch();
    } catch (err) {
      addAlert(
        "error",
        err instanceof Error ? err.message : "Failed to create experiment",
      );
    }
  };

  const openCreateFlow = () => {
    resetCreateForm();
    setShowCreate(true);
  };

  const openDetails = async (experiment: Experiment) => {
    const detailUrlTemplate = config.experimentManager?.detailUrlTemplate;
    if (detailUrlTemplate) {
      window.location.assign(
        detailUrlTemplate.replace("{experimentId}", encodeURIComponent(experiment.id)),
      );
      return;
    }
    setSelected(experiment);
    setDetailTab("results");
    setDetailAction(null);
    setActionReason("");
    setTraffic(experiment.traffic_percentage || 10);
    setChosenVariant(experiment.variants[0]?.id ?? "");
    try {
      setSelected(await experiments.get(experiment.id));
    } catch {
      addAlert("error", "Failed to load current experiment details");
    }
  };

  const runAction = async (
    action: "ramp" | "pause" | "resume" | "conclude" | "discard",
  ) => {
    if (action === "discard") {
      const confirmed = await confirmAction({
        title: `Discard "${selected?.name}"?`,
        description: "This experiment cannot be resumed after it is discarded.",
        confirmLabel: "Discard",
        variant: "destructive",
      });
      if (!confirmed) return;
    }

    try {
      const result = await lifecycleMutation.mutate(action);
      setSelected(result);
      setDetailAction(null);
      setActionReason("");
      addAlert("success", `Experiment ${formatStatus(result.status)}`);
      refetch();
    } catch (err) {
      addAlert("error", err instanceof Error ? err.message : "Experiment action failed");
    }
  };

  const columns: Column<Experiment>[] = [
    {
      key: "name",
      header: "Experiment",
      width: "32%",
      render: (row) => <strong>{row.name}</strong>,
    },
    {
      key: "experiment_type",
      header: "Type",
      width: "28%",
      render: (row) =>
        row.experiment_type === "DELETE_OVERRIDES" ? "Delete overrides" : "Configuration",
    },
    {
      key: "status",
      header: "Status",
      width: "20%",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "last_modified",
      header: "Updated",
      width: "20%",
      render: (row) => formatTimestamp(row.last_modified),
    },
  ];

  const actionDisabled = lifecycleMutation.loading || !actionReason.trim();
  const terminal = selected?.status === "CONCLUDED" || selected?.status === "DISCARDED";
  const maxTraffic = selected
    ? Math.floor(100 / Math.max(selected.variants.length, 1))
    : 100;
  const rows = loading ? [] : (data?.data ?? []);
  const hasExperiments = (data?.total_items ?? 0) > 0;
  const running = rows.filter((item) => item.status === "INPROGRESS").length;
  const scheduled = rows.filter((item) => item.status === "CREATED").length;
  const ended = rows.filter(
    (item) => item.status === "CONCLUDED" || item.status === "DISCARDED",
  ).length;

  if (selected) {
    const primaryResult = experimentResults?.primaryMetric ?? null;
    const resultRows = experimentResults?.metrics ?? [];
    const resultColumns: Column<ExperimentMetricResult>[] = [
      {
        key: "metric",
        header: "Metric",
        width: "34%",
        render: (metric) => (
          <strong>{metric.label ?? formatMetricDisplayName(metric.name)}</strong>
        ),
      },
      {
        key: "control",
        header: "Control",
        width: "22%",
        render: (metric) => formatResultValue(metric, "control"),
      },
      {
        key: "variant",
        header: "Variant",
        width: "22%",
        render: (metric) => formatResultValue(metric, "variant"),
      },
      {
        key: "change",
        header: "Change",
        width: "22%",
        render: (metric) => (
          <strong style={{ color: resultTone(metric) }}>
            {metric.relativeChange != null
              ? metric.relativeChange > 0
                ? "↑ "
                : metric.relativeChange < 0
                  ? "↓ "
                  : ""
              : ""}
            {formatResultChange(metric)}
          </strong>
        ),
      },
    ];
    const banner = experimentResults?.banner;
    const bannerFeedback =
      banner?.tone === "danger"
        ? "error"
        : banner?.tone === "neutral"
          ? "info"
          : banner?.tone;
    const actionLabel =
      detailAction === "conclude"
        ? "End Experiment"
        : detailAction
          ? detailAction.charAt(0).toUpperCase() + detailAction.slice(1)
          : "";
    const actionInvalid =
      actionDisabled ||
      (detailAction === "ramp" && (traffic < 1 || traffic > maxTraffic)) ||
      (detailAction === "conclude" && !chosenVariant);

    const beginAction = (
      action: "ramp" | "pause" | "resume" | "conclude" | "discard",
    ) => {
      setActionReason("");
      setDetailAction(action);
    };
    const compactActionButton = {
      height: 36,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 14px",
      fontSize: 13,
      fontWeight: 500,
    } as const;
    const overviewSectionStyle = {
      display: "grid",
      gridTemplateColumns: "minmax(220px, 28%) minmax(0, 1fr)",
      columnGap: "var(--sp-space-lg)",
      alignItems: "start",
      padding: "18px var(--sp-space-lg)",
      border: "1px solid var(--sp-color-border)",
      borderRadius: "var(--sp-radius-sm)",
      background: "var(--sp-color-panel)",
    } as const;
    const overviewHelperStyle = {
      margin: "5px 0 0",
      color: "var(--sp-color-muted)",
      fontSize: 12,
      lineHeight: 1.45,
    } as const;
    const summaryLabelStyle = {
      fontSize: 13,
      fontWeight: 500,
    } as const;
    const summaryValueStyle = {
      marginTop: 4,
      color: "var(--sp-color-muted)",
      fontSize: 13,
      lineHeight: 1.4,
    } as const;

    return (
      <div style={{ display: "grid", gap: 20 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--sp-space-md)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <button
              type="button"
              aria-label="Back to experiments"
              onClick={() => setSelected(null)}
              style={{
                border: 0,
                background: "transparent",
                color: "var(--sp-color-text)",
                padding: 0,
                fontSize: 22,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ←
            </button>
            <div style={{ display: "grid", gap: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  flexWrap: "wrap",
                }}
              >
                <h1
                  style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}
                >
                  {selected.name}
                </h1>
                <StatusBadge status={selected.status} compact />
              </div>
              <span style={{ color: "var(--sp-color-muted)", fontSize: 12 }}>
                {formatExperimentPeriod(selected)}
              </span>
            </div>
          </div>

          {!terminal ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(selected.status === "CREATED" || selected.status === "INPROGRESS") &&
              canRamp ? (
                <button
                  style={{ ...buttonSecondary, ...compactActionButton }}
                  onClick={() => beginAction("ramp")}
                >
                  Ramp
                </button>
              ) : null}
              {selected.status === "INPROGRESS" && canExecute ? (
                <button
                  style={{ ...buttonSecondary, ...compactActionButton }}
                  onClick={() => beginAction("pause")}
                >
                  Pause
                </button>
              ) : null}
              {selected.status === "PAUSED" && canExecute ? (
                <button
                  style={{ ...buttonSecondary, ...compactActionButton }}
                  onClick={() => beginAction("resume")}
                >
                  Resume
                </button>
              ) : null}
              {canExecute ? (
                <button
                  style={{
                    ...buttonSecondary,
                    ...compactActionButton,
                    color: "var(--sp-button-danger-text)",
                    borderColor: "var(--sp-button-danger-border)",
                  }}
                  onClick={() => beginAction("discard")}
                >
                  Discard
                </button>
              ) : null}
              {selected.status === "INPROGRESS" && canExecute ? (
                <button
                  style={{ ...buttonDanger, ...compactActionButton }}
                  onClick={() => beginAction("conclude")}
                >
                  End Experiment
                </button>
              ) : null}
            </div>
          ) : null}
        </header>

        <nav
          aria-label="Experiment detail sections"
          style={{
            display: "flex",
            gap: "var(--sp-space-lg)",
            borderBottom: "1px solid var(--sp-color-border)",
          }}
        >
          {(["overview", "results"] as const).map((tab) => {
            const active = detailTab === tab;
            return (
              <button
                type="button"
                key={tab}
                aria-current={active ? "page" : undefined}
                onClick={() => setDetailTab(tab)}
                style={{
                  padding: "0 8px 10px",
                  border: 0,
                  borderBottom: active
                    ? "2px solid var(--sp-color-primary)"
                    : "2px solid transparent",
                  background: "transparent",
                  color: active ? "var(--sp-color-primary)" : "var(--sp-color-muted)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {tab}
              </button>
            );
          })}
        </nav>

        {detailAction ? (
          <section
            aria-label={`${actionLabel} configuration`}
            style={{
              display: "grid",
              gap: "var(--sp-space-md)",
              padding: "var(--sp-space-lg)",
              border: "1px solid var(--sp-color-border)",
              borderRadius: "var(--sp-card-radius)",
              background: "var(--sp-color-panel)",
            }}
          >
            <strong>{actionLabel}</strong>
            <FormField label="Change reason" required>
              <input
                style={inputStyle}
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder="Reason for this lifecycle change"
              />
            </FormField>
            {detailAction === "ramp" ? (
              <FormField
                label={`Traffic per variant (max ${maxTraffic}%)`}
                required
                error={
                  traffic < 1 || traffic > maxTraffic
                    ? `Traffic per variant must be between 1% and ${maxTraffic}%.`
                    : undefined
                }
              >
                <input
                  type="number"
                  min={1}
                  max={maxTraffic}
                  style={inputStyle}
                  value={traffic}
                  onChange={(event) => setTraffic(Number(event.target.value))}
                />
              </FormField>
            ) : null}
            {detailAction === "conclude" ? (
              <FormField label="Winning variant" required>
                <select
                  style={inputStyle}
                  value={chosenVariant}
                  onChange={(event) => setChosenVariant(event.target.value)}
                >
                  {selected.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.id}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={buttonSecondary} onClick={() => setDetailAction(null)}>
                Cancel
              </button>
              <button
                style={
                  detailAction === "ramp" || detailAction === "resume"
                    ? buttonPrimary
                    : buttonDanger
                }
                disabled={actionInvalid}
                onClick={() => runAction(detailAction)}
              >
                {actionLabel}
              </button>
            </div>
          </section>
        ) : null}

        {detailTab === "results" ? (
          <div style={{ display: "grid", gap: "var(--sp-space-md)" }}>
            {resultsLoading ? (
              <section
                aria-live="polite"
                style={{
                  padding: "var(--sp-space-lg)",
                  textAlign: "center",
                  color: "var(--sp-color-muted)",
                  border: "1px solid var(--sp-color-border)",
                  borderRadius: "var(--sp-radius-sm)",
                  background: "var(--sp-color-panel)",
                }}
              >
                Loading experiment results…
              </section>
            ) : resultsError || experimentResults?.status === "error" ? (
              <section
                role="alert"
                style={{
                  padding: "var(--sp-space-md)",
                  color: "var(--sp-feedback-error-text)",
                  background: "var(--sp-feedback-error-bg)",
                  border: "1px solid var(--sp-feedback-error-border)",
                  borderRadius: "var(--sp-radius-sm)",
                }}
              >
                <strong>Experiment results could not be loaded.</strong>
                <div style={{ marginTop: 6 }}>
                  {resultsError || experimentResults?.note || "Try again later."}
                </div>
              </section>
            ) : experimentResults?.status === "available" ? (
              <>
                {banner && bannerFeedback ? (
                  <section
                    style={{
                      padding: "12px 14px",
                      color: `var(--sp-feedback-${bannerFeedback}-text)`,
                      background: `var(--sp-feedback-${bannerFeedback}-bg)`,
                      border: `1px solid var(--sp-feedback-${bannerFeedback}-border)`,
                      borderRadius: "var(--sp-radius-sm)",
                      fontSize: 13,
                    }}
                  >
                    <strong>{banner.title}</strong>
                    {banner.description ? <span> — {banner.description}</span> : null}
                  </section>
                ) : null}
                {primaryResult ? (
                  <section
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "var(--sp-space-md)",
                    }}
                  >
                    {(["control", "variant"] as const).map((side) => (
                      <div
                        key={side}
                        style={{
                          display: "grid",
                          gap: 6,
                          padding: "14px var(--sp-space-md)",
                          border: "1px solid var(--sp-color-border)",
                          borderRadius: "var(--sp-radius-sm)",
                          background: "var(--sp-color-panel)",
                        }}
                      >
                        <strong style={{ fontSize: 13, fontWeight: 600 }}>
                          {side === "control" ? "Control's" : "Variant's"}{" "}
                          {primaryResult.label ??
                            formatMetricDisplayName(primaryResult.name)}
                        </strong>
                        <span style={{ color: "var(--sp-color-muted)", fontSize: 12 }}>
                          {(side === "control"
                            ? primaryResult.controlSampleSize
                            : primaryResult.variantSampleSize) != null
                            ? `${(side === "control"
                                ? primaryResult.controlSampleSize
                                : primaryResult.variantSampleSize
                              )?.toLocaleString()} samples`
                            : `${side === "control" ? "Control" : "Variant"} group`}
                        </span>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                          <strong style={{ fontSize: 22, fontWeight: 600 }}>
                            {formatResultValue(primaryResult, side)}
                          </strong>
                          {side === "variant" ? (
                            <span
                              style={{
                                color: resultTone(primaryResult),
                                fontSize: 12,
                                fontWeight: 500,
                              }}
                            >
                              {formatResultChange(primaryResult)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </section>
                ) : null}
                {resultRows.length > 0 ? (
                  <Table
                    columns={resultColumns}
                    data={resultRows}
                    keyExtractor={(metric) => metric.name}
                  />
                ) : null}
                {experimentResults.note ? (
                  <p style={{ margin: 0, color: "var(--sp-color-muted)", fontSize: 13 }}>
                    {experimentResults.note}
                  </p>
                ) : null}
              </>
            ) : selected.metrics_url && !config.experimentManager?.resultsSource ? (
              <section style={{ display: "grid", gap: "var(--sp-space-sm)" }}>
                <strong>Experiment analytics</strong>
                <iframe
                  title="Experiment analytics"
                  src={selected.metrics_url}
                  style={{
                    width: "100%",
                    minHeight: 620,
                    border: "1px solid var(--sp-color-border)",
                    borderRadius: "var(--sp-radius-sm)",
                    background: "var(--sp-color-panel)",
                  }}
                />
              </section>
            ) : (
              <section
                style={{
                  display: "grid",
                  gap: 8,
                  padding: "var(--sp-space-lg)",
                  textAlign: "center",
                  border: "1px solid var(--sp-color-border)",
                  borderRadius: "var(--sp-radius-sm)",
                  background: "var(--sp-color-panel)",
                }}
              >
                <strong>
                  {experimentResults?.status === "collecting"
                    ? "Collecting experiment data"
                    : "No experiment results available"}
                </strong>
                <span style={{ color: "var(--sp-color-muted)" }}>
                  {experimentResults?.note ??
                    (config.experimentManager?.resultsSource
                      ? "Results will appear when the analytics source has enough data."
                      : "Configure a results source to show structured experiment analytics.")}
                </span>
              </section>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "var(--sp-space-sm)" }}>
            <section style={overviewSectionStyle}>
              <div>
                <strong style={summaryLabelStyle}>Hypothesis</strong>
                <p style={overviewHelperStyle}>
                  Capture your reasoning before you run the experiment.
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                {selected.metrics?.selection?.hypothesis || "No hypothesis provided."}
              </p>
            </section>

            <section style={overviewSectionStyle}>
              <div>
                <strong style={summaryLabelStyle}>Variants</strong>
                <p style={overviewHelperStyle}>What is your control and test variant</p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "var(--sp-space-sm)",
                }}
              >
                {selected.variants.map((variant) => {
                  const control = variant.variant_type === "CONTROL";
                  return (
                    <div
                      key={variant.id}
                      style={{
                        display: "grid",
                        gap: 8,
                        minWidth: 0,
                        padding: "10px 12px",
                        border: "1px solid var(--sp-color-border)",
                        borderRadius: "var(--sp-radius-sm)",
                      }}
                    >
                      <span
                        style={{
                          justifySelf: "start",
                          padding: "3px 8px",
                          borderRadius: "var(--sp-pill-radius)",
                          color: control
                            ? "var(--sp-feedback-info-text)"
                            : "var(--sp-feedback-success-text)",
                          background: control
                            ? "var(--sp-feedback-info-bg)"
                            : "var(--sp-feedback-success-bg)",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {control ? "Current live configuration" : "Test configuration"}
                      </span>
                      <CompactConfigPreview data={variant.overrides ?? {}} />
                      <span
                        title={variant.id}
                        style={{
                          overflow: "hidden",
                          color: "var(--sp-color-muted)",
                          fontSize: 11,
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {control ? "Control" : "Variant"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={overviewSectionStyle}>
              <div>
                <strong style={summaryLabelStyle}>Configuration summary</strong>
                <p style={overviewHelperStyle}>Your experiment configurations</p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                  columnGap: "var(--sp-space-lg)",
                  rowGap: 14,
                }}
              >
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <strong style={summaryLabelStyle}>Guardrail</strong>
                    <div style={summaryValueStyle}>
                      {selected.metrics?.selection?.guardrail
                        ? formatMetricDisplayName(selected.metrics.selection.guardrail)
                        : "Not configured"}
                    </div>
                  </div>
                  <div>
                    <strong style={summaryLabelStyle}>Schedule</strong>
                    <div style={summaryValueStyle}>
                      {formatExperimentPeriod(selected)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <strong style={summaryLabelStyle}>Primary Metrics</strong>
                    <div style={summaryValueStyle}>
                      {selected.metrics?.selection?.primary
                        ? formatMetricDisplayName(selected.metrics.selection.primary.name)
                        : "Not configured"}
                    </div>
                  </div>
                  <div>
                    <strong style={summaryLabelStyle}>Traffic split</strong>
                    <div style={summaryValueStyle}>
                      {selected.variants
                        .map(
                          (variant, index) =>
                            `${index === 0 || variant.variant_type === "CONTROL" ? "Control" : selected.variants.length === 2 ? "Variant" : `Variant ${index}`}: ${selected.traffic_percentage}%`,
                        )
                        .join(" | ")}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  if (showCreate) {
    if (experimentTemplates.length > 0 && !selectedTemplate) {
      return (
        <div style={{ display: "grid", gap: "var(--sp-space-lg)" }}>
          <header
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--sp-space-md)",
            }}
          >
            <button
              type="button"
              aria-label="Back to experiments"
              style={{
                width: 28,
                height: 28,
                padding: 0,
                border: 0,
                background: "transparent",
                color: "var(--sp-color-text)",
                cursor: "pointer",
                fontSize: 28,
                lineHeight: 1,
              }}
              onClick={() => setShowCreate(false)}
            >
              ←
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: "var(--sp-page-title-font-size)" }}>
                Choose an experiment template
              </h1>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "var(--sp-color-muted)",
                  fontSize: 14,
                }}
              >
                Select the configuration surface you want to test. This determines which
                options appear in the next step.
              </p>
            </div>
          </header>
          {templateError ? (
            <div
              role="alert"
              style={{
                padding: "var(--sp-space-sm)",
                color: "var(--sp-feedback-danger-text)",
                background: "var(--sp-feedback-danger-bg)",
                border: "1px solid var(--sp-feedback-danger-border)",
                borderRadius: "var(--sp-radius-sm)",
              }}
            >
              {templateError}
            </div>
          ) : null}
          <div
            className="sp-experiment-template-grid"
            style={{
              display: "grid",
              gap: "var(--sp-space-lg)",
            }}
          >
            {experimentTemplates.map((template) => {
              const disabled = templateLoading || template.disabled;
              const tone = template.impactTone ?? "info";
              return (
                <button
                  key={template.id}
                  className="sp-experiment-template-card"
                  type="button"
                  disabled={disabled}
                  onClick={() => chooseTemplate(template)}
                  style={{
                    display: "grid",
                    gridTemplateRows: "auto auto 1fr auto",
                    gap: "var(--sp-space-sm)",
                    minHeight: 210,
                    padding: "var(--sp-space-md)",
                    textAlign: "left",
                    color: template.disabled
                      ? "var(--sp-color-muted)"
                      : "var(--sp-color-text)",
                    background: "var(--sp-color-panel)",
                    border: "1px solid var(--sp-color-border)",
                    borderRadius: "var(--sp-radius-sm)",
                    cursor: templateLoading
                      ? "wait"
                      : template.disabled
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--sp-space-sm)",
                    }}
                  >
                    {template.iconUrl ? (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 32,
                          height: 32,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: "var(--sp-radius-sm)",
                          background: "var(--sp-color-primary-soft)",
                        }}
                      >
                        <img
                          src={template.iconUrl}
                          alt=""
                          style={{ width: 20, height: 20 }}
                        />
                      </span>
                    ) : (
                      <span />
                    )}
                    {template.statusLabel ? (
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "var(--sp-pill-radius)",
                          color: "var(--sp-color-muted)",
                          background: "var(--sp-color-surface-muted)",
                          fontSize: 12,
                        }}
                      >
                        {template.statusLabel}
                      </span>
                    ) : null}
                  </span>
                  <strong style={{ fontSize: 16 }}>{template.label}</strong>
                  <span style={{ color: "var(--sp-color-muted)", lineHeight: 1.45 }}>
                    {template.description}
                  </span>
                  {template.impactLabel ? (
                    <span
                      style={{
                        width: "fit-content",
                        padding: "4px 10px",
                        borderRadius: "var(--sp-pill-radius)",
                        color: `var(--sp-feedback-${tone}-text)`,
                        background: `var(--sp-feedback-${tone}-bg)`,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {template.impactLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    const steps = [
      { id: 1, label: "Configure Variants" },
      ...(metricsEnabled ? [{ id: 2, label: "Hypothesis & Metrics" }] : []),
      { id: 3, label: "Rollout" },
    ];
    const stepIndex = steps.findIndex((step) => step.id === createStep);
    const variantsIncomplete = !!controlOverrideError || !!treatmentOverrideError;
    const detailsIncomplete =
      !name.trim() ||
      (!metricsEnabled && (!description.trim() || !reason.trim())) ||
      !!parsedContext.error;
    const launchTrafficError =
      launchTraffic < 1 || launchTraffic > 50
        ? "Traffic per variant must be between 1% and 50%."
        : undefined;
    const isLastStep = stepIndex === steps.length - 1;
    // Review & Launch is a modal, not a page — but it stays in the stepper as the final
    // indicator, permanently "upcoming" because createStep never reaches it.
    const displaySteps = [...steps, { id: 4, label: "Review & Launch" }];
    // Mirrors the experiment-overview summary layout: a section title in a narrow left
    // column, the fields in a two-up grid beside it.
    const reviewSectionStyle = {
      display: "grid",
      gridTemplateColumns: "minmax(160px, 24%) minmax(0, 1fr)",
      columnGap: "var(--sp-space-lg)",
      alignItems: "start",
    } as const;
    const reviewSectionTitleStyle = {
      fontSize: 14,
      fontWeight: 600,
    } as const;
    const reviewGridStyle = {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
      columnGap: "var(--sp-space-lg)",
      rowGap: 22,
    } as const;
    const reviewLabelStyle = {
      display: "block",
      fontSize: 13,
      fontWeight: 500,
    } as const;
    const reviewValueStyle = {
      marginTop: 6,
      color: "var(--sp-color-muted)",
      fontSize: 13,
      lineHeight: 1.4,
    } as const;
    const reviewVariantCardStyle = {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "var(--sp-space-md)",
      padding: "var(--sp-space-lg)",
      border: "1px solid var(--sp-color-border)",
      borderRadius: "var(--sp-radius-sm)",
      background: "var(--sp-color-panel)",
    } as const;
    const nextDisabled =
      (createStep === 1 && (variantsIncomplete || detailsIncomplete)) ||
      (createStep === 2 && metricSelectionIncomplete) ||
      (createStep === 3 && !!launchTrafficError);
    const back = () => {
      if (createStep === 1 && experimentTemplates.length > 0) {
        setSelectedTemplate(null);
        setTemplateFields(null);
      } else if (createStep === 1) setShowCreate(false);
      else setCreateStep(steps[stepIndex - 1].id);
    };
    return (
      <div style={{ display: "grid", gap: "var(--sp-space-lg)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--sp-space-md)",
          }}
        >
          <div style={{ display: "grid", gap: "var(--sp-space-sm)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-space-xs)",
              }}
            >
              <button
                type="button"
                aria-label="Back to experiments"
                onClick={() => setShowCreate(false)}
                style={{
                  width: 16,
                  height: 16,
                  display: "grid",
                  placeContent: "center",
                  padding: 0,
                  border: 0,
                  borderRadius: "var(--sp-button-radius)",
                  background: "transparent",
                  color: "var(--sp-color-text)",
                  cursor: "pointer",
                }}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 8H3" />
                  <path d="m7 4-4 4 4 4" />
                </svg>
              </button>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--sp-page-title-font-size)",
                  color: "var(--sp-page-title-text)",
                }}
              >
                Configure Variants
              </h2>
              <span style={{ color: "var(--sp-color-muted)", fontSize: 14 }}>
                {getMessage(
                  config,
                  "experiments.configure.subtitle",
                  "Define the control and test configuration for this experiment.",
                )}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={buttonSecondary} onClick={back}>
              Back
            </button>
            <button
              style={{
                ...buttonPrimary,
                opacity: nextDisabled ? 0.55 : 1,
                cursor: nextDisabled ? "not-allowed" : "pointer",
              }}
              disabled={nextDisabled}
              onClick={() => {
                if (isLastStep) setShowReview(true);
                else setCreateStep(steps[stepIndex + 1].id);
              }}
            >
              {isLastStep ? "Review & Launch" : "Next →"}
            </button>
          </div>
        </div>

        <div
          aria-label={`Step ${stepIndex + 1} of ${displaySteps.length}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "var(--sp-space-md) var(--sp-space-md)",
            border: "1px solid var(--sp-color-border)",
            borderRadius: "var(--sp-radius-sm)",
            background: "var(--sp-color-panel)",
          }}
        >
          {displaySteps.map(({ id: step, label }, index) => {
            const state: "completed" | "active" | "upcoming" =
              step < createStep
                ? "completed"
                : step === createStep
                  ? "active"
                  : "upcoming";
            const isLast = index === displaySteps.length - 1;
            // Connector is blue only when the next step has been reached.
            const connectorActive = step < createStep;
            return (
              <Fragment key={label}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flex: "0 0 auto",
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      flex: "0 0 auto",
                      display: "grid",
                      placeContent: "center",
                      borderRadius: "50%",
                      boxSizing: "border-box",
                      fontSize: 12,
                      fontWeight: 600,
                      ...(state === "completed"
                        ? {
                            color: "var(--sp-color-primary)",
                            background: "transparent",
                            border: "1.5px solid var(--sp-color-primary)",
                          }
                        : state === "active"
                          ? {
                              color: "var(--sp-button-primary-text)",
                              background: "var(--sp-color-primary)",
                              border: "1.5px solid var(--sp-color-primary)",
                            }
                          : {
                              color: "var(--sp-color-muted)",
                              background: "var(--sp-color-surface-muted)",
                              border: "1.5px solid var(--sp-color-border)",
                            }),
                    }}
                  >
                    {state === "completed" ? (
                      <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m3 8.5 3.2 3.2L13 5" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      color:
                        state === "upcoming"
                          ? "var(--sp-color-muted)"
                          : "var(--sp-color-text)",
                      fontSize: 13,
                      fontWeight: state === "upcoming" ? 400 : 600,
                    }}
                  >
                    {label}
                  </span>
                </div>
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    style={{
                      flex: "1 1 48px",
                      minWidth: 24,
                      height: 0,
                      marginInline: "18px 14px",
                      borderTop: `2px dashed ${
                        connectorActive
                          ? "var(--sp-color-primary)"
                          : "var(--sp-color-border)"
                      }`,
                    }}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </div>

        {createStep === 1 ? (
          <>
            <div
              style={{
                display: "grid",
                gap: "var(--sp-space-md)",
                padding: "var(--sp-space-lg)",
                border: "1px solid var(--sp-color-border)",
                borderRadius: "var(--sp-radius-sm)",
                background: "var(--sp-color-panel)",
                width: "100%",
                maxWidth: "var(--sp-experiment-wizard-max-width)",
                marginInline: "auto",
              }}
            >
              <strong>Experiment details</strong>
              <FormField label="Name" required>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Experiment name"
                />
              </FormField>
              {!metricsEnabled ? (
                <>
                  <FormField label="Description" required>
                    <input
                      style={inputStyle}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="What this experiment measures"
                    />
                  </FormField>
                  <FormField label="Change reason" required>
                    <input
                      style={inputStyle}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why this experiment is being created"
                    />
                  </FormField>
                </>
              ) : null}
              {!contextIsHostManaged ? (
                <FormField
                  label="Audience context (JSON)"
                  required
                  error={parsedContext.error ?? undefined}
                >
                  <textarea
                    style={{ ...inputStyle, minHeight: 88, fontFamily: "monospace" }}
                    value={contextJson}
                    onChange={(event) => setContextJson(event.target.value)}
                  />
                </FormField>
              ) : null}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  comparisonUrls.length > 0
                    ? "repeat(auto-fit, minmax(min(100%, 420px), 1fr))"
                    : "1fr",
                gap: "var(--sp-space-md)",
                width: "100%",
                maxWidth: "var(--sp-experiment-wizard-max-width)",
                marginInline: "auto",
                alignItems: "stretch",
              }}
            >
              <div style={{ display: "grid", gap: "var(--sp-space-md)" }}>
                {[
                  {
                    title: "Control",
                    badge: "Current live configuration",
                    readOnly: true,
                  },
                  { title: "Variant", badge: "Test configuration", readOnly: false },
                ].map((section) => (
                  <section
                    key={section.title}
                    style={{
                      border: "1px solid var(--sp-color-border)",
                      borderRadius: "var(--sp-radius-sm)",
                      background: "var(--sp-color-panel)",
                      overflow: "hidden",
                    }}
                  >
                    <header
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--sp-space-md)",
                        padding: "var(--sp-space-md)",
                        borderBottom: "1px solid var(--sp-color-border)",
                      }}
                    >
                      <strong>{section.title}</strong>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "var(--sp-pill-radius)",
                          color: section.readOnly
                            ? "var(--sp-feedback-info-text)"
                            : "var(--sp-feedback-success-text)",
                          background: section.readOnly
                            ? "var(--sp-feedback-info-bg)"
                            : "var(--sp-feedback-success-bg)",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {section.badge}
                      </span>
                    </header>
                    <div
                      style={{
                        display: "grid",
                        gap: "var(--sp-space-md)",
                        padding: "var(--sp-space-lg)",
                      }}
                    >
                      {variantFields.length > 0 ? (
                        variantFields.map((field) => {
                          const controlValue = getStringValue(
                            parsedControl.value,
                            field.key,
                            field.controlValue,
                          );
                          return (
                            <VariantFieldRow
                              key={field.key}
                              label={field.label}
                              type={field.type}
                              options={field.options}
                              readOnly={section.readOnly}
                              value={
                                section.readOnly
                                  ? controlValue
                                  : getStringValue(
                                      parsedTreatment.value,
                                      field.key,
                                      controlValue,
                                    )
                              }
                              onChange={(value) => updateTreatmentField(field.key, value)}
                            />
                          );
                        })
                      ) : (
                        <FormField
                          label={`${section.title} overrides (JSON)`}
                          required
                          error={
                            section.readOnly
                              ? (controlOverrideError ?? undefined)
                              : (treatmentOverrideError ?? undefined)
                          }
                        >
                          <textarea
                            style={{
                              ...inputStyle,
                              minHeight: 130,
                              fontFamily: "monospace",
                            }}
                            value={section.readOnly ? controlJson : treatmentJson}
                            onChange={(event) =>
                              section.readOnly
                                ? setControlJson(event.target.value)
                                : setTreatmentJson(event.target.value)
                            }
                          />
                        </FormField>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              {comparisonUrls.length > 0 ? (
                <ExperimentComparison
                  urls={comparisonUrls}
                  configs={[
                    { ...comparisonBaseConfig, ...(parsedControl.value ?? {}) },
                    { ...comparisonBaseConfig, ...(parsedTreatment.value ?? {}) },
                  ]}
                />
              ) : null}
            </div>
          </>
        ) : null}

        {createStep === 2 && metricsEnabled ? (
          <div style={{ display: "grid", gap: "var(--sp-space-md)" }}>
            {metricOptions.length === 0 ? (
              <p role="status" style={{ color: "var(--sp-experiment-metrics-helper)" }}>
                {workspaceLoading
                  ? "Loading metric choices…"
                  : workspaceError
                    ? "Metric choices could not be loaded. Reload to try again."
                    : "No metric choices are configured. Add metrics to the workspace list to select them here; workspace metrics can remain disabled."}
              </p>
            ) : null}
            <MetricPanel
              title="Primary Metric"
              description="This is the metric that determines the experiment winner."
            >
              <div
                role="radiogroup"
                aria-label="Primary metric"
                style={{ display: "grid", gap: "var(--sp-space-sm)" }}
              >
                {metricOptions.map((metric) => {
                  const selected = primaryMetric === metric.name;
                  const metricDescription = formatMetricDescription(metric);
                  return (
                    <label
                      key={`${metric.name}-${metric.direction}`}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "var(--sp-space-xs)",
                        cursor: disablePrimaryMetricSelection ? "default" : "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="primary-metric"
                        value={metric.name}
                        checked={selected}
                        disabled={disablePrimaryMetricSelection}
                        onChange={() => setPrimaryMetric(metric.name)}
                        style={{
                          position: "absolute",
                          opacity: 0,
                          width: 1,
                          height: 1,
                          margin: 0,
                          padding: 0,
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          width: 18,
                          height: 18,
                          flex: "0 0 auto",
                          marginTop: 1,
                          display: "grid",
                          placeContent: "center",
                          boxSizing: "border-box",
                          borderRadius: "50%",
                          border: `2px solid ${
                            selected
                              ? "var(--sp-color-primary)"
                              : "var(--sp-control-border)"
                          }`,
                          background: "var(--sp-control-bg)",
                          transition: "border-color 160ms ease",
                        }}
                      >
                        {selected ? (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "var(--sp-color-primary)",
                            }}
                          />
                        ) : null}
                      </span>
                      <span style={{ display: "grid", gap: 2 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 400,
                            color: "var(--sp-color-text)",
                            lineHeight: 1.3,
                          }}
                        >
                          {formatMetricDisplayName(metric.name)}
                        </span>
                        {metricDescription ? (
                          <small
                            style={{
                              color: "var(--sp-experiment-metrics-helper)",
                              fontSize: 12,
                              lineHeight: 1.4,
                            }}
                          >
                            {metricDescription}
                          </small>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </MetricPanel>

            {!disableSecondaryMetric ? (
              <MetricPanel
                title="Secondary Metric"
                description="Optionally track another outcome alongside the primary metric."
              >
                <MetricSelect
                  label="Secondary metric"
                  value={secondaryMetric}
                  options={metricOptions}
                  onChange={setSecondaryMetric}
                  optional
                />
              </MetricPanel>
            ) : null}

            {!disableGuardrailMetric ? (
              <MetricPanel
                title="Guardrail Metric"
                description="We'll automatically monitor this metric and pause the experiment if it drops significantly — protecting you from a bad variant."
              >
                <MetricSelect
                  label="Guardrail metric"
                  value={guardrailMetric}
                  options={metricOptions}
                  onChange={setGuardrailMetric}
                  compact
                  hideRequired
                />
              </MetricPanel>
            ) : null}

            <MetricPanel
              title="Hypothesis"
              description="Capture your reasoning before you run the experiment."
            >
              <FormField label="Hypothesis">
                <textarea
                  style={{ ...inputStyle, minHeight: 120 }}
                  value={hypothesis}
                  onChange={(event) => setHypothesis(event.target.value)}
                  placeholder="Enter your hypothesis"
                />
              </FormField>
            </MetricPanel>
          </div>
        ) : null}

        {createStep === 3 ? (
          <div
            style={{
              display: "grid",
              gap: "var(--sp-space-md)",
              width: "100%",
              maxWidth: "var(--sp-experiment-wizard-max-width)",
              marginInline: "auto",
            }}
          >
            <MetricPanel
              title="Traffic Split"
              description="Choose how traffic is split, and when the experiment runs."
            >
              <div
                role="radiogroup"
                aria-label="Traffic split"
                style={{ display: "grid", gap: "var(--sp-space-md)" }}
              >
                {(
                  [
                    {
                      mode: "even",
                      label: "Even split (50/50)",
                      hint: "Recommended for most experiments",
                      traffic: 50,
                    },
                    {
                      mode: "favor-control",
                      label: "Favor Control (70/30)",
                      hint: "Keep more traffic on your current setup",
                      traffic: 30,
                    },
                    {
                      mode: "custom",
                      label: "Custom split",
                      hint: "Set your own percentage",
                      traffic: null,
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.mode}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      columnGap: 10,
                      alignItems: "start",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="traffic-split"
                      checked={splitMode === option.mode}
                      onChange={() => {
                        setSplitMode(option.mode);
                        if (option.traffic !== null) setLaunchTraffic(option.traffic);
                      }}
                      style={{ marginTop: 2 }}
                    />
                    <span style={{ display: "grid", gap: 2 }}>
                      <span style={{ fontSize: 14 }}>{option.label}</span>
                      <span style={{ color: "var(--sp-color-muted)", fontSize: 13 }}>
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}

                {splitMode === "custom" ? (
                  <div style={{ display: "grid", gap: 8, paddingLeft: 26 }}>
                    <span style={{ fontSize: 14 }}>
                      Control: {100 - launchTraffic}% / Variant B: {launchTraffic}%
                    </span>
                    {/* Capped at 50: Superposition applies traffic_percentage to EACH
                        variant, so anything above 50 would over-subscribe the split. */}
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      aria-label="Traffic per variant"
                      value={launchTraffic}
                      onChange={(event) => setLaunchTraffic(Number(event.target.value))}
                      style={{
                        width: "100%",
                        maxWidth: 360,
                        accentColor: "var(--sp-color-primary)",
                      }}
                    />
                    {launchTrafficError ? (
                      <span style={{ color: "var(--sp-color-danger)", fontSize: 13 }}>
                        {launchTrafficError}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </MetricPanel>
          </div>
        ) : null}

        <Modal
          open={showReview}
          onClose={() => setShowReview(false)}
          maxWidth="880px"
          title="Review your experiment"
          footer={
            <>
              <button style={buttonSecondary} onClick={() => setShowReview(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...buttonPrimary,
                  opacity: createDisabled ? 0.55 : 1,
                  cursor: createDisabled ? "not-allowed" : "pointer",
                }}
                disabled={createDisabled}
                onClick={handleCreate}
              >
                {createMutation.loading ? "Launching..." : "Launch"}
              </button>
            </>
          }
        >
          <div style={{ display: "grid", rowGap: 32, padding: "var(--sp-space-sm) 0" }}>
            <section style={reviewSectionStyle}>
              <strong style={reviewSectionTitleStyle}>Experiment Details</strong>
              <div style={reviewGridStyle}>
                <div>
                  <strong style={reviewLabelStyle}>Experiment name</strong>
                  <div style={reviewValueStyle}>{name || "Not set"}</div>
                </div>
                <div>
                  <strong style={reviewLabelStyle}>Configuration</strong>
                  <div style={reviewValueStyle}>
                    {selectedTemplate?.label ?? "Custom"}
                  </div>
                </div>
                <div>
                  <strong style={reviewLabelStyle}>Primary Metrics</strong>
                  <div style={reviewValueStyle}>
                    {metricsEnabled && primaryMetric
                      ? formatMetricDisplayName(primaryMetric)
                      : "Not configured"}
                  </div>
                </div>
                <div>
                  <strong style={reviewLabelStyle}>Traffic Split</strong>
                  <div style={reviewValueStyle}>
                    Control: {100 - launchTraffic}% | Variant: {launchTraffic}%
                  </div>
                </div>
              </div>
            </section>

            <section style={reviewSectionStyle}>
              <strong style={reviewSectionTitleStyle}>Variant Details</strong>
              <div style={reviewGridStyle}>
                {[
                  {
                    badge: "Current live configuration",
                    control: true,
                    data: { ...comparisonBaseConfig, ...(parsedControl.value ?? {}) },
                  },
                  {
                    badge: "Test configuration",
                    control: false,
                    data: { ...comparisonBaseConfig, ...(parsedTreatment.value ?? {}) },
                  },
                ].map((variant) => (
                  <div key={variant.badge} style={reviewVariantCardStyle}>
                    <span
                      style={{
                        alignSelf: "flex-start",
                        padding: "5px 12px",
                        whiteSpace: "nowrap",
                        borderRadius: "var(--sp-pill-radius)",
                        color: variant.control
                          ? "var(--sp-feedback-info-text)"
                          : "var(--sp-feedback-success-text)",
                        background: variant.control
                          ? "var(--sp-feedback-info-bg)"
                          : "var(--sp-feedback-success-bg)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {variant.badge}
                    </span>
                    <CompactConfigPreview data={variant.data} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-space-lg)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--sp-space-md)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <h2
            style={{
              margin: "var(--sp-page-title-margin)",
              fontSize: "var(--sp-page-title-font-size)",
              lineHeight: 1.08,
              fontWeight: "var(--sp-page-title-font-weight)",
              color: "var(--sp-page-title-text)",
            }}
          >
            {getMessage(config, "experiments.title", "Experiments")}
          </h2>
          <p style={{ margin: 0, color: "var(--sp-color-muted)", fontSize: 14 }}>
            {getMessage(
              config,
              "experiments.subtitle",
              "Know your customers. Reach the right ones.",
            )}
          </p>
        </div>
        {canCreate && !loading && hasExperiments ? (
          <button style={buttonPrimary} onClick={openCreateFlow}>
            + Create Experiment
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--sp-space-md)",
        }}
      >
        <SummaryCard
          label="Total"
          value={loading || !hasExperiments ? "–" : data!.total_items}
        />
        <SummaryCard label="Running" value={loading || !hasExperiments ? "–" : running} />
        <SummaryCard
          label="Scheduled"
          value={loading || !hasExperiments ? "–" : scheduled}
        />
        <SummaryCard label="Ended" value={loading || !hasExperiments ? "–" : ended} />
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--sp-inline-radius)",
            background: "var(--sp-feedback-danger-bg)",
            border: "1px solid var(--sp-feedback-danger-border)",
            color: "var(--sp-feedback-danger-text)",
            fontSize: 13,
          }}
        >
          Failed to load experiments: {error}
        </div>
      ) : null}

      {loading || rows.length > 0 ? (
        <Table
          columns={columns}
          data={rows}
          keyExtractor={(row) => row.id}
          onRowClick={openDetails}
          loading={loading}
        />
      ) : (
        <div
          style={{
            minHeight: "var(--sp-admin-content-min-height)",
            display: "grid",
            placeContent: "center",
            justifyItems: "center",
            gap: 8,
            padding: "var(--sp-space-lg)",
            border: "1px solid var(--sp-color-border)",
            borderRadius: "var(--sp-radius-sm)",
            background: "var(--sp-color-panel)",
            textAlign: "center",
          }}
        >
          {config.assets?.emptyStateImageUrl ? (
            <img
              src={config.assets.emptyStateImageUrl}
              alt=""
              aria-hidden="true"
              style={{
                width: 172,
                maxWidth: "100%",
                height: "auto",
                objectFit: "contain",
              }}
            />
          ) : null}
          <strong style={{ marginTop: 8 }}>
            {getMessage(config, "experiments.empty.title", "No experiments created")}
          </strong>
          <span style={{ color: "var(--sp-color-muted)", fontSize: 13 }}>
            {getMessage(
              config,
              "experiments.empty.description",
              "Create your first experiment",
            )}
          </span>
          {canCreate ? (
            <button style={{ ...buttonPrimary, marginTop: 12 }} onClick={openCreateFlow}>
              + Create Experiment
            </button>
          ) : null}
        </div>
      )}

      {data && data.data.length > 0 ? (
        <Pagination
          currentPage={page}
          totalPages={data.total_pages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

export function ExperimentManager(props: ExperimentManagerProps) {
  const { config } = useSuperposition();

  if (!isFeatureEnabled(config.features, "experiments")) {
    return (
      <FeatureUnavailable
        feature="Experiments"
        message={getMessage(
          config,
          "feature.disabled",
          "{feature} is not enabled for this embed.",
          { feature: "Experiments" },
        )}
      />
    );
  }

  return <ExperimentManagerContent {...props} />;
}
