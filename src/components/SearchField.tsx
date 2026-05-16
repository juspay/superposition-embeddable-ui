import { SearchInput } from "@juspay/blend-design-system";
import { Search } from "lucide-react";

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel = placeholder,
}: SearchFieldProps) {
  return (
    <div
      className="sp-search-field"
      style={{
        width: "var(--sp-search-width)",
        minHeight: "var(--sp-search-height)",
        opacity: "var(--sp-search-opacity)",
      }}
    >
      <SearchInput
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        leftSlot={<Search aria-hidden="true" focusable="false" strokeWidth={2} />}
        allowClear
        onClear={() => onChange("")}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
