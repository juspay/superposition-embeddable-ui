import type { CSSProperties } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Download,
  FileJson,
} from "lucide-react";
import {
  buttonSecondary,
  Modal,
  Pagination,
  resolveTableSerialNumberProps,
  SearchField,
} from "../components";
import { useApi } from "../hooks/useApi";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { AuditAction, AuditLog, JsonValue } from "../types";
import { paginateRows } from "../utils";
import {
  FeatureUnavailable,
  getMessage,
  isFeatureEnabled,
} from "./FeatureGate";

export interface AuditTrailProps {
  pageSize?: number;
}

type AuditDataSelection = {
  title: string;
  value: unknown;
};

type AuditDateRange = {
  startDate: Date;
  endDate?: Date;
};

type AuditSelectItem = {
  label: string;
  value: string;
};

const actionPillStyles: Record<string, CSSProperties> = {
  INSERT: {
    background: "#ECFDF3",
    border: "1px solid #ABEFC6",
    color: "#067647",
  },
  UPDATE: {
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
    color: "#2563EB",
  },
  DELETE: {
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#DC2626",
  },
};

const tableHeaderStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--sp-color-border)",
  background: "var(--sp-table-header-bg)",
  color: "var(--sp-color-muted)",
  fontSize: "0.76rem",
  fontWeight: 700,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tableCellStyle: CSSProperties = {
  height: 58,
  padding: "7px 12px",
  borderBottom: "1px solid var(--sp-color-border)",
  color: "var(--sp-color-text)",
  fontSize: "0.84rem",
  fontWeight: 450,
  verticalAlign: "middle",
};

const compactIconButtonStyle: CSSProperties = {
  ...buttonSecondary,
  minHeight: 36,
  minWidth: 36,
  width: 36,
  height: 36,
  padding: 0,
  borderRadius: "var(--sp-control-radius)",
  background: "var(--sp-color-panel)",
  boxShadow: "none",
};

function formatTimestampParts(value: AuditLog["timestamp"]): {
  date: string;
  time: string;
} {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: String(value), time: "" };
  }

  return {
    date: parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

function formatErrorMessage(error: string): string {
  const apiError = error.match(/^API error (\d+) for .*:\s*(.*)$/);
  if (!apiError) return error;

  const [, status, detail] = apiError;
  return detail ? `API error ${status}. ${detail}` : `API error ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonValueEquals(left: unknown, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function documentContainsScope(value: unknown, scope: Record<string, JsonValue>): boolean {
  if (!scope || Object.keys(scope).length === 0) {
    return true;
  }

  if (isRecord(value)) {
    const directMatch = Object.entries(scope).every(([key, expected]) => {
      if (!(key in value)) return false;
      return jsonValueEquals(value[key], expected);
    });

    if (directMatch) {
      return true;
    }

    return Object.values(value).some((nested) => documentContainsScope(nested, scope));
  }

  if (Array.isArray(value)) {
    return value.some((nested) => documentContainsScope(nested, scope));
  }

  return false;
}

function auditLogMatchesScope(log: AuditLog, scope: Record<string, JsonValue>): boolean {
  return (
    documentContainsScope(log.original_data, scope) ||
    documentContainsScope(log.new_data, scope)
  );
}

function formatJson(value: unknown): string {
  if (value === undefined) return "Not Present";
  if (value === null) return "null";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getJsonStats(value: unknown): { bytes: string; lines: number; text: string } {
  const text = formatJson(value);
  const bytes =
    typeof TextEncoder === "function"
      ? new TextEncoder().encode(text).length
      : text.length;

  return {
    bytes: formatBytes(bytes),
    lines: text.split("\n").length,
    text,
  };
}

function formatInputDate(date?: Date): string {
  if (!date || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string): Date | undefined {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDateRangeLabel(value?: AuditDateRange): string {
  if (!value?.startDate) return "Date range";

  const format = (date: Date) =>
    date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return value.endDate
    ? `${format(value.startDate)} - ${format(value.endDate)}`
    : format(value.startDate);
}

function BlendFilterSelect({
  ariaLabel,
  selected,
  items,
  onSelect,
  width,
}: {
  ariaLabel: string;
  selected: string;
  items: AuditSelectItem[];
  onSelect: (value: string) => void;
  width: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel = items.find((item) => item.value === selected)?.label ?? selected;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="sp-audit-filter-select"
      aria-label={ariaLabel}
      style={{ position: "relative", width }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "100%",
          minHeight: 38,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "0 12px",
          border: "1px solid var(--sp-control-border)",
          borderRadius: "var(--sp-control-radius)",
          background: "var(--sp-control-bg)",
          color: "var(--sp-control-text)",
          cursor: "pointer",
          boxShadow: "var(--sp-search-shadow)",
          fontSize: 14,
          fontWeight: 650,
          lineHeight: 1,
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLabel}
        </span>
        <ChevronDown aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            width: "max-content",
            minWidth: width,
            maxWidth: 320,
            maxHeight: 260,
            overflowY: "auto",
            padding: 4,
            border: "1px solid var(--sp-dropdown-menu-border)",
            borderRadius: "var(--sp-control-radius)",
            background: "var(--sp-dropdown-menu-bg)",
            boxShadow: "var(--sp-dropdown-menu-shadow)",
          }}
        >
          {items.map((item) => {
            const active = item.value === selected;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={active}
                style={{
                  width: "100%",
                  minHeight: 34,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 10px",
                  border: 0,
                  borderRadius: "var(--sp-inline-radius)",
                  background: active
                    ? "var(--sp-dropdown-option-selected-bg)"
                    : "transparent",
                  color: active
                    ? "var(--sp-dropdown-option-selected-text)"
                    : "var(--sp-control-text)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.86rem",
                  fontWeight: active ? 800 : 650,
                  whiteSpace: "nowrap",
                }}
                onClick={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
                onMouseEnter={(event) => {
                  if (!active) {
                    event.currentTarget.style.background =
                      "var(--sp-dropdown-option-hover-bg)";
                  }
                }}
                onMouseLeave={(event) => {
                  if (!active) {
                    event.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function BlendAuditDateRange({
  value,
  onChange,
}: {
  value?: AuditDateRange;
  onChange: (range?: AuditDateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(formatInputDate(value?.startDate));
  const [draftEnd, setDraftEnd] = useState(formatInputDate(value?.endDate));
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftStart(formatInputDate(value?.startDate));
    setDraftEnd(formatInputDate(value?.endDate));
  }, [value]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const applyRange = () => {
    const startDate = parseInputDate(draftStart);
    const endDate = parseInputDate(draftEnd);
    if (!startDate) {
      onChange(undefined);
      setOpen(false);
      return;
    }

    onChange({ startDate, endDate });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="sp-audit-date-range" style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          minHeight: 38,
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          padding: "0 12px",
          border: "1px solid var(--sp-control-border)",
          borderRadius: "var(--sp-control-radius)",
          background: "var(--sp-control-bg)",
          color: value ? "var(--sp-control-text)" : "var(--sp-color-muted)",
          cursor: "pointer",
          boxShadow: "var(--sp-search-shadow)",
          fontSize: 14,
          fontWeight: 650,
          lineHeight: 1,
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarDays aria-hidden="true" size={16} strokeWidth={2} />
        {formatDateRangeLabel(value)}
        <ChevronDown aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      {value ? (
        <button
          type="button"
          aria-label="Clear date range"
          className="sp-audit-date-range__clear"
          onClick={() => onChange(undefined)}
        >
          Clear
        </button>
      ) : null}
      {open ? (
        <div
          role="dialog"
          aria-label="Date range filter"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            width: 300,
            display: "grid",
            gap: 12,
            padding: 14,
            border: "1px solid var(--sp-dropdown-menu-border)",
            borderRadius: "var(--sp-control-radius)",
            background: "var(--sp-dropdown-menu-bg)",
            boxShadow: "var(--sp-dropdown-menu-shadow)",
          }}
        >
          <label style={{ display: "grid", gap: 6, color: "var(--sp-color-text)" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 800 }}>From</span>
            <input
              type="date"
              value={draftStart}
              onChange={(event) => setDraftStart(event.target.value)}
              style={{
                minHeight: 36,
                padding: "0 10px",
                border: "1px solid var(--sp-control-border)",
                borderRadius: "var(--sp-inline-radius)",
                background: "var(--sp-control-bg)",
                color: "var(--sp-control-text)",
                fontSize: "0.86rem",
                fontWeight: 650,
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, color: "var(--sp-color-text)" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 800 }}>To</span>
            <input
              type="date"
              value={draftEnd}
              onChange={(event) => setDraftEnd(event.target.value)}
              style={{
                minHeight: 36,
                padding: "0 10px",
                border: "1px solid var(--sp-control-border)",
                borderRadius: "var(--sp-inline-radius)",
                background: "var(--sp-control-bg)",
                color: "var(--sp-control-text)",
                fontSize: "0.86rem",
                fontWeight: 650,
              }}
            />
          </label>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              paddingTop: 2,
            }}
          >
            <button
              type="button"
              className="sp-button sp-button-secondary"
              style={{ ...buttonSecondary, minHeight: 34, padding: "0 12px" }}
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="sp-button sp-button-secondary"
              style={{
                ...buttonSecondary,
                minHeight: 34,
                padding: "0 12px",
                borderColor:
                  "color-mix(in oklab, var(--sp-color-primary) 42%, var(--sp-color-border))",
                color: "var(--sp-color-primary)",
              }}
              onClick={applyRange}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionPill({ action }: { action: AuditAction }) {
  const normalizedAction = String(action).trim().toUpperCase();
  const style = actionPillStyles[normalizedAction] ?? actionPillStyles.UPDATE;

  return (
    <span
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 64,
        padding: "4px 9px",
        borderRadius: "var(--sp-pill-radius)",
        fontSize: "0.7rem",
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {normalizedAction}
    </span>
  );
}

function DataPreviewCard({
  label,
  value,
  onView,
}: {
  label: string;
  value: unknown;
  onView: () => void;
}) {
  if (value === null || value === undefined) {
    return (
      <code
        style={{
          minHeight: 22,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "fit-content",
          minWidth: 0,
          maxWidth: "100%",
          padding: "2px 7px",
          border: "1px solid var(--sp-color-border)",
          borderRadius: "var(--sp-inline-radius)",
          background: "var(--sp-color-surface-muted)",
          color: "var(--sp-color-muted)",
          fontFamily:
            '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
          fontSize: "0.74rem",
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {value === null ? "null" : "Not Present"}
      </code>
    );
  }

  const stats = getJsonStats(value);
  const accent = "var(--sp-color-primary)";

  return (
    <div
      style={{
        minHeight: 42,
        display: "grid",
        gridTemplateColumns: "18px minmax(58px, 1fr) auto",
        alignItems: "center",
        gap: 7,
        width: "min(100%, 220px)",
        maxWidth: 220,
        padding: "6px 8px",
        border: "1px solid color-mix(in oklab, var(--sp-color-primary) 8%, var(--sp-color-border))",
        borderRadius: "var(--sp-control-radius)",
        background: "color-mix(in oklab, var(--sp-color-primary) 5%, var(--sp-color-panel))",
        color: "var(--sp-color-text)",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
        }}
      >
        <FileJson aria-hidden="true" size={16} strokeWidth={2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, lineHeight: 1.15 }}>
          JSON
        </div>
        <div
          style={{
            color: "var(--sp-color-muted)",
            fontSize: "0.7rem",
            fontWeight: 500,
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {stats.bytes} • {stats.lines} lines
        </div>
      </div>
      <button
        type="button"
        aria-label={label}
        style={{
          padding: 0,
          border: 0,
          background: "transparent",
          color: "color-mix(in oklab, var(--sp-color-primary) 70%, var(--sp-color-muted))",
          cursor: "pointer",
          fontSize: "0.72rem",
          fontWeight: 650,
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
        onClick={onView}
      >
        View
      </button>
    </div>
  );
}

function DiffPane({
  title,
  value,
  tone,
  compareAgainst,
}: {
  title: string;
  value: unknown;
  tone: "old" | "new";
  compareAgainst: unknown;
}) {
  const lines = formatJson(value).split("\n").slice(0, 50);
  const otherLines = formatJson(compareAgainst).split("\n");

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--sp-color-border)",
          color: "var(--sp-color-text)",
          fontSize: "0.84rem",
          fontWeight: 800,
        }}
      >
        {title}
      </div>
      <div
        style={{
          maxHeight: 280,
          overflow: "auto",
          fontFamily:
            '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
          fontSize: "0.84rem",
          lineHeight: 1.6,
          background: "var(--sp-color-panel)",
        }}
      >
        {lines.map((line, index) => {
          const changed = line !== otherLines[index];
          const background = changed
            ? tone === "old"
              ? "color-mix(in oklab, var(--sp-color-danger) 14%, var(--sp-color-panel))"
              : "color-mix(in oklab, var(--sp-color-success) 16%, var(--sp-color-panel))"
            : "transparent";

          return (
            <div
              key={`${title}-${index}-${line}`}
              style={{
                display: "grid",
                gridTemplateColumns: "54px minmax(0, 1fr)",
                background,
                color: "var(--sp-color-text)",
              }}
            >
              <span
                style={{
                  padding: "0 12px",
                  color: "var(--sp-color-muted)",
                  textAlign: "right",
                  userSelect: "none",
                }}
              >
                {index + 1}
                {changed ? (tone === "old" ? "-" : "+") : ""}
              </span>
              <span style={{ paddingRight: 12, whiteSpace: "pre" }}>{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InlineDiff({
  log,
}: {
  log: AuditLog;
}) {
  return (
    <div
      style={{
        margin: "0 20px 20px",
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-card-radius)",
        background: "var(--sp-color-panel)",
        boxShadow: "var(--sp-shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid var(--sp-color-border)",
          color: "var(--sp-color-text)",
          fontSize: "0.95rem",
          fontWeight: 800,
        }}
      >
        <span>
          Changes{" "}
          <span style={{ color: "var(--sp-color-muted)", fontWeight: 700 }}>
            Showing first 50 differences
          </span>
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          minWidth: 760,
        }}
      >
        <DiffPane
          title="Original Data"
          value={log.original_data}
          compareAgainst={log.new_data}
          tone="old"
        />
        <div style={{ borderLeft: "1px solid var(--sp-color-border)" }}>
          <DiffPane
            title="New Data"
            value={log.new_data}
            compareAgainst={log.original_data}
            tone="new"
          />
        </div>
      </div>
    </div>
  );
}

function TableNamePill({ name }: { name: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        maxWidth: "none",
        minHeight: 28,
        padding: "0 9px",
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-inline-radius)",
        background: "var(--sp-color-surface-muted)",
        color: "var(--sp-color-text)",
        fontFamily:
          '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
        fontSize: "0.77rem",
        fontWeight: 650,
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

function AuditTrailContent({ pageSize = 10 }: AuditTrailProps) {
  const { config, auditLogs, scope } = useSuperposition();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState<"ALL" | AuditAction>("ALL");
  const [dateRange, setDateRange] = useState<AuditDateRange | undefined>();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<AuditDataSelection | null>(null);
  const scopedContext = scope.effectiveContext;
  const hasScopedContext = Boolean(scopedContext && Object.keys(scopedContext).length > 0);
  const trimmedSearch = search.trim().toLowerCase();
  const shouldClientPage =
    hasScopedContext ||
    Boolean(trimmedSearch) ||
    tableFilter !== "ALL" ||
    actionFilter !== "ALL" ||
    Boolean(dateRange);

  const { data, loading, error } = useApi(
    () =>
      auditLogs.list(
        shouldClientPage ? { all: true } : { page, count: rowsPerPage },
        { sort_by: "desc" },
      ),
    [auditLogs, page, rowsPerPage, shouldClientPage],
  );

  const tableOptions = useMemo(
    () => Array.from(new Set((data?.data ?? []).map((row) => row.table_name))).sort(),
    [data?.data],
  );

  const filteredRows = useMemo(() => {
    const source = data?.data ?? [];
    const scoped = scopedContext
      ? source.filter((row) => auditLogMatchesScope(row, scopedContext))
      : source;

    return scoped.filter((row) => {
      if (tableFilter !== "ALL" && row.table_name !== tableFilter) {
        return false;
      }

      if (actionFilter !== "ALL" && row.action !== actionFilter) {
        return false;
      }

      const timestamp = new Date(row.timestamp).getTime();
      if (dateRange?.startDate) {
        const from = new Date(dateRange.startDate);
        from.setHours(0, 0, 0, 0);
        if (!Number.isNaN(timestamp) && timestamp < from.getTime()) return false;
      }

      if (dateRange?.endDate) {
        const to = new Date(dateRange.endDate);
        to.setHours(23, 59, 59, 999);
        if (!Number.isNaN(timestamp) && timestamp > to.getTime()) return false;
      }

      if (!trimmedSearch) {
        return true;
      }

      return [row.table_name, row.action, row.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(trimmedSearch));
    });
  }, [actionFilter, data?.data, dateRange, scopedContext, tableFilter, trimmedSearch]);

  const rows = shouldClientPage ? paginateRows(filteredRows, page, rowsPerPage) : filteredRows;
  const totalPages = shouldClientPage
    ? Math.ceil(filteredRows.length / rowsPerPage)
    : (data?.total_pages ?? 0);
  const totalItems = shouldClientPage ? filteredRows.length : (data?.total_items ?? rows.length);
  const hasRows = rows.length > 0;
  const serialNumberProps = resolveTableSerialNumberProps(
    config.table,
    (page - 1) * rowsPerPage + 1,
  );
  const serialNumberConfigured = config.table?.serialNumber !== undefined;
  const showSerialNumber = serialNumberConfigured
    ? serialNumberProps.showSerialNumber === true
    : true;
  const serialNumberHeader = serialNumberProps.serialNumberHeader ?? "S.No";
  const serialNumberStart = serialNumberProps.serialNumberStart ?? (page - 1) * rowsPerPage + 1;
  const serialNumberAlign = serialNumberProps.serialNumberAlign ?? "left";
  const columnCount = showSerialNumber ? 6 : 5;

  useEffect(() => {
    setPage(1);
  }, [actionFilter, dateRange, rowsPerPage, search, tableFilter]);

  useEffect(() => {
    if (page > 1 && page > Math.max(1, totalPages)) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  const openData = (title: string, value: unknown) => setSelectedData({ title, value });

  const exportRows = () => {
    if (typeof document === "undefined" || typeof URL === "undefined") return;
    const blob = new Blob([JSON.stringify(filteredRows, null, 2)], {
      type: "application/json",
    });
    const createObjectURL = URL.createObjectURL?.bind(URL);
    const revokeObjectURL = URL.revokeObjectURL?.bind(URL);
    if (!createObjectURL) return;

    const url = createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-trail.json";
    link.click();
    revokeObjectURL?.(url);
  };

  const fromItem = totalItems === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const toItem = Math.min(page * rowsPerPage, totalItems);
  const rowsPerPageOptions = Array.from(new Set([pageSize, 10, 20, 50])).sort(
    (a, b) => a - b,
  );

  return (
    <div style={{ display: "grid", gap: "var(--sp-space-lg)" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h2
          style={{
            margin: "var(--sp-page-title-margin)",
            fontSize: "var(--sp-page-title-font-size)",
            lineHeight: 1.08,
            fontWeight: "var(--sp-page-title-font-weight)",
            color: "var(--sp-page-title-text)",
          }}
        >
          Audit Trail
        </h2>
        <p
          style={{
            margin: 0,
            color: "var(--sp-color-muted)",
            fontSize: "1rem",
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          Track inserts, updates, deletes, and compare changes across configuration tables.
        </p>
      </div>

      <section
        style={{
          display: "grid",
          gap: "var(--sp-space-sm)",
          padding: "20px",
          border: "1px solid var(--sp-color-border)",
          borderRadius: "var(--sp-card-radius)",
          background: "var(--sp-color-panel)",
          boxShadow: "0 8px 24px color-mix(in oklab, var(--sp-color-text) 5%, transparent)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--sp-space-md)",
            flexWrap: "wrap",
          }}
        >
          <div
            style={
              {
                "--sp-search-width": "min(360px, 100%)",
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                flex: "1 1 auto",
              } as CSSProperties
            }
          >
            <SearchField
              ariaLabel="Search audit logs"
              placeholder="Search audit records..."
              value={search}
              onChange={setSearch}
            />
            <BlendFilterSelect
              ariaLabel="Filter by table"
              selected={tableFilter}
              onSelect={setTableFilter}
              width={154}
              items={[
                { label: "All tables", value: "ALL" },
                ...tableOptions.map((tableName) => ({
                  label: tableName,
                  value: tableName,
                })),
              ]}
            />
            <BlendFilterSelect
              ariaLabel="Filter by action"
              selected={actionFilter}
              onSelect={(value) => setActionFilter(value as "ALL" | AuditAction)}
              width={142}
              items={[
                { label: "All actions", value: "ALL" },
                { label: "INSERT", value: "INSERT" },
                { label: "UPDATE", value: "UPDATE" },
                { label: "DELETE", value: "DELETE" },
              ]}
            />
            <BlendAuditDateRange value={dateRange} onChange={setDateRange} />
          </div>
          <button
            type="button"
            className="sp-button sp-button-secondary"
            style={{
              ...buttonSecondary,
              minHeight: 38,
              padding: "0 14px",
              borderRadius: "var(--sp-control-radius)",
              fontWeight: 800,
            }}
            onClick={exportRows}
          >
            <Download aria-hidden="true" size={17} strokeWidth={2.2} />
            Export
          </button>
        </div>

        {error && !loading ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sp-inline-radius)",
              background: "var(--sp-feedback-danger-bg)",
              border: "1px solid var(--sp-feedback-danger-border)",
              color: "var(--sp-feedback-danger-text)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Failed to load audit logs: {formatErrorMessage(error)}
          </div>
        ) : null}

        <div style={{ overflowX: "visible" }}>
          <table
            style={{
              width: "100%",
              minWidth: 0,
              tableLayout: "fixed",
              borderCollapse: "separate",
              borderSpacing: 0,
              color: "var(--sp-color-text)",
            }}
          >
            <thead>
              <tr>
                {showSerialNumber ? (
                  <th
                    style={{
                      ...tableHeaderStyle,
                      width: serialNumberProps.serialNumberWidth ?? "54px",
                      textAlign: serialNumberAlign,
                    }}
                  >
                    {serialNumberHeader}
                  </th>
                ) : null}
                <th style={{ ...tableHeaderStyle, width: "18%" }}>Table Name</th>
                <th style={{ ...tableHeaderStyle, width: "14%" }}>Timestamp</th>
                <th style={{ ...tableHeaderStyle, width: "10%" }}>Action</th>
                <th style={{ ...tableHeaderStyle, width: "25%" }}>Original Data</th>
                <th style={{ ...tableHeaderStyle, width: "28%" }}>New Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount} style={{ ...tableCellStyle, textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              ) : hasRows ? (
                rows.map((row, index) => {
                  const timestamp = formatTimestampParts(row.timestamp);
                  const expanded = expandedLogId === row.id;

                  return (
                    <Fragment key={row.id}>
                      <tr className="sp-audit-row">
                        {showSerialNumber ? (
                          <td style={{ ...tableCellStyle, textAlign: serialNumberAlign }}>
                            {serialNumberStart + index}
                          </td>
                        ) : null}
                        <td style={tableCellStyle}>
                          <TableNamePill name={row.table_name} />
                        </td>
                        <td style={tableCellStyle}>
                          <div style={{ display: "grid", gap: 2 }}>
                            <span style={{ fontWeight: 450 }}>{timestamp.date}</span>
                            {timestamp.time ? (
                              <span
                                style={{
                                  color: "var(--sp-color-muted)",
                                  fontSize: "0.78rem",
                                  fontWeight: 450,
                                }}
                              >
                                {timestamp.time}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td style={tableCellStyle}>
                          <ActionPill action={row.action} />
                        </td>
                        <td style={tableCellStyle}>
                          <DataPreviewCard
                            label="View original"
                            value={row.original_data}
                            onView={() => openData("Original Data", row.original_data)}
                          />
                        </td>
                        <td style={tableCellStyle}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) 36px",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <DataPreviewCard
                              label="View new"
                              value={row.new_data}
                              onView={() => openData("New Data", row.new_data)}
                            />
                            <button
                              type="button"
                              aria-label={`${expanded ? "Collapse" : "Expand"} audit row ${
                                row.id
                              }`}
                              style={compactIconButtonStyle}
                              onClick={() =>
                                setExpandedLogId((current) =>
                                  current === row.id ? null : row.id,
                                )
                              }
                            >
                              {expanded ? (
                                <ChevronUp aria-hidden="true" size={18} strokeWidth={2.2} />
                              ) : (
                                <ChevronDown aria-hidden="true" size={18} strokeWidth={2.2} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr key={`${row.id}-expanded`}>
                          <td
                            colSpan={columnCount}
                            style={{
                              padding: 0,
                              borderBottom: "1px solid var(--sp-color-border)",
                            }}
                          >
                            <InlineDiff log={row} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={columnCount}
                    style={{
                      ...tableCellStyle,
                      padding: "48px 16px",
                      textAlign: "center",
                      color: "var(--sp-color-muted)",
                    }}
                  >
                    {hasScopedContext
                      ? "No scoped audit events found"
                      : "No audit events found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && !loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--sp-space-sm)",
              flexWrap: "wrap",
              paddingTop: 4,
              color: "var(--sp-color-muted)",
              fontSize: "0.84rem",
              fontWeight: 500,
            }}
          >
            <span>
              Showing {fromItem} to {toItem} of {totalItems} records
            </span>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
              {totalPages <= 1 ? (
                <div
                  aria-label="Pagination"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    paddingTop: 0,
                  }}
                >
                  <button
                    type="button"
                    disabled
                    style={{
                      minHeight: 32,
                      minWidth: 32,
                      padding: "0 10px",
                      border: "1px solid var(--sp-feedback-info-border)",
                      borderRadius: "var(--sp-inline-radius)",
                      background: "var(--sp-feedback-info-bg)",
                      color: "var(--sp-feedback-info-text)",
                      fontSize: 13,
                      fontWeight: 650,
                    }}
                  >
                    1
                  </button>
                </div>
              ) : null}
              <BlendFilterSelect
                ariaLabel="Rows per page"
                selected={String(rowsPerPage)}
                onSelect={(value) => setRowsPerPage(Number(value))}
                width={112}
                items={rowsPerPageOptions.map((option) => ({
                  label: `${option} / page`,
                  value: String(option),
                }))}
              />
            </div>
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(selectedData)}
        onClose={() => setSelectedData(null)}
        title={selectedData?.title ?? "Audit Data"}
        footer={
          <button style={buttonSecondary} onClick={() => setSelectedData(null)}>
            Close
          </button>
        }
      >
        {selectedData ? (
          <pre
            style={{
              maxHeight: "min(58vh, 560px)",
              overflow: "auto",
              margin: 0,
              padding: "var(--sp-space-md)",
              border: "1px solid var(--sp-color-border)",
              borderRadius: "var(--sp-control-radius)",
              background: "var(--sp-color-surface-muted)",
              color: "var(--sp-color-text)",
              fontFamily:
                '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Consolas, monospace',
              fontSize: "0.86rem",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {formatJson(selectedData.value)}
          </pre>
        ) : null}
      </Modal>
    </div>
  );
}

export function AuditTrail(props: AuditTrailProps) {
  const { config } = useSuperposition();

  if (!isFeatureEnabled(config.features, "audit")) {
    return (
      <FeatureUnavailable
        feature="Audit Trail"
        message={getMessage(
          config,
          "audit.unavailable",
          "Audit Trail is not enabled for this embed.",
        )}
      />
    );
  }

  return <AuditTrailContent {...props} />;
}
