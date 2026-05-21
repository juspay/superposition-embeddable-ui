import { useEffect, useMemo, useRef, useState } from "react";
import type { DefaultConfig, Dimension, JsonValue } from "../types";
import { ConditionBadges } from "./ConditionBadges";
import { inputStyle } from "./FormField";
import { Tooltip } from "./Tooltip";

export interface FieldEntryState {
  key: string;
  value: JsonValue;
  draft?: string;
  error?: string;
  locked?: boolean;
  required?: boolean;
}

interface StructuredContextOverrideFormProps {
  contextEntries: FieldEntryState[];
  overrideEntries: FieldEntryState[];
  dimensions: Dimension[];
  defaultConfigs: DefaultConfig[];
  lockedScope?: Record<string, JsonValue>;
  lockedKeys?: string[];
  showContextFields?: boolean;
  showOverrideFields?: boolean;
  showLockedScope?: boolean;
  showValidationErrors?: boolean;
  canAddContext?: boolean;
  canRemoveContext?: boolean;
  canAddOverride?: boolean;
  canRemoveOverride?: boolean;
  onAddContextKey: (key: string) => void;
  onUpdateContextEntry: (key: string, update: Partial<FieldEntryState>) => void;
  onRemoveContextKey: (key: string) => void;
  onAddOverrideKey: (key: string) => void;
  onUpdateOverrideEntry: (key: string, update: Partial<FieldEntryState>) => void;
  onRemoveOverrideKey: (key: string) => void;
}

type InputKind = "string" | "number" | "boolean" | "enum" | "json";

function getSchemaType(schema?: Record<string, JsonValue>): string | undefined {
  const raw = schema?.type;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.find(
      (item): item is string => typeof item === "string" && item !== "null",
    );
  }
  return undefined;
}

function getEnumOptions(schema?: Record<string, JsonValue>): JsonValue[] {
  return Array.isArray(schema?.enum) ? schema.enum : [];
}

function getInputKind(schema?: Record<string, JsonValue>): InputKind {
  if (getEnumOptions(schema).length > 0) return "enum";

  const schemaType = getSchemaType(schema);
  if (schemaType === "integer" || schemaType === "number") return "number";
  if (schemaType === "boolean") return "boolean";
  if (schemaType === "object" || schemaType === "array") return "json";
  return "string";
}

function getDefaultValue(schema?: Record<string, JsonValue>): JsonValue {
  if (schema && "default" in schema) {
    return schema.default as JsonValue;
  }

  const enumOptions = getEnumOptions(schema);
  if (enumOptions.length > 0) return enumOptions[0] ?? "";

  switch (getSchemaType(schema)) {
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

function getTypeBadge(schema?: Record<string, JsonValue>) {
  return getEnumOptions(schema).length > 0 ? "enum" : (getSchemaType(schema) ?? "string");
}

function valueToDraft(value: JsonValue) {
  return JSON.stringify(value, null, 2);
}

function normalizeEntries(entries: FieldEntryState[]) {
  return entries.slice().sort((left, right) => {
    if (left.required && !right.required) return -1;
    if (!left.required && right.required) return 1;
    return left.key.localeCompare(right.key);
  });
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="var(--sp-form-remove-button-icon-size)"
      height="var(--sp-form-remove-button-icon-size)"
      style={{ color: "currentColor", flex: "0 0 auto" }}
    >
      <path
        d="M17 6h5v2h-2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8H2V6h5V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3ZM6 8v12h12V8H6Zm3 3h2v6H9v-6Zm4 0h2v6h-2v-6ZM9 4v2h6V4H9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SafeSelect({
  label,
  selected,
  items,
  onSelect,
  error,
}: {
  label: string;
  selected?: string;
  items: Array<{ value: string; label: string }>;
  onSelect: (value: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedItem = items.find((item) => item.value === selected);
  const buttonLabel = selectedItem?.label ?? label;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className={open ? "sp-select sp-select-open" : "sp-select"} ref={rootRef}>
      <button
        type="button"
        className="sp-select__trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selectedItem ? "sp-select__value" : "sp-select__placeholder"}>
          {buttonLabel}
        </span>
        <span className="sp-select__chevron" aria-hidden="true">
          v
        </span>
      </button>
      {open && (
        <div className="sp-select__menu" role="listbox" aria-label={label}>
          {items.length === 0 ? (
            <div className="sp-select__empty">No options</div>
          ) : (
            items.map((item) => (
              <button
                key={item.value}
                type="button"
                className="sp-select__option"
                role="option"
                aria-selected={item.value === selected}
                onClick={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      )}
      {error && <div className="sp-select__error">{error}</div>}
    </div>
  );
}

function AddOptionMenu({
  label,
  options,
  selectedValues,
  onSelect,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelect: (value: string) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const availableOptions = useMemo(() => {
    return options.filter((option) => !selectedSet.has(option.value));
  }, [options, selectedSet]);

  return (
    <SafeSelect
      label={label}
      items={availableOptions}
      selected=""
      onSelect={onSelect}
    />
  );
}

function FieldCard({
  title,
  entries,
  addLabel,
  selectOptions,
  validationMessage,
  canAdd = true,
  canRemove = true,
  onAdd,
  onUpdate,
  onRemove,
  schemaFor,
}: {
  title: string;
  entries: FieldEntryState[];
  addLabel: string;
  selectOptions: Array<{ value: string; label: string }>;
  validationMessage?: string;
  canAdd?: boolean;
  canRemove?: boolean;
  onAdd: (key: string) => void;
  onUpdate: (key: string, update: Partial<FieldEntryState>) => void;
  onRemove: (key: string) => void;
  schemaFor: (key: string) => Record<string, JsonValue> | undefined;
}) {
  return (
    <div
      className="sp-field-card"
      style={{
        display: "grid",
        gap: 0,
        borderRadius: "var(--sp-card-radius)",
        background: "var(--sp-color-panel)",
        border: "1px solid var(--sp-color-border)",
        boxShadow: "var(--sp-shadow-sm)",
        overflow: "visible",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--sp-space-sm)",
          flexWrap: "wrap",
          padding: "var(--sp-space-md)",
          background: "var(--sp-color-surface-muted)",
          borderBottom: "1px solid var(--sp-color-border)",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: "1rem", lineHeight: 1.25, fontWeight: 800 }}>
            {title}
            {entries.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  color: "var(--sp-color-muted)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {entries.length}
              </span>
            )}
          </div>
          {validationMessage && (
            <div style={{ fontSize: 12, color: "var(--sp-feedback-danger-text)" }}>
              {validationMessage}
            </div>
          )}
        </div>
        {canAdd && entries.length > 0 && (
          <AddOptionMenu
            label={addLabel}
            options={selectOptions}
            selectedValues={entries.map((entry) => entry.key)}
            onSelect={onAdd}
          />
        )}
      </div>

      <div
        style={{
          background: "var(--sp-color-panel)",
          padding: entries.length === 0 ? "var(--sp-space-md)" : 0,
          display: "grid",
          overflow: "visible",
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              minHeight: 72,
              border: "1px dashed var(--sp-color-border)",
              borderRadius: "var(--sp-inline-radius)",
              background: "var(--sp-color-surface-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--sp-space-sm)",
            }}
          >
            {canAdd ? (
              <AddOptionMenu
                label={addLabel}
                options={selectOptions}
                selectedValues={[]}
                onSelect={onAdd}
              />
            ) : (
              <span
                style={{
                  color: "var(--sp-color-muted)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                No items
              </span>
            )}
          </div>
        ) : (
          <>
            {entries.map((entry) => {
              const schema = schemaFor(entry.key);
              const inputKind = getInputKind(schema);
              const enumOptions = getEnumOptions(schema);

              return (
                <div
                  key={entry.key}
                  style={{
                    width: "100%",
                    padding: "var(--sp-space-md)",
                    borderBottom: "1px solid var(--sp-color-border)",
                    background: "var(--sp-color-panel)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(180px, 240px) minmax(220px, 1fr) auto",
                      alignItems: "start",
                      gap: "var(--sp-space-md)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        flexWrap: "wrap",
                        minWidth: 0,
                        paddingTop: 7,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--sp-color-text)",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {entry.key}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "var(--sp-pill-radius)",
                          border: "1px solid var(--sp-color-border)",
                          background: "var(--sp-color-surface-muted)",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--sp-color-muted)",
                        }}
                      >
                        {getTypeBadge(schema)}
                      </span>
                      {entry.required && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--sp-color-muted)",
                          }}
                        >
                          Required
                        </span>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                      {inputKind === "string" && (
                        <input
                          aria-label={entry.key}
                          style={inputStyle}
                          value={
                            typeof entry.value === "string"
                              ? entry.value
                              : String(entry.value ?? "")
                          }
                          onChange={(event) =>
                            onUpdate(entry.key, {
                              value: event.target.value,
                              error: undefined,
                            })
                          }
                        />
                      )}

                      {inputKind === "number" && (
                        <input
                          aria-label={entry.key}
                          style={inputStyle}
                          type="number"
                          value={
                            typeof entry.value === "number"
                              ? entry.value
                              : Number(entry.value ?? 0)
                          }
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            const parsed = Number(nextValue);
                            onUpdate(entry.key, {
                              value: nextValue === "" ? 0 : parsed,
                              error: Number.isNaN(parsed)
                                ? "Enter a valid number."
                                : undefined,
                            });
                          }}
                        />
                      )}

                      {inputKind === "boolean" && (
                        <SafeSelect
                          label={entry.key}
                          selected={String(Boolean(entry.value))}
                          items={[
                            { value: "true", label: "true" },
                            { value: "false", label: "false" },
                          ]}
                          error={entry.error}
                          onSelect={(value) =>
                            onUpdate(entry.key, {
                              value: value === "true",
                              error: undefined,
                            })
                          }
                        />
                      )}

                      {inputKind === "enum" && (
                        <SafeSelect
                          label={entry.key}
                          selected={JSON.stringify(entry.value)}
                          items={enumOptions.map((option) => ({
                            value: JSON.stringify(option),
                            label: String(option),
                          }))}
                          error={entry.error}
                          onSelect={(value) =>
                            onUpdate(entry.key, {
                              value: JSON.parse(value) as JsonValue,
                              error: undefined,
                            })
                          }
                        />
                      )}

                      {inputKind === "json" && (
                        <textarea
                          aria-label={entry.key}
                          style={{ ...inputStyle, fontFamily: "monospace", minHeight: 90 }}
                          value={entry.draft ?? valueToDraft(entry.value)}
                          onChange={(event) => {
                            const nextDraft = event.target.value;
                            try {
                              onUpdate(entry.key, {
                                draft: nextDraft,
                                value: JSON.parse(nextDraft) as JsonValue,
                                error: undefined,
                              });
                            } catch {
                              onUpdate(entry.key, {
                                draft: nextDraft,
                                error: "Enter valid JSON.",
                              });
                            }
                          }}
                        />
                      )}

                      {entry.error && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--sp-feedback-danger-text)",
                          }}
                        >
                          {entry.error}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      {canRemove && (
                        <Tooltip content={`Remove ${entry.key}`}>
                          <button
                            type="button"
                            aria-label={`Remove ${entry.key}`}
                            style={{
                              width: "var(--sp-form-remove-button-width)",
                              height: "var(--sp-form-remove-button-height)",
                              border: "1px solid var(--sp-form-remove-button-border)",
                              borderRadius: "var(--sp-form-remove-button-radius)",
                              background: "var(--sp-form-remove-button-bg)",
                              color: "var(--sp-form-remove-button-text)",
                              boxShadow: "var(--sp-form-remove-button-shadow)",
                              cursor:
                                entry.required || entry.locked ? "not-allowed" : "pointer",
                              opacity: entry.required || entry.locked ? 0.45 : 1,
                              padding: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flex: "0 0 auto",
                              transition:
                                "border-color 180ms ease, background 180ms ease, color 180ms ease, transform 180ms ease",
                            }}
                            onClick={() => onRemove(entry.key)}
                            disabled={entry.required || entry.locked}
                          >
                            <TrashIcon />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export function defaultEntryFromSchema(
  key: string,
  schema?: Record<string, JsonValue>,
  options?: { required?: boolean; locked?: boolean },
): FieldEntryState {
  const value = getDefaultValue(schema);
  return {
    key,
    value,
    draft: getInputKind(schema) === "json" ? valueToDraft(value) : undefined,
    error: undefined,
    required: options?.required,
    locked: options?.locked,
  };
}

export function StructuredContextOverrideForm({
  contextEntries,
  overrideEntries,
  dimensions,
  defaultConfigs,
  lockedScope,
  lockedKeys = [],
  showContextFields = true,
  showOverrideFields = true,
  showLockedScope = true,
  showValidationErrors = false,
  canAddContext = true,
  canRemoveContext = true,
  canAddOverride = true,
  canRemoveOverride = true,
  onAddContextKey,
  onUpdateContextEntry,
  onRemoveContextKey,
  onAddOverrideKey,
  onUpdateOverrideEntry,
  onRemoveOverrideKey,
}: StructuredContextOverrideFormProps) {
  const dimensionMap = useMemo(
    () =>
      Object.fromEntries(dimensions.map((dimension) => [dimension.dimension, dimension])),
    [dimensions],
  );
  const defaultConfigMap = useMemo(
    () => Object.fromEntries(defaultConfigs.map((config) => [config.key, config])),
    [defaultConfigs],
  );
  const lockedKeySet = useMemo(() => new Set(lockedKeys), [lockedKeys]);

  const availableDimensions = useMemo(
    () =>
      dimensions
        .filter(
          (dimension) =>
            dimension.dimension !== "variantIds" &&
            !lockedKeySet.has(dimension.dimension),
        )
        .map((dimension) => ({ value: dimension.dimension, label: dimension.dimension })),
    [dimensions, lockedKeySet],
  );

  const availableConfigKeys = useMemo(
    () => defaultConfigs.map((config) => ({ value: config.key, label: config.key })),
    [defaultConfigs],
  );

  return (
    <div style={{ display: "grid", gap: "var(--sp-space-md)" }}>
      {showLockedScope && lockedScope && Object.keys(lockedScope).length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "var(--sp-space-sm)",
            marginBottom: "var(--sp-space-sm)",
            padding: "var(--sp-space-md)",
            borderRadius: "var(--sp-control-radius)",
            background: "var(--sp-color-surface-muted)",
            border: "1px solid var(--sp-color-border)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--sp-color-muted)",
            }}
          >
            Fixed Scope
          </div>
          <ConditionBadges condition={lockedScope} lockedKeys={lockedKeys} />
        </div>
      )}

      {showContextFields && (
        <FieldCard
          title="Context"
          entries={normalizeEntries(contextEntries)}
          addLabel="Add Context"
          selectOptions={availableDimensions}
          canAdd={canAddContext}
          canRemove={canRemoveContext}
          validationMessage={
            showValidationErrors && contextEntries.length === 0
              ? "Select at least one context condition."
              : undefined
          }
          onAdd={onAddContextKey}
          onUpdate={onUpdateContextEntry}
          onRemove={onRemoveContextKey}
          schemaFor={(key) => dimensionMap[key]?.schema}
        />
      )}

      {showOverrideFields && (
        <FieldCard
          title="Overrides"
          entries={overrideEntries}
          addLabel="Add Override"
          selectOptions={availableConfigKeys}
          canAdd={canAddOverride}
          canRemove={canRemoveOverride}
          validationMessage={
            showValidationErrors && overrideEntries.length === 0
              ? "Select at least one override value."
              : undefined
          }
          onAdd={onAddOverrideKey}
          onUpdate={onUpdateOverrideEntry}
          onRemove={onRemoveOverrideKey}
          schemaFor={(key) => defaultConfigMap[key]?.schema}
        />
      )}
    </div>
  );
}
