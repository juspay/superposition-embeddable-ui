import React from "react";
import { Tooltip as BlendTooltip } from "@juspay/blend-design-system";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <BlendTooltip content={content} maxWidth="220px" showArrow>
      {children}
    </BlendTooltip>
  );
}
