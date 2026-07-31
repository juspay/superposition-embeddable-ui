import "../blend-react-compat";
import { TextArea, TextInput, TextInputSize } from "@juspay/blend-design-system";
import React, { cloneElement, isValidElement, useId } from "react";

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function FormField({
  label,
  required,
  error,
  children,
  disabled,
}: FormFieldProps) {
  const fieldId = useId();
  const messageId = `${fieldId}-error`;
  const childElement = isValidElement(children)
    ? (children as React.ReactElement<
        React.InputHTMLAttributes<HTMLInputElement> &
          React.TextareaHTMLAttributes<HTMLTextAreaElement>
      >)
    : null;

  const blendControl =
    childElement?.type === "input" ? (
      <TextInput
        id={fieldId}
        label={label}
        aria-label={required ? `${label}*` : label}
        value={String(childElement.props.value ?? "")}
        onChange={
          childElement.props.onChange as React.ChangeEventHandler<HTMLInputElement>
        }
        placeholder={childElement.props.placeholder}
        type={childElement.props.type}
        min={childElement.props.min}
        required={required}
        disabled={disabled || childElement.props.disabled}
        error={Boolean(error)}
        errorMessage={error}
        size={TextInputSize.MEDIUM}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
      />
    ) : childElement?.type === "textarea" ? (
      <TextArea
        id={fieldId}
        label={label}
        aria-label={required ? `${label}*` : label}
        value={String(childElement.props.value ?? "")}
        onChange={
          childElement.props.onChange as React.ChangeEventHandler<HTMLTextAreaElement>
        }
        placeholder={childElement.props.placeholder ?? ""}
        required={required}
        disabled={disabled || childElement.props.disabled}
        error={Boolean(error)}
        errorMessage={error}
        resize={
          childElement.props.style?.resize as
            | "none"
            | "both"
            | "horizontal"
            | "vertical"
            | undefined
        }
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
      />
    ) : null;

  const control = blendControl
    ? blendControl
    : isValidElement(children)
      ? cloneElement(children, {
          id: fieldId,
          disabled,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? messageId : undefined,
        })
      : children;

  return (
    <div style={{ marginBottom: "var(--sp-space-md)", opacity: disabled ? 0.6 : 1 }}>
      {!blendControl && (
        <label
          htmlFor={fieldId}
          style={{
            display: "block",
            marginBottom: "var(--sp-space-xs)",
            fontSize: "var(--sp-form-label-font-size)",
            fontWeight: "var(--sp-form-label-font-weight)",
            color: "var(--sp-form-label-color)",
            lineHeight: 1.35,
          }}
        >
          {label}
          {required && (
            <span style={{ color: "var(--sp-feedback-danger-text)", marginLeft: 2 }}>
              *
            </span>
          )}
        </label>
      )}
      {control}
      {error && !blendControl && (
        <p
          id={messageId}
          style={{
            margin: "4px 0 0",
            fontSize: 12,
            color: "var(--sp-feedback-danger-text)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ── Reusable input styles ──────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1.5px solid var(--sp-control-border)",
  background: "var(--sp-control-bg)",
  color: "var(--sp-control-text)",
  borderRadius: "var(--sp-control-radius)",
  fontSize: "1rem",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 180ms ease, box-shadow 180ms ease, background 180ms ease",
};

export const buttonPrimary: React.CSSProperties = {
  padding: "var(--sp-button-padding)",
  background: "var(--sp-button-primary-bg)",
  color: "var(--sp-button-primary-text)",
  border: "2px solid var(--sp-button-primary-border)",
  borderRadius: "var(--sp-button-radius)",
  fontSize: "var(--sp-button-font-size)",
  cursor: "pointer",
  fontWeight: "var(--sp-button-font-weight)",
  boxShadow: "var(--sp-button-primary-shadow), var(--sp-shadow-sm)",
  transition:
    "box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, transform 120ms ease",
};

export const createActionButtonStyle: React.CSSProperties = {
  ...buttonPrimary,
  minHeight: 42,
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  whiteSpace: "nowrap",
  borderColor: "color-mix(in oklab, var(--sp-color-primary) 76%, var(--sp-color-border))",
};

export const buttonSecondary: React.CSSProperties = {
  padding: "var(--sp-button-padding)",
  background: "var(--sp-button-secondary-bg)",
  color: "var(--sp-button-secondary-text)",
  border: "1px solid var(--sp-button-secondary-border)",
  borderRadius: "var(--sp-button-radius)",
  fontSize: "var(--sp-button-font-size)",
  cursor: "pointer",
  fontWeight: "var(--sp-button-font-weight)",
  transition:
    "box-shadow 180ms ease, background 180ms ease, border-color 180ms ease, transform 120ms ease",
};

export const exportActionButtonStyle: React.CSSProperties = {
  ...buttonSecondary,
  minHeight: 38,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  borderRadius: "var(--sp-control-radius)",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

export const buttonDanger: React.CSSProperties = {
  padding: "6px 10px",
  background: "var(--sp-button-danger-bg)",
  color: "var(--sp-button-danger-text)",
  border: "1px solid var(--sp-button-danger-border)",
  borderRadius: "var(--sp-control-radius)",
  fontSize: "14px",
  cursor: "pointer",
  fontWeight: 500,
};
