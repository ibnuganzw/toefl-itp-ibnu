import type { ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

const legacyClassByTone: Record<BadgeTone, string> = {
  danger: "warnChip",
  neutral: "",
  success: "okChip",
  warning: "warnChip",
};

const arcaneClassByTone: Record<BadgeTone, string> = {
  danger: "arcane-badge-danger",
  neutral: "arcane-badge-muted",
  success: "arcane-badge-success",
  warning: "arcane-badge-warning",
};

export function Badge({
  children,
  className = "",
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span className={["uiBadge", "arcane-badge", arcaneClassByTone[tone], `uiBadge--${tone}`, "chip", legacyClassByTone[tone], className].join(" ")}>
      {children}
    </span>
  );
}
