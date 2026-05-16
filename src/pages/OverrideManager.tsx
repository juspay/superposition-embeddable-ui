import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldEntryState } from "../components";
import {
  buttonPrimary,
  buttonSecondary,
  ConditionBadges,
  defaultEntryFromSchema,
  EmptyState,
  FormField,
  inputStyle,
  Modal,
  Pagination,
  SearchField,
  StructuredContextOverrideForm,
  Tooltip,
} from "../components";
import { useApi, useMutation } from "../hooks/useApi";
import { useAlerts } from "../providers/AlertProvider";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { ContextOverride, JsonValue, PutContextRequest } from "../types";
import {
  filterRecordByPrefix,
  matchesPrefix,
  mergeScopedContext,
  normalizeFilterValues,
} from "../utils";
import { contextCanBeEditedInScope } from "../utils/context-filter";
import {
  canUseFeatureAction,
  FeatureUnavailable,
  getMessage,
  isFeatureEnabled,
} from "./FeatureGate";

export interface OverrideManagerProps {
  pageSize?: number;
  /** Restrict overrideable default config keys to one or more prefixes */
  defaultConfigPrefix?: string | string[];
}

type OverrideContext = NonNullable<PutContextRequest["context"]>;

function filterOverrideValuesByPrefix(
  row: ContextOverride,
  prefixes?: string[],
): ContextOverride | null {
  if (!prefixes || prefixes.length === 0) return row;

  const override_ = filterRecordByPrefix(row.override_, prefixes);

  if (Object.keys(override_).length === 0) return null;
  return { ...row, override_ };
}

function entryFromOverrideValue(
  key: string,
  value: JsonValue,
  schema?: Record<string, JsonValue>,
): FieldEntryState {
  const entry = defaultEntryFromSchema(key, schema);
  return {
    ...entry,
    value,
    draft: entry.draft === undefined ? undefined : JSON.stringify(value, null, 2),
  };
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-icon-color)", flex: "0 0 auto" }}
    >
      <path
        d="M4.25 14.75 5 11.5 12.7 3.8a1.7 1.7 0 0 1 2.4 0l1.1 1.1a1.7 1.7 0 0 1 0 2.4l-7.7 7.7-3.25.75a.85.85 0 0 1-1-1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m11.55 4.95 3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChangeInfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-icon-color)", flex: "0 0 auto" }}
    >
      <rect x="3" y="6" width="14" height="8" rx="2.2" fill="currentColor" />
      <circle cx="7" cy="10" r="1" fill="var(--sp-color-panel)" />
      <circle cx="10" cy="10" r="1" fill="var(--sp-color-panel)" />
      <circle cx="13" cy="10" r="1" fill="var(--sp-color-panel)" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-icon-color)", flex: "0 0 auto" }}
    >
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10 9.4v4.1M10 6.5h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "var(--sp-icon-color)", flex: "0 0 auto" }}
    >
      <path
        d="M4.6 7.4A6 6 0 1 1 4 10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.4 4.7v2.9h2.9M10 6.8v3.4l2.4 1.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function jsonCellValue(value: JsonValue) {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}

function formatErrorMessage(error: string): string {
  const apiError = error.match(/^API error (\d+) for .*:\s*(.*)$/);
  if (!apiError) return error;

  const [, status, detail] = apiError;
  return detail ? `API error ${status}. ${detail}` : `API error ${status}.`;
}

function DeleteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="var(--sp-icon-size)"
      height="var(--sp-icon-size)"
      style={{ color: "currentColor", flex: "0 0 auto" }}
    >
      <path
        d="M17 6h5v2h-2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8H2V6h5V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3ZM6 8v12h12V8H6Zm3 3h2v6H9v-6Zm4 0h2v6h-2v-6ZM9 4v2h6V4H9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-space-sm)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-space-sm)",
          fontSize: "1rem",
          fontWeight: 700,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          minHeight: 48,
          padding: "var(--sp-space-md)",
          border: "1px solid var(--sp-color-border)",
          borderRadius: "var(--sp-control-radius)",
          background: "var(--sp-color-surface-muted)",
          color: value ? "var(--sp-color-text)" : "var(--sp-color-muted)",
          fontSize: "1rem",
          lineHeight: 1.45,
        }}
      >
        {value || "Not provided"}
      </div>
    </div>
  );
}

function OverrideCard({
  row,
  lockedDims,
  canEdit,
  canEditRow,
  canDelete,
  onEdit,
  onDelete,
}: {
  row: ContextOverride;
  lockedDims: string[];
  canEdit: boolean;
  canEditRow: boolean;
  canDelete: boolean;
  onEdit: (row: ContextOverride) => void;
  onDelete: (row: ContextOverride) => void;
}) {
  const [showChangeInfo, setShowChangeInfo] = useState(false);
  const overrideEntries = Object.entries(row.override_);

  return (
    <article
      style={{
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-card-radius)",
        background: "var(--sp-color-panel)",
        boxShadow:
          "0 16px 42px color-mix(in oklab, var(--sp-color-text) 6%, transparent)",
        padding: "calc(var(--sp-space-lg) * 1.25)",
        display: "grid",
        gap: "calc(var(--sp-space-lg) * 1.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--sp-space-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{
              padding: "10px 18px",
              borderRadius: "var(--sp-control-radius)",
              border: "1px solid var(--sp-color-border)",
              background: "var(--sp-color-panel)",
              fontWeight: 800,
              fontSize: "1.05rem",
              lineHeight: 1.1,
            }}
          >
            Condition
          </div>
          <Tooltip content="View change information">
            <button
              type="button"
              aria-label={`View change information for ${row.id}`}
              style={{
                ...buttonSecondary,
                width: 32,
                height: 28,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--sp-inline-radius)",
                borderColor: "transparent",
                background: "transparent",
                boxShadow: "none",
              }}
              onClick={() => setShowChangeInfo(true)}
            >
              <ChangeInfoIcon />
            </button>
          </Tooltip>
        </div>
        {((canEdit && canEditRow) || canDelete) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {canEdit && canEditRow && (
              <Tooltip content="Edit override">
                <button
                  type="button"
                  aria-label={`Edit override ${row.id}`}
                  style={{
                    ...buttonSecondary,
                    width: 40,
                    height: 36,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--sp-inline-radius)",
                    borderColor: "var(--sp-color-border)",
                    background: "var(--sp-color-panel)",
                    boxShadow: "none",
                  }}
                  onClick={() => onEdit(row)}
                >
                  <EditIcon />
                </button>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip content="Delete override">
                <button
                  type="button"
                  aria-label={`Delete override ${row.id}`}
                  style={{
                    ...buttonSecondary,
                    width: 40,
                    height: 36,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--sp-inline-radius)",
                    color: "var(--sp-form-remove-button-text)",
                    borderColor: "var(--sp-form-remove-button-border)",
                    background: "var(--sp-form-remove-button-bg)",
                    boxShadow: "none",
                  }}
                  onClick={() => onDelete(row)}
                >
                  <DeleteIcon />
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          paddingLeft: 0,
          minHeight: 82,
          display: "flex",
          alignItems: "center",
        }}
      >
        <ConditionBadges condition={row.value} lockedKeys={lockedDims} showConjunction />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 520,
            borderCollapse: "separate",
            borderSpacing: 0,
            color: "var(--sp-color-text)",
          }}
        >
          <thead>
            <tr>
              <th
                aria-label="Index"
                style={{
                  width: 72,
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--sp-color-border)",
                }}
              />
              <th
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--sp-color-border)",
                  fontSize: "1rem",
                  fontWeight: 800,
                }}
              >
                Key
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--sp-color-border)",
                  borderLeft: "1px solid var(--sp-color-border)",
                  boxShadow:
                    "-8px 0 14px -14px color-mix(in oklab, var(--sp-color-text) 45%, transparent)",
                  fontSize: "1rem",
                  fontWeight: 800,
                }}
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {overrideEntries.map(([key, value], index) => (
              <tr key={key}>
                <td
                  style={{
                    width: 72,
                    padding: "16px 14px",
                    borderBottom: "1px solid var(--sp-color-border)",
                    color: "var(--sp-color-text)",
                  }}
                >
                  {index + 1}
                </td>
                <td
                  style={{
                    padding: "16px 14px",
                    borderBottom: "1px solid var(--sp-color-border)",
                    fontWeight: 400,
                  }}
                >
                  {key}
                </td>
                <td
                  style={{
                    padding: "16px 14px",
                    borderBottom: "1px solid var(--sp-color-border)",
                    borderLeft: "1px solid var(--sp-color-border)",
                    boxShadow:
                      "-8px 0 14px -14px color-mix(in oklab, var(--sp-color-text) 45%, transparent)",
                    fontWeight: 400,
                    wordBreak: "break-word",
                  }}
                >
                  {jsonCellValue(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={showChangeInfo}
        onClose={() => setShowChangeInfo(false)}
        title="Change Information"
      >
        <div style={{ display: "grid", gap: "var(--sp-space-lg)" }}>
          <InfoBlock icon={<InfoIcon />} label="Description" value={row.description} />
          <InfoBlock
            icon={<HistoryIcon />}
            label="Reason for Change"
            value={row.change_reason}
          />
        </div>
      </Modal>
    </article>
  );
}

function OverrideManagerContent({
  pageSize = 20,
  defaultConfigPrefix,
}: OverrideManagerProps) {
  const { overrides, config, scope, defaultConfigs, dimensions } = useSuperposition();
  const { addAlert, confirmAction } = useAlerts();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingOverride, setEditingOverride] = useState<ContextOverride | null>(null);
  const [contextEntries, setContextEntries] = useState<FieldEntryState[]>([]);
  const [overrideEntries, setOverrideEntries] = useState<FieldEntryState[]>([]);
  const [newDesc, setNewDesc] = useState("");
  const [newReason, setNewReason] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  const scopedContext = scope.effectiveContext;
  const hasScopedContext = Boolean(
    scopedContext && Object.keys(scopedContext).length > 0,
  );
  const canEditContext = config.capabilities?.overrides?.editContext === true;
  const canCreate = canUseFeatureAction(config, "overrides", "create");
  const canEdit = canUseFeatureAction(config, "overrides", "update");
  const canDelete = canUseFeatureAction(config, "overrides", "delete");
  const lockDimensions = config.scope?.locked !== false;
  const lockedDims = lockDimensions ? scope.lockedDimensions : [];
  const defaultConfigPrefixes = useMemo(
    () =>
      normalizeFilterValues(defaultConfigPrefix ?? config.filters?.defaultConfigPrefix),
    [config.filters?.defaultConfigPrefix, defaultConfigPrefix],
  );
  const dimensionMatchStrategy = hasScopedContext
    ? config.strict === true
      ? "exact"
      : "subset"
    : undefined;

  const { data, loading, error, refetch } = useApi(
    () =>
      overrides.list(
        { page, count: pageSize },
        {
          plaintext: search || undefined,
          prefix: defaultConfigPrefixes,
          dimension: scopedContext,
          dimension_match_strategy: dimensionMatchStrategy,
        },
      ),
    [
      defaultConfigPrefixes,
      dimensionMatchStrategy,
      overrides,
      page,
      pageSize,
      scopedContext,
      search,
    ],
  );

  const { data: defaultConfigsData } = useApi(
    () => defaultConfigs.list({ all: true }, { prefix: defaultConfigPrefixes }),
    [defaultConfigs, defaultConfigPrefixes],
  );

  const { data: dimensionsData } = useApi(
    () => dimensions.list({ all: true }),
    [dimensions],
  );

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.data
      .map((row) => filterOverrideValuesByPrefix(row, defaultConfigPrefixes))
      .filter((row): row is ContextOverride => Boolean(row));
  }, [data, defaultConfigPrefixes]);

  useEffect(() => {
    if (data && page > 1 && page > (data.total_pages || 1)) {
      setPage(Math.max(1, data.total_pages || 1));
    }
  }, [data, page]);

  const defaultConfigOptions = useMemo(
    () =>
      (defaultConfigsData?.data ?? []).filter((item) =>
        matchesPrefix(item.key, defaultConfigPrefixes),
      ),
    [defaultConfigPrefixes, defaultConfigsData?.data],
  );

  const dimensionOptions = useMemo(
    () => dimensionsData?.data ?? [],
    [dimensionsData?.data],
  );

  const defaultConfigByKey = useMemo(
    () => new Map(defaultConfigOptions.map((item) => [item.key, item])),
    [defaultConfigOptions],
  );

  const openCreateModal = useCallback(() => {
    setEditingOverride(null);
    setContextEntries([]);
    setOverrideEntries([]);
    setNewDesc("");
    setNewReason("");
    setFormSubmitted(false);
    setShowEditor(true);
  }, []);

  const contextCanBeMutated = useCallback(
    (context: OverrideContext) => {
      if (scopedContext) {
        return contextCanBeEditedInScope(context, scopedContext);
      }

      return canEdit;
    },
    [canEdit, scopedContext],
  );

  const openEditModal = useCallback(
    (row: ContextOverride) => {
      if (!contextCanBeMutated(row.value)) {
        addAlert(
          "warning",
          "This override cannot be edited from the current scoped view.",
        );
        return;
      }

      setEditingOverride(row);
      setContextEntries([]);
      setOverrideEntries(
        Object.entries(row.override_).map(([key, value]) =>
          entryFromOverrideValue(key, value, defaultConfigByKey.get(key)?.schema),
        ),
      );
      setNewDesc(row.description ?? "");
      setNewReason("");
      setFormSubmitted(false);
      setShowEditor(true);
    },
    [addAlert, contextCanBeMutated, defaultConfigByKey],
  );

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditingOverride(null);
    setContextEntries([]);
    setOverrideEntries([]);
    setNewDesc("");
    setNewReason("");
    setFormSubmitted(false);
  }, []);

  const deleteMutation = useMutation(
    useCallback(
      async (id: string) => {
        await overrides.delete(id);
        addAlert("success", getMessage(config, "overrides.deleted", "Override deleted"));
      },
      [overrides, addAlert, config],
    ),
  );

  const handleDelete = useCallback(
    async (row: ContextOverride) => {
      const confirmed = await confirmAction({
        title: `Delete override?`,
        description: "This will permanently remove this override.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        variant: "destructive",
      });
      if (!confirmed) return;

      try {
        await deleteMutation.mutate(row.id);
        refetch();
      } catch {
        addAlert("error", deleteMutation.error || "Failed to delete override");
      }
    },
    [confirmAction, deleteMutation, addAlert, refetch],
  );

  const addContextKey = useCallback(
    (key: string) => {
      const dimension = dimensionOptions.find((item) => item.dimension === key);
      if (!dimension) return;

      setContextEntries((current) => [
        ...current,
        defaultEntryFromSchema(key, dimension.schema, {
          required: dimension.mandatory,
        }),
      ]);
    },
    [dimensionOptions],
  );

  const updateContextEntry = useCallback(
    (key: string, update: Partial<FieldEntryState>) => {
      setContextEntries((current) =>
        current.map((entry) => (entry.key === key ? { ...entry, ...update } : entry)),
      );
    },
    [],
  );

  const removeContextKey = useCallback((key: string) => {
    setContextEntries((current) => current.filter((entry) => entry.key !== key));
  }, []);

  const updateOverrideEntry = useCallback(
    (key: string, update: Partial<FieldEntryState>) => {
      setOverrideEntries((current) =>
        current.map((entry) => (entry.key === key ? { ...entry, ...update } : entry)),
      );
    },
    [],
  );

  const contextObject = useMemo(
    () =>
      Object.fromEntries(
        contextEntries.map((entry) => [entry.key, entry.value]),
      ) as OverrideContext,
    [contextEntries],
  );

  const overrideObject = useMemo(
    () =>
      Object.fromEntries(
        overrideEntries.map((entry) => [entry.key, entry.value]),
      ) as PutContextRequest["override"],
    [overrideEntries],
  );
  const showCreateContextFields =
    !editingOverride && (!hasScopedContext || canEditContext);
  const requiresContextEntries = !editingOverride && !hasScopedContext;

  const parsedContext = useMemo(() => {
    const invalidEntry = contextEntries.find((entry) => entry.error);
    if (invalidEntry) {
      return {
        value: null,
        error: invalidEntry.error ?? "Context contains an invalid value.",
      };
    }

    if (requiresContextEntries && contextEntries.length === 0) {
      return { value: null, error: "Add at least one context condition." };
    }

    return { value: contextObject, error: null };
  }, [contextEntries, contextObject, editingOverride, requiresContextEntries]);

  const parsedOverride = useMemo(() => {
    const invalidEntry = overrideEntries.find((entry) => entry.error);
    if (invalidEntry) {
      return {
        value: null,
        error: invalidEntry.error ?? "Overrides contain an invalid value.",
      };
    }

    if (overrideEntries.length === 0) {
      return { value: null, error: "Add at least one override value." };
    }

    return { value: overrideObject, error: null };
  }, [overrideEntries, overrideObject]);

  const saveMutation = useMutation(
    useCallback(
      async (req: PutContextRequest) => {
        return editingOverride ? overrides.update(req) : overrides.create(req);
      },
      [editingOverride, overrides],
    ),
  );

  const handleSave = async () => {
    setFormSubmitted(true);

    if (parsedContext.error) {
      addAlert("error", parsedContext.error);
      return;
    }

    if (parsedOverride.error) {
      addAlert("error", parsedOverride.error);
      return;
    }

    if (!newReason.trim()) {
      addAlert("error", "Enter a reason for this change.");
      return;
    }

    try {
      const context =
        editingOverride?.value ??
        mergeScopedContext(parsedContext.value ?? {}, scopedContext);
      await saveMutation.mutate({
        context,
        override: parsedOverride.value as PutContextRequest["override"],
        description: newDesc || undefined,
        change_reason:
          newReason ||
          (editingOverride ? "Updated via admin UI" : "Created via admin UI"),
      });
      addAlert(
        "success",
        editingOverride
          ? getMessage(config, "overrides.updated", "Override updated")
          : getMessage(config, "overrides.created", "Override created"),
      );
      closeEditor();
      refetch();
    } catch {
      addAlert(
        "error",
        saveMutation.error ||
          (editingOverride ? "Failed to update override" : "Failed to create override"),
      );
    }
  };

  const rows = filteredData;
  const hasRows = rows.length > 0;
  const totalPages = data?.total_pages ?? 0;
  const trimmedSearch = search.trim();
  const canSave = editingOverride ? canEdit : canCreate;
  const reasonError =
    formSubmitted && !newReason.trim() ? "Enter a reason for this change." : undefined;
  const saveDisabled = !canSave || saveMutation.loading;
  const editorContext = editingOverride?.value ?? scopedContext;
  const editorLockedKeys = editorContext ? Object.keys(editorContext) : [];
  const showSearch = hasRows || Boolean(trimmedSearch);
  const renderCreateOverrideAction = () =>
    canCreate ? (
      <button style={buttonPrimary} onClick={openCreateModal}>
        {getMessage(config, "overrides.create", "Create override")}
      </button>
    ) : undefined;
  const emptyTitle = trimmedSearch ? "No matching overrides" : "No overrides found";
  const emptyDescription = trimmedSearch
    ? "Try a different search term or clear the search field."
    : hasScopedContext
      ? "This scoped context does not have any overrides yet."
      : "Create an override to customize config values for a context.";
  const emptyAction = trimmedSearch ? (
    <button style={buttonSecondary} onClick={() => setSearch("")}>
      Clear search
    </button>
  ) : undefined;
  const errorDescription = error ? formatErrorMessage(error) : undefined;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: "var(--sp-page-title-margin)",
            fontSize: "var(--sp-page-title-font-size)",
            lineHeight: 1.08,
            fontWeight: "var(--sp-page-title-font-weight)",
            color: "var(--sp-page-title-text)",
          }}
        >
          Overrides
        </h2>
        {renderCreateOverrideAction()}
      </div>

      {(!canCreate || hasScopedContext) && (
        <div style={{ display: "grid", gap: 10 }}>
          {!canCreate && (config.readOnly || hasScopedContext) && (
            <div
              style={{
                padding: "var(--sp-banner-padding)",
                borderRadius: "var(--sp-banner-radius)",
                background: "var(--sp-banner-bg)",
                border: "1px solid var(--sp-banner-border)",
                color: "var(--sp-banner-text)",
                fontSize: "var(--sp-banner-font-size)",
                fontWeight: "var(--sp-banner-font-weight)",
              }}
            >
              {getMessage(config, "common.readOnly", "Read-only mode")}
            </div>
          )}
          {hasScopedContext && scopedContext && (
            <div
              style={{
                padding: "var(--sp-banner-padding)",
                borderRadius: "var(--sp-banner-radius)",
                background: "var(--sp-banner-bg)",
                border: "1px solid var(--sp-banner-border)",
                color: "var(--sp-banner-text)",
                fontSize: "var(--sp-banner-font-size)",
                fontWeight: "var(--sp-banner-font-weight)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {getMessage(config, "common.fixedScope", "Fixed Scope")}
              </div>
              <ConditionBadges condition={scopedContext} lockedKeys={lockedDims} />
            </div>
          )}
        </div>
      )}

      {showSearch && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <SearchField
            placeholder="Search overrides"
            value={search}
            onChange={(nextSearch) => {
              setSearch(nextSearch);
              setPage(1);
            }}
          />
        </div>
      )}

      {error && hasRows && (
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
          Failed to load overrides: {error}
        </div>
      )}

      {loading ? (
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
      ) : error ? (
        <EmptyState
          title="Could not load overrides"
          description={errorDescription}
          tone="danger"
          minHeight="var(--sp-table-empty-min-height)"
        />
      ) : hasRows ? (
        <div style={{ display: "grid", gap: "var(--sp-space-md)" }}>
          {rows.map((row) => (
            <OverrideCard
              key={row.id}
              row={row}
              lockedDims={lockedDims}
              canEdit={canEdit}
              canEditRow={contextCanBeMutated(row.value)}
              canDelete={canDelete}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          minHeight="var(--sp-table-empty-min-height)"
        />
      )}

      {data && hasRows && totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Modal
        open={showEditor}
        onClose={closeEditor}
        title={editingOverride ? "Edit Overrides" : "Create Overrides"}
        footer={
          <>
            <button style={buttonSecondary} onClick={closeEditor}>
              Cancel
            </button>
            <button style={buttonPrimary} onClick={handleSave} disabled={saveDisabled}>
              {saveMutation.loading
                ? editingOverride
                  ? "Saving..."
                  : "Creating..."
                : editingOverride
                  ? "Save"
                  : "Create"}
            </button>
          </>
        }
      >
        <StructuredContextOverrideForm
          contextEntries={contextEntries}
          overrideEntries={overrideEntries}
          dimensions={dimensionOptions}
          defaultConfigs={defaultConfigOptions}
          lockedScope={editorContext}
          lockedKeys={editingOverride ? editorLockedKeys : lockedDims}
          showContextFields={showCreateContextFields}
          showOverrideFields={false}
          showValidationErrors={formSubmitted}
          onAddContextKey={addContextKey}
          onUpdateContextEntry={updateContextEntry}
          onRemoveContextKey={removeContextKey}
          onAddOverrideKey={(key) => {
            const configItem = defaultConfigOptions.find((item) => item.key === key);
            if (!configItem) return;
            setOverrideEntries((current) => [
              ...current,
              defaultEntryFromSchema(key, configItem.schema),
            ]);
          }}
          onUpdateOverrideEntry={updateOverrideEntry}
          onRemoveOverrideKey={(key) =>
            setOverrideEntries((current) => current.filter((entry) => entry.key !== key))
          }
        />
        {formSubmitted && parsedContext.error && (
          <div
            style={{
              marginTop: -6,
              padding: "10px 12px",
              borderRadius: "var(--sp-inline-radius)",
              background: "var(--sp-feedback-danger-bg)",
              border: "1px solid var(--sp-feedback-danger-border)",
              color: "var(--sp-feedback-danger-text)",
              fontSize: 13,
            }}
          >
            {parsedContext.error}
          </div>
        )}
        <div style={{ paddingTop: "var(--sp-space-sm)" }}>
          <FormField label="Description">
            <textarea
              style={{ ...inputStyle, minHeight: 82, resize: "vertical" }}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Enter a description"
            />
          </FormField>
        </div>
        <FormField label="Reason for Change" required error={reasonError}>
          <textarea
            style={{ ...inputStyle, minHeight: 82, resize: "vertical" }}
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Enter a reason for this change"
          />
        </FormField>
        <StructuredContextOverrideForm
          contextEntries={contextEntries}
          overrideEntries={overrideEntries}
          dimensions={dimensionOptions}
          defaultConfigs={defaultConfigOptions}
          lockedScope={editorContext}
          lockedKeys={editingOverride ? editorLockedKeys : lockedDims}
          showContextFields={false}
          showOverrideFields
          showLockedScope={false}
          showValidationErrors={formSubmitted}
          onAddContextKey={addContextKey}
          onUpdateContextEntry={updateContextEntry}
          onRemoveContextKey={removeContextKey}
          onAddOverrideKey={(key) => {
            const configItem = defaultConfigOptions.find((item) => item.key === key);
            if (!configItem) return;
            setOverrideEntries((current) => [
              ...current,
              defaultEntryFromSchema(key, configItem.schema),
            ]);
          }}
          onUpdateOverrideEntry={updateOverrideEntry}
          onRemoveOverrideKey={(key) =>
            setOverrideEntries((current) => current.filter((entry) => entry.key !== key))
          }
        />
        {formSubmitted && parsedOverride.error && (
          <div
            style={{
              marginTop: -6,
              padding: "10px 12px",
              borderRadius: "var(--sp-inline-radius)",
              background: "var(--sp-feedback-danger-bg)",
              border: "1px solid var(--sp-feedback-danger-border)",
              color: "var(--sp-feedback-danger-text)",
              fontSize: 13,
            }}
          >
            {parsedOverride.error}
          </div>
        )}
        {saveMutation.error && (
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
            {saveMutation.error}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function OverrideManager(props: OverrideManagerProps) {
  const { config } = useSuperposition();

  if (!isFeatureEnabled(config.features, "overrides")) {
    return (
      <FeatureUnavailable
        feature="Overrides"
        message={getMessage(
          config,
          "feature.disabled",
          "{feature} is not enabled for this embed.",
          { feature: "Overrides" },
        )}
      />
    );
  }

  return <OverrideManagerContent {...props} />;
}
