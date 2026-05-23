import "../blend-react-compat";

import {
  DiffLineType as BlendDiffLineType,
  Tooltip as BlendTooltip,
  Breadcrumb,
  Button,
  ButtonSize,
  ButtonSubType,
  ButtonType,
  Card,
  CodeBlock,
  CodeBlockVariant,
  ColumnType,
  DataTable,
  DateRangePicker,
  KeyValuePair,
  KeyValuePairSize,
  KeyValuePairStateType,
  Tag,
  TagColor,
  TagShape,
  TagSize,
  TagVariant,
  TooltipSide,
  type ColumnDefinition,
  type ColumnFilter,
  type DiffLine,
  type SearchConfig,
} from "@juspay/blend-design-system";
import { ArrowRight, Copy, Download, FileJson, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  InlineNotice,
  Modal,
  PageHeader,
  resolveTableSearchAlign,
  resolveTableSerialNumberProps,
  searchAlignStyle,
  SearchField,
} from "../components";
import { Pagination, useResponsivePaginationFallback } from "../components/Pagination";
import { useApi } from "../hooks/useApi";
import { useAlerts } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { AuditAction, AuditLog, JsonValue } from "../types";
import { matchesSearchQuery, paginateRows } from "../utils";
import { formatErrorMessage } from "../utils/errors";
import { FeatureUnavailable, getMessage, isFeatureEnabled } from "./FeatureGate";

export interface AuditTrailProps {
  pageSize?: number;
  filters?: AuditTrailFilters;
}

export interface AuditTrailDateRange {
  startDate: Date;
  endDate?: Date;
}

export interface AuditTrailFilters {
  dateRange?: AuditTrailDateRange;
  tables?: string[];
  actions?: AuditAction[];
}

type AuditDataSelection = {
  title: string;
  value: unknown;
};

function AuditNoResults({ title, description }: { title: string; description: string }) {
  return (
    <div
      role="status"
      aria-label={title}
      style={{
        display: "grid",
        gap: 4,
        alignContent: "start",
        minHeight: 72,
        padding: "10px 2px 4px",
        color: "var(--sp-color-text)",
      }}
    >
      <div
        style={{
          fontSize: "0.92rem",
          fontWeight: 650,
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
      <div
        style={{
          maxWidth: 640,
          color: "var(--sp-color-muted)",
          fontSize: "0.88rem",
          fontWeight: 500,
          lineHeight: 1.45,
        }}
      >
        {description}
      </div>
    </div>
  );
}

type SelectedAuditLog = {
  log: AuditLog;
  reference: string;
};

type AuditChangeStatus = "Added" | "Removed" | "Modified";

type AuditChangeRow = {
  field: string;
  valueType: string;
  oldValue: unknown;
  newValue: unknown;
  status: AuditChangeStatus;
};

type AuditChangeTableRow = Record<string, unknown> &
  AuditChangeRow & {
    id: string;
  };

function normalizeAuditFilterValues(values?: string[]): string[] | undefined {
  const normalized = values?.map((value) => value.trim()).filter(Boolean);

  if (!normalized?.length) {
    return undefined;
  }

  return Array.from(new Set(normalized));
}

function normalizeAuditDateRange(
  value?: AuditTrailDateRange,
): AuditTrailDateRange | undefined {
  if (!value) return undefined;

  const startDate = new Date(value.startDate);
  const endDate = value.endDate ? new Date(value.endDate) : undefined;
  const hasValidStart = !Number.isNaN(startDate.getTime());
  const hasValidEnd = endDate ? !Number.isNaN(endDate.getTime()) : false;

  if (!hasValidStart && !hasValidEnd) {
    return undefined;
  }

  return {
    startDate: hasValidStart ? startDate : endDate!,
    endDate: hasValidEnd ? endDate : undefined,
  };
}

function startOfAuditDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfAuditDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getAuditDateRangeBounds(
  range?: AuditTrailDateRange,
): AuditTrailDateRange | undefined {
  const normalized = normalizeAuditDateRange(range);

  if (!normalized) {
    return undefined;
  }

  return {
    startDate: startOfAuditDay(normalized.startDate),
    endDate: normalized.endDate ? endOfAuditDay(normalized.endDate) : undefined,
  };
}

function getAuditDateRangeKey(range?: AuditTrailDateRange): string {
  const bounds = getAuditDateRangeBounds(range);

  if (!bounds) {
    return "";
  }

  return `${bounds.startDate.toISOString()}|${bounds.endDate?.toISOString() ?? ""}`;
}

function getEffectiveAuditDateRange(
  ...ranges: Array<AuditTrailDateRange | undefined>
): AuditTrailDateRange | undefined {
  const bounds = ranges.flatMap((range) => {
    const boundedRange = getAuditDateRangeBounds(range);
    return boundedRange ? [boundedRange] : [];
  });

  if (!bounds.length) {
    return undefined;
  }

  const startDate = new Date(
    Math.max(...bounds.map((range) => range.startDate.getTime())),
  );
  const endDates = bounds.flatMap((range) => (range.endDate ? [range.endDate] : []));

  return {
    startDate,
    endDate: endDates.length
      ? new Date(Math.min(...endDates.map((date) => date.getTime())))
      : undefined,
  };
}

function isWithinAuditDateRange(timestamp: number, range?: AuditTrailDateRange): boolean {
  const bounds = getAuditDateRangeBounds(range);

  if (!bounds || Number.isNaN(timestamp)) {
    return true;
  }

  if (timestamp < bounds.startDate.getTime()) {
    return false;
  }

  if (bounds.endDate && timestamp > bounds.endDate.getTime()) {
    return false;
  }

  return true;
}

const actionTagColors: Record<string, TagColor> = {
  INSERT: TagColor.SUCCESS,
  UPDATE: TagColor.PRIMARY,
  DELETE: TagColor.ERROR,
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

function formatJson(value: unknown): string {
  if (value === undefined) return "Not Present";
  if (value === null) return "null";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildDiffLines(
  originalValue: unknown,
  newValue: unknown,
  maxLines = 50,
): DiffLine[] {
  const originalLines = formatJson(originalValue).split("\n");
  const newLines = formatJson(newValue).split("\n");
  const rowCount = originalLines.length;
  const columnCount = newLines.length;
  const matrix = Array.from({ length: rowCount + 1 }, () =>
    Array<number>(columnCount + 1).fill(0),
  );

  for (let row = rowCount - 1; row >= 0; row -= 1) {
    for (let column = columnCount - 1; column >= 0; column -= 1) {
      matrix[row][column] =
        originalLines[row] === newLines[column]
          ? matrix[row + 1][column + 1] + 1
          : Math.max(matrix[row + 1][column], matrix[row][column + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let row = 0;
  let column = 0;

  while (row < rowCount && column < columnCount && lines.length < maxLines) {
    if (originalLines[row] === newLines[column]) {
      lines.push({
        content: originalLines[row],
        type: BlendDiffLineType.UNCHANGED,
      });
      row += 1;
      column += 1;
      continue;
    }

    if (matrix[row + 1][column] >= matrix[row][column + 1]) {
      lines.push({
        content: originalLines[row],
        type: BlendDiffLineType.REMOVED,
      });
      row += 1;
    } else {
      lines.push({
        content: newLines[column],
        type: BlendDiffLineType.ADDED,
      });
      column += 1;
    }
  }

  while (row < rowCount && lines.length < maxLines) {
    lines.push({
      content: originalLines[row],
      type: BlendDiffLineType.REMOVED,
    });
    row += 1;
  }

  while (column < columnCount && lines.length < maxLines) {
    lines.push({
      content: newLines[column],
      type: BlendDiffLineType.ADDED,
    });
    column += 1;
  }

  return lines;
}

function toAuditDimensionParamValue(value: JsonValue): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildAuditDimensionParams(
  context?: Record<string, JsonValue>,
): Record<string, string> | undefined {
  if (!context || Object.keys(context).length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      `dimension[${key}]`,
      toAuditDimensionParamValue(value),
    ]),
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function titleCaseWords(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function flattenAuditValues(
  value: unknown,
  prefix = "",
  output: Record<string, unknown> = {},
): Record<string, unknown> {
  if (value === undefined) {
    return output;
  }

  if (value === null || Array.isArray(value) || typeof value !== "object") {
    output[prefix || "value"] = value;
    return output;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    output[prefix || "value"] = value;
    return output;
  }

  entries.forEach(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenAuditValues(nested, nextPrefix, output);
  });

  return output;
}

function getAuditValueType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (value === undefined) return "unknown";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return "object";
}

function summarizeAuditChanges(log: AuditLog): AuditChangeRow[] {
  const oldEntries = flattenAuditValues(log.original_data);
  const newEntries = flattenAuditValues(log.new_data);
  const keys = Array.from(
    new Set([...Object.keys(oldEntries), ...Object.keys(newEntries)]),
  ).sort();

  return keys
    .filter((key) => JSON.stringify(oldEntries[key]) !== JSON.stringify(newEntries[key]))
    .map((key) => {
      const oldValue = oldEntries[key];
      const newValue = newEntries[key];

      let status: AuditChangeStatus = "Modified";
      if (oldValue === undefined && newValue !== undefined) status = "Added";
      if (oldValue !== undefined && newValue === undefined) status = "Removed";

      return {
        field: key,
        valueType: getAuditValueType(newValue !== undefined ? newValue : oldValue),
        oldValue,
        newValue,
        status,
      };
    });
}

function extractEntityName(log: AuditLog): string {
  const normalized = String(log.table_name ?? "").trim();
  if (normalized === "default_configs") return "Configs";
  if (normalized === "contexts") return "Overrides";
  return titleCaseWords(normalized);
}

function extractEntityId(log: AuditLog): string {
  const candidates = [log.new_data, log.original_data];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;

    const record = candidate as Record<string, unknown>;
    const directId =
      record.dimension ??
      record.key ??
      record.id ??
      record.context_id ??
      record.override_id;
    if (directId) {
      return String(directId).replace(/_/g, "-").replace(/\s+/g, "-").toUpperCase();
    }
  }

  return String(log.id).toUpperCase();
}

function matchesAuditLogSearch(log: AuditLog, query: string): boolean {
  return matchesSearchQuery(
    [
      log.id,
      log.table_name,
      log.user_name,
      log.timestamp,
      log.action,
      log.original_data,
      log.new_data,
      log.query,
      extractEntityName(log),
      extractEntityId(log),
    ],
    query,
  );
}

function shouldUseArtifactPreview(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 88 || value.includes("\n");
  if (typeof value === "object") return true;
  return false;
}

function truncateMiddle(value: string, maxLength = 22): string {
  if (value.length <= maxLength) return value;

  const prefixLength = Math.ceil((maxLength - 1) / 2);
  const suffixLength = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, prefixLength)}…${value.slice(value.length - suffixLength)}`;
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

function ActionPill({ action }: { action: AuditAction }) {
  const normalizedAction = String(action).trim().toUpperCase();
  const color = actionTagColors[normalizedAction] ?? TagColor.PRIMARY;

  return (
    <Tag
      text={normalizedAction}
      color={color}
      variant={TagVariant.SUBTLE}
      size={TagSize.SM}
      shape={TagShape.SQUARICAL}
    />
  );
}

function StatusPill({ status }: { status: AuditChangeStatus }) {
  const colors: Record<AuditChangeStatus, TagColor> = {
    Added: TagColor.SUCCESS,
    Removed: TagColor.ERROR,
    Modified: TagColor.PRIMARY,
  };

  return (
    <Tag
      text={status}
      color={colors[status]}
      variant={TagVariant.SUBTLE}
      size={TagSize.SM}
      shape={TagShape.SQUARICAL}
    />
  );
}

function InlineDiff({ log }: { log: AuditLog }) {
  const diffLines = buildDiffLines(log.original_data, log.new_data);
  const code = diffLines.map((line) => line.content).join("\n");

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            color: "var(--sp-color-text)",
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          Changes
        </span>
        <span
          style={{
            color: "var(--sp-color-muted)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Showing first 50 differences
        </span>
      </div>
      <div className="sp-audit-diff-viewer">
        <CodeBlock
          code={code}
          diffLines={diffLines}
          variant={CodeBlockVariant.DIFF}
          language="json"
          header="Original Data / New Data"
          showLineNumbers
          showHeader
          showCopyButton
        />
      </div>
    </div>
  );
}

function TypePill({ value }: { value: string }) {
  return (
    <Tag
      text={value}
      color={TagColor.PRIMARY}
      variant={TagVariant.SUBTLE}
      size={TagSize.XS}
      shape={TagShape.SQUARICAL}
      maxWidth="100%"
    />
  );
}

function TooltipText({
  value,
  maxLength = 48,
  className,
}: {
  value: string;
  maxLength?: number;
  className?: string;
}) {
  const text = value || "-";
  const content = (
    <span className={className}>
      {text.length > maxLength ? truncateMiddle(text, maxLength) : text}
    </span>
  );

  if (text.length <= maxLength) {
    return content;
  }

  return (
    <BlendTooltip content={text} side={TooltipSide.TOP} showArrow maxWidth="360px">
      {content}
    </BlendTooltip>
  );
}

function FieldName({ value }: { value: string }) {
  return <TooltipText value={value} maxLength={34} className="sp-audit-field-name" />;
}

function getAuditValueToneClass(side: "old" | "new", status: AuditChangeStatus): string {
  if (side === "old" && (status === "Modified" || status === "Removed")) {
    return "sp-audit-value-preview--old";
  }

  if (side === "new" && (status === "Modified" || status === "Added")) {
    return "sp-audit-value-preview--new";
  }

  return "";
}

function getAuditValueKind(value: unknown): "JSON" | "Text" {
  return value !== null && typeof value === "object" ? "JSON" : "Text";
}

function AuditValuePreview({
  label,
  value,
  side,
  status,
  onView,
}: {
  label: string;
  value: unknown;
  side: "old" | "new";
  status: AuditChangeStatus;
  onView: () => void;
}) {
  const toneClass = getAuditValueToneClass(side, status);

  if (value === undefined) {
    return <span className="sp-audit-empty-value">-</span>;
  }

  if (shouldUseArtifactPreview(value)) {
    const stats = getJsonStats(value);
    const valueKind = getAuditValueKind(value);
    const Icon = valueKind === "JSON" ? FileJson : FileText;

    return (
      <div className={`sp-audit-artifact-preview ${toneClass}`.trim()}>
        <span className="sp-audit-artifact-preview__icon">
          <Icon aria-hidden="true" size={14} strokeWidth={2} />
        </span>
        <div className="sp-audit-artifact-preview__copy">
          <Tag
            text={valueKind}
            color={valueKind === "JSON" ? TagColor.PRIMARY : TagColor.NEUTRAL}
            variant={TagVariant.SUBTLE}
            size={TagSize.XS}
            shape={TagShape.SQUARICAL}
          />
          <span>
            {stats.bytes} • {stats.lines} lines
          </span>
        </div>
        <button
          type="button"
          className="sp-audit-artifact-preview__view"
          aria-label={label}
          onClick={onView}
        >
          View
        </button>
      </div>
    );
  }

  const text = typeof value === "string" ? value : String(value);

  return (
    <span className={`sp-audit-value-preview ${toneClass}`.trim()}>
      <TooltipText value={text} maxLength={64} />
    </span>
  );
}

function AuditDetailCardShell({ children }: { children: React.ReactNode }) {
  return <div className="sp-audit-detail-card-shell">{children}</div>;
}

function AuditDetailPage({
  selected,
  onBack,
  onViewData,
  onCopyText,
}: {
  selected: SelectedAuditLog;
  onBack: () => void;
  onViewData: (title: string, value: unknown) => void;
  onCopyText: (value: string, successMessage: string) => void;
}) {
  const { log, reference } = selected;
  const entity = extractEntityName(log);
  const entityId = extractEntityId(log);
  const entityIdDisplay = truncateMiddle(entityId, 34);
  const changes = summarizeAuditChanges(log);
  const changeRows: AuditChangeTableRow[] = changes.map((change) => ({
    ...change,
    id: change.field,
  }));
  const changeColumns: ColumnDefinition<Record<string, unknown>>[] = [
    {
      field: "field",
      header: "Field",
      type: ColumnType.CUSTOM,
      width: "20%",
      isSortable: false,
      renderCell: (_value: unknown, row: Record<string, unknown>) => (
        <FieldName value={String(row.field ?? "")} />
      ),
    },
    {
      field: "valueType",
      header: "Type",
      type: ColumnType.CUSTOM,
      width: "10%",
      isSortable: false,
      renderCell: (value: unknown) => <TypePill value={String(value ?? "unknown")} />,
    },
    {
      field: "oldValue",
      header: "Old Value",
      type: ColumnType.CUSTOM,
      width: "26%",
      isSortable: false,
      renderCell: (_value: unknown, row: Record<string, unknown>) => {
        const change = row as AuditChangeTableRow;

        return (
          <AuditValuePreview
            label={`View old value for ${change.field}`}
            value={change.oldValue}
            side="old"
            status={change.status}
            onView={() => onViewData(`Old value • ${change.field}`, change.oldValue)}
          />
        );
      },
    },
    {
      field: "id",
      header: "Arrow",
      type: ColumnType.CUSTOM,
      width: "56px",
      isSortable: false,
      renderCell: () => (
        <span className="sp-audit-change-arrow">
          <ArrowRight aria-hidden="true" size={16} strokeWidth={2.2} />
        </span>
      ),
    },
    {
      field: "newValue",
      header: "New Value",
      type: ColumnType.CUSTOM,
      width: "26%",
      isSortable: false,
      renderCell: (_value: unknown, row: Record<string, unknown>) => {
        const change = row as AuditChangeTableRow;

        return (
          <AuditValuePreview
            label={`View new value for ${change.field}`}
            value={change.newValue}
            side="new"
            status={change.status}
            onView={() => onViewData(`New value • ${change.field}`, change.newValue)}
          />
        );
      },
    },
    {
      field: "status",
      header: "Change Status",
      type: ColumnType.CUSTOM,
      width: "14%",
      isSortable: false,
      renderCell: (value: unknown) => <StatusPill status={value as AuditChangeStatus} />,
    },
  ];

  return (
    <div className="sp-audit-detail-page">
      <div className="sp-audit-detail-header">
        <div className="sp-audit-detail-title-stack">
          <Breadcrumb
            items={[
              {
                label: "Audit Trail",
                href: "#",
                onClick: (event) => {
                  event.preventDefault();
                  onBack();
                },
              },
              {
                label: reference,
                href: "#",
                onClick: (event) => event.preventDefault(),
              },
            ]}
          />
        </div>
      </div>

      <AuditDetailCardShell>
        <Card
          maxWidth="100%"
          bodySlot1={
            <div className="sp-audit-summary-grid">
              <KeyValuePair
                keyString="Entity"
                value={entity}
                keyValuePairState={KeyValuePairStateType.vertical}
                size={KeyValuePairSize.SMALL}
                maxWidth="100%"
              />
              <KeyValuePair
                keyString="Entity ID"
                value={entityIdDisplay}
                valueRightSlot={
                  <BlendTooltip content="Copy entity ID" side={TooltipSide.TOP} showArrow>
                    <Button
                      buttonType={ButtonType.SECONDARY}
                      size={ButtonSize.SMALL}
                      subType={ButtonSubType.ICON_ONLY}
                      aria-label="Copy entity id"
                      leadingIcon={
                        <Copy aria-hidden="true" size={14} strokeWidth={2.1} />
                      }
                      onClick={() => onCopyText(entityId, "Entity ID copied")}
                    />
                  </BlendTooltip>
                }
                keyValuePairState={KeyValuePairStateType.vertical}
                size={KeyValuePairSize.SMALL}
                maxWidth="100%"
                textOverflow="truncate"
              />
              <div className="sp-audit-summary-action">
                <span>Action</span>
                <ActionPill action={log.action} />
              </div>
            </div>
          }
        />
      </AuditDetailCardShell>

      <AuditDetailCardShell>
        <Card
          maxWidth="100%"
          headerTitle="Changes"
          subHeader="Below are the fields that were changed."
          bodySlot1={
            <div className="sp-audit-change-table">
              <DataTable
                idField="id"
                columns={changeColumns}
                data={changeRows}
                showHeader={false}
                showToolbar={false}
                showSettings={false}
                showFooter={false}
                enableColumnManager={false}
                enableRowExpansion={false}
                isHoverable={false}
                mobileColumnsToShow={6}
              />
            </div>
          }
        />
      </AuditDetailCardShell>
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

type AuditTableRow = Record<string, unknown> & {
  id: string;
  table_name: string;
  timestamp: AuditLog["timestamp"];
  action: AuditAction;
  serial_number?: number;
  __spLog: AuditLog;
};

function AuditTrailContent({ pageSize = 10, filters }: AuditTrailProps) {
  const { config, auditLogs, scope } = useSuperposition();
  const { addAlert } = useAlerts();
  const hostTableFilters = useMemo(
    () => normalizeAuditFilterValues(filters?.tables),
    [filters?.tables],
  );
  const hostActionFilters = useMemo(
    () => normalizeAuditFilterValues(filters?.actions),
    [filters?.actions],
  ) as AuditAction[] | undefined;
  const hostDateRange = useMemo(
    () => normalizeAuditDateRange(filters?.dateRange),
    [filters?.dateRange],
  );
  const hostTableFilterKey = hostTableFilters?.join("\u0000") ?? "";
  const hostActionFilterKey = hostActionFilters?.join("\u0000") ?? "";
  const hostDateFilterKey = getAuditDateRangeKey(hostDateRange);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState(
    hostTableFilters?.length === 1 ? hostTableFilters[0] : "ALL",
  );
  const [actionFilter, setActionFilter] = useState<"ALL" | AuditAction>(
    hostActionFilters?.length === 1 ? hostActionFilters[0] : "ALL",
  );
  const [dateRange, setDateRange] = useState<AuditTrailDateRange | undefined>(
    hostDateRange,
  );
  const dateRangeFilterKey = getAuditDateRangeKey(dateRange);
  const effectiveDateRange = useMemo(
    () => getEffectiveAuditDateRange(hostDateRange, dateRange),
    [dateRangeFilterKey, hostDateFilterKey],
  );
  const effectiveDateFilterKey = getAuditDateRangeKey(effectiveDateRange);
  const [selectedLog, setSelectedLog] = useState<SelectedAuditLog | null>(null);
  const [selectedData, setSelectedData] = useState<AuditDataSelection | null>(null);
  const shouldUsePaginationFallback = useResponsivePaginationFallback();
  const scopedContext = scope.effectiveContext;
  const auditDimensionParams = useMemo(
    () => buildAuditDimensionParams(scopedContext),
    [scopedContext],
  );
  const hasScopedContext = Boolean(auditDimensionParams);
  const trimmedSearch = search.trim();
  const shouldClientPage =
    Boolean(trimmedSearch) ||
    tableFilter !== "ALL" ||
    actionFilter !== "ALL" ||
    Boolean(dateRange);
  const requestPage = shouldClientPage ? 1 : page;

  const { data, loading, error } = useApi(
    () =>
      auditLogs.list(
        shouldClientPage ? { all: true } : { page: requestPage, count: rowsPerPage },
        {
          sort_by: "desc",
          dimension_params: auditDimensionParams,
          from_date: effectiveDateRange?.startDate,
          to_date: effectiveDateRange?.endDate,
          tables: hostTableFilters,
          action: hostActionFilters,
        },
      ),
    [
      auditDimensionParams,
      auditLogs,
      effectiveDateFilterKey,
      hostActionFilterKey,
      hostTableFilterKey,
      requestPage,
      rowsPerPage,
      shouldClientPage,
    ],
  );

  const tableOptions = useMemo(
    () =>
      hostTableFilters
        ? [...hostTableFilters]
        : Array.from(new Set((data?.data ?? []).map((row) => row.table_name))).sort(),
    [data?.data, hostTableFilters],
  );

  const actionOptions = hostActionFilters ?? ["INSERT", "UPDATE", "DELETE"];

  useEffect(() => {
    setTableFilter(hostTableFilters?.length === 1 ? hostTableFilters[0] : "ALL");
  }, [hostTableFilterKey]);

  useEffect(() => {
    setActionFilter(hostActionFilters?.length === 1 ? hostActionFilters[0] : "ALL");
  }, [hostActionFilterKey]);

  useEffect(() => {
    setDateRange(hostDateRange);
  }, [hostDateFilterKey]);

  const filteredRows = useMemo(() => {
    const source = data?.data ?? [];

    return source.filter((row) => {
      if (hostTableFilters?.length && !hostTableFilters.includes(row.table_name)) {
        return false;
      }

      if (tableFilter !== "ALL" && row.table_name !== tableFilter) {
        return false;
      }

      if (hostActionFilters?.length && !hostActionFilters.includes(row.action)) {
        return false;
      }

      if (actionFilter !== "ALL" && row.action !== actionFilter) {
        return false;
      }

      const timestamp = new Date(row.timestamp).getTime();
      if (!isWithinAuditDateRange(timestamp, hostDateRange)) {
        return false;
      }

      if (!isWithinAuditDateRange(timestamp, dateRange)) {
        return false;
      }

      if (!trimmedSearch) {
        return true;
      }

      return matchesAuditLogSearch(row, trimmedSearch);
    });
  }, [
    actionFilter,
    data?.data,
    dateRange,
    hostActionFilters,
    hostDateRange,
    hostTableFilters,
    tableFilter,
    trimmedSearch,
  ]);

  const rows = shouldClientPage
    ? paginateRows(filteredRows, page, rowsPerPage)
    : filteredRows;
  const totalPages = shouldClientPage
    ? Math.ceil(filteredRows.length / rowsPerPage)
    : (data?.total_pages ?? 0);
  const totalItems = shouldClientPage
    ? filteredRows.length
    : (data?.total_items ?? rows.length);
  const serialNumberProps = resolveTableSerialNumberProps(
    config.table,
    (page - 1) * rowsPerPage + 1,
  );
  const serialNumberConfigured = config.table?.serialNumber !== undefined;
  const showSerialNumber = serialNumberConfigured
    ? serialNumberProps.showSerialNumber === true
    : true;
  const serialNumberHeader = serialNumberProps.serialNumberHeader ?? "S.No";
  const serialNumberStart =
    serialNumberProps.serialNumberStart ?? (page - 1) * rowsPerPage + 1;
  const serialNumberAlign = serialNumberProps.serialNumberAlign ?? "left";
  const searchAlign = resolveTableSearchAlign(config.table, "audit");
  const openData = (title: string, value: unknown) => setSelectedData({ title, value });

  useEffect(() => {
    setPage(1);
  }, [actionFilter, auditDimensionParams, dateRange, rowsPerPage, search, tableFilter]);

  useEffect(() => {
    if (page > 1 && page > Math.max(1, totalPages)) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  const copyText = async (value: string, successMessage: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      addAlert("error", "Clipboard is not available");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      addAlert("success", successMessage);
    } catch {
      addAlert("error", "Failed to copy");
    }
  };
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

  const rowsPerPageOptions = Array.from(new Set([pageSize, 10, 20, 50])).sort(
    (a, b) => a - b,
  );
  const auditTableRows: AuditTableRow[] = rows.map((row, index) => ({
    id: String(row.id),
    table_name: row.table_name,
    timestamp: row.timestamp,
    action: row.action,
    serial_number: serialNumberStart + index,
    __spLog: row,
  }));
  const shouldRenderAlignedSearch = Boolean(searchAlign);
  const handleSearchInputChange = (nextSearch: string) => {
    setSearch(nextSearch);
    setPage(1);
  };
  const handleSearchChange = (searchConfig: SearchConfig) =>
    handleSearchInputChange(searchConfig.query);
  const handleFilterChange = (filters: ColumnFilter[]) => {
    const nextTableFilter = filters.find(
      (filter) => String(filter.field) === "table_name",
    );
    const nextActionFilter = filters.find((filter) => String(filter.field) === "action");

    setTableFilter(
      typeof nextTableFilter?.value === "string" ? nextTableFilter.value : "ALL",
    );
    setActionFilter(
      typeof nextActionFilter?.value === "string"
        ? (nextActionFilter.value as AuditAction)
        : "ALL",
    );
    setPage(1);
  };
  const auditColumns: ColumnDefinition<Record<string, unknown>>[] = [
    ...(showSerialNumber
      ? [
          {
            field: "serial_number",
            header: serialNumberHeader,
            type: ColumnType.CUSTOM,
            width: serialNumberProps.serialNumberWidth ?? "72px",
            isSortable: false,
            renderCell: (value: unknown) => (
              <span
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: serialNumberAlign,
                }}
              >
                {String(value ?? "")}
              </span>
            ),
          } satisfies ColumnDefinition<Record<string, unknown>>,
        ]
      : []),
    {
      field: "table_name",
      header: "Table Name",
      type: ColumnType.SELECT,
      width: "26%",
      isSortable: false,
      filterOptions: tableOptions.map((tableName) => ({
        id: tableName,
        label: tableName,
        value: tableName,
      })),
      renderCell: (value: unknown) => <TableNamePill name={String(value)} />,
    },
    {
      field: "timestamp",
      header: "Timestamp",
      type: ColumnType.CUSTOM,
      width: "22%",
      isSortable: false,
      renderCell: (_value: unknown, tableRow: Record<string, unknown>) => {
        const timestamp = formatTimestampParts((tableRow.__spLog as AuditLog).timestamp);

        return (
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
        );
      },
    },
    {
      field: "action",
      header: "Action",
      type: ColumnType.SELECT,
      width: "16%",
      isSortable: false,
      filterOptions: actionOptions.map((action) => ({
        id: action,
        label: action,
        value: action,
      })),
      renderCell: (value: unknown) => <ActionPill action={value as AuditAction} />,
    },
    {
      field: "id",
      header: "Details",
      type: ColumnType.CUSTOM,
      width: "120px",
      isSortable: false,
      renderCell: (_value: unknown, tableRow: Record<string, unknown>) => {
        const auditLog = tableRow.__spLog as AuditLog;
        const reference = String(auditLog.id);

        return (
          <Button
            buttonType={ButtonType.SECONDARY}
            size={ButtonSize.SMALL}
            text="Open"
            aria-label={`Open audit detail ${auditLog.id}`}
            trailingIcon={<ArrowRight aria-hidden="true" size={14} strokeWidth={2.2} />}
            onClick={(event) => {
              event?.stopPropagation();
              setSelectedLog({ log: auditLog, reference });
            }}
          />
        );
      },
    },
  ];

  if (selectedLog) {
    return (
      <>
        <AuditDetailPage
          selected={selectedLog}
          onBack={() => setSelectedLog(null)}
          onViewData={openData}
          onCopyText={copyText}
        />
        <Modal
          open={Boolean(selectedData)}
          onClose={() => setSelectedData(null)}
          title={selectedData?.title ?? "Audit Data"}
          footer={
            <Button
              buttonType={ButtonType.SECONDARY}
              size={ButtonSize.MEDIUM}
              text="Close"
              onClick={() => setSelectedData(null)}
            />
          }
        >
          {selectedData ? (
            <div className="sp-audit-json-viewer">
              <CodeBlock
                code={formatJson(selectedData.value)}
                language="json"
                header={selectedData.title}
                showLineNumbers
                showHeader
                showCopyButton
              />
            </div>
          ) : null}
        </Modal>
      </>
    );
  }

  return (
    <div className="sp-section-stack">
      <PageHeader
        title="Audit Trail"
        description="Track inserts, updates, deletes, and compare changes across configuration tables."
      />

      <div className="sp-section-stack">
        {error && !loading ? (
          <InlineNotice
            title="Could not load audit logs"
            description={formatErrorMessage(error)}
            tone="danger"
          />
        ) : null}

        <div className="sp-table-search-align" style={searchAlignStyle(searchAlign)}>
          {shouldRenderAlignedSearch ? (
            <div className="sp-table-search-row">
              <SearchField
                value={search}
                placeholder="Search audit records..."
                onChange={handleSearchInputChange}
              />
            </div>
          ) : null}
          <DataTable
            idField="id"
            columns={auditColumns}
            data={auditTableRows}
            enableSearch={!shouldRenderAlignedSearch}
            searchPlaceholder="Search audit records..."
            serverSideSearch={!shouldRenderAlignedSearch}
            onSearchChange={shouldRenderAlignedSearch ? undefined : handleSearchChange}
            enableFiltering
            serverSideFiltering
            onFilterChange={handleFilterChange}
            enableRowExpansion
            isRowExpandable={() => true}
            renderExpandedRow={({ row }) => (
              <InlineDiff log={(row as AuditTableRow).__spLog} />
            )}
            pagination={{
              currentPage: page,
              pageSize: rowsPerPage,
              totalRows: totalItems,
              pageSizeOptions: rowsPerPageOptions,
            }}
            serverSidePagination
            onPageChange={setPage}
            onPageSizeChange={(nextRowsPerPage) => {
              setRowsPerPage(nextRowsPerPage);
              setPage(1);
            }}
            isLoading={loading}
            showHeader
            showToolbar
            showSettings={false}
            showFooter={!shouldUsePaginationFallback}
            enableColumnManager={false}
            isHoverable
            mobileColumnsToShow={8}
            tableBodyHeight="min(668px, 65vh)"
            headerSlot1={
              <div className="sp-audit-date-range">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Date range"
                  triggerConfig={{
                    renderTrigger: ({ formattedValue, isOpen }) => (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={isOpen}
                        aria-label={`Date range picker, ${formattedValue || "Select date range"}`}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          minHeight: 38,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "0 12px",
                          border: "1px solid var(--sp-control-border)",
                          borderRadius: "var(--sp-control-radius)",
                          background: "var(--sp-control-bg)",
                          color: dateRange
                            ? "var(--sp-control-text)"
                            : "var(--sp-color-muted)",
                          cursor: "pointer",
                          boxShadow: "var(--sp-search-shadow)",
                          fontSize: 14,
                          fontWeight: 650,
                          lineHeight: 1,
                        }}
                      >
                        {formattedValue}
                      </button>
                    ),
                  }}
                />
              </div>
            }
            headerSlot2={
              <Button
                type="button"
                buttonType={ButtonType.SECONDARY}
                size={ButtonSize.MEDIUM}
                text="Export"
                leadingIcon={<Download aria-hidden="true" size={17} strokeWidth={2.2} />}
                onClick={exportRows}
              />
            }
          />
        </div>
        {!loading && totalItems > 0 && shouldUsePaginationFallback ? (
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalItems / rowsPerPage))}
            totalItems={totalItems}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={rowsPerPageOptions}
            showSinglePage
            onPageChange={setPage}
            onRowsPerPageChange={(nextRowsPerPage) => {
              setRowsPerPage(nextRowsPerPage);
              setPage(1);
            }}
          />
        ) : null}
        {!loading && auditTableRows.length === 0 ? (
          <AuditNoResults
            title={
              hasScopedContext ? "No scoped audit events found" : "No audit events found"
            }
            description={
              hasScopedContext
                ? "No audit activity matched the active host scope and filters."
                : "No audit activity matched the current filters."
            }
          />
        ) : null}
      </div>

      <Modal
        open={Boolean(selectedData)}
        onClose={() => setSelectedData(null)}
        title={selectedData?.title ?? "Audit Data"}
        footer={
          <Button
            buttonType={ButtonType.SECONDARY}
            size={ButtonSize.MEDIUM}
            text="Close"
            onClick={() => setSelectedData(null)}
          />
        }
      >
        {selectedData ? (
          <div className="sp-audit-json-viewer">
            <CodeBlock
              code={formatJson(selectedData.value)}
              language="json"
              header={selectedData.title}
              showLineNumbers
              showHeader
              showCopyButton
            />
          </div>
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
