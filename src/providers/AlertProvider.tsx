import React, { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";
import {
  Alert as BlendAlert,
  AlertStyle,
  AlertVariant,
  Button,
  ButtonSize,
  ButtonType,
  Modal as BlendModal,
} from "@juspay/blend-design-system";
import type { ConfirmInput, SuperpositionUiAdapters } from "../types";
import { confirmAction as resolveConfirmAction } from "../utils/ui-adapters";
import {
  useOptionalSuperposition,
  useOptionalSuperpositionTheme,
  useOptionalSuperpositionThemeStyles,
} from "./SuperpositionUIProvider";

export type AlertType = "success" | "error" | "warning" | "info";

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
}

interface AlertContextValue {
  alerts: Alert[];
  addAlert: (type: AlertType, message: string) => void;
  removeAlert: (id: string) => void;
  confirmAction: (input: ConfirmInput) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function useAlerts(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useAlerts must be used within an <AlertProvider>");
  }
  return ctx;
}

let alertCounter = 0;

function resolvePortalTarget(ui?: SuperpositionUiAdapters): Element | null {
  if (!ui?.portalContainer || typeof document === "undefined") {
    return null;
  }

  if (typeof ui.portalContainer === "function") {
    return ui.portalContainer();
  }

  if (typeof ui.portalContainer === "string") {
    return document.querySelector(ui.portalContainer);
  }

  return ui.portalContainer;
}

export function AlertBar({
  zIndex = 9999,
  portalContainer,
}: {
  zIndex?: number;
  portalContainer?: Element | null;
} = {}) {
  const { alerts, removeAlert } = useAlerts();

  if (alerts.length === 0) {
    return null;
  }

  const content = (
    <div
      style={{
        position: "fixed",
        top: "var(--sp-space-md)",
        right: "var(--sp-space-md)",
        zIndex,
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-space-xs)",
      }}
    >
      {alerts.map((alert) => {
        const variant: Record<AlertType, AlertVariant> = {
          success: AlertVariant.SUCCESS,
          error: AlertVariant.ERROR,
          warning: AlertVariant.WARNING,
          info: AlertVariant.PRIMARY,
        };

        return (
          <BlendAlert
            key={alert.id}
            heading={alert.message}
            description=""
            variant={variant[alert.type]}
            style={AlertStyle.SUBTLE}
            onClose={() => removeAlert(alert.id)}
            minWidth="var(--sp-alert-min-width)"
          />
        );
      })}
    </div>
  );

  return portalContainer ? createPortal(content, portalContainer) : content;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const superposition = useOptionalSuperposition();
  const theme = useOptionalSuperpositionTheme();
  const themeStyles = useOptionalSuperpositionThemeStyles();
  const ui = superposition?.config.ui;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<{
    input: Parameters<AlertContextValue["confirmAction"]>[0];
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const addAlert = useCallback(
    (type: AlertType, message: string) => {
      if (ui?.notify) {
        ui.notify({ tone: type, title: message });
        return;
      }

      const id = `alert-${++alertCounter}`;
      setAlerts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 5000);
    },
    [ui],
  );

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const confirmAction = useCallback<AlertContextValue["confirmAction"]>(
    async (input) =>
      resolveConfirmAction(
        ui,
        input,
        () =>
          new Promise<boolean>((resolve) => {
            setConfirmRequest({ input, resolve });
          }),
      ),
    [ui],
  );

  const closeConfirm = useCallback((confirmed: boolean) => {
    setConfirmRequest((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const portalTarget = resolvePortalTarget(ui);
  const isDestructiveConfirm = confirmRequest?.input.variant === "destructive";
  const confirmFooter = confirmRequest ? (
    <>
      <Button
        buttonType={ButtonType.SECONDARY}
        size={ButtonSize.MEDIUM}
        text={confirmRequest.input.cancelLabel ?? "Cancel"}
        onClick={() => closeConfirm(false)}
      />
      <Button
        buttonType={isDestructiveConfirm ? ButtonType.DANGER : ButtonType.PRIMARY}
        size={ButtonSize.MEDIUM}
        text={confirmRequest.input.confirmLabel ?? "Confirm"}
        onClick={() => closeConfirm(true)}
      />
    </>
  ) : null;

  const confirmContent = confirmRequest ? (
    <div style={{ color: "var(--sp-color-muted)", lineHeight: 1.5 }}>
      {confirmRequest.input.description}
    </div>
  ) : null;

  return (
    <AlertContext.Provider value={{ alerts, addAlert, removeAlert, confirmAction }}>
      {children}
      {!ui?.notify && (
        <AlertBar zIndex={ui?.alertZIndex ?? 9999} portalContainer={portalTarget} />
      )}
      {confirmRequest &&
        ui?.renderModal?.({
          open: true,
          onClose: () => closeConfirm(false),
          title: confirmRequest.input.title,
          children: confirmContent,
          footer: confirmFooter,
        })}
      {confirmRequest &&
        !ui?.renderModal &&
        createPortal(
          <BlendModal
            isOpen
            onClose={() => closeConfirm(false)}
            title={confirmRequest.input.title}
            isCustom
            closeOnBackdropClick
            maxWidth="var(--sp-confirm-width)"
            minWidth="var(--sp-confirm-width)"
            useDrawerOnMobile
          >
            <div
              className="sp-ui"
              data-sp-theme={theme?.resolvedMode}
              style={{
                ...themeStyles,
                width: "var(--sp-confirm-width)",
                maxWidth: "100%",
                background: "var(--sp-color-panel)",
              }}
            >
              <div
                style={{
                  padding: "var(--sp-space-lg)",
                  color: "var(--sp-color-muted)",
                  lineHeight: 1.5,
                  overflowWrap: "anywhere",
                }}
              >
                {confirmRequest.input.description}
              </div>
              <div
                style={{
                  padding: "var(--sp-space-md) var(--sp-space-lg)",
                  borderTop: "1px solid var(--sp-color-border)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: "var(--sp-button-padding)",
                    background: "var(--sp-button-secondary-bg)",
                    color: "var(--sp-button-secondary-text)",
                    border: "1px solid var(--sp-button-secondary-border)",
                    borderRadius: "var(--sp-button-radius)",
                    fontSize: "var(--sp-button-font-size)",
                    fontWeight: "var(--sp-button-font-weight)",
                    cursor: "pointer",
                  }}
                  onClick={() => closeConfirm(false)}
                >
                  {confirmRequest.input.cancelLabel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  style={{
                    padding: "var(--sp-button-padding)",
                    background: isDestructiveConfirm
                      ? "var(--sp-button-danger-bg)"
                      : "var(--sp-button-primary-bg)",
                    color: isDestructiveConfirm
                      ? "var(--sp-button-danger-text)"
                      : "var(--sp-button-primary-text)",
                    border: `1px solid ${
                      isDestructiveConfirm
                        ? "var(--sp-button-danger-border)"
                        : "var(--sp-button-primary-border)"
                    }`,
                    borderRadius: "var(--sp-button-radius)",
                    fontSize: "var(--sp-button-font-size)",
                    fontWeight: "var(--sp-button-font-weight)",
                    boxShadow: isDestructiveConfirm
                      ? "none"
                      : "var(--sp-button-primary-shadow)",
                    cursor: "pointer",
                  }}
                  onClick={() => closeConfirm(true)}
                >
                  {confirmRequest.input.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </div>
          </BlendModal>,
          portalTarget ?? document.body,
        )}
    </AlertContext.Provider>
  );
}
