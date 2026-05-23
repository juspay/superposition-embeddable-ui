import type {
  Config,
  DefaultConfig,
  JsonValue,
  MergeStrategy,
  PaginatedResponse,
  ResolvedConfigExplanation,
} from "../types";
import type { SuperpositionClient } from "./client";

interface DetailedResolveOptions {
  prefix?: string[];
  mergeStrategy?: MergeStrategy;
}

interface ExplainResolveOptions {
  version?: string;
  contextId?: string;
  resolveRemote?: boolean;
  mergeStrategy?: MergeStrategy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function defaultConfigFromEntry(key: string, entry: unknown): DefaultConfig {
  if (!isRecord(entry)) {
    return {
      key,
      value: entry as JsonValue,
      schema: {},
    } as DefaultConfig;
  }

  const resolvedValue = hasOwn(entry, "value")
    ? entry.value
    : hasOwn(entry, "resolved_value")
      ? entry.resolved_value
      : hasOwn(entry, "resolvedValue")
        ? entry.resolvedValue
        : entry;

  return {
    ...entry,
    key: typeof entry.key === "string" ? entry.key : key,
    value: resolvedValue as JsonValue,
    schema: (hasOwn(entry, "schema") ? entry.schema : {}) as DefaultConfig["schema"],
  } as DefaultConfig;
}

function normalizeDetailedResolvedConfig(
  payload: unknown,
): PaginatedResponse<DefaultConfig> {
  let rows: DefaultConfig[] = [];

  if (Array.isArray(payload)) {
    rows = payload.map((entry, index) => {
      const key =
        isRecord(entry) && typeof entry.key === "string" ? entry.key : String(index);
      return defaultConfigFromEntry(key, entry);
    });
  } else if (isRecord(payload)) {
    if (isRecord(payload.config)) {
      return normalizeDetailedResolvedConfig(payload.config);
    }

    if (Array.isArray(payload.data)) {
      return normalizeDetailedResolvedConfig(payload.data);
    }

    if (typeof payload.key === "string" && hasOwn(payload, "value")) {
      rows = [defaultConfigFromEntry(payload.key, payload)];
    } else {
      rows = Object.entries(payload).map(([key, entry]) =>
        defaultConfigFromEntry(key, entry),
      );
    }
  }

  return {
    total_pages: rows.length > 0 ? 1 : 0,
    total_items: rows.length,
    data: rows,
  };
}

export function resolveApi(client: SuperpositionClient) {
  return {
    getConfig(context: Record<string, JsonValue> = {}): Promise<Config> {
      return client.get("/config", { dimension: context });
    },

    resolve(
      context: Record<string, JsonValue>,
      mergeStrategy?: MergeStrategy,
    ): Promise<Record<string, JsonValue>> {
      return client.post(
        "/config/resolve",
        { context },
        { merge_strategy: mergeStrategy },
      );
    },

    resolveDetailed(
      context: Record<string, JsonValue> = {},
      options: DetailedResolveOptions = {},
    ): Promise<PaginatedResponse<DefaultConfig>> {
      return client
        .post<unknown>(
          "/config/resolve/detailed",
          { context },
          {
            prefix: options.prefix,
            merge_strategy: options.mergeStrategy,
          },
        )
        .then(normalizeDetailedResolvedConfig);
    },

    explain(
      key: string,
      context: Record<string, JsonValue> = {},
      options: ExplainResolveOptions = {},
    ): Promise<ResolvedConfigExplanation> {
      return client.post(
        `/config/resolve/explain/${encodeURIComponent(key)}`,
        { context },
        {
          version: options.version,
          context_id: options.contextId,
          resolve_remote: options.resolveRemote,
        },
        options.mergeStrategy ? { "x-merge-strategy": options.mergeStrategy } : undefined,
      );
    },
  };
}
