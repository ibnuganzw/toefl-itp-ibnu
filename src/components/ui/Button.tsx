import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AppIcon, type AppIconName } from "./AppIcon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "warning";
type ButtonSize = "sm" | "md" | "lg";
type ButtonIconPosition = "start" | "end";

const legacyClassByVariant: Record<ButtonVariant, string> = {
  ghost: "ghostAction",
  primary: "primaryAction",
  secondary: "secondaryAction",
  warning: "helpAction",
};

const arcaneClassByVariant: Record<ButtonVariant, string> = {
  ghost: "arcane-btn-ghost",
  primary: "arcane-btn-primary",
  secondary: "arcane-btn-secondary",
  warning: "arcane-btn-secondary arcane-btn-warning",
};

export function Button({
  children,
  className = "",
  icon,
  iconPosition = "start",
  iconOnly = false,
  size = "md",
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  icon?: AppIconName;
  iconPosition?: ButtonIconPosition;
  iconOnly?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={[
        "uiButton",
        "arcane-btn",
        arcaneClassByVariant[variant],
        `uiButton--${variant}`,
        `uiButton--${size}`,
        iconOnly ? "uiButton--iconOnly" : "",
        legacyClassByVariant[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {icon && iconPosition === "start" ? <AppIcon name={icon} /> : null}
      {children}
      {icon && iconPosition === "end" ? <AppIcon name={icon} /> : null}
    </button>
  );
}
