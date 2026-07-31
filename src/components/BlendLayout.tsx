import "../blend-react-compat";
import type React from "react";
import {
  Alert as BlendAlert,
  AlertStyle,
  AlertVariant,
  KeyValuePair,
  KeyValuePairSize,
  KeyValuePairStateType,
  TagColor,
  TagShape,
  TagSize,
  TagVariant,
  Tag,
} from "@juspay/blend-design-system";
import { formatErrorMessage } from "../utils/errors";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export function PageHeader({ title, description, actions, meta }: PageHeaderProps) {
  return (
    <header className="sp-page-header">
      <div className="sp-page-header__copy">
        <h2 className="sp-page-title">{title}</h2>
        {description ? <p className="sp-page-description">{description}</p> : null}
        {meta ? <div className="sp-page-meta">{meta}</div> : null}
      </div>
      {actions ? <div className="sp-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export interface SurfaceProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}

export function Surface({ children, className, padded = true }: SurfaceProps) {
  const classes = ["sp-surface", padded ? "sp-surface--padded" : "", className]
    .filter(Boolean)
    .join(" ");

  return <section className={classes}>{children}</section>;
}

export interface ToolbarProps {
  children: React.ReactNode;
}

export function Toolbar({ children }: ToolbarProps) {
  return <div className="sp-toolbar">{children}</div>;
}

export interface InlineNoticeProps {
  title: string;
  description: string;
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
}

const noticeVariant: Record<NonNullable<InlineNoticeProps["tone"]>, AlertVariant> = {
  info: AlertVariant.PRIMARY,
  success: AlertVariant.SUCCESS,
  warning: AlertVariant.WARNING,
  danger: AlertVariant.ERROR,
  neutral: AlertVariant.NEUTRAL,
};

export function InlineNotice({ title, description, tone = "info" }: InlineNoticeProps) {
  const displayDescription =
    tone === "danger" ? formatErrorMessage(description) : description;

  return (
    <BlendAlert
      heading={title}
      description={displayDescription}
      variant={noticeVariant[tone]}
      style={AlertStyle.SUBTLE}
      width="100%"
    />
  );
}

export interface MetaTagProps {
  text: string;
  color?: TagColor;
}

export function MetaTag({ text, color = TagColor.NEUTRAL }: MetaTagProps) {
  return (
    <Tag
      text={text}
      color={color}
      variant={TagVariant.SUBTLE}
      size={TagSize.SM}
      shape={TagShape.SQUARICAL}
      maxWidth="100%"
    />
  );
}

export interface DetailPairProps {
  label: string;
  value?: string | number | boolean | null;
}

export function DetailPair({ label, value }: DetailPairProps) {
  return (
    <KeyValuePair
      keyString={label}
      value={value === undefined || value === null ? "Not provided" : String(value)}
      keyValuePairState={KeyValuePairStateType.horizontal}
      size={KeyValuePairSize.MEDIUM}
      textOverflow="wrap"
      maxWidth="100%"
    />
  );
}

export function DetailStack({ children }: { children: React.ReactNode }) {
  return <div className="sp-detail-stack">{children}</div>;
}
