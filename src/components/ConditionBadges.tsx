import {
  Tag,
  TagColor,
  TagShape,
  TagSize,
  TagVariant,
} from "@juspay/blend-design-system";
import type { Condition } from "../types";

export interface ConditionBadgesProps {
  condition: Condition;
  lockedKeys?: string[];
  showConjunction?: boolean;
}

function formatConditionValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="var(--sp-lock-icon-size)"
      height="var(--sp-lock-icon-size)"
      style={{ color: "var(--sp-lock-icon-color)", flex: "0 0 auto" }}
    >
      <rect
        x="4.5"
        y="8.2"
        width="11"
        height="8"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7.3 8.2V6.4a2.7 2.7 0 0 1 5.4 0v1.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ConditionBadges({
  condition,
  lockedKeys = [],
  showConjunction = false,
}: ConditionBadgesProps) {
  const entries = Object.entries(condition);
  if (entries.length === 0) {
    return (
      <span style={{ color: "var(--sp-color-muted)", fontSize: 12 }}>No conditions</span>
    );
  }

  const badges = (
    <div
      style={{
        display: "flex",
        flexDirection: showConjunction ? "column" : "row",
        flexWrap: showConjunction ? "nowrap" : "wrap",
        alignItems: showConjunction ? "flex-start" : "center",
        gap: showConjunction ? 12 : 8,
      }}
    >
      {entries.map(([key, value]) => {
        const isLocked = lockedKeys.includes(key);
        return (
          <Tag
            key={key}
            text={`${key} == ${formatConditionValue(value)}`}
            variant={TagVariant.SUBTLE}
            color={isLocked ? TagColor.WARNING : TagColor.PRIMARY}
            size={TagSize.SM}
            shape={TagShape.SQUARICAL}
            rightSlot={isLocked ? <LockIcon /> : undefined}
          />
        );
      })}
    </div>
  );

  if (showConjunction) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-space-md)",
          minHeight: Math.max(entries.length * 42, 96),
        }}
      >
        <div
          style={{
            position: "relative",
            alignSelf: "stretch",
            width: 72,
            minHeight: 84,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 32,
              top: 4,
              bottom: 4,
              width: 12,
              borderLeft: "2px solid var(--sp-color-border)",
              borderTopLeftRadius: "var(--sp-inline-radius)",
              borderBottomLeftRadius: "var(--sp-inline-radius)",
            }}
          />
          <span
            style={{
              position: "relative",
              padding: "5px 12px",
              borderRadius: "var(--sp-pill-radius)",
              background: "var(--sp-color-surface-muted)",
              color: "var(--sp-color-text)",
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.2,
              zIndex: 1,
            }}
          >
            And
          </span>
        </div>
        <div style={{ display: "grid", gap: 12 }}>{badges}</div>
      </div>
    );
  }

  return badges;
}
