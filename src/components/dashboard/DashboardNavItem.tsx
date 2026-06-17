import type { DashboardNav } from "../../types/dashboardTypes";
import { AppIcon, type AppIconName } from "../ui/AppIcon";

export interface DashboardNavItemConfig {
  id: DashboardNav;
  icon: AppIconName;
  label: string;
  mobileLabel: string;
}

export function DashboardNavItem({
  active,
  item,
  onClick,
}: {
  active: boolean;
  item: DashboardNavItemConfig;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={`appNavItem arcane-nav-link ${active ? "isActive is-active" : ""}`}
      data-nav-id={item.id}
      type="button"
      onClick={onClick}
    >
      <span className="appNavIcon" aria-hidden="true">
        <AppIcon name={item.icon} />
      </span>
      <span className="appNavLabel appNavLabel--desktop">{item.label}</span>
      <span className="appNavLabel appNavLabel--mobile">{item.mobileLabel}</span>
    </button>
  );
}
