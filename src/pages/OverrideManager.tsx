import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  ButtonSize,
  ButtonSubType,
  ButtonType,
} from "@juspay/blend-design-system";
import type { FieldEntryState } from "../components";
import {
  buttonPrimary,
  buttonSecondary,
  ConditionBadges,
  defaultEntryFromSchema,
  EmptyState,
  FormField,
  inputStyle,
  Modal,
  Pagination,
  SearchField,
  StructuredContextOverrideForm,
  Tooltip,
} from "../components";
import { useApi, useMutation } from "../hooks/useApi";
import { useAlerts } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { ContextOverride, JsonValue, PutContextRequest } from "../types";
import {
  filterRecordByPrefix,
  matchesPrefix,
  mergeScopedContext,
  normalizeFilterValues,
  paginateRows,
} from "../utils";
import { contextCanBeEditedInScope } from "../utils/context-filter";
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

function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-color-primary)", flex: "0 0 auto" }}
    >
      <path
        d="M3.4 4.9c-.4-.5 0-1.2.6-1.2h12c.6 0 1 .7.6 1.2L12 10.5v4.1c0 .3-.2.6-.4.7l-2.4 1.2c-.5.2-1-.1-1-.7v-5.3L3.4 4.9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
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
        border: "1px solid color-mix(in oklab, var(--sp-color-primary) 16%, var(--sp-color-border))",
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
        justifyContent: "center",
        verticalAlign: "middle",
        boxSizing: "border-box",
        maxWidth: "100%",
        height: 28,
        padding: "0 10px",
        border: "1px solid var(--sp-feedback-success-border)",
        borderRadius: "var(--sp-inline-radius)",
        background: "var(--sp-feedback-success-bg)",
        color: "var(--sp-feedback-success-text)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.82rem",
        fontWeight: 650,
        lineHeight: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
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

function formatErrorMessage(error: string): string {
  const apiError = error.match(/^API error (\d+) for .*:\s*(.*)$/);
  if (!apiError) return error;

  const [, status, detail] = apiError;
  return detail ? `API error ${status}. ${detail}` : `API error ${status}.`;
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
  maxVisible = 3,
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
  const shouldClipSummary = entries.length > 1 || remaining > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "nowrap",
        gap: 4,
        minWidth: 0,
        overflow: shouldClipSummary ? "hidden" : "visible",
      }}
    >
      {visibleEntries.map(([key, value], index) => (
        <div
          key={key}
          style={{
            display: "contents",
          }}
        >
          {index > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: "var(--sp-color-muted)",
                fontSize: "0.72rem",
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "0.02em",
                padding: "0 2px",
                flex: "0 0 auto",
              }}
            >
              AND
            </span>
          )}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 28,
              maxWidth: shouldClipSummary ? "min(100%, 320px)" : "fit-content",
              padding: "1px 9px",
              border: "1px solid color-mix(in oklab, var(--sp-color-primary) 12%, var(--sp-color-border))",
              borderRadius: "var(--sp-inline-radius)",
              background: "color-mix(in oklab, var(--sp-color-primary) 6%, var(--sp-color-panel))",
              color: "var(--sp-color-text)",
              fontSize: "0.8rem",
              fontWeight: 700,
              lineHeight: 1.2,
              flex: shouldClipSummary ? "0 1 auto" : "0 0 auto",
            }}
          >
            <span style={{ color: "var(--sp-color-text)", fontWeight: 750 }}>
              {key}
            </span>
            <span style={{ color: "var(--sp-color-muted)", fontWeight: 800 }}>=</span>
            <span
              style={{
                minWidth: 0,
                overflow: shouldClipSummary ? "hidden" : "visible",
                textOverflow: shouldClipSummary ? "ellipsis" : "clip",
                whiteSpace: "nowrap",
                fontWeight: 550,
              }}
            >
              {jsonCellValue(value)}
            </span>
          </span>
        </div>
      ))}
      {remaining > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 24,
            padding: "0 8px",
            borderRadius: "var(--sp-inline-radius)",
            background: "color-mix(in oklab, var(--sp-color-primary) 8%, var(--sp-color-panel))",
            color: "var(--sp-color-primary)",
            fontSize: "0.76rem",
            fontWeight: 800,
            lineHeight: 1,
            flex: "0 0 auto",
          }}
        >
          +{remaining} more
        </span>
      )}
    </div>
  );
}

function ReadOnlyConditionRows({ entries }: { entries: Array<[string, JsonValue]> }) {
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
          gap: "var(--sp-space-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
            gap: "var(--sp-space-sm)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            minWidth: 80,
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--sp-color-muted)",
            fontSize: "0.82rem",
            fontWeight: 800,
          }}
        >
          Logic
          <InfoIcon />
        </div>
        <div style={{ ...readOnlyControlStyle, minWidth: 160 }}>AND</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
              minWidth: 560,
              gap: 10,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(140px, 1fr) minmax(120px, 0.75fr) minmax(180px, 2fr)",
                gap: 10,
              color: "var(--sp-color-muted)",
                fontSize: "0.8rem",
              fontWeight: 800,
            }}
          >
            <div>Field</div>
            <div>Operator</div>
            <div>Value</div>
          </div>
          {entries.map(([key, value]) => (
            <div
              key={key}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px, 1fr) minmax(120px, 0.75fr) minmax(180px, 2fr)",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={readOnlyControlStyle}>{key}</div>
              <div style={readOnlyControlStyle}>==</div>
              <div style={{ ...readOnlyControlStyle, wordBreak: "break-word" }}>
                {jsonCellValue(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const readOnlyControlStyle: React.CSSProperties = {
  minHeight: 36,
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
  border: "1px solid var(--sp-color-border)",
  borderRadius: "var(--sp-control-radius)",
  background: "var(--sp-color-panel)",
  color: "var(--sp-color-text)",
  fontSize: "0.88rem",
  fontWeight: 500,
  boxShadow: "0 1px 0 color-mix(in oklab, var(--sp-color-text) 3%, transparent)",
};

function OverrideValuesTable({ entries }: { entries: Array<[string, JsonValue]> }) {
  const rowPadding = entries.length === 1 ? "6px 12px" : "8px 12px";

  return (
    <div
      style={{
        overflowX: "auto",
        paddingTop: 0,
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: 460,
          borderCollapse: "separate",
          borderSpacing: 0,
          tableLayout: "fixed",
          color: "var(--sp-color-text)",
        }}
      >
        <colgroup>
          <col style={{ width: 56 }} />
          <col style={{ width: "44%" }} />
          <col style={{ width: "56%" }} />
        </colgroup>
        <thead>
          <tr>
            <th
              aria-label="Index"
              style={{
                padding: "6px 12px",
                borderBottom: "1px solid var(--sp-color-border)",
              }}
            />
            <th
              style={{
                textAlign: "left",
                padding: "6px 12px",
                borderBottom: "1px solid var(--sp-color-border)",
                fontSize: "0.8rem",
                fontWeight: 800,
                color: "var(--sp-color-muted)",
              }}
            >
              Key
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "6px 12px",
                borderBottom: "1px solid var(--sp-color-border)",
                boxShadow:
                  "-10px 0 16px -16px color-mix(in oklab, var(--sp-color-text) 54%, transparent)",
                fontSize: "0.8rem",
                fontWeight: 800,
                color: "var(--sp-color-muted)",
              }}
            >
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value], index) => (
            <tr key={key}>
              <td
                style={{
                  padding: rowPadding,
                  borderBottom: "1px solid var(--sp-color-border)",
                  color: "var(--sp-color-muted)",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  verticalAlign: "middle",
                }}
              >
                {index + 1}
              </td>
              <td
                style={{
                  padding: rowPadding,
                  borderBottom: "1px solid var(--sp-color-border)",
                  fontSize: "0.86rem",
                  fontWeight: 600,
                  verticalAlign: "middle",
                }}
              >
                <OverrideKeyPill value={key} />
              </td>
              <td
                style={{
                  padding: rowPadding,
                  borderBottom: "1px solid var(--sp-color-border)",
                  boxShadow:
                    "-10px 0 16px -16px color-mix(in oklab, var(--sp-color-text) 54%, transparent)",
                  fontSize: "0.86rem",
                  fontWeight: 500,
                  wordBreak: "break-word",
                    verticalAlign: "middle",
                }}
              >
                <OverrideValuePill value={value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-card-radius)",
        background: "var(--sp-color-panel)",
        boxShadow: "var(--sp-shadow-sm)",
        display: "grid",
        gap: 2,
        overflow: "hidden",
        padding: "10px 14px",
        transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "36px minmax(0, 1fr)",
            alignItems: "center",
            columnGap: 10,
            minWidth: 0,
            flex: "1 1 auto",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--sp-control-radius)",
              background:
                "color-mix(in oklab, var(--sp-color-primary) 8%, var(--sp-color-panel))",
              flex: "0 0 auto",
            }}
          >
            <FilterIcon />
          </div>
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
                flexWrap: "wrap",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--sp-color-text)",
                  fontSize: "0.98rem",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  flex: "0 0 auto",
                }}
              >
                Condition
              </h3>
              {expanded ? (
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <ConditionSummary entries={conditionEntries} />
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={`Expand conditions for ${row.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minWidth: 0,
                    maxWidth: "100%",
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    flex: "0 1 auto",
                  }}
                  onClick={() => setExpanded(true)}
                >
                  <ConditionSummary entries={conditionEntries} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            flex: "0 0 auto",
          }}
        >
            <Tooltip content="View change information">
              <button
                type="button"
                className="sp-button sp-button-secondary"
                aria-label={`View change information for ${row.id}`}
                style={{
                  ...buttonSecondary,
                  width: 32,
                  height: 32,
                  minHeight: 32,
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--sp-control-radius)",
                  borderColor: "var(--sp-color-border)",
                  background: "var(--sp-color-panel)",
                  boxShadow: "none",
                  cursor: "pointer",
                  transition: "background 180ms ease, border-color 180ms ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChangeInfo(true);
                }}
              >
                <ChangeInfoIcon />
              </button>
            </Tooltip>
          {expanded ? (
            <button
              type="button"
              aria-label={`Collapse conditions for ${row.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                  minHeight: 32,
                padding: "0 8px",
                border: 0,
                background: "transparent",
                color: "var(--sp-color-primary)",
                cursor: "pointer",
                  fontSize: "0.82rem",
                fontWeight: 800,
              }}
              onClick={() => setExpanded(false)}
            >
              Collapse
              <ChevronUpIcon />
            </button>
          ) : (
            canEdit &&
            canEditRow && (
              <Tooltip content="Edit override">
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
                />
              </Tooltip>
            )
          )}
        </div>
      </div>

      {expanded && (
        <section
          aria-label={`Expanded conditions for ${row.id}`}
          style={{
            padding: "2px 0 0",
          }}
        >
          <ReadOnlyConditionRows entries={conditionEntries} />
        </section>
      )}

      <OverrideValuesTable entries={overrideEntries} />
      <Modal
        open={showChangeInfo}
        onClose={() => setShowChangeInfo(false)}
        title="Change Information"
        width="min(900px, calc(100vw - 32px))"
        maxWidth="900px"
        maxHeight="min(86vh, 860px)"
        footer={
          <button
            type="button"
            className="sp-button sp-button-secondary"
            style={{
              ...buttonSecondary,
              minHeight: 42,
              padding: "0 18px",
              borderRadius: "var(--sp-control-radius)",
              fontWeight: 750,
            }}
            onClick={() => setShowChangeInfo(false)}
          >
            Close
          </button>
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
  pageSize = 20,
  defaultConfigPrefix,
}: OverrideManagerProps) {
  const { overrides, config, scope, defaultConfigs, dimensions } = useSuperposition();
  const { addAlert } = useAlerts();
  const [page, setPage] = useState(1);
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
  const canEditContext = config.capabilities?.overrides?.editContext === true;
  const canCreate = canUseFeatureAction(config, "overrides", "create");
  const canEdit = canUseFeatureAction(config, "overrides", "update");
  const lockDimensions = config.scope?.locked !== false;
  const lockedDims = lockDimensions ? scope.lockedDimensions : [];
  const defaultConfigPrefixes = useMemo(
    () =>
      normalizeFilterValues(defaultConfigPrefix ?? config.filters?.defaultConfigPrefix),
    [config.filters?.defaultConfigPrefix, defaultConfigPrefix],
  );
  const dimensionMatchStrategy = hasScopedContext
    ? config.strict === true
      ? "exact"
      : "subset"
    : undefined;

  const { data, loading, error, refetch } = useApi(
    () =>
      overrides.list(
        { page, count: pageSize },
        {
          plaintext: search || undefined,
          prefix: defaultConfigPrefixes,
          dimension: scopedContext,
          dimension_match_strategy: dimensionMatchStrategy,
        },
      ),
    [
      defaultConfigPrefixes,
      dimensionMatchStrategy,
      overrides,
      page,
      pageSize,
      scopedContext,
      search,
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
      .filter((row): row is ContextOverride => Boolean(row));
  }, [data, defaultConfigPrefixes]);

  const shouldClientPage = Boolean(data && filteredData.length > pageSize);
  const totalPages = shouldClientPage
    ? Math.ceil(filteredData.length / pageSize)
    : (data?.total_pages ?? 0);
  const rows = shouldClientPage
    ? paginateRows(filteredData, page, pageSize)
    : filteredData;

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

  const openCreateModal = useCallback(() => {
    setEditingOverride(null);
    setContextEntries([]);
    setOverrideEntries([]);
    setNewDesc("");
    setNewReason("");
    setFormSubmitted(false);
    setShowEditor(true);
  }, []);

  const contextCanBeMutated = useCallback(
    (context: OverrideContext) => {
      if (scopedContext) {
        return contextCanBeEditedInScope(context, scopedContext);
      }

      return canEdit;
    },
    [canEdit, scopedContext],
  );

  const openEditModal = useCallback(
    (row: ContextOverride) => {
      if (!contextCanBeMutated(row.value)) {
        addAlert(
          "warning",
          "This override cannot be edited from the current scoped view.",
        );
        return;
      }

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
    [addAlert, contextCanBeMutated, defaultConfigByKey],
  );

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditingOverride(null);
    setContextEntries([]);
    setOverrideEntries([]);
    setNewDesc("");
    setNewReason("");
    setFormSubmitted(false);
  }, []);

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
  const showCreateContextFields =
    !editingOverride && (!hasScopedContext || canEditContext);
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
  }, [contextEntries, contextObject, editingOverride, requiresContextEntries]);

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

  const saveMutation = useMutation(
    useCallback(
      async (req: PutContextRequest) => {
        return editingOverride ? overrides.update(req) : overrides.create(req);
      },
      [editingOverride, overrides],
    ),
  );

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
      const context =
        editingOverride?.value ??
        mergeScopedContext(parsedContext.value ?? {}, scopedContext);
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
    } catch {
      addAlert(
        "error",
        saveMutation.error ||
        (editingOverride ? "Failed to update override" : "Failed to create override"),
      );
    }
  };

  const hasRows = rows.length > 0;
  const trimmedSearch = search.trim();
  const canSave = editingOverride ? canEdit : canCreate;
  const reasonError =
    formSubmitted && !newReason.trim() ? "Enter a reason for this change." : undefined;
  const saveDisabled = !canSave || saveMutation.loading;
  const editorContext = editingOverride?.value ?? scopedContext;
  const editorLockedKeys = editorContext ? Object.keys(editorContext) : [];
  const showSearch = hasRows || Boolean(trimmedSearch);
  const renderCreateOverrideAction = () =>
    canCreate ? (
      <button
        className="sp-button sp-button-primary sp-create-override-button"
        style={{
          ...buttonPrimary,
          minHeight: 42,
          padding: "0 18px",
          borderColor:
            "color-mix(in oklab, var(--sp-color-primary) 76%, var(--sp-color-border))",
        }}
        onClick={openCreateModal}
      >
        {getMessage(config, "overrides.create", "Create override")}
      </button>
    ) : undefined;
  const emptyTitle = trimmedSearch ? "No matching overrides" : "No overrides found";
  const emptyDescription = trimmedSearch
    ? "Try a different search term or clear the search field."
    : hasScopedContext
      ? "This scoped context does not have any overrides yet."
      : "Create an override to customize config values for a context.";
  const emptyAction = trimmedSearch ? (
    <button style={buttonSecondary} onClick={() => setSearch("")}>
      Clear search
    </button>
  ) : undefined;
  const errorDescription = error ? formatErrorMessage(error) : undefined;

  return (
    <div style={{ display: "grid", gap: "var(--sp-space-lg)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: "var(--sp-page-title-margin)",
            fontSize: "var(--sp-page-title-font-size)",
            lineHeight: 1.12,
            fontWeight: "var(--sp-page-title-font-weight)",
            color: "var(--sp-page-title-text)",
          }}
        >
          Overrides
        </h2>
        {renderCreateOverrideAction()}
      </div>

      {(!canCreate || hasScopedContext) && (
        <div style={{ display: "grid", gap: 10 }}>
          {!canCreate && (config.readOnly || hasScopedContext) && (
            <div
              style={{
                padding: "var(--sp-banner-padding)",
                borderRadius: "var(--sp-banner-radius)",
                background: "var(--sp-banner-bg)",
                border: "1px solid var(--sp-banner-border)",
                color: "var(--sp-banner-text)",
                fontSize: "var(--sp-banner-font-size)",
                fontWeight: "var(--sp-banner-font-weight)",
              }}
            >
              {getMessage(config, "common.readOnly", "Read-only mode")}
            </div>
          )}
          {hasScopedContext && scopedContext && (
            <div
              style={{
                padding: "var(--sp-banner-padding)",
                borderRadius: "var(--sp-banner-radius)",
                background: "var(--sp-banner-bg)",
                border: "1px solid var(--sp-banner-border)",
                color: "var(--sp-banner-text)",
                fontSize: "var(--sp-banner-font-size)",
                fontWeight: "var(--sp-banner-font-weight)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {getMessage(config, "common.fixedScope", "Fixed Scope")}
              </div>
              <ConditionBadges condition={scopedContext} lockedKeys={lockedDims} />
            </div>
          )}
        </div>
      )}

      {showSearch && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
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
      )}

      {error && hasRows && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "var(--sp-inline-radius)",
            background: "var(--sp-feedback-danger-bg)",
            border: "1px solid var(--sp-feedback-danger-border)",
            color: "var(--sp-feedback-danger-text)",
            fontSize: 13,
          }}
        >
          Failed to load overrides: {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: "calc(var(--sp-space-lg) * 2)",
            textAlign: "center",
            color: "var(--sp-color-muted)",
            border: "1px solid var(--sp-color-border)",
            borderRadius: "var(--sp-card-radius)",
            background: "var(--sp-color-panel)",
          }}
        >
          Loading...
        </div>
      ) : error ? (
        <EmptyState
          title="Could not load overrides"
          description={errorDescription}
          tone="danger"
          minHeight="var(--sp-table-empty-min-height)"
        />
      ) : hasRows ? (
        <div style={{ display: "grid", gap: "var(--sp-space-md)" }}>
          {rows.map((row) => (
            <OverrideCard
              key={row.id}
              row={row}
              canEdit={canEdit}
              canEditRow={contextCanBeMutated(row.value)}
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

      {data && hasRows && totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Modal
        open={showEditor}
        onClose={closeEditor}
        title={editingOverride ? "Edit Overrides" : "Create Overrides"}
        footer={
          <>
            <button style={buttonSecondary} onClick={closeEditor}>
              Cancel
            </button>
            <button
              className="sp-button sp-button-primary"
              style={buttonPrimary}
              onClick={handleSave}
              disabled={saveDisabled}
            >
              {saveMutation.loading
                ? editingOverride
                  ? "Saving..."
                  : "Creating..."
                : editingOverride
                  ? "Save"
                  : "Create"}
            </button>
          </>
        }
      >
        <StructuredContextOverrideForm
          contextEntries={contextEntries}
          overrideEntries={overrideEntries}
          dimensions={dimensionOptions}
          defaultConfigs={defaultConfigOptions}
          lockedScope={editorContext}
          lockedKeys={editingOverride ? editorLockedKeys : lockedDims}
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
            setOverrideEntries((current) => current.filter((entry) => entry.key !== key))
          }
        />
        {formSubmitted && parsedContext.error && (
          <div
            style={{
              marginTop: -6,
              padding: "10px 12px",
              borderRadius: "var(--sp-inline-radius)",
              background: "var(--sp-feedback-danger-bg)",
              border: "1px solid var(--sp-feedback-danger-border)",
              color: "var(--sp-feedback-danger-text)",
              fontSize: 13,
            }}
          >
            {parsedContext.error}
          </div>
        )}
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
          lockedScope={editorContext}
          lockedKeys={editingOverride ? editorLockedKeys : lockedDims}
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
            setOverrideEntries((current) => current.filter((entry) => entry.key !== key))
          }
        />
        {formSubmitted && parsedOverride.error && (
          <div
            style={{
              marginTop: -6,
              padding: "10px 12px",
              borderRadius: "var(--sp-inline-radius)",
              background: "var(--sp-feedback-danger-bg)",
              border: "1px solid var(--sp-feedback-danger-border)",
              color: "var(--sp-feedback-danger-text)",
              fontSize: 13,
            }}
          >
            {parsedOverride.error}
          </div>
        )}
        {saveMutation.error && (
          <div
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: "var(--sp-inline-radius)",
              background: "var(--sp-feedback-danger-bg)",
              border: "1px solid var(--sp-feedback-danger-border)",
              color: "var(--sp-feedback-danger-text)",
              fontSize: 13,
            }}
          >
            {saveMutation.error}
          </div>
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
