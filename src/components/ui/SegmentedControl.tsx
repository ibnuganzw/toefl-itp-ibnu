import type { ReactNode } from "react";

export function SegmentedControl<T extends string | number>({
  ariaLabel,
  className = "",
  onChange,
  optionClassName = "",
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: T) => void;
  optionClassName?: string;
  options: Array<{ label: ReactNode; value: T }>;
  value: T;
}) {
  return (
    <div className={`uiSegmented arcane-session-selector ${className}`} aria-label={ariaLabel} role="group">
      {options.map((option) => (
        <button
          className={[
            "uiSegmented__option",
            "arcane-session-option",
            optionClassName,
            value === option.value ? "isActive" : "",
          ].join(" ")}
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
