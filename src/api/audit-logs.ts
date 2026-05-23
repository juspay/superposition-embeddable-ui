import type {
    AuditLog,
    AuditLogListFilters,
    PaginatedResponse,
    PaginationParams,
} from "../types";
import type { SuperpositionClient } from "./client";

function toQueryDate(value?: Date): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function auditLogsApi(client: SuperpositionClient) {
  return {
    list(
      params: PaginationParams = {},
      filters: AuditLogListFilters = {},
    ): Promise<PaginatedResponse<AuditLog>> {
      return client.get<PaginatedResponse<AuditLog>>("/audit", {
        ...params,
        from_date: toQueryDate(filters.from_date),
        to_date: toQueryDate(filters.to_date),
        table: filters.tables,
        action: filters.action,
        username: filters.username,
        sort_by: filters.sort_by,
      });
    },
  };
}
