import { ArrowLeft, Check, Copy } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { Surface } from "./BlendLayout";

export interface RecordDetailHeaderProps {
  title: string;
  description?: string;
  status?: ReactNode;
  onBack?: () => void;
  backLabel: string;
}

export function RecordDetailHeader({
  title,
  description,
  status,
  onBack,
  backLabel,
}: RecordDetailHeaderProps) {
  return (
    <header className="sp-record-detail-header">
      {onBack ? (
        <button type="button" className="sp-record-detail-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} />
          <span>{backLabel}</span>
        </button>
      ) : null}
      <div className="sp-record-detail-heading">
        <div className="sp-record-detail-heading__title-row">
          <h2>{title}</h2>
          {status}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
    </header>
  );
}

export interface RecordMetadataSummaryProps {
  description?: string | null;
  changeReason?: string | null;
  createdBy?: string | null;
  createdAt: string;
  lastModifiedBy?: string | null;
  lastModifiedAt: string;
}

function MetadataItem({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value?: string | null;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`sp-record-detail-metadata-item${
        emphasized ? " sp-record-detail-metadata-item--emphasized" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value?.trim() || "Not provided"}</strong>
    </div>
  );
}

export function RecordMetadataSummary({
  description,
  changeReason,
  createdBy,
  createdAt,
  lastModifiedBy,
  lastModifiedAt,
}: RecordMetadataSummaryProps) {
  return (
    <Surface className="sp-record-detail-metadata" padded={false}>
      <div className="sp-record-detail-metadata-grid">
        <div className="sp-record-detail-metadata-column">
          <MetadataItem label="Description" value={description} emphasized />
        </div>
        <div className="sp-record-detail-metadata-column">
          <MetadataItem label="Change Reason" value={changeReason} />
          <MetadataItem label="Created By" value={createdBy} />
          <MetadataItem label="Created At" value={createdAt} />
        </div>
        <div className="sp-record-detail-metadata-column">
          <MetadataItem label="Last Modified By" value={lastModifiedBy} />
          <MetadataItem label="Last Modified At" value={lastModifiedAt} />
        </div>
      </div>
    </Surface>
  );
}

export function ReadonlyValueField({ value }: { value: string }) {
  return (
    <div className="sp-record-detail-readonly-field">
      <code>{value}</code>
    </div>
  );
}

export interface CopyableJsonFieldProps {
  data: unknown;
  label: string;
}

export function CopyableJsonField({ data, label }: CopyableJsonFieldProps) {
  const [copied, setCopied] = useState(false);
  const value = JSON.stringify(data) ?? String(data);

  const copyValue = useCallback(async () => {
    if (!navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <div className="sp-record-detail-readonly-field">
      <code>{value}</code>
      <button
        type="button"
        className="sp-record-detail-copy"
        aria-label={`Copy ${label}`}
        title={copied ? "Copied" : `Copy ${label}`}
        onClick={copyValue}
      >
        {copied ? (
          <Check aria-hidden="true" size={16} />
        ) : (
          <Copy aria-hidden="true" size={16} />
        )}
      </button>
    </div>
  );
}
