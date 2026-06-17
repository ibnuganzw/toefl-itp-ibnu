import type { DashboardSummaryItem } from "../../types/homeDashboard";
import { AppIcon, type AppIconName } from "../ui/AppIcon";

const ICONS: Record<DashboardSummaryItem["id"], AppIconName> = {
  accuracy: "target",
  "active-questions": "document",
  "last-session": "clock",
  "learning-progress": "analytics",
  "weekly-target": "calendar",
};

export function DashboardSummaryCard({ item }: { item: DashboardSummaryItem }) {
  return (
    <article className={`dashboardSummaryCard arcane-metric-card arcane-card tone-${item.tone}`} data-summary-id={item.id}>
      <span className="dashboardSummaryIcon" aria-hidden="true">
        <AppIcon name={ICONS[item.id]} />
      </span>
      <div className="dashboardSummaryCopy">
        <span className="arcane-metric-label">{item.label}</span>
        <strong className="arcane-metric-value">{item.value}</strong>
        <small className="arcane-metric-note">{item.detail}</small>
        {item.progressPercent !== undefined ? (
          <span className="dashboardSummaryProgress arcane-progress" aria-label={`Progress ${item.progressPercent}%`}>
            <span className="arcane-progress-bar" style={{ inlineSize: `${item.progressPercent}%` }} />
          </span>
        ) : null}
      </div>
    </article>
  );
}
