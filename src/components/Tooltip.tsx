import React, { useId } from "react";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
}

export function Tooltip({ content, children }: TooltipProps) {
  const tooltipId = useId();
  const childDescribedBy = children.props["aria-describedby"];
  const describedBy = [childDescribedBy, tooltipId].filter(Boolean).join(" ");
  const child = React.cloneElement(children, {
    "aria-describedby": describedBy,
  });

  return (
    <div className="sp-tooltip" style={{ display: "inline-flex" }}>
      {child}
      <span id={tooltipId} role="tooltip" className="sp-tooltip__bubble">
        {content}
      </span>
    </div>
  );
}
