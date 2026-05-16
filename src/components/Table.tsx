import React from "react";
import {
  ColumnType,
  DataTable,
  type ColumnDefinition,
} from "@juspay/blend-design-system";
import type { SuperpositionTableConfig } from "../types";
import { EmptyState } from "./EmptyState";

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
  emptyDescription?: string;
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
  emptyDescription,
  loading = false,
  showSerialNumber = false,
  serialNumberHeader = "#",
  serialNumberStart = 1,
  serialNumberWidth = "64px",
  serialNumberAlign = "left",
}: TableProps<T>) {
  type TableRow = Record<string, unknown> & {
    __spId: string;
    __spRow: T;
    __spSerial?: number;
  };

  if (loading) {
    return (
      <div>
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          Loading...
        </span>
        <DataTable idField="__spId" columns={[]} data={[]} isLoading />
      </div>
    );
  }

  const tableRows: TableRow[] = data.map((row, index) => ({
    __spId: keyExtractor(row),
    __spRow: row,
    __spSerial: serialNumberStart + index,
  }));

  const blendColumns: ColumnDefinition<Record<string, unknown>>[] = [
    ...(showSerialNumber
      ? [
          {
            field: "__spSerial" as keyof TableRow,
            header: serialNumberHeader,
            width: serialNumberWidth,
            type: ColumnType.CUSTOM,
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
    ...columns.map(
      (col) =>
        ({
          field: col.key as keyof TableRow,
          header: toTitleCase(col.header),
          width: col.width,
          type: ColumnType.CUSTOM,
          isSortable: false,
          renderCell: (_value: unknown, tableRow: Record<string, unknown>) => (
            <span style={{ display: "block", textAlign: col.align ?? "left" }}>
              {col.render
                ? col.render(tableRow.__spRow as T)
                : String(
                    (tableRow.__spRow as T as Record<string, unknown>)[col.key] ?? "",
                  )}
            </span>
          ),
        }) satisfies ColumnDefinition<Record<string, unknown>>,
    ),
  ];

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        description={emptyDescription}
        minHeight="var(--sp-table-empty-min-height)"
      />
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
      <div style={tableStyle}>
        <DataTable
          idField="__spId"
          columns={blendColumns}
          data={tableRows}
          showHeader={false}
          showToolbar={false}
          showSettings={false}
          showFooter={false}
          isHoverable={Boolean(onRowClick)}
          onRowClick={
            onRowClick ? (tableRow) => onRowClick(tableRow.__spRow as T) : undefined
          }
          getRowStyle={() => ({ cursor: onRowClick ? "pointer" : "default" })}
          mobileColumnsToShow={blendColumns.length}
        />
      </div>
    </div>
  );
}
