import type { ReactNode } from "react";
import { AppIcon, type AppIconName } from "../ui/AppIcon";

export function DestinationPageHero({
  actions,
  aside,
  children,
  className = "",
  eyebrow,
  icon,
  title,
}: {
  actions?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow: string;
  icon: AppIconName;
  title: string;
}) {
  return (
    <header className={`destinationPageHero arcane-card ${className}`}>
      <div className="destinationPageHeroIcon" aria-hidden="true">
        <AppIcon name={icon} />
      </div>
      <div className="destinationPageHeroCopy">
        <p className="arcane-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <span>{children}</span>
        {actions}
      </div>
      {aside ? <div className="destinationPageHeroAside">{aside}</div> : null}
    </header>
  );
}
