import type React from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "neutral" | "danger";
  minHeight?: number | string;
}

export function EmptyState({
  title,
  description,
  action,
  tone = "neutral",
  minHeight = 168,
}: EmptyStateProps) {
  const isDanger = tone === "danger";

  return (
    <section
      role={isDanger ? "alert" : "status"}
      style={{
        minHeight,
        padding: "calc(var(--sp-space-lg) * 1.6) var(--sp-space-lg)",
        border: "1px solid var(--sp-color-border)",
        borderRadius: "var(--sp-card-radius)",
        background: "var(--sp-color-panel)",
        color: "var(--sp-color-text)",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "var(--sp-space-xs)",
          justifyItems: "center",
          maxWidth: 460,
        }}
      >
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: isDanger ? "var(--sp-feedback-danger-text)" : "var(--sp-color-text)",
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              color: "var(--sp-color-muted)",
              fontSize: "0.9rem",
              lineHeight: 1.5,
              overflowWrap: "anywhere",
            }}
          >
            {description}
          </div>
        ) : null}
        {action ? <div style={{ marginTop: "var(--sp-space-xs)" }}>{action}</div> : null}
      </div>
    </section>
  );
}
