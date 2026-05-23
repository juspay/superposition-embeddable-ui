import type {
  AuditLog,
  AuditLogListFilters,
  PaginatedResponse,
  PaginationParams,
} from "../types";
import type { SuperpositionClient } from "./client";
import { SuperpositionApiError } from "./client";

function toQueryDate(value?: Date): string | undefined {
  return value ? value.toISOString() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAuditLogList(payload: unknown): PaginatedResponse<AuditLog> {
  if (Array.isArray(payload)) {
    return {
      total_pages: payload.length > 0 ? 1 : 0,
      total_items: payload.length,
      data: payload as AuditLog[],
    };
  }

  if (!isRecord(payload)) {
    return {
      total_pages: 0,
      total_items: 0,
      data: [],
    };
  }

  const data = Array.isArray(payload.data) ? (payload.data as AuditLog[]) : [];

  return {
    total_pages:
      typeof payload.total_pages === "number"
        ? payload.total_pages
        : data.length > 0
          ? 1
          : 0,
    total_items:
      typeof payload.total_items === "number" ? payload.total_items : data.length,
    data,
  };
}

export function auditLogsApi(client: SuperpositionClient) {
  return {
    list(
      params: PaginationParams = {},
      filters: AuditLogListFilters = {},
    ): Promise<PaginatedResponse<AuditLog>> {
      return client
        .get<unknown>("/audit", {
          ...params,
          ...filters.dimension_params,
          from_date: toQueryDate(filters.from_date),
          to_date: toQueryDate(filters.to_date),
          table: filters.tables,
          action: filters.action,
          username: filters.username,
          sort_by: filters.sort_by,
        })
        .then(normalizeAuditLogList)
        .catch((error) => {
          if (
            error instanceof SuperpositionApiError &&
            error.status === 404 &&
            error.body.includes("No records found")
          ) {
            return {
              total_pages: 0,
              total_items: 0,
              data: [],
            } satisfies PaginatedResponse<AuditLog>;
          }

          throw error;
        });
    },
  };
}
