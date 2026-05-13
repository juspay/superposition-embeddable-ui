import React from "react";
import type { SuperpositionTableConfig } from "../types";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  showSerialNumber?: boolean;
  serialNumberHeader?: string;
  serialNumberStart?: number;
  serialNumberWidth?: string;
  serialNumberAlign?: "left" | "center" | "right";
}

export type TableSerialNumberProps = Pick<
  TableProps<unknown>,
  | "showSerialNumber"
  | "serialNumberHeader"
  | "serialNumberStart"
  | "serialNumberWidth"
  | "serialNumberAlign"
>;

export function resolveTableSerialNumberProps(
  tableConfig?: SuperpositionTableConfig,
  fallbackStartAt = 1,
): TableSerialNumberProps {
  const serialNumber = tableConfig?.serialNumber;

  if (!serialNumber) {
    return { showSerialNumber: false, serialNumberStart: fallbackStartAt };
  }

  if (serialNumber === true) {
    return { showSerialNumber: true, serialNumberStart: fallbackStartAt };
  }

  return {
    showSerialNumber: serialNumber.enabled ?? true,
    serialNumberHeader: serialNumber.header,
    serialNumberStart: serialNumber.startAt ?? fallbackStartAt,
    serialNumberWidth: serialNumber.width,
    serialNumberAlign: serialNumber.align,
  };
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "var(--sp-table-min-width)",
  borderCollapse: "collapse",
  fontSize: "1rem",
  background: "var(--sp-color-panel)",
  opacity: "var(--sp-table-opacity)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--sp-table-header-padding)",
  borderBottom: "1px solid var(--sp-color-border)",
  fontWeight: "var(--sp-table-header-font-weight)",
  color: "var(--sp-table-header-text)",
  background: "var(--sp-table-header-bg)",
  fontSize: "var(--sp-table-header-font-size)",
  letterSpacing: 0,
  textTransform: "var(--sp-table-header-text-transform)",
  opacity: "var(--sp-table-header-opacity)",
};

const tdStyle: React.CSSProperties = {
  padding: "var(--sp-space-md)",
  borderBottom: "1px solid color-mix(in oklab, var(--sp-color-border) 75%, transparent)",
  color: "var(--sp-color-text)",
  verticalAlign: "top",
};

function toTitleCase(value: string) {
  if (!value.trim()) return value;

  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data",
  loading = false,
  showSerialNumber = false,
  serialNumberHeader = "#",
  serialNumberStart = 1,
  serialNumberWidth = "64px",
  serialNumberAlign = "center",
}: TableProps<T>) {
  if (loading) {
    return (
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
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-card-radius)",
        background: "var(--sp-color-panel)",
      }}
    >
      <table style={tableStyle}>
        <thead>
          <tr>
            {showSerialNumber && (
              <th
                style={{
                  ...thStyle,
                  width: serialNumberWidth,
                  textAlign: serialNumberAlign,
                }}
              >
                {serialNumberHeader}
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ ...thStyle, width: col.width, textAlign: col.align ?? "left" }}
              >
                {toTitleCase(col.header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (showSerialNumber ? 1 : 0)}
                style={{
                  ...tdStyle,
                  textAlign: "center",
                  color: "var(--sp-color-muted)",
                  padding: "calc(var(--sp-space-lg) * 2) var(--sp-space-lg)",
                  fontSize: "1rem",
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                style={{
                  cursor: onRowClick ? "pointer" : "default",
                }}
              >
                {showSerialNumber && (
                  <td
                    style={{
                      ...tdStyle,
                      width: serialNumberWidth,
                      textAlign: serialNumberAlign,
                      color: "var(--sp-color-muted)",
                      fontWeight: 700,
                    }}
                  >
                    {serialNumberStart + index}
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ ...tdStyle, textAlign: col.align ?? "left" }}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
