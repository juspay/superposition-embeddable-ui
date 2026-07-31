import "../blend-react-compat";
import React from "react";
import { Modal as BlendModal } from "@juspay/blend-design-system";
import {
  useOptionalSuperposition,
  useOptionalSuperpositionTheme,
  useOptionalSuperpositionThemeStyles,
} from "../providers/SuperpositionUIProvider";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  maxWidth?: string;
  maxHeight?: string;
}

type BlendModalWithContainerEvents = React.ComponentType<
  React.ComponentProps<typeof BlendModal> & {
    "data-sp-embed-modal"?: string;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
  }
>;

const ClickableBlendModal = BlendModal as BlendModalWithContainerEvents;

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width,
  maxWidth,
  maxHeight,
}: ModalProps) {
  const context = useOptionalSuperposition();
  const ui = context?.config.ui;
  const themeStyles = useOptionalSuperpositionThemeStyles();
  const theme = useOptionalSuperpositionTheme();

  if (!open) return null;

  if (ui?.renderModal) {
    return (
      <>
        {ui.renderModal({
          open,
          onClose,
          title,
          children,
          footer,
        })}
      </>
    );
  }

  return (
    <ClickableBlendModal
      isOpen={open}
      onClose={onClose}
      title={title}
      isCustom
      closeOnBackdropClick
      useDrawerOnMobile
      data-sp-embed-modal="true"
      minWidth="var(--sp-modal-min-width)"
      maxWidth={maxWidth ?? "var(--sp-modal-max-width)"}
      maxHeight={maxHeight ?? "var(--sp-modal-max-height)"}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="sp-ui"
        data-sp-theme={theme?.resolvedMode}
        style={{
          ...themeStyles,
          width: width ?? "var(--sp-modal-width)",
          maxWidth: maxWidth ?? "var(--sp-modal-max-width)",
          maxHeight: maxHeight ?? "var(--sp-modal-max-height)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
          background: "var(--sp-color-panel)",
        }}
      >
        <div style={{ padding: 24, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: "20px 24px",
              borderTop: "1px solid var(--sp-color-border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </ClickableBlendModal>
  );
}
