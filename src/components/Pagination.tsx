import "../blend-react-compat";
import {
  SelectMenuSize,
  SelectMenuVariant,
  SingleSelect,
} from "@juspay/blend-design-system";
import { useEffect, useState, type CSSProperties } from "react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  rowsPerPage?: number;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
  itemLabel?: string;
  showSinglePage?: boolean;
}

export const BLEND_PAGINATION_FALLBACK_WIDTH = 1024;

export function useResponsivePaginationFallback(
  breakpoint = BLEND_PAGINATION_FALLBACK_WIDTH,
) {
  const [shouldUseFallback, setShouldUseFallback] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateFallbackState = () => {
      setShouldUseFallback(window.innerWidth < breakpoint);
    };

    updateFallbackState();
    window.addEventListener("resize", updateFallbackState);

    return () => {
      window.removeEventListener("resize", updateFallbackState);
    };
  }, [breakpoint]);

  return shouldUseFallback;
}

const btnStyle: CSSProperties = {
  minWidth: 34,
  minHeight: 34,
  padding: "0 10px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--sp-button-secondary-border)",
  background: "var(--sp-button-secondary-bg)",
  color: "var(--sp-button-secondary-text)",
  borderRadius: "var(--sp-inline-radius)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const activeBtnStyle: CSSProperties = {
  ...btnStyle,
  background: "var(--sp-feedback-info-bg)",
  color: "var(--sp-feedback-info-text)",
  borderColor: "var(--sp-feedback-info-border)",
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  rowsPerPage,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 20, 50],
  itemLabel = "records",
  showSinglePage = false,
}: PaginationProps) {
  if (totalPages <= 1 && !showSinglePage && totalItems === undefined) return null;

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const normalizedTotalPages = Math.max(1, totalPages);
  const end = Math.min(normalizedTotalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  const fromItem =
    totalItems === undefined || rowsPerPage === undefined || totalItems === 0
      ? 0
      : (currentPage - 1) * rowsPerPage + 1;
  const toItem =
    totalItems === undefined || rowsPerPage === undefined
      ? 0
      : Math.min(currentPage * rowsPerPage, totalItems);

  return (
    <div
      role="navigation"
      aria-label="Pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "4px 4px 0",
        flexWrap: "wrap",
      }}
    >
      {totalItems !== undefined && rowsPerPage !== undefined ? (
        <div
          style={{
            fontSize: "0.84rem",
            color: "var(--sp-color-muted)",
            fontWeight: 550,
          }}
        >
          Showing {fromItem} to {toItem} of {totalItems} {itemLabel}
        </div>
      ) : (
        <div />
      )}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {rowsPerPage !== undefined && onRowsPerPageChange ? (
          <div style={{ minWidth: 124 }}>
            <SingleSelect
              aria-label="Select number of rows per page"
              placeholder="Rows"
              selected={String(rowsPerPage)}
              onSelect={(value) => onRowsPerPageChange(Number(value))}
              size={SelectMenuSize.SMALL}
              variant={SelectMenuVariant.CONTAINER}
              useDrawerOnMobile={false}
              items={[
                {
                  items: rowsPerPageOptions.map((option) => ({
                    label: `${option} / page`,
                    value: String(option),
                  })),
                },
              ]}
            />
          </div>
        ) : null}
        <button
          aria-label="Previous page"
          style={{ ...btnStyle, opacity: currentPage <= 1 ? 0.5 : 1 }}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        {pages.map((p) => (
          <button
            key={p}
            style={p === currentPage ? activeBtnStyle : btnStyle}
            aria-current={p === currentPage ? "page" : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          aria-label="Next page"
          style={{
            ...btnStyle,
            opacity: currentPage >= normalizedTotalPages ? 0.5 : 1,
          }}
          disabled={currentPage >= normalizedTotalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
