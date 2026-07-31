import { useState } from "react";

export interface JsonViewerProps {
  data: unknown;
  collapsed?: boolean;
}

export function JsonViewer({ data, collapsed = true }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(!collapsed);

  const formatted = JSON.stringify(data, null, 2) ?? String(data);
  const preview = JSON.stringify(data) ?? String(data);
  const isLong = preview.length > 60;

  if (!isLong) {
    return (
      <code
        style={{
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          wordBreak: "break-all",
          display: "inline-block",
          padding: "4px 8px",
          borderRadius: "var(--sp-json-value-radius)",
          background: "var(--sp-json-value-bg)",
          border: "1px solid var(--sp-json-value-border)",
          lineHeight: 1.5,
        }}
      >
        {preview}
      </code>
    );
  }

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {expanded ? (
        <pre
          style={{
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            background: "var(--sp-json-value-bg)",
            padding: "var(--sp-space-sm)",
            borderRadius: "var(--sp-json-value-radius)",
            border: "1px solid var(--sp-json-value-border)",
            overflow: "auto",
            maxHeight: 300,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {formatted}
        </pre>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <code
            style={{
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              display: "inline-block",
              padding: "4px 8px",
              borderRadius: "var(--sp-json-value-radius)",
              background: "var(--sp-json-value-bg)",
              border: "1px solid var(--sp-json-value-border)",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.5,
            }}
            title={preview}
          >
            {preview}
          </code>
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          color: "var(--sp-color-primary)",
          cursor: "pointer",
          fontSize: 12,
          padding: "4px 0 0",
          fontWeight: 700,
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
