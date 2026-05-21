import React, { useId } from "react";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
}

export function Tooltip({ content, children }: TooltipProps) {
  const tooltipId = useId();

  return (
    <div className="sp-tooltip" aria-describedby={tooltipId} style={{ display: "inline-flex" }}>
      {children}
      <span id={tooltipId} role="tooltip" className="sp-tooltip__bubble">
        {content}
      </span>
    </div>
  );
}
