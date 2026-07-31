import "../blend-react-compat";

import {
  Tooltip as BlendTooltip,
  Button,
  ButtonSize,
  ButtonSubType,
  ButtonType,
  TooltipSide,
} from "@juspay/blend-design-system";
import { Plus } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldEntryState } from "../components";
import {
  defaultEntryFromSchema,
  EmptyState,
  FormField,
  InlineNotice,
  inputStyle,
  Modal,
  PageHeader,
  Pagination,
  resolveTableSearchAlign,
  searchAlignStyle,
  SearchField,
  StructuredContextOverrideForm,
  Surface,
  Toolbar,
} from "../components";
import { useApi, useMutation } from "../hooks/useApi";
import { useAlerts } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { ContextOverride, JsonValue, PutContextRequest } from "../types";
import {
  filterRecordByPrefix,
  matchesPrefix,
  matchesSearchQuery,
  normalizeFilterValues,
  paginateRows,
} from "../utils";
import { formatErrorMessage } from "../utils/errors";
import {
  canUseFeatureAction,
  FeatureUnavailable,
  getMessage,
  isFeatureEnabled,
} from "./FeatureGate";

export interface OverrideManagerProps {
  pageSize?: number;
  /** Restrict overrideable default config keys to one or more prefixes */
  defaultConfigPrefix?: string | string[];
}

type OverrideContext = NonNullable<PutContextRequest["context"]>;

function filterOverrideValuesByPrefix(
  row: ContextOverride,
  prefixes?: string[],
): ContextOverride | null {
  if (!prefixes || prefixes.length === 0) return row;

  const override_ = filterRecordByPrefix(row.override_, prefixes);

  if (Object.keys(override_).length === 0) return null;
  return { ...row, override_ };
}

function matchesOverrideSearch(row: ContextOverride, query: string): boolean {
  return matchesSearchQuery(
    [
      row.id,
      row.override_id,
      row.value,
      row.override_,
      row.created_at,
      row.created_by,
      row.last_modified_at,
      row.last_modified_by,
      row.description,
      row.change_reason,
      row.weight,
    ],
    query,
  );
}

function entryFromOverrideValue(
  key: string,
  value: JsonValue,
  schema?: Record<string, JsonValue>,
): FieldEntryState {
  const entry = defaultEntryFromSchema(key, schema);
  return {
    ...entry,
    value,
    draft: entry.draft === undefined ? undefined : JSON.stringify(value, null, 2),
  };
}

function ChangeInfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-icon-color)", flex: "0 0 auto" }}
    >
      <rect x="3" y="6" width="14" height="8" rx="2.2" fill="currentColor" />
      <circle cx="7" cy="10" r="1" fill="var(--sp-color-panel)" />
      <circle cx="10" cy="10" r="1" fill="var(--sp-color-panel)" />
      <circle cx="13" cy="10" r="1" fill="var(--sp-color-panel)" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-icon-color)", flex: "0 0 auto" }}
    >
      <path
        d="M4.25 14.75 5 11.5 12.7 3.8a1.7 1.7 0 0 1 2.4 0l1.1 1.1a1.7 1.7 0 0 1 0 2.4l-7.7 7.7-3.25.75a.85.85 0 0 1-1-1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m11.55 4.95 3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width={16}
      height={16}
      style={{ flex: "0 0 auto" }}
    >
      <path
        d="m5.5 12 4.5-4.5 4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-icon-color)", flex: "0 0 auto" }}
    >
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10 9.4v4.1M10 6.5h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-icon-color)", flex: "0 0 auto" }}
    >
      <path
        d="M4.6 7.4A6 6 0 1 1 4 10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.4 4.7v2.9h2.9M10 6.8v3.4l2.4 1.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-color-primary)", flex: "0 0 auto" }}
    >
      <rect
        x="3.5"
        y="4.5"
        width="13"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M6.5 3.2v3M13.5 3.2v3M3.8 8h12.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="14"
      height="14"
      style={{ color: "var(--sp-color-muted)", flex: "0 0 auto" }}
    >
      <rect
        x="4.5"
        y="8.2"
        width="11"
        height="8"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7.3 8.2V6.4a2.7 2.7 0 0 1 5.4 0v1.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FixedScopeSection({ scope }: { scope: Record<string, JsonValue> }) {
  const entries = Object.entries(scope);

  if (entries.length === 0) return null;

  return (
    <section
      style={{
        display: "grid",
        gap: 14,
        padding: "22px 24px",
        border: "1px solid var(--sp-card-border)",
        borderRadius: "var(--sp-card-radius)",
        background: "var(--sp-card-bg)",
        boxShadow: "var(--sp-card-shadow)",
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--sp-color-text)",
            fontSize: "1rem",
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          Fixed Scope
          <InfoIcon />
        </div>
        <div
          style={{
            color: "var(--sp-color-muted)",
            fontSize: "0.92rem",
            fontWeight: 500,
            lineHeight: 1.45,
          }}
        >
          These conditions are fixed and cannot be changed.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {entries.map(([key, value]) => (
          <span
            key={key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              minHeight: 42,
              padding: "0 16px",
              border: "1px solid var(--sp-color-border)",
              borderRadius: "var(--sp-control-radius)",
              background: "var(--sp-color-panel)",
              color: "var(--sp-color-text)",
              fontSize: "0.94rem",
              fontWeight: 650,
              lineHeight: 1,
              boxShadow:
                "0 1px 0 color-mix(in oklab, var(--sp-color-text) 3%, transparent)",
            }}
          >
            <span style={{ fontWeight: 700 }}>{key}</span>
            <span style={{ color: "var(--sp-color-muted)", fontWeight: 800 }}>==</span>
            <span>{jsonCellValue(value)}</span>
            <LockIcon />
          </span>
        ))}
      </div>
    </section>
  );
}

function LockedScopeMeta({ scope }: { scope?: Record<string, JsonValue> }) {
  const entries = scope ? Object.entries(scope) : [];

  if (entries.length === 0) return null;

  const visibleEntries = entries.slice(0, 3);
  const hiddenEntries = entries.slice(3);

  return (
    <div
      role="group"
      aria-label="Locked scope"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          minHeight: 38,
          padding: "6px 14px",
          border: "1px solid var(--sp-color-border)",
          borderRadius: "var(--sp-control-radius)",
          background: "var(--sp-color-surface-muted)",
          color: "var(--sp-color-muted)",
          fontSize: "0.9rem",
          fontWeight: 600,
          lineHeight: 1.25,
        }}
      >
        <LockIcon />
        Scope
      </span>
      {visibleEntries.map(([key, value]) => {
        const formattedValue = jsonCellValue(value);

        return (
          <span
            key={key}
            title={`${key} = ${formattedValue}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "4px 8px",
              boxSizing: "border-box",
              minWidth: 0,
              maxWidth: "min(100%, 420px)",
              minHeight: 38,
              padding: "6px 16px",
              border: "1px solid var(--sp-color-border)",
              borderRadius: "var(--sp-control-radius)",
              background: "var(--sp-color-panel)",
              color: "var(--sp-color-text)",
              fontSize: "0.9rem",
              fontWeight: 600,
              lineHeight: 1.25,
              whiteSpace: "normal",
            }}
          >
            <span
              style={{
                flex: "0 1 auto",
                minWidth: 0,
                maxWidth: "100%",
                lineHeight: 1.25,
                overflowWrap: "anywhere",
              }}
            >
              {key}
            </span>
            <span
              style={{
                color: "var(--sp-color-muted)",
                fontWeight: 600,
                lineHeight: 1.25,
              }}
            >
              =
            </span>
            <span
              style={{
                flex: "1 1 10ch",
                minWidth: 0,
                lineHeight: 1.25,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {formattedValue}
            </span>
          </span>
        );
      })}
      {hiddenEntries.length > 0 && (
        <span
          title={hiddenEntries
            .map(([key, value]) => `${key} = ${jsonCellValue(value)}`)
            .join(", ")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 38,
            padding: "6px 14px",
            border: "1px solid var(--sp-color-border)",
            borderRadius: "var(--sp-control-radius)",
            background: "var(--sp-color-panel)",
            color: "var(--sp-color-text)",
            fontSize: "0.9rem",
            fontWeight: 650,
            lineHeight: 1.25,
          }}
        >
          +{hiddenEntries.length} more
        </span>
      )}
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width={16}
      height={16}
      style={{ flex: "0 0 auto" }}
    >
      <path
        d="m5.5 8 4.5 4.5L14.5 8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function jsonCellValue(value: JsonValue) {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}

function conditionPreview(dimension: string, value: JsonValue) {
  return `${dimension}:${jsonCellValue(value)}`;
}

function ConditionBadge({
  children,
  tone = "primary",
}: {
  children: React.ReactNode;
  tone?: "primary" | "neutral";
}) {
  const primary = tone === "primary";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minWidth: 0,
        maxWidth: "min(100%, 560px)",
        minHeight: 28,
        padding: "5px 10px",
        border: primary
          ? "1px solid color-mix(in oklab, var(--sp-color-primary) 14%, var(--sp-color-border))"
          : "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-control-radius)",
        background: primary
          ? "color-mix(in oklab, var(--sp-color-primary) 11%, var(--sp-color-panel))"
          : "var(--sp-color-surface-muted)",
        color: primary ? "var(--sp-color-primary)" : "var(--sp-color-text)",
        boxShadow: primary
          ? "inset 0 0 0 1px color-mix(in oklab, var(--sp-color-primary) 4%, transparent)"
          : "inset 0 0 0 1px color-mix(in oklab, var(--sp-color-text) 2%, transparent)",
        fontSize: "0.82rem",
        fontWeight: primary ? 700 : 650,
        lineHeight: 1.25,
        overflowWrap: "anywhere",
        whiteSpace: "normal",
        wordBreak: "break-word",
      }}
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </span>
  );
}

function OverrideKeyPill({ value }: { value: string }) {
  return (
    <code
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        boxSizing: "border-box",
        maxWidth: "100%",
        height: 28,
        padding: "0 10px",
        border:
          "1px solid color-mix(in oklab, var(--sp-color-primary) 16%, var(--sp-color-border))",
        borderRadius: "var(--sp-inline-radius)",
        background:
          "color-mix(in oklab, var(--sp-color-primary) 7%, var(--sp-color-panel))",
        color: "var(--sp-color-primary)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.82rem",
        fontWeight: 700,
        lineHeight: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={value}
    >
      {value}
    </code>
  );
}

function OverrideValuePill({ value }: { value: JsonValue }) {
  const preview = jsonCellValue(value);

  return (
    <code
      style={{
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
        boxSizing: "border-box",
        maxWidth: "100%",
        minHeight: 28,
        padding: "6px 10px",
        border: "1px solid var(--sp-feedback-success-border)",
        borderRadius: "var(--sp-inline-radius)",
        background: "var(--sp-feedback-success-bg)",
        color: "var(--sp-feedback-success-text)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.82rem",
        fontWeight: 650,
        lineHeight: 1.35,
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      }}
      title={preview}
    >
      {preview}
    </code>
  );
}

function formatChangeTimestamp(value: ContextOverride["last_modified_at"]) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayValue = value?.trim() || "Not provided";
  const canExpand = displayValue.length > 180;

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr)",
        gap: "var(--sp-space-sm)",
        alignItems: "start",
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--sp-pill-radius)",
          background: "var(--sp-color-primary-soft)",
          color: "var(--sp-color-primary)",
        }}
      >
        {icon}
      </span>
      <div style={{ display: "grid", gap: "var(--sp-space-sm)", minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            color: "var(--sp-color-text)",
            fontSize: "1rem",
            lineHeight: 1.2,
            fontWeight: 800,
          }}
        >
          {label}
        </h3>
        <div
          style={{
            maxHeight: canExpand ? (expanded ? 260 : 112) : undefined,
            overflowY: expanded ? "auto" : canExpand ? "hidden" : "visible",
            padding: "12px 14px",
            border: "1px solid var(--sp-color-border)",
            borderRadius: "var(--sp-control-radius)",
            background: "var(--sp-color-panel)",
            color: value ? "var(--sp-color-text)" : "var(--sp-color-muted)",
            fontSize: "0.92rem",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {displayValue}
        </div>
        {canExpand ? (
          <button
            type="button"
            style={{
              width: "fit-content",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: 0,
              border: 0,
              background: "transparent",
              color: "var(--sp-color-primary)",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 750,
            }}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Show less" : "Show more"}
            {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ChangeMetadata({ row }: { row: ContextOverride }) {
  const timestamp = formatChangeTimestamp(row.last_modified_at);
  const actor = row.last_modified_by;
  const details =
    timestamp && actor
      ? `${timestamp} by ${actor}`
      : timestamp || actor || "Change metadata not available";

  return (
    <div
      style={{
        marginLeft: 64,
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr)",
        alignItems: "center",
        gap: "var(--sp-space-sm)",
        padding: "14px 16px",
        borderRadius: "var(--sp-control-radius)",
        background: "var(--sp-color-surface-muted)",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--sp-inline-radius)",
          background: "var(--sp-color-primary-soft)",
          color: "var(--sp-color-primary)",
        }}
      >
        <CalendarIcon />
      </span>
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span
          style={{
            color: "var(--sp-color-muted)",
            fontSize: "0.82rem",
            fontWeight: 700,
          }}
        >
          Changed on
        </span>
        <span
          style={{
            color: "var(--sp-color-text)",
            fontSize: "0.92rem",
            fontWeight: 500,
            overflowWrap: "anywhere",
          }}
        >
          {details}
        </span>
      </div>
    </div>
  );
}

function ConditionSummary({
  entries,
  maxVisible = 1,
}: {
  entries: Array<[string, JsonValue]>;
  maxVisible?: number;
}) {
  if (entries.length === 0) {
    return (
      <span style={{ color: "var(--sp-color-muted)", fontSize: "0.95rem" }}>
        No conditions
      </span>
    );
  }

  const visibleEntries = entries.slice(0, maxVisible);
  const remaining = entries.length - visibleEntries.length;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        minWidth: 0,
      }}
    >
      {visibleEntries.map(([dimension, value]) => (
        <ConditionBadge key={dimension}>
          {conditionPreview(dimension, value)}
        </ConditionBadge>
      ))}
      {remaining > 0 && (
        <ConditionBadge tone="neutral">
          {`+${remaining} more condition${remaining === 1 ? "" : "s"}`}
        </ConditionBadge>
      )}
    </div>
  );
}

function ReadOnlyConditionRows({ entries }: { entries: Array<[string, JsonValue]> }) {
  const columnTemplate = "minmax(120px, 0.38fr) minmax(0, 1fr)";

  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: "var(--sp-space-md)",
          border: "1px dashed var(--sp-color-border)",
          borderRadius: "var(--sp-control-radius)",
          color: "var(--sp-color-muted)",
          fontSize: "0.95rem",
        }}
      >
        No conditions
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 0,
        minWidth: 0,
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-control-radius)",
        background: "var(--sp-card-bg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columnTemplate,
          gap: 16,
          padding: "10px 14px",
          borderBottom: "1px solid var(--sp-color-border)",
          background: "var(--sp-color-surface-muted)",
          color: "var(--sp-color-muted)",
          fontSize: "0.78rem",
          fontWeight: 800,
          lineHeight: 1.2,
        }}
      >
        <div>Dimension</div>
        <div>Value</div>
      </div>
      {entries.map(([key, value], index) => (
        <div
          key={key}
          style={{
            display: "grid",
            gridTemplateColumns: columnTemplate,
            gap: 16,
            alignItems: "center",
            minWidth: 0,
            padding: "12px 14px",
            borderTop: index === 0 ? undefined : "1px solid var(--sp-color-border)",
          }}
        >
          <span
            style={{
              color: "var(--sp-color-muted)",
              fontSize: "0.9rem",
              fontWeight: 700,
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {key}
          </span>
          <span
            style={{
              color: "var(--sp-color-text)",
              fontSize: "0.94rem",
              fontWeight: 600,
              lineHeight: 1.45,
              overflowWrap: "anywhere",
            }}
          >
            {jsonCellValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function OverrideValuesTable({ entries }: { entries: Array<[string, JsonValue]> }) {
  const columnTemplate = "minmax(140px, 0.38fr) minmax(0, 1fr)";

  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: "var(--sp-space-md)",
          border: "1px dashed var(--sp-color-border)",
          borderRadius: "var(--sp-control-radius)",
          color: "var(--sp-color-muted)",
          fontSize: "0.95rem",
        }}
      >
        No override values
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 0,
        minWidth: 0,
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-control-radius)",
        background: "var(--sp-card-bg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columnTemplate,
          gap: 16,
          padding: "10px 14px",
          borderBottom: "1px solid var(--sp-color-border)",
          background: "var(--sp-color-surface-muted)",
          color: "var(--sp-color-muted)",
          fontSize: "0.78rem",
          fontWeight: 800,
          lineHeight: 1.2,
        }}
      >
        <div>Key</div>
        <div>Value</div>
      </div>
      {entries.map(([key, value], index) => (
        <div
          key={key}
          style={{
            display: "grid",
            gridTemplateColumns: columnTemplate,
            gap: 16,
            alignItems: "center",
            minWidth: 0,
            padding: "12px 14px",
            borderTop: index === 0 ? undefined : "1px solid var(--sp-color-border)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <OverrideKeyPill value={key} />
          </div>
          <div style={{ minWidth: 0 }}>
            <OverrideValuePill value={value} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OverrideCard({
  row,
  canEdit,
  canEditRow,
  onEdit,
}: {
  row: ContextOverride;
  canEdit: boolean;
  canEditRow: boolean;
  onEdit: (row: ContextOverride) => void;
}) {
  const [showChangeInfo, setShowChangeInfo] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const overrideEntries = Object.entries(row.override_);
  const conditionEntries = Object.entries(row.value);

  return (
    <article
      className="sp-override-card"
      style={{
        width: "100%",
        border: "1px solid var(--sp-card-border)",
        borderRadius: "var(--sp-card-radius)",
        background: "var(--sp-card-bg)",
        boxShadow: "var(--sp-card-shadow)",
        display: "grid",
        gap: 0,
        overflow: "hidden",
        padding: "0",
        transition:
          "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          padding: "var(--sp-override-card-padding)",
        }}
      >
        <button
          type="button"
          aria-label={`${expanded ? "Collapse" : "Expand"} override details for ${row.id}`}
          aria-expanded={expanded}
          style={{
            display: "grid",
            gridTemplateColumns: "40px minmax(0, 1fr)",
            alignItems: "center",
            columnGap: 16,
            minWidth: 0,
            flex: "1 1 auto",
            padding: 0,
            border: 0,
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
          }}
          onClick={() => setExpanded((current) => !current)}
        >
          <div
            style={{
              width: 40,
              height: 40,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--sp-control-radius)",
              border: "1px solid var(--sp-color-border)",
              background: "var(--sp-color-surface-muted)",
              color: expanded ? "var(--sp-color-text)" : "var(--sp-color-muted)",
              flex: "0 0 auto",
              boxShadow: expanded
                ? "inset 0 0 0 1px color-mix(in oklab, var(--sp-color-primary) 10%, transparent)"
                : undefined,
            }}
          >
            {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </div>
          <div style={{ display: "grid", gap: expanded ? 0 : 8, minWidth: 0 }}>
            <span
              style={{
                color: "var(--sp-color-muted)",
                fontSize: "0.76rem",
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Condition
            </span>
            {!expanded && (
              <div style={{ minWidth: 0 }}>
                <ConditionSummary entries={conditionEntries} />
              </div>
            )}
          </div>
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            flex: "0 0 auto",
            paddingLeft: 12,
          }}
        >
          <BlendTooltip
            content="View change information"
            side={TooltipSide.BOTTOM}
            showArrow
          >
            <Button
              aria-label={`View change information for ${row.id}`}
              buttonType={ButtonType.SECONDARY}
              size={ButtonSize.SMALL}
              subType={ButtonSubType.ICON_ONLY}
              leadingIcon={<ChangeInfoIcon />}
              onClick={(e) => {
                e?.stopPropagation();
                setShowChangeInfo(true);
              }}
            />
          </BlendTooltip>
          {canEdit && (
            <BlendTooltip
              content={
                canEditRow
                  ? "Edit override"
                  : "This override cannot be edited from the current scoped view"
              }
              side={TooltipSide.BOTTOM}
              showArrow
            >
              <div style={{ opacity: canEditRow ? 1 : 0.6 }}>
                <Button
                  aria-label={`Edit override ${row.id}`}
                  buttonType={ButtonType.SECONDARY}
                  size={ButtonSize.SMALL}
                  subType={ButtonSubType.ICON_ONLY}
                  leadingIcon={<PencilIcon />}
                  onClick={(event) => {
                    event?.stopPropagation();
                    onEdit(row);
                  }}
                  disabled={!canEditRow}
                />
              </div>
            </BlendTooltip>
          )}
        </div>
      </div>

      {expanded && (
        <section
          aria-label={`Expanded override details for ${row.id}`}
          style={{
            display: "grid",
            gap: 16,
            padding: "var(--sp-override-card-padding)",
            borderTop: "1px solid var(--sp-color-border)",
            background:
              "color-mix(in oklab, var(--sp-color-surface-muted) 72%, var(--sp-card-bg))",
          }}
        >
          <ReadOnlyConditionRows entries={conditionEntries} />
          <div style={{ display: "grid", gap: 10 }}>
            <span
              style={{
                color: "var(--sp-color-muted)",
                fontSize: "0.78rem",
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Overrides
            </span>
            <OverrideValuesTable entries={overrideEntries} />
          </div>
        </section>
      )}
      <Modal
        open={showChangeInfo}
        onClose={() => setShowChangeInfo(false)}
        title="Change Information"
        width="var(--sp-override-details-modal-width)"
        maxWidth="var(--sp-override-details-modal-max-width)"
        maxHeight="var(--sp-override-details-modal-max-height)"
        footer={
          <Button
            buttonType={ButtonType.SECONDARY}
            size={ButtonSize.MEDIUM}
            text="Close"
            onClick={() => setShowChangeInfo(false)}
          />
        }
      >
        <div style={{ display: "grid", gap: "var(--sp-space-lg)" }}>
          <InfoBlock icon={<InfoIcon />} label="Description" value={row.description} />
          <InfoBlock
            icon={<HistoryIcon />}
            label="Reason for Change"
            value={row.change_reason}
          />
          <ChangeMetadata row={row} />
        </div>
      </Modal>
    </article>
  );
}

function OverrideManagerContent({
  pageSize = 10,
  defaultConfigPrefix,
}: OverrideManagerProps) {
  const { overrides, config, scope, defaultConfigs, dimensions } = useSuperposition();
  const { addAlert } = useAlerts();
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [search, setSearch] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingOverride, setEditingOverride] = useState<ContextOverride | null>(null);
  const [contextEntries, setContextEntries] = useState<FieldEntryState[]>([]);
  const [overrideEntries, setOverrideEntries] = useState<FieldEntryState[]>([]);
  const [newDesc, setNewDesc] = useState("");
  const [newReason, setNewReason] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  const scopedContext = scope.effectiveContext;
  const hasScopedContext = Boolean(
    scopedContext && Object.keys(scopedContext).length > 0,
  );
  const canCreate = canUseFeatureAction(config, "overrides", "create");
  const canEdit = canUseFeatureAction(config, "overrides", "update");
  const defaultConfigPrefixes = useMemo(
    () =>
      normalizeFilterValues(defaultConfigPrefix ?? config.filters?.defaultConfigPrefix),
    [config.filters?.defaultConfigPrefix, defaultConfigPrefix],
  );
  const dimensionMatchStrategy = hasScopedContext ? "non_conflicting" : undefined;
  const trimmedSearch = search.trim();
  const hasSearch = Boolean(trimmedSearch);
  const requestPage = hasSearch ? 1 : page;

  const { data, loading, error, refetch } = useApi(
    () =>
      overrides.list(
        hasSearch ? { all: true } : { page: requestPage, count: currentPageSize },
        {
          prefix: defaultConfigPrefixes,
          dimension: scopedContext,
          dimension_match_strategy: dimensionMatchStrategy,
        },
      ),
    [
      defaultConfigPrefixes,
      dimensionMatchStrategy,
      hasSearch,
      overrides,
      requestPage,
      currentPageSize,
      scopedContext,
    ],
  );

  const { data: defaultConfigsData } = useApi(
    () => defaultConfigs.list({ all: true }, { prefix: defaultConfigPrefixes }),
    [defaultConfigs, defaultConfigPrefixes],
  );

  const { data: dimensionsData } = useApi(
    () => dimensions.list({ all: true }),
    [dimensions],
  );

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.data
      .map((row) => filterOverrideValuesByPrefix(row, defaultConfigPrefixes))
      .filter((row): row is ContextOverride => Boolean(row))
      .filter((row) => matchesOverrideSearch(row, trimmedSearch));
  }, [data, defaultConfigPrefixes, trimmedSearch]);

  const shouldClientPage =
    hasSearch || Boolean(data && filteredData.length > currentPageSize);
  const serverTotalPages =
    typeof data?.total_pages === "number" ? data.total_pages : undefined;
  const serverTotalItems =
    typeof data?.total_items === "number" ? data.total_items : undefined;
  const totalPagesFromItems =
    serverTotalItems !== undefined
      ? Math.ceil(serverTotalItems / currentPageSize)
      : undefined;
  const hasServerPaginationMeta =
    serverTotalPages !== undefined || serverTotalItems !== undefined;
  const hasPotentialUnknownNextPage =
    !shouldClientPage &&
    !hasSearch &&
    !hasServerPaginationMeta &&
    filteredData.length >= currentPageSize;
  const totalPages = shouldClientPage
    ? Math.max(1, Math.ceil(filteredData.length / currentPageSize))
    : Math.max(
        1,
        serverTotalPages ??
          totalPagesFromItems ??
          (hasPotentialUnknownNextPage ? page + 1 : page),
      );
  const totalItems = shouldClientPage
    ? filteredData.length
    : (serverTotalItems ?? filteredData.length);
  const paginationTotalItems =
    shouldClientPage || serverTotalItems !== undefined ? totalItems : undefined;
  const rows = shouldClientPage
    ? paginateRows(filteredData, page, currentPageSize)
    : filteredData;
  const pageOptions = Array.from(new Set([pageSize, 10, 20, 50])).sort(
    (left, right) => left - right,
  );

  useEffect(() => {
    if (page > 1 && page > Math.max(1, totalPages)) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  const defaultConfigOptions = useMemo(
    () =>
      (defaultConfigsData?.data ?? []).filter((item) =>
        matchesPrefix(item.key, defaultConfigPrefixes),
      ),
    [defaultConfigPrefixes, defaultConfigsData?.data],
  );

  const dimensionOptions = useMemo(
    () => dimensionsData?.data ?? [],
    [dimensionsData?.data],
  );

  const defaultConfigByKey = useMemo(
    () => new Map(defaultConfigOptions.map((item) => [item.key, item])),
    [defaultConfigOptions],
  );

  const saveMutation = useMutation(
    useCallback(
      async (req: PutContextRequest) => {
        return editingOverride ? overrides.update(req) : overrides.create(req);
      },
      [editingOverride, overrides],
    ),
  );

  const openCreateModal = useCallback(() => {
    saveMutation.reset();
    setEditingOverride(null);
    setContextEntries([]);
    setOverrideEntries([]);
    setNewDesc("");
    setNewReason("");
    setFormSubmitted(false);
    setShowEditor(true);
  }, [saveMutation]);

  const openEditModal = useCallback(
    (row: ContextOverride) => {
      saveMutation.reset();
      setEditingOverride(row);
      setContextEntries([]);
      setOverrideEntries(
        Object.entries(row.override_).map(([key, value]) =>
          entryFromOverrideValue(key, value, defaultConfigByKey.get(key)?.schema),
        ),
      );
      setNewDesc(row.description ?? "");
      setNewReason("");
      setFormSubmitted(false);
      setShowEditor(true);
    },
    [defaultConfigByKey, saveMutation],
  );

  const closeEditor = useCallback(() => {
    saveMutation.reset();
    setShowEditor(false);
    setEditingOverride(null);
    setContextEntries([]);
    setOverrideEntries([]);
    setNewDesc("");
    setNewReason("");
    setFormSubmitted(false);
  }, [saveMutation]);

  const addContextKey = useCallback(
    (key: string) => {
      const dimension = dimensionOptions.find((item) => item.dimension === key);
      if (!dimension) return;

      setContextEntries((current) => [
        ...current,
        defaultEntryFromSchema(key, dimension.schema, {
          required: dimension.mandatory,
        }),
      ]);
    },
    [dimensionOptions],
  );

  const updateContextEntry = useCallback(
    (key: string, update: Partial<FieldEntryState>) => {
      setContextEntries((current) =>
        current.map((entry) => (entry.key === key ? { ...entry, ...update } : entry)),
      );
    },
    [],
  );

  const removeContextKey = useCallback((key: string) => {
    setContextEntries((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const updateOverrideEntry = useCallback(
    (key: string, update: Partial<FieldEntryState>) => {
      setOverrideEntries((current) =>
        current.map((entry) => (entry.key === key ? { ...entry, ...update } : entry)),
      );
    },
    [],
  );

  const contextObject = useMemo(
    () =>
      Object.fromEntries(
        contextEntries.map((entry) => [entry.key, entry.value]),
      ) as OverrideContext,
    [contextEntries],
  );

  const overrideObject = useMemo(
    () =>
      Object.fromEntries(
        overrideEntries.map((entry) => [entry.key, entry.value]),
      ) as PutContextRequest["override"],
    [overrideEntries],
  );
  const showCreateContextFields = !editingOverride;
  const requiresContextEntries = !editingOverride && !hasScopedContext;

  const parsedContext = useMemo(() => {
    const invalidEntry = contextEntries.find((entry) => entry.error);
    if (invalidEntry) {
      return {
        value: null,
        error: invalidEntry.error ?? "Context contains an invalid value.",
      };
    }

    if (requiresContextEntries && contextEntries.length === 0) {
      return { value: null, error: "Add at least one context condition." };
    }

    return { value: contextObject, error: null };
  }, [contextEntries, contextObject, requiresContextEntries]);

  const parsedOverride = useMemo(() => {
    const invalidEntry = overrideEntries.find((entry) => entry.error);
    if (invalidEntry) {
      return {
        value: null,
        error: invalidEntry.error ?? "Overrides contain an invalid value.",
      };
    }

    if (overrideEntries.length === 0) {
      return { value: null, error: "Add at least one override value." };
    }

    return { value: overrideObject, error: null };
  }, [overrideEntries, overrideObject]);

  const handleSave = async () => {
    setFormSubmitted(true);

    if (parsedContext.error) {
      addAlert("error", parsedContext.error);
      return;
    }

    if (parsedOverride.error) {
      addAlert("error", parsedOverride.error);
      return;
    }

    if (!newReason.trim()) {
      addAlert("error", "Enter a reason for this change.");
      return;
    }

    try {
      const context = editingOverride?.value ?? parsedContext.value ?? {};
      await saveMutation.mutate({
        context,
        override: parsedOverride.value as PutContextRequest["override"],
        description: newDesc || undefined,
        change_reason:
          newReason ||
          (editingOverride ? "Updated via admin UI" : "Created via admin UI"),
      });
      addAlert(
        "success",
        editingOverride
          ? getMessage(config, "overrides.updated", "Override updated")
          : getMessage(config, "overrides.created", "Override created"),
      );
      closeEditor();
      refetch();
    } catch (err) {
      addAlert(
        "error",
        formatErrorMessage(
          err,
          editingOverride
            ? "Could not update override. Please try again."
            : "Could not create override. Please try again.",
        ),
      );
    }
  };

  const hasRows = rows.length > 0;
  const showPagination = Boolean(
    data &&
    (hasRows || page > 1) &&
    (totalPages > 1 || (paginationTotalItems ?? 0) > currentPageSize),
  );
  const canSave = editingOverride ? canEdit : canCreate;
  const reasonError =
    formSubmitted && !newReason.trim() ? "Enter a reason for this change." : undefined;
  const saveDisabled = !canSave || saveMutation.loading;
  const editorContext = editingOverride?.value ?? scopedContext;
  const editorLockedKeys = editorContext ? Object.keys(editorContext) : [];
  const showSearch = true;
  const lockedScope = config.scope?.locked === false ? undefined : scope.hostContext;
  const emptyTitle = trimmedSearch ? "No matching overrides" : "No overrides found";
  const emptyDescription = trimmedSearch
    ? "Try a different search term or clear the search field."
    : hasScopedContext
      ? "This scoped context does not have any overrides yet."
      : "Create an override to customize config values for a context.";
  const overridesSearchAlign = resolveTableSearchAlign(config.table, "overrides");
  const emptyAction = trimmedSearch ? (
    <Button
      buttonType={ButtonType.SECONDARY}
      size={ButtonSize.SMALL}
      text="Clear search"
      onClick={() => setSearch("")}
    />
  ) : undefined;
  const errorDescription = error ? formatErrorMessage(error) : undefined;
  const hasLockedScope = Boolean(lockedScope && Object.keys(lockedScope).length > 0);

  return (
    <div className="sp-section-stack">
      <PageHeader
        title="Overrides"
        description="Review scoped overrides, then expand a card to inspect its conditions and values."
      />

      {hasLockedScope ? <LockedScopeMeta scope={lockedScope} /> : null}

      {!canCreate && (config.readOnly || hasScopedContext) && (
        <div style={{ display: "grid", gap: 10 }}>
          <InlineNotice
            title={getMessage(config, "common.readOnly", "Read-only mode")}
            description="Mutation actions are disabled for this embed."
            tone="warning"
          />
        </div>
      )}

      {showSearch && (
        <Toolbar>
          <div
            className="sp-overrides-search-row"
            style={{
              ...searchAlignStyle(overridesSearchAlign),
              flex: "1 1 320px",
              minWidth: "min(100%, 280px)",
            }}
          >
            <SearchField
              placeholder="Search overrides"
              value={search}
              onChange={(nextSearch) => {
                setSearch(nextSearch);
                setPage(1);
              }}
            />
          </div>
          {canCreate ? (
            <div>
              <Button
                buttonType={ButtonType.PRIMARY}
                size={ButtonSize.MEDIUM}
                text={getMessage(config, "overrides.create", "Create override")}
                leadingIcon={<Plus aria-hidden="true" size={16} />}
                onClick={openCreateModal}
              />
            </div>
          ) : null}
        </Toolbar>
      )}

      {error && hasRows && (
        <InlineNotice
          title="Could not load overrides"
          description={formatErrorMessage(error)}
          tone="danger"
        />
      )}

      {loading ? (
        <Surface>
          <div
            style={{
              padding: "calc(var(--sp-space-lg) * 2)",
              textAlign: "center",
              color: "var(--sp-color-muted)",
            }}
          >
            Loading...
          </div>
        </Surface>
      ) : error ? (
        <EmptyState
          title="Could not load overrides"
          description={errorDescription}
          tone="danger"
          minHeight="var(--sp-table-empty-min-height)"
        />
      ) : hasRows ? (
        <div style={{ display: "grid", gap: "var(--sp-override-list-gap)" }}>
          {rows.map((row) => (
            <OverrideCard
              key={row.id}
              row={row}
              canEdit={canEdit}
              canEditRow={canEdit}
              onEdit={openEditModal}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          minHeight="var(--sp-table-empty-min-height)"
        />
      )}

      {showPagination && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={paginationTotalItems}
          rowsPerPage={currentPageSize}
          onRowsPerPageChange={(nextRowsPerPage) => {
            setCurrentPageSize(nextRowsPerPage);
            setPage(1);
          }}
          rowsPerPageOptions={pageOptions}
          showSinglePage
          onPageChange={setPage}
        />
      )}

      <Modal
        open={showEditor}
        onClose={closeEditor}
        title={editingOverride ? "Edit Overrides" : "Create Overrides"}
        width="var(--sp-override-editor-modal-width)"
        maxWidth="var(--sp-override-editor-modal-max-width)"
        maxHeight="var(--sp-override-editor-modal-max-height)"
        footer={
          <>
            <Button
              buttonType={ButtonType.SECONDARY}
              size={ButtonSize.MEDIUM}
              text="Cancel"
              onClick={closeEditor}
            />
            <Button
              buttonType={ButtonType.PRIMARY}
              size={ButtonSize.MEDIUM}
              text={
                saveMutation.loading
                  ? editingOverride
                    ? "Saving..."
                    : "Creating..."
                  : editingOverride
                    ? "Save"
                    : "Create"
              }
              onClick={handleSave}
              disabled={saveDisabled}
              loading={saveMutation.loading}
            />
          </>
        }
      >
        {editingOverride ? (
          <div style={{ display: "grid", gap: 24 }}>
            {editorContext && <FixedScopeSection scope={editorContext} />}
            <FormField label="Description">
              <textarea
                style={{ ...inputStyle, minHeight: 136, resize: "vertical" }}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Enter a description"
              />
            </FormField>
            <FormField label="Reason for Change" required error={reasonError}>
              <textarea
                style={{ ...inputStyle, minHeight: 136, resize: "vertical" }}
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Enter a reason for this change"
              />
            </FormField>
            <StructuredContextOverrideForm
              contextEntries={contextEntries}
              overrideEntries={overrideEntries}
              dimensions={dimensionOptions}
              defaultConfigs={defaultConfigOptions}
              lockedScope={editorContext}
              lockedKeys={editorLockedKeys}
              showContextFields={false}
              showOverrideFields
              showLockedScope={false}
              showValidationErrors={formSubmitted}
              canAddContext={canSave}
              canRemoveContext={canSave}
              canAddOverride={canSave}
              canRemoveOverride={canSave}
              variant="modal"
              onAddContextKey={addContextKey}
              onUpdateContextEntry={updateContextEntry}
              onRemoveContextKey={removeContextKey}
              onAddOverrideKey={(key) => {
                const configItem = defaultConfigOptions.find((item) => item.key === key);
                if (!configItem) return;
                setOverrideEntries((current) => [
                  ...current,
                  defaultEntryFromSchema(key, configItem.schema),
                ]);
              }}
              onUpdateOverrideEntry={updateOverrideEntry}
              onRemoveOverrideKey={(key) =>
                setOverrideEntries((current) =>
                  current.filter((entry) => entry.key !== key),
                )
              }
            />
            {formSubmitted && parsedOverride.error && (
              <InlineNotice
                title="Override values need attention"
                description={parsedOverride.error}
                tone="danger"
              />
            )}
            {saveMutation.error && (
              <InlineNotice
                title="Could not save override"
                description={saveMutation.error}
                tone="danger"
              />
            )}
          </div>
        ) : (
          <>
            <StructuredContextOverrideForm
              contextEntries={contextEntries}
              overrideEntries={overrideEntries}
              dimensions={dimensionOptions}
              defaultConfigs={defaultConfigOptions}
              lockedScope={undefined}
              lockedKeys={[]}
              showLockedScope={false}
              showContextFields={showCreateContextFields}
              showOverrideFields={false}
              showValidationErrors={formSubmitted}
              canAddContext={canCreate}
              canRemoveContext={canCreate}
              canAddOverride={canCreate}
              canRemoveOverride={canCreate}
              onAddContextKey={addContextKey}
              onUpdateContextEntry={updateContextEntry}
              onRemoveContextKey={removeContextKey}
              onAddOverrideKey={(key) => {
                const configItem = defaultConfigOptions.find((item) => item.key === key);
                if (!configItem) return;
                setOverrideEntries((current) => [
                  ...current,
                  defaultEntryFromSchema(key, configItem.schema),
                ]);
              }}
              onUpdateOverrideEntry={updateOverrideEntry}
              onRemoveOverrideKey={(key) =>
                setOverrideEntries((current) =>
                  current.filter((entry) => entry.key !== key),
                )
              }
            />
            <div style={{ paddingTop: "var(--sp-space-sm)" }}>
              <FormField label="Description">
                <textarea
                  style={{ ...inputStyle, minHeight: 82, resize: "vertical" }}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Enter a description"
                />
              </FormField>
            </div>
            <FormField label="Reason for Change" required error={reasonError}>
              <textarea
                style={{ ...inputStyle, minHeight: 82, resize: "vertical" }}
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Enter a reason for this change"
              />
            </FormField>
            <StructuredContextOverrideForm
              contextEntries={contextEntries}
              overrideEntries={overrideEntries}
              dimensions={dimensionOptions}
              defaultConfigs={defaultConfigOptions}
              lockedScope={undefined}
              lockedKeys={[]}
              showContextFields={false}
              showOverrideFields
              showLockedScope={false}
              showValidationErrors={formSubmitted}
              canAddContext={canSave}
              canRemoveContext={canSave}
              canAddOverride={canSave}
              canRemoveOverride={canSave}
              onAddContextKey={addContextKey}
              onUpdateContextEntry={updateContextEntry}
              onRemoveContextKey={removeContextKey}
              onAddOverrideKey={(key) => {
                const configItem = defaultConfigOptions.find((item) => item.key === key);
                if (!configItem) return;
                setOverrideEntries((current) => [
                  ...current,
                  defaultEntryFromSchema(key, configItem.schema),
                ]);
              }}
              onUpdateOverrideEntry={updateOverrideEntry}
              onRemoveOverrideKey={(key) =>
                setOverrideEntries((current) =>
                  current.filter((entry) => entry.key !== key),
                )
              }
            />
            {saveMutation.error && (
              <div style={{ paddingTop: "var(--sp-space-md)" }}>
                <InlineNotice
                  title="Could not save override"
                  description={saveMutation.error}
                  tone="danger"
                />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

export function OverrideManager(props: OverrideManagerProps) {
  const { config } = useSuperposition();

  if (!isFeatureEnabled(config.features, "overrides")) {
    return (
      <FeatureUnavailable
        feature="Overrides"
        message={getMessage(
          config,
          "feature.disabled",
          "{feature} is not enabled for this embed.",
          { feature: "Overrides" },
        )}
      />
    );
  }

  return <OverrideManagerContent {...props} />;
}
