import type React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  FormField,
  inputStyle,
  JsonViewer,
  Modal,
  SearchField,
} from "../components";
import { useApi, useMutation } from "../hooks/useApi";
import { useAlerts } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { CreateDefaultConfigRequest, DefaultConfig, JsonValue } from "../types";
import { matchesPrefix, normalizeFilterValues } from "../utils";
import {
  canUseFeatureAction,
  FeatureUnavailable,
  getMessage,
  isFeatureEnabled,
} from "./FeatureGate";

export interface ConfigManagerProps {
  /** Items per page */
  pageSize?: number;
  /** Restrict default config keys to one or more prefixes */
  prefix?: string | string[];
  /** Resolve and display values using the active host scope */
  showResolvedValues?: boolean;
  /** Allow create/delete controls for default configs. Defaults to view-only. */
  editable?: boolean;
}

function applyResolvedValues(
  rows: DefaultConfig[],
  resolvedValues?: Record<string, JsonValue>,
): DefaultConfig[] {
  if (!resolvedValues) return rows;

  return rows.map((row) =>
    Object.prototype.hasOwnProperty.call(resolvedValues, row.key)
      ? { ...row, value: resolvedValues[row.key] }
      : row,
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
        strokeWidth="1.8"
      />
    </svg>
  );
}

function JsonIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 24,
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--sp-inline-radius)",
        background:
          "color-mix(in oklab, var(--sp-color-primary) 9%, var(--sp-color-panel))",
        color: "var(--sp-color-primary)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {"{}"}
    </span>
  );
}

function formatPrimitive(value: JsonValue): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  return JSON.stringify(value) ?? String(value);
}

function truncatePreview(preview: string, maxLength: number, closing = ""): string {
  if (preview.length <= maxLength) return preview;

  const suffix = closing ? `...${closing}` : "...";
  return `${preview.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
}

function compactJsonPreview(value: JsonValue, maxLength = 76): string {
  let preview: string;
  let closing = "";

  if (Array.isArray(value)) {
    if (value.length === 0) {
      preview = "[]";
    } else {
      const visible = value.slice(0, 3).map((item) => formatPrimitive(item as JsonValue));
      preview = `[ ${visible.join(", ")}${value.length > visible.length ? ", ..." : ""}]`;
    }
    closing = "]";
  } else if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, JsonValue>);
    const visible = entries
      .slice(0, 3)
      .map(([key, entry]) => `${JSON.stringify(key)}: ${formatPrimitive(entry)}`);
    preview = `{ ${visible.join(", ")}${entries.length > visible.length ? ", ..." : ""} }`;
    closing = "}";
  } else {
    preview = formatPrimitive(value);
  }

  return truncatePreview(preview, maxLength, closing);
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? String(value);
}

function ConfigKeyPill({ value }: { value: string }) {
  return (
    <code
      style={{
        display: "inline-flex",
        alignItems: "center",
        maxWidth: "100%",
        minHeight: 26,
        padding: "3px 9px",
        border: "1px solid color-mix(in oklab, var(--sp-color-primary) 18%, var(--sp-color-border))",
        borderRadius: "var(--sp-inline-radius)",
        background:
          "color-mix(in oklab, var(--sp-color-primary) 8%, var(--sp-color-panel))",
        color: "var(--sp-color-primary)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.8rem",
        fontWeight: 700,
        lineHeight: 1.25,
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

function ValueChip({
  value,
  onOpen,
}: {
  value: JsonValue;
  onOpen: (title: string, value: JsonValue) => void;
}) {
  const preview = compactJsonPreview(value, 42);
  const isInspectable =
    Array.isArray(value) ||
    (value !== null && typeof value === "object") ||
    preview.length >= 41;

  return (
    <button
      type="button"
      title={prettyJson(value)}
      onClick={() => {
        if (isInspectable) onOpen("Resolved Value", value);
      }}
      style={{
        maxWidth: "min(100%, 320px)",
        minHeight: 34,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "0 12px",
        overflow: "hidden",
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        border: "1px solid var(--sp-feedback-success-border)",
        borderRadius: "var(--sp-pill-radius)",
        backgroundColor: "var(--sp-feedback-success-bg)",
        color: "var(--sp-feedback-success-text)",
        boxShadow: "none",
        cursor: isInspectable ? "pointer" : "default",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "0.81rem",
        fontWeight: 580,
        lineHeight: 1.25,
        textAlign: "left",
        outline: "none",
      }}
    >
      <span
        style={{
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {preview}
      </span>
    </button>
  );
}

function SchemaPreviewButton({
  schema,
  onOpen,
}: {
  schema: DefaultConfig["schema"];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={prettyJson(schema)}
      style={{
        width: "min(100%, 360px)",
        minHeight: 34,
        display: "grid",
        gridTemplateColumns: "24px minmax(0, 1fr) 16px",
        alignItems: "center",
        gap: 9,
        padding: "5px 10px",
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-control-radius)",
        background: "var(--sp-color-surface-muted)",
        color: "var(--sp-color-text)",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: "0 1px 0 color-mix(in oklab, var(--sp-color-text) 4%, transparent)",
      }}
    >
      <JsonIcon />
      <code
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "var(--sp-color-text)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.78rem",
          fontWeight: 600,
          lineHeight: 1.35,
        }}
      >
        {compactJsonPreview(schema as JsonValue, 86)}
      </code>
      <span style={{ color: "var(--sp-color-muted)" }}>
        <ChevronDownIcon />
      </span>
    </button>
  );
}

function DescriptionText({ value }: { value?: string | null }) {
  const description = value || "No description";

  return (
    <span
      title={description}
      style={{
        display: "-webkit-box",
        maxWidth: 360,
        overflow: "hidden",
        color: value ? "var(--sp-color-text)" : "var(--sp-color-muted)",
        fontSize: "0.85rem",
        fontWeight: 450,
        lineHeight: 1.45,
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
      }}
    >
      {description}
    </span>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid var(--sp-color-border)",
  color: "var(--sp-color-muted)",
  fontSize: "0.78rem",
  fontWeight: 750,
  letterSpacing: 0,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tableCellStyle: React.CSSProperties = {
  height: 62,
  padding: "8px 14px",
  borderBottom: "1px solid var(--sp-color-border)",
  color: "var(--sp-color-text)",
  fontSize: "0.86rem",
  fontWeight: 450,
  verticalAlign: "middle",
};

function ConfigManagerContent({
  pageSize = 20,
  prefix,
  showResolvedValues = true,
  editable = false,
}: ConfigManagerProps) {
  const { config, defaultConfigs, resolve, scope } = useSuperposition();
  const { addAlert, confirmAction } = useAlerts();
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailsModal, setDetailsModal] = useState<{
    title: string;
    value: unknown;
  } | null>(null);
  const canCreate = editable && canUseFeatureAction(config, "config", "create");
  const canDelete = editable && canUseFeatureAction(config, "config", "delete");
  const prefixes = useMemo(
    () => normalizeFilterValues(prefix ?? config.filters?.defaultConfigPrefix),
    [config.filters?.defaultConfigPrefix, prefix],
  );
  const resolvedContext = scope.effectiveContext ?? {};
  const resolvedContextKey = JSON.stringify(resolvedContext);

  const { data, loading, error, refetch } = useApi(
    () =>
      defaultConfigs.list(
        { page, count: currentPageSize },
        { name: search || undefined, prefix: prefixes },
      ),
    [defaultConfigs, page, currentPageSize, search, prefixes],
  );

  const { data: resolvedValues } = useApi(
    () =>
      showResolvedValues
        ? resolve.resolve(resolvedContext)
        : Promise.resolve({} as Record<string, JsonValue>),
    [resolve, showResolvedValues, resolvedContextKey],
  );

  // Create form state
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("null");
  const [newSchema, setNewSchema] = useState('{"type": "string"}');
  const [newDesc, setNewDesc] = useState("");
  const [newReason, setNewReason] = useState("");

  const parsedValue = useMemo(() => {
    const trimmedValue = newValue.trim();

    if (!trimmedValue) {
      return { value: "", error: null, isImplicitString: true };
    }

    try {
      return {
        value: JSON.parse(trimmedValue) as DefaultConfig["value"],
        error: null,
        isImplicitString: false,
      };
    } catch {
      return {
        value: newValue,
        error: null,
        isImplicitString: true,
      };
    }
  }, [newValue]);

  const parsedSchema = useMemo(() => {
    try {
      const value = JSON.parse(newSchema) as Record<string, unknown>;
      if (!value || Array.isArray(value) || typeof value !== "object") {
        return { value: null, error: "Schema must be a JSON object." };
      }

      return { value, error: null };
    } catch {
      return {
        value: null,
        error: 'Enter valid schema JSON, for example {"type":"string"}.',
      };
    }
  }, [newSchema]);

  const createMutation = useMutation(
    useCallback(
      async (req: CreateDefaultConfigRequest) => {
        const result = await defaultConfigs.create(req);
        addAlert("success", `Config "${result.key}" created`);
        return result;
      },
      [defaultConfigs, addAlert],
    ),
  );

  const createDisabled =
    !canCreate ||
    createMutation.loading ||
    !newKey.trim() ||
    !newReason.trim() ||
    (newKey.trim() ? !matchesPrefix(newKey.trim(), prefixes) : false) ||
    !!parsedSchema.error;
  const keyPrefixError =
    newKey.trim() && !matchesPrefix(newKey.trim(), prefixes)
      ? `Key must start with ${prefixes?.join(" or ")}`
      : undefined;

  const deleteMutation = useMutation(
    useCallback(
      async (key: string) => {
        await defaultConfigs.delete(key);
        addAlert("success", `Config "${key}" deleted`);
      },
      [defaultConfigs, addAlert],
    ),
  );

  const handleCreate = async () => {
    if (keyPrefixError) {
      addAlert("error", keyPrefixError);
      return;
    }

    if (parsedValue.error) {
      addAlert("error", parsedValue.error);
      return;
    }

    if (parsedSchema.error) {
      addAlert("error", parsedSchema.error);
      return;
    }

    try {
      await createMutation.mutate({
        key: newKey.trim(),
        value: parsedValue.value,
        schema: parsedSchema.value as CreateDefaultConfigRequest["schema"],
        description: newDesc || "No description",
        change_reason: newReason.trim(),
      });
      setShowCreate(false);
      setNewKey("");
      setNewValue("null");
      setNewSchema('{"type": "string"}');
      setNewDesc("");
      setNewReason("");
      refetch();
    } catch (err) {
      addAlert(
        "error",
        err instanceof Error
          ? err.message
          : createMutation.error || "Failed to create config",
      );
    }
  };

  const handleDelete = async (key: string) => {
    const confirmed = await confirmAction({
      title: `Delete config "${key}"?`,
      description: "This removes the default config from the workspace.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      await deleteMutation.mutate(key);
      refetch();
    } catch {
      addAlert("error", deleteMutation.error || "Failed to delete config");
    }
  };

  const rows = applyResolvedValues(
    (data?.data ?? []).filter((row) => matchesPrefix(row.key, prefixes)),
    showResolvedValues ? (resolvedValues ?? undefined) : undefined,
  );
  const hasRows = rows.length > 0;
  const totalItems = data?.total_items ?? rows.length;
  const totalPages = Math.max(1, data?.total_pages ?? 1);
  const startItem = hasRows ? (page - 1) * currentPageSize + 1 : 0;
  const endItem = hasRows ? Math.min(startItem + rows.length - 1, totalItems) : 0;
  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const visiblePages = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, index) => firstVisiblePage + index,
  );
  const pageOptions = [10, 20, 50];

  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        fontFamily: "var(--sp-font-family)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--sp-page-title-font-size)",
              lineHeight: 1.08,
              fontWeight: "var(--sp-page-title-font-weight)",
              color: "var(--sp-page-title-text)",
            }}
          >
            Configs
          </h2>
          <p
            style={{
              margin: 0,
              color: "var(--sp-color-muted)",
              fontSize: "0.95rem",
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            Manage default configuration values and schemas.
          </p>
        </div>
        {canCreate && (
          <button style={buttonPrimary} onClick={() => setShowCreate(true)}>
            {getMessage(config, "config.create", "Create config")}
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 18,
          padding: "18px",
          border: "1px solid var(--sp-color-border)",
          borderRadius: "var(--sp-card-radius)",
          background: "var(--sp-color-panel)",
          boxShadow: "var(--sp-shadow-sm)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "min(100%, 360px)",
            }}
          >
            <SearchField
              placeholder="Search by key"
              value={search}
              onChange={(nextSearch) => {
                setSearch(nextSearch);
                setPage(1);
              }}
            />
            {!search && (
              <kbd
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  minHeight: 24,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 7px",
                  border: "1px solid var(--sp-color-border)",
                  borderRadius: "var(--sp-inline-radius)",
                  background: "var(--sp-color-surface-muted)",
                  color: "var(--sp-color-muted)",
                  fontFamily: "var(--sp-font-family)",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        {error && (
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
            Failed to load configs: {error}
          </div>
        )}

        <div
          style={{
            overflowX: "auto",
            border: "1px solid var(--sp-color-border)",
            borderRadius: "var(--sp-card-radius)",
            background: "var(--sp-color-panel)",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 860,
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 70 }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "34%" }} />
              <col style={{ width: "26%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>S.No</th>
                <th style={tableHeaderStyle}>Key</th>
                <th style={tableHeaderStyle}>
                  {showResolvedValues ? "Resolved Value" : "Value"}
                </th>
                <th style={tableHeaderStyle}>Schema</th>
                <th style={tableHeaderStyle}>Description</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...tableCellStyle,
                      height: 120,
                      textAlign: "center",
                      color: "var(--sp-color-muted)",
                    }}
                  >
                    Loading configs...
                  </td>
                </tr>
              )}
              {!loading && !hasRows && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...tableCellStyle,
                      height: 120,
                      textAlign: "center",
                      color: "var(--sp-color-muted)",
                    }}
                  >
                    No configs found
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row, index) => (
                  <tr key={row.key} className="sp-config-row">
                    <td style={tableCellStyle}>
                      {startItem + index}
                    </td>
                    <td style={tableCellStyle}>
                      <ConfigKeyPill value={row.key} />
                    </td>
                    <td style={tableCellStyle}>
                      <ValueChip
                        value={row.value}
                        onOpen={(title, value) => setDetailsModal({ title, value })}
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <SchemaPreviewButton
                        schema={row.schema}
                        onOpen={() =>
                          setDetailsModal({ title: `Schema for ${row.key}`, value: row.schema })
                        }
                      />
                    </td>
                    <td style={tableCellStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <DescriptionText value={row.description} />
                        {canDelete && (
                          <button
                            type="button"
                            style={{
                              ...buttonDanger,
                              minHeight: 30,
                              padding: "0 10px",
                              fontSize: "0.78rem",
                              flex: "0 0 auto",
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(row.key);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "0 4px",
          }}
        >
          <span
            style={{
              color: "var(--sp-color-muted)",
              fontSize: "0.84rem",
              fontWeight: 550,
            }}
          >
            Showing {startItem} to {endItem} of {totalItems} records
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <select
              aria-label="Rows per page"
              value={currentPageSize}
              onChange={(event) => {
                setCurrentPageSize(Number(event.target.value));
                setPage(1);
              }}
              style={{
                minHeight: 34,
                padding: "0 30px 0 10px",
                border: "1px solid var(--sp-color-border)",
                borderRadius: "var(--sp-inline-radius)",
                background: "var(--sp-color-panel)",
                color: "var(--sp-color-text)",
                fontSize: "0.82rem",
                fontWeight: 650,
              }}
            >
              {pageOptions.map((option) => (
                <option key={option} value={option}>
                  {option} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              style={{
                ...buttonSecondary,
                width: 34,
                minHeight: 34,
                padding: 0,
                opacity: page <= 1 ? 0.5 : 1,
              }}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {"<"}
            </button>
            {visiblePages.map((pageNumber) => {
              return (
                <button
                  type="button"
                  key={pageNumber}
                  aria-current={pageNumber === page ? "page" : undefined}
                  style={{
                    ...buttonSecondary,
                    width: 34,
                    minHeight: 34,
                    padding: 0,
                    borderColor:
                      pageNumber === page
                        ? "var(--sp-color-primary)"
                        : "var(--sp-button-secondary-border)",
                    color:
                      pageNumber === page
                        ? "var(--sp-color-primary)"
                        : "var(--sp-button-secondary-text)",
                    background:
                      pageNumber === page
                        ? "var(--sp-color-primary-soft)"
                        : "var(--sp-button-secondary-bg)",
                  }}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= totalPages}
              style={{
                ...buttonSecondary,
                width: 34,
                minHeight: 34,
                padding: 0,
                opacity: page >= totalPages ? 0.5 : 1,
              }}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              {">"}
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(detailsModal)}
        onClose={() => setDetailsModal(null)}
        title={detailsModal?.title ?? "Details"}
        width="min(720px, calc(100vw - 32px))"
        maxWidth="720px"
        footer={
          <button style={buttonSecondary} onClick={() => setDetailsModal(null)}>
            Close
          </button>
        }
      >
        <JsonViewer data={detailsModal?.value} collapsed={false} />
      </Modal>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Default Config"
        footer={
          <>
            <button style={buttonSecondary} onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button
              style={{
                ...buttonPrimary,
                opacity: createDisabled ? 0.55 : 1,
                cursor: createDisabled ? "not-allowed" : "pointer",
              }}
              onClick={handleCreate}
              disabled={createDisabled}
            >
              {createMutation.loading ? "Creating..." : "Create"}
            </button>
          </>
        }
      >
        <FormField label="Key" required error={keyPrefixError}>
          <input
            style={inputStyle}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder={
              prefixes?.[0] ? `${prefixes[0]}config.key.name` : "config.key.name"
            }
          />
        </FormField>
        <FormField label="Value" required error={parsedValue.error ?? undefined}>
          <textarea
            style={{ ...inputStyle, fontFamily: "monospace", minHeight: 60 }}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder='JSON or plain text, for example "hello", 42, true, or hello'
          />
        </FormField>
        <p
          style={{ margin: "-8px 0 12px", fontSize: 12, color: "var(--sp-color-muted)" }}
        >
          Plain text is stored as a string.
        </p>
        <FormField label="Schema (JSON)" required error={parsedSchema.error ?? undefined}>
          <textarea
            style={{ ...inputStyle, fontFamily: "monospace", minHeight: 60 }}
            value={newSchema}
            onChange={(e) => setNewSchema(e.target.value)}
          />
        </FormField>
        <FormField label="Description">
          <input
            style={inputStyle}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Short operator-facing description"
          />
        </FormField>
        <FormField label="Change Reason" required>
          <input
            style={inputStyle}
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Reason for this change"
          />
        </FormField>
        {createMutation.error && (
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
            {createMutation.error}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function ConfigManager(props: ConfigManagerProps) {
  const { config } = useSuperposition();

  if (!isFeatureEnabled(config.features, "config")) {
    return (
      <FeatureUnavailable
        feature="Configs"
        message={getMessage(
          config,
          "feature.disabled",
          "{feature} is not enabled for this embed.",
          { feature: "Configs" },
        )}
      />
    );
  }

  return <ConfigManagerContent {...props} />;
}
