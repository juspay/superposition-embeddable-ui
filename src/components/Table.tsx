import "../blend-react-compat";
import {
  ColumnType,
  DataTable,
  type ColumnDefinition,
  type SearchConfig,
} from "@juspay/blend-design-system";
import React from "react";
import type {
  SuperpositionFeature,
  SuperpositionSearchAlign,
  SuperpositionTableConfig,
} from "../types";
import { Pagination, useResponsivePaginationFallback } from "./Pagination";
import { SearchField } from "./SearchField";

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
  className?: string;
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  showSerialNumber?: boolean;
  serialNumberHeader?: string;
  serialNumberStart?: number;
  serialNumberWidth?: string;
  serialNumberAlign?: "left" | "center" | "right";
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalRows: number;
    pageSizeOptions?: number[];
  };
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  headerSlot1?: React.ReactNode;
  headerSlot2?: React.ReactNode;
  enableColumnManager?: boolean;
  columnManagerAlwaysSelected?: string[];
  tableBodyHeight?: string;
  searchAlign?: SuperpositionSearchAlign;
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

export function resolveTableSearchAlign(
  tableConfig: SuperpositionTableConfig | undefined,
  feature: SuperpositionFeature,
): SuperpositionSearchAlign | undefined {
  const pageConfig =
    feature === "config"
      ? tableConfig?.defaultConfig
      : feature === "overrides"
        ? tableConfig?.overrides
      : feature === "dimensions"
        ? tableConfig?.dimensions
        : tableConfig?.audit;

  return pageConfig?.searchAlign ?? tableConfig?.searchAlign;
}

export function searchAlignStyle(
  searchAlign?: SuperpositionSearchAlign,
): React.CSSProperties | undefined {
  if (!searchAlign) return undefined;

  const justifyContent =
    searchAlign === "center"
      ? "center"
      : searchAlign === "right"
        ? "flex-end"
        : "flex-start";

  return {
    "--sp-search-justify-content": justifyContent,
  } as React.CSSProperties;
}

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
  className,
  keyExtractor,
  onRowClick,
  loading = false,
  showSerialNumber = false,
  serialNumberHeader = "#",
  serialNumberStart = 1,
  serialNumberWidth = "64px",
  serialNumberAlign = "left",
  searchPlaceholder = "Search...",
  onSearchChange,
  pagination,
  onPageChange,
  onPageSizeChange,
  headerSlot1,
  headerSlot2,
  enableColumnManager = false,
  columnManagerAlwaysSelected,
  tableBodyHeight,
  searchAlign,
}: TableProps<T>) {
  const shouldRenderAlignedSearch = Boolean(onSearchChange && searchAlign);
  const [alignedSearch, setAlignedSearch] = React.useState("");
  const shouldShowToolbar = Boolean(
    (!shouldRenderAlignedSearch && onSearchChange) || headerSlot1 || headerSlot2,
  );
  const shouldShowHeader = shouldShowToolbar;
  const shouldUsePaginationFallback = useResponsivePaginationFallback();

  type TableRow = Record<string, unknown> & {
    __spId: string;
    __spRow: T;
    __spSerial?: number;
  };

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

  return (
    <div className={className} style={searchAlignStyle(searchAlign)}>
      {shouldRenderAlignedSearch ? (
        <div className="sp-table-search-row">
          <SearchField
            value={alignedSearch}
            placeholder={searchPlaceholder}
            onChange={(nextSearch) => {
              setAlignedSearch(nextSearch);
              onSearchChange?.(nextSearch);
            }}
          />
        </div>
      ) : null}
      <DataTable
        idField="__spId"
        columns={blendColumns}
        data={tableRows}
        isLoading={loading}
        showHeader={shouldShowHeader}
        showToolbar={shouldShowToolbar}
        showFooter={Boolean(pagination) && !shouldUsePaginationFallback}
        pagination={pagination}
        serverSidePagination={Boolean(pagination)}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        enableColumnManager={enableColumnManager}
        columnManagerAlwaysSelected={
          columnManagerAlwaysSelected as Array<keyof TableRow> | undefined
        }
        isHoverable={Boolean(onRowClick)}
        enableSearch={Boolean(onSearchChange) && !shouldRenderAlignedSearch}
        searchPlaceholder={searchPlaceholder}
        serverSideSearch={Boolean(onSearchChange) && !shouldRenderAlignedSearch}
        onSearchChange={
          onSearchChange && !shouldRenderAlignedSearch
            ? (searchConfig: SearchConfig) => onSearchChange(searchConfig.query)
            : undefined
        }
        headerSlot1={headerSlot1}
        headerSlot2={headerSlot2}
        tableBodyHeight={tableBodyHeight}
        onRowClick={
          onRowClick ? (tableRow) => onRowClick(tableRow.__spRow as T) : undefined
        }
        getRowStyle={() => ({ cursor: onRowClick ? "pointer" : "default" })}
      />
      {pagination && shouldUsePaginationFallback ? (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={Math.max(1, Math.ceil(pagination.totalRows / pagination.pageSize))}
          totalItems={pagination.totalRows}
          rowsPerPage={pagination.pageSize}
          rowsPerPageOptions={pagination.pageSizeOptions}
          showSinglePage
          onPageChange={onPageChange ?? (() => {})}
          onRowsPerPageChange={onPageSizeChange}
        />
      ) : null}
    </div>
  );
}
