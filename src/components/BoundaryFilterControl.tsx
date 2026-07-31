import "../blend-react-compat";
import { Button, ButtonSize, ButtonType } from "@juspay/blend-design-system";
import { useMemo, useState } from "react";
import { useSuperposition } from "../providers/SuperpositionUIProvider";
import type { JsonValue } from "../types";
import { normalizeFilterValues } from "../utils";
import { ConditionBadges } from "./ConditionBadges";
import { FormField, inputStyle } from "./FormField";
import { Modal } from "./Modal";

type BoundaryContext = Record<string, JsonValue>;

function formatContext(context?: BoundaryContext) {
  return JSON.stringify(context ?? {}, null, 2);
}

export function BoundaryFilterControl() {
  const { config, scope } = useSuperposition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(formatContext(scope.boundaryContext));
  const allowedDimensions = useMemo(
    () => normalizeFilterValues(config.filters?.dimensions),
    [config.filters?.dimensions],
  );

  const parsedBoundary = useMemo(() => {
    try {
      const value = JSON.parse(draft);
      if (!value || Array.isArray(value) || typeof value !== "object") {
        return { value: null, error: "Filter must be a JSON object." };
      }

      if (allowedDimensions) {
        const unsupportedKeys = Object.keys(value).filter(
          (key) => !allowedDimensions.includes(key),
        );

        if (unsupportedKeys.length > 0) {
          return {
            value: null,
            error: `Filter can only use configured dimensions: ${allowedDimensions.join(", ")}.`,
          };
        }
      }

      return { value: value as BoundaryContext, error: null };
    } catch {
      return {
        value: null,
        error: 'Enter valid filter JSON, for example {"country":"IN"}.',
      };
    }
  }, [allowedDimensions, draft]);

  const handleOpen = () => {
    setDraft(formatContext(scope.boundaryContext));
    setOpen(true);
  };

  const handleApply = () => {
    if (parsedBoundary.error) {
      return;
    }

    scope.setBoundaryContext(parsedBoundary.value ?? undefined);
    setOpen(false);
  };

  const handleClear = () => {
    scope.clearBoundaryContext();
    setDraft("{}");
    setOpen(false);
  };

  return (
    <>
      <Button
        buttonType={ButtonType.SECONDARY}
        size={ButtonSize.SMALL}
        text={
          scope.hasBoundaryContext
            ? `Filter (${scope.lockedDimensions.length})`
            : "Filter"
        }
        onClick={handleOpen}
      />

      {scope.effectiveContext && Object.keys(scope.effectiveContext).length > 0 && (
        <div
          style={{
            display: "grid",
            gap: 8,
            padding: "12px 14px",
            borderRadius: "var(--sp-control-radius)",
            background: "var(--sp-color-surface-muted)",
            border: "1px solid var(--sp-color-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--sp-color-muted)",
              }}
            >
              Boundary
            </div>
            {scope.hasBoundaryContext && (
              <Button
                buttonType={ButtonType.SECONDARY}
                size={ButtonSize.SMALL}
                text="Clear"
                onClick={handleClear}
              />
            )}
          </div>
          <ConditionBadges
            condition={scope.effectiveContext}
            lockedKeys={scope.lockedDimensions}
          />
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Boundary Filter"
        footer={
          <>
            <Button
              buttonType={ButtonType.SECONDARY}
              size={ButtonSize.MEDIUM}
              text="Cancel"
              onClick={() => setOpen(false)}
            />
            <Button
              buttonType={ButtonType.SECONDARY}
              size={ButtonSize.MEDIUM}
              text="Clear"
              onClick={handleClear}
            />
            <Button
              buttonType={ButtonType.PRIMARY}
              size={ButtonSize.MEDIUM}
              text="Apply"
              onClick={handleApply}
              disabled={Boolean(parsedBoundary.error)}
            />
          </>
        }
      >
        {scope.hostContext && Object.keys(scope.hostContext).length > 0 && (
          <div style={{ marginBottom: 16, display: "grid", gap: 8 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--sp-color-muted)",
              }}
            >
              Host Scope
            </div>
            <ConditionBadges
              condition={scope.hostContext}
              lockedKeys={Object.keys(scope.hostContext)}
            />
          </div>
        )}

        <FormField label="Filter (JSON)" error={parsedBoundary.error ?? undefined}>
          <textarea
            style={{ ...inputStyle, fontFamily: "monospace", minHeight: 120 }}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              allowedDimensions?.[0]
                ? `{"${allowedDimensions[0]}":"value"}`
                : '{"country":"IN"}'
            }
          />
        </FormField>
      </Modal>
    </>
  );
}
