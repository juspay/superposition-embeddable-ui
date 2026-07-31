import {
  Button,
  ButtonSize,
  ButtonType,
  Tag,
  TagColor,
  TagShape,
  TagSize,
  TagVariant,
} from "@juspay/blend-design-system";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../blend-react-compat";
import {
  FormField,
  InlineNotice,
  inputStyle,
  JsonViewer,
  Modal,
  PageHeader,
  resolveTableSearchAlign,
  Table,
} from "../components";
import { useApi, useMutation } from "../hooks/useApi";
import { useAlerts } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { CreateDefaultConfigRequest, DefaultConfig, JsonValue } from "../types";
import {
  matchesPrefix,
  matchesSearchQuery,
  normalizeFilterValues,
  paginateRows,
} from "../utils";
import { formatErrorMessage } from "../utils/errors";
import { ConfigDetailPage } from "./ConfigDetailPage";
import {
  canUseFeatureAction,
  FeatureUnavailable,
  getMessage,
  isFeatureDetailPageEnabled,
  isFeatureEditable,
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
  /** Allow clicking a row to open the single default config detail page. Defaults to enabled. */
  enableDetailPage?: boolean;
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
    <span className="sp-config-key-pill" title={value}>
      <span>{value}</span>
    </span>
  );
}

function ValueCell({
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
      onClick={(event) => {
        if (!isInspectable) return;

        event.stopPropagation();
        onOpen("Resolved Value", value);
      }}
      style={{
        border: 0,
        padding: 0,
        background: "none",
        color: "inherit",
        font: "inherit",
        cursor: isInspectable ? "pointer" : "default",
        textAlign: "left",
      }}
    >
      <Tag
        text={preview}
        color={TagColor.SUCCESS}
        variant={TagVariant.SUBTLE}
        size={TagSize.SM}
        shape={TagShape.SQUARICAL}
        maxWidth="min(100%, 320px)"
      />
    </button>
  );
}

function SchemaCell({
  schema,
  onOpen,
}: {
  schema: DefaultConfig["schema"];
  onOpen: () => void;
}) {
  const preview = compactJsonPreview(schema as JsonValue, 42);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      title={prettyJson(schema)}
      style={{
        border: 0,
        padding: 0,
        background: "none",
        color: "inherit",
        font: "inherit",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <Tag
        text={preview}
        color={TagColor.NEUTRAL}
        variant={TagVariant.SUBTLE}
        size={TagSize.SM}
        shape={TagShape.SQUARICAL}
        maxWidth="min(100%, 360px)"
      />
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

function ConfigManagerContent({
  pageSize = 10,
  prefix,
  showResolvedValues = true,
  editable,
  enableDetailPage,
}: ConfigManagerProps) {
  const { config, defaultConfigs, resolve, scope } = useSuperposition();
  const { addAlert, confirmAction } = useAlerts();
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedConfigKey, setSelectedConfigKey] = useState<string | null>(null);
  const [detailsModal, setDetailsModal] = useState<{
    title: string;
    value: unknown;
  } | null>(null);
  const isEditable = isFeatureEditable(config, "config", editable);
  const detailPageEnabled = isFeatureDetailPageEnabled(
    config,
    "config",
    enableDetailPage,
  );
  const canCreate = isEditable && canUseFeatureAction(config, "config", "create");
  const canDelete = isEditable && canUseFeatureAction(config, "config", "delete");
  const prefixes = useMemo(
    () => normalizeFilterValues(prefix ?? config.filters?.defaultConfigPrefix),
    [config.filters?.defaultConfigPrefix, prefix],
  );
  const resolvedContext = scope.effectiveContext ?? {};
  const resolvedContextKey = JSON.stringify(resolvedContext);

  const { data, loading, error, refetch } = useApi(
    () =>
      showResolvedValues
        ? resolve.resolveDetailed(resolvedContext, { prefix: prefixes })
        : defaultConfigs.list({ all: true }, { prefix: prefixes }),
    [defaultConfigs, prefixes, resolve, showResolvedValues, resolvedContextKey],
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
        formatErrorMessage(err, "Could not create config. Please try again."),
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
    } catch (err) {
      addAlert("error", formatErrorMessage(err, "Could not delete config."));
    }
  };

  const filteredRows = useMemo(
    () =>
      (data?.data ?? [])
        .filter((row) => matchesPrefix(row.key, prefixes))
        .filter((row) => matchesSearchQuery([row.key], search)),
    [data?.data, prefixes, search],
  );
  const paginatedRows = useMemo(
    () => paginateRows(filteredRows, page, currentPageSize),
    [filteredRows, page, currentPageSize],
  );
  const rows = paginatedRows;
  const hasRows = rows.length > 0;
  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / currentPageSize));
  const startItem = hasRows ? (page - 1) * currentPageSize + 1 : 0;
  const pageOptions = Array.from(new Set([pageSize, 10, 20, 50])).sort(
    (left, right) => left - right,
  );
  const searchAlign = resolveTableSearchAlign(config.table, "config");

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  const configColumns = [
    {
      key: "key",
      header: "Key",
      width: "18%",
      render: (row: DefaultConfig) => <ConfigKeyPill value={row.key} />,
    },
    {
      key: "value",
      header: showResolvedValues ? "Resolved Value" : "Value",
      width: "28%",
      render: (row: DefaultConfig) => (
        <ValueCell
          value={row.value}
          onOpen={(title, value) => setDetailsModal({ title, value })}
        />
      ),
    },
    {
      key: "schema",
      header: "Schema",
      width: "22%",
      render: (row: DefaultConfig) => (
        <SchemaCell
          schema={row.schema}
          onOpen={() =>
            setDetailsModal({ title: `Schema for ${row.key}`, value: row.schema })
          }
        />
      ),
    },
    {
      key: "description",
      header: "Description",
      width: canDelete ? "32%" : "36%",
      render: (row: DefaultConfig) => (
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
            <Button
              type="button"
              buttonType={ButtonType.DANGER}
              size={ButtonSize.SMALL}
              text="Delete"
              leadingIcon={<Trash2 aria-hidden="true" size={14} />}
              onClick={(event) => {
                event?.stopPropagation();
                handleDelete(row.key);
              }}
            />
          )}
        </div>
      ),
    },
  ];

  if (detailPageEnabled && selectedConfigKey) {
    return (
      <ConfigDetailPage
        configKey={selectedConfigKey}
        backLabel="Back to configs"
        onBack={() => setSelectedConfigKey(null)}
      />
    );
  }

  return (
    <div className="sp-section-stack">
      <PageHeader
        title="Configs"
        description="Manage default configuration values and schemas."
        actions={
          canCreate ? (
            <Button
              buttonType={ButtonType.PRIMARY}
              size={ButtonSize.MEDIUM}
              text={getMessage(config, "config.create", "Create config")}
              leadingIcon={<Plus aria-hidden="true" size={16} />}
              onClick={() => setShowCreate(true)}
            />
          ) : undefined
        }
      />

      <div className="sp-section-stack sp-config-layout">
        {error && (
          <InlineNotice
            title="Could not load configs"
            description={error}
            tone="danger"
          />
        )}

        <Table
          className="sp-table-search-align"
          searchAlign={searchAlign}
          columns={configColumns}
          data={rows}
          keyExtractor={(row) => row.key}
          loading={loading}
          showSerialNumber
          serialNumberHeader="S.No"
          serialNumberStart={startItem || 1}
          searchPlaceholder="Search by key"
          onSearchChange={(nextSearch) => {
            setSearch(nextSearch);
            setPage(1);
          }}
          pagination={{
            currentPage: page,
            pageSize: currentPageSize,
            totalRows: totalItems,
            pageSizeOptions: pageOptions,
          }}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setCurrentPageSize(nextPageSize);
            setPage(1);
          }}
          onRowClick={
            detailPageEnabled ? (row) => setSelectedConfigKey(row.key) : undefined
          }
          tableBodyHeight="min(668px, 65vh)"
        />
      </div>

      <Modal
        open={Boolean(detailsModal)}
        onClose={() => setDetailsModal(null)}
        title={detailsModal?.title ?? "Details"}
        width="min(720px, calc(100vw - 32px))"
        maxWidth="720px"
      >
        <JsonViewer data={detailsModal?.value} collapsed={false} />
      </Modal>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Default Config"
        footer={
          <>
            <Button
              buttonType={ButtonType.SECONDARY}
              size={ButtonSize.MEDIUM}
              text="Cancel"
              onClick={() => setShowCreate(false)}
            />
            <Button
              buttonType={ButtonType.PRIMARY}
              size={ButtonSize.MEDIUM}
              text={createMutation.loading ? "Creating..." : "Create"}
              onClick={handleCreate}
              disabled={createDisabled}
              loading={createMutation.loading}
            />
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
