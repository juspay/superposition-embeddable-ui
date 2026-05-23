import {
  Tooltip as BlendTooltip,
  Button,
  ButtonSize,
  ButtonSubType,
  ButtonType,
  DropdownInput,
  Tag,
  TagColor,
  TagShape,
  TagSize,
  TagVariant,
  TooltipSide,
} from "@juspay/blend-design-system";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "../blend-react-compat";
import type { DefaultConfig, Dimension, JsonValue } from "../types";
import { ConditionBadges } from "./ConditionBadges";
import { inputStyle } from "./FormField";

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
  variant?: "default" | "modal";
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
  errorMessage,
  placeholder,
  showLabel = false,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelect: (value: string) => void;
  errorMessage?: string;
  placeholder?: string;
  showLabel?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const availableOptions = useMemo(() => {
    return options.filter((option) => !selectedSet.has(option.value));
  }, [options, selectedSet]);
  const hasAvailableOptions = availableOptions.length > 0;

  const dropDownItems = useMemo(
    () => [
      {
        items: availableOptions.map((opt) => ({
          label: opt.label,
          value: opt.value,
        })),
      },
    ],
    [availableOptions],
  );

  const getDropdownTrigger = () => {
    const buttons = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );

    return buttons.find((button) => button.getAttribute("aria-label") === label);
  };

  const isDropdownTriggerEvent = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const trigger = target.closest("button");
    return trigger?.getAttribute("aria-label") === label;
  };

  const openDropdownFromField = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isDropdownTriggerEvent(event)) return;

    const trigger = getDropdownTrigger();
    if (!trigger || trigger.disabled) return;

    window.setTimeout(() => {
      for (const eventType of [
        "pointerdown",
        "mousedown",
        "pointerup",
        "mouseup",
        "click",
      ]) {
        trigger.dispatchEvent(
          new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: eventType.endsWith("down") ? 1 : 0,
          }),
        );
      }
      trigger.focus();
    }, 0);
  };

  return (
    <div
      ref={rootRef}
      className="sp-add-option-menu"
      onClickCapture={openDropdownFromField}
    >
      <DropdownInput
        label={showLabel ? label : ""}
        dropdownName={label}
        dropDownItems={dropDownItems}
        dropDownValue=""
        value=""
        readOnly
        inputMode="none"
        autoComplete="off"
        placeholder={
          hasAvailableOptions ? (placeholder ?? label) : "No keys available"
        }
        error={Boolean(errorMessage)}
        errorMessage={errorMessage}
        hintText={
          !errorMessage && !hasAvailableOptions
            ? "All available keys are added."
            : undefined
        }
        maxMenuHeight={280}
        minMenuWidth={260}
        onChange={(event) => {
          event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (
            event.key.length === 1 ||
            event.key === "Backspace" ||
            event.key === "Delete"
          ) {
            event.preventDefault();
          }
        }}
        onPaste={(event) => event.preventDefault()}
        onDropDownChange={(value) => {
          if (!value) return;
          onSelect(value);
        }}
      />
    </div>
  );
}

function AddMenuButton({
  label,
  ariaLabel,
  options,
  onSelect,
}: {
  label: string;
  ariaLabel?: string;
  options: Array<{ value: string; label: string }>;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
    <div ref={rootRef} style={{ position: "relative", justifySelf: "start" }}>
      <Button
        type="button"
        buttonType={ButtonType.SECONDARY}
        size={ButtonSize.MEDIUM}
        text={label}
        aria-label={ariaLabel ?? label}
        leadingIcon={<Plus aria-hidden="true" size={16} />}
        onClick={() => setOpen((current) => !current)}
      />
      {open && (
        <div
          role="menu"
          aria-label={label}
          style={{
            position: "absolute",
            left: 0,
            bottom: "calc(100% + 8px)",
            zIndex: 20,
            minWidth: 240,
            maxHeight: 260,
            overflowY: "auto",
            padding: 8,
            borderRadius: 14,
            border: "1px solid var(--sp-color-border)",
            background: "var(--sp-color-panel)",
            boxShadow: "var(--sp-shadow-md)",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "10px 12px",
                color: "var(--sp-color-muted)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              All available keys are added.
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 10,
                  background: "transparent",
                  padding: "10px 12px",
                  textAlign: "left",
                  color: "var(--sp-color-text)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FieldValueInput({
  entry,
  schema,
  isModalVariant,
  onUpdate,
}: {
  entry: FieldEntryState;
  schema?: Record<string, JsonValue>;
  isModalVariant: boolean;
  onUpdate: (key: string, update: Partial<FieldEntryState>) => void;
}) {
  const inputKind = getInputKind(schema);
  const enumOptions = getEnumOptions(schema);

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
      {inputKind === "string" && (
        <input
          aria-label={entry.key}
          style={
            isModalVariant
              ? { ...inputStyle, minHeight: 44, borderRadius: 12 }
              : inputStyle
          }
          value={
            typeof entry.value === "string" ? entry.value : String(entry.value ?? "")
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
          style={
            isModalVariant
              ? { ...inputStyle, minHeight: 44, borderRadius: 12 }
              : inputStyle
          }
          type="number"
          value={typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0)}
          onChange={(event) => {
            const nextValue = event.target.value;
            const parsed = Number(nextValue);
            onUpdate(entry.key, {
              value: nextValue === "" ? 0 : parsed,
              error: Number.isNaN(parsed) ? "Enter a valid number." : undefined,
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
          style={{
            ...inputStyle,
            fontFamily: "monospace",
            minHeight: isModalVariant ? 104 : 90,
            borderRadius: isModalVariant ? 12 : inputStyle.borderRadius,
          }}
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
  variant = "default",
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
  variant?: "default" | "modal";
  onAdd: (key: string) => void;
  onUpdate: (key: string, update: Partial<FieldEntryState>) => void;
  onRemove: (key: string) => void;
  schemaFor: (key: string) => Record<string, JsonValue> | undefined;
}) {
  const isModalVariant = variant === "modal";
  const isModalOverrideCard = isModalVariant && title === "Overrides";
  const addMenuErrorMessage =
    canAdd && entries.length === 0 ? validationMessage : undefined;
  const headerValidationMessage = addMenuErrorMessage ? undefined : validationMessage;
  const availableOptions = useMemo(() => {
    const selectedKeys = new Set(entries.map((entry) => entry.key));
    return selectOptions.filter((option) => !selectedKeys.has(option.value));
  }, [entries, selectOptions]);

  if (isModalOverrideCard) {
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
            display: "grid",
            gap: 8,
            padding: "22px 24px 18px",
            background: "var(--sp-color-panel)",
            borderBottom:
              entries.length > 0 ? "1px solid var(--sp-color-border)" : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "1rem",
              lineHeight: 1.25,
              fontWeight: 800,
            }}
          >
            <span>{title}</span>
            {entries.length > 0 && (
              <Tag
                text={String(entries.length)}
                color={TagColor.PRIMARY}
                variant={TagVariant.SUBTLE}
                size={TagSize.XS}
                shape={TagShape.SQUARICAL}
              />
            )}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--sp-color-muted)",
              maxWidth: 520,
            }}
          >
            Define key-value overrides that will be applied for this condition.
          </div>
          {headerValidationMessage && (
            <div style={{ fontSize: 12, color: "var(--sp-feedback-danger-text)" }}>
              {headerValidationMessage}
            </div>
          )}
        </div>

        <div style={{ display: "grid", background: "var(--sp-color-panel)" }}>
          {entries.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  minWidth: 680,
                  display: "grid",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "32px minmax(180px, 1fr) 120px minmax(260px, 1.4fr) 64px",
                    gap: 16,
                    alignItems: "center",
                    padding: "18px 24px",
                    borderBottom: "1px solid var(--sp-color-border)",
                    color: "var(--sp-color-muted)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span aria-hidden="true" />
                  <span>Key</span>
                  <span>Type</span>
                  <span>Value</span>
                  <span aria-hidden="true" />
                </div>

                {entries.map((entry) => {
                  const schema = schemaFor(entry.key);
                  const removeDisabled = Boolean(entry.required || entry.locked);

                  return (
                    <div
                      key={entry.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "32px minmax(180px, 1fr) 120px minmax(260px, 1.4fr) 64px",
                        gap: 16,
                        alignItems: "start",
                        padding: "22px 24px",
                        borderBottom: "1px solid var(--sp-color-border)",
                        background: "var(--sp-color-panel)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 44,
                          color: "var(--sp-color-muted)",
                        }}
                      >
                        <GripVertical aria-hidden="true" size={18} />
                      </div>
                      <div
                        style={{
                          minHeight: 44,
                          display: "flex",
                          alignItems: "center",
                          minWidth: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--sp-color-text)",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {entry.key}
                      </div>
                      <div
                        style={{
                          minHeight: 44,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Tag
                          text={getTypeBadge(schema)}
                          color={TagColor.PRIMARY}
                          variant={TagVariant.SUBTLE}
                          size={TagSize.XS}
                          shape={TagShape.SQUARICAL}
                        />
                      </div>
                      <FieldValueInput
                        entry={entry}
                        schema={schema}
                        isModalVariant
                        onUpdate={onUpdate}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        {canRemove && (
                          <BlendTooltip
                            content={`Remove ${entry.key}`}
                            side={TooltipSide.BOTTOM}
                            showArrow
                          >
                            <Button
                              type="button"
                              aria-label={`Remove ${entry.key}`}
                              title={`Remove ${entry.key}`}
                              buttonType={ButtonType.SECONDARY}
                              size={ButtonSize.SMALL}
                              subType={ButtonSubType.ICON_ONLY}
                              leadingIcon={
                                <Trash2 aria-hidden="true" size={16} strokeWidth={2.1} />
                              }
                              onClick={() => onRemove(entry.key)}
                              disabled={removeDisabled}
                            />
                          </BlendTooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ padding: "20px 24px 24px" }}>
            {canAdd && (
              <AddMenuButton
                label="Add another override"
                ariaLabel={addLabel}
                options={availableOptions}
                onSelect={onAdd}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

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
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--sp-space-md)",
          flexWrap: "wrap",
          padding: isModalVariant ? "20px 22px 16px" : "var(--sp-space-md)",
          background: isModalVariant
            ? "var(--sp-color-panel)"
            : "var(--sp-color-surface-muted)",
          borderBottom: isModalVariant ? "none" : "1px solid var(--sp-color-border)",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "1rem",
              lineHeight: 1.25,
              fontWeight: 800,
            }}
          >
            <span>{title}</span>
            {entries.length > 0 && (
              <Tag
                text={String(entries.length)}
                color={TagColor.PRIMARY}
                variant={isModalVariant ? TagVariant.SUBTLE : TagVariant.NO_FILL}
                size={TagSize.XS}
                shape={TagShape.SQUARICAL}
              />
            )}
          </div>
          {headerValidationMessage && (
            <div style={{ fontSize: 12, color: "var(--sp-feedback-danger-text)" }}>
              {headerValidationMessage}
            </div>
          )}
        </div>
        {!isModalVariant && canAdd && entries.length > 0 && (
          <AddOptionMenu
            label={addLabel}
            options={selectOptions}
            selectedValues={entries.map((entry) => entry.key)}
            onSelect={onAdd}
            errorMessage={addMenuErrorMessage}
          />
        )}
      </div>

      <div
        style={{
          background: "var(--sp-color-panel)",
          padding:
            entries.length === 0
              ? isModalVariant
                ? "0 22px 22px"
                : "var(--sp-space-md)"
              : 0,
          display: "grid",
          overflow: "visible",
        }}
      >
        {isModalVariant && canAdd && (
          <div
            style={{
              padding: entries.length === 0 ? "0 0 16px" : "0 22px 18px",
            }}
          >
            <AddOptionMenu
              label={addLabel}
              options={selectOptions}
              selectedValues={entries.map((entry) => entry.key)}
              onSelect={onAdd}
              errorMessage={addMenuErrorMessage}
            />
          </div>
        )}
        {entries.length === 0 ? (
          canAdd ? (
            !isModalVariant ? (
              <AddOptionMenu
                label={addLabel}
                options={selectOptions}
                selectedValues={[]}
                onSelect={onAdd}
                errorMessage={addMenuErrorMessage}
              />
            ) : null
          ) : (
            <div
              style={{
                minHeight: isModalVariant ? 88 : 72,
                border: "1px dashed var(--sp-color-border)",
                borderRadius: "var(--sp-inline-radius)",
                background: "var(--sp-color-surface-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--sp-space-sm)",
              }}
            >
              <span
                style={{
                  color: "var(--sp-color-muted)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                No items added yet
              </span>
            </div>
          )
        ) : (
          <>
            {entries.map((entry) => {
              const schema = schemaFor(entry.key);
              const removeDisabled = Boolean(entry.required || entry.locked);

              return (
                <div
                  key={entry.key}
                  style={{
                    width: "100%",
                    padding: isModalVariant ? "18px 22px" : "var(--sp-space-md)",
                    borderBottom: "1px solid var(--sp-color-border)",
                    background: "var(--sp-color-panel)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isModalVariant
                        ? "minmax(180px, 260px) minmax(260px, 1fr) auto"
                        : "minmax(180px, 240px) minmax(220px, 1fr) auto",
                      alignItems: isModalVariant ? "center" : "start",
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
                        paddingTop: isModalVariant ? 0 : 7,
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
                      <Tag
                        text={getTypeBadge(schema)}
                        color={TagColor.NEUTRAL}
                        variant={TagVariant.SUBTLE}
                        size={TagSize.XS}
                        shape={TagShape.SQUARICAL}
                      />
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

                    <FieldValueInput
                      entry={entry}
                      schema={schema}
                      isModalVariant={isModalVariant}
                      onUpdate={onUpdate}
                    />

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      {canRemove && (
                        <BlendTooltip
                          content={`Remove ${entry.key}`}
                          side={TooltipSide.BOTTOM}
                          showArrow
                        >
                          <Button
                            type="button"
                            aria-label={`Remove ${entry.key}`}
                            buttonType={ButtonType.SECONDARY}
                            size={ButtonSize.SMALL}
                            subType={ButtonSubType.ICON_ONLY}
                            leadingIcon={
                              <Trash2 aria-hidden="true" size={16} strokeWidth={2.1} />
                            }
                            onClick={() => onRemove(entry.key)}
                            disabled={removeDisabled}
                          />
                        </BlendTooltip>
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
  variant = "default",
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
          variant={variant}
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
          variant={variant}
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
