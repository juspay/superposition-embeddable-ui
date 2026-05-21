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
        return (
          <span
            key={key}
            className={
              isLocked
                ? "sp-condition-badge sp-condition-badge-locked"
                : "sp-condition-badge"
            }
          >
            <span className="sp-condition-badge__key">{key}</span>
            <span className="sp-condition-badge__operator">==</span>
            <span className="sp-condition-badge__value">
              {formatConditionValue(value)}
            </span>
            {isLocked && <LockIcon />}
          </span>
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
