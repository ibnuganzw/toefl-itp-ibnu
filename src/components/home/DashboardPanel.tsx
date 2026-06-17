import type { ReactNode } from "react";

export function DashboardPanel({
  action,
  children,
  className = "",
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className={`homeDashboardPanel arcane-card arcane-card-pad ${className}`}>
      <header className="homeDashboardPanelHeader arcane-panel-top">
        <div>
          {eyebrow ? <p className="arcane-kicker">{eyebrow}</p> : null}
          <h2 className="arcane-panel-title">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
