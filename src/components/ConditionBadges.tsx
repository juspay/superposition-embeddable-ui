import "../blend-react-compat";
import {
  TagColor,
  TagShape,
  TagSize,
  TagVariant,
  Tag,
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
    <div className="sp-condition-badges">
      {entries.map(([key, value]) => {
        const isLocked = lockedKeys.includes(key);
        const formattedValue = formatConditionValue(value);

        return (
          <Tag
            key={key}
            text={`${key} = ${formattedValue}`}
            color={isLocked ? TagColor.WARNING : TagColor.PRIMARY}
            variant={TagVariant.SUBTLE}
            size={TagSize.SM}
            shape={TagShape.SQUARICAL}
            rightSlot={isLocked ? <LockIcon /> : undefined}
            maxWidth="100%"
            title={`${key} = ${formattedValue}`}
          />
        );
      })}
    </div>
  );

  if (showConjunction && entries.length === 1) {
    return <div className="sp-condition-single">{badges}</div>;
  }

  if (showConjunction) {
    return (
      <div className="sp-condition-tree">
        <span className="sp-condition-tree__conjunction">And</span>
        {badges}
      </div>
    );
  }

  return badges;
}
