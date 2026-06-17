import type { DashboardFocusArea } from "../../types/homeDashboard";
import type { FocusedPracticeTarget } from "../../utils/focusedPractice";
import { DashboardPanel } from "./DashboardPanel";

export function DashboardFocusPanel({
  areas,
  onLaunchFocused,
}: {
  areas: DashboardFocusArea[];
  onLaunchFocused: (target: FocusedPracticeTarget) => void;
}) {
  return (
    <DashboardPanel className="dashboardFocusPanel arcane-focus-panel" eyebrow="Analitik Belajar" title="Fokus Perbaikan">
      <div className="dashboardFocusList arcane-focus-list">
        {areas.map((area) => (
          <button
            className="arcane-focus-item"
            data-focus-category={area.focusTarget.category}
            data-focus-key={area.focusTarget.key}
            key={area.id}
            type="button"
            onClick={() => onLaunchFocused(area.focusTarget)}
          >
            <span>
              <strong>{area.label}</strong>
              <small>{area.attempted} percobaan</small>
            </span>
            <em>{area.accuracy}%</em>
          </button>
        ))}
        {!areas.length ? (
          <div className="dashboardEmptyState arcane-empty">
            <strong>Belum ada area lemah</strong>
            <span>Selesaikan satu sesi agar analitik mulai terbentuk.</span>
          </div>
        ) : null}
      </div>
    </DashboardPanel>
  );
}
