import type { DashboardWeeklyTarget } from "../../types/homeDashboard";
import { DashboardPanel } from "./DashboardPanel";

export function DashboardWeeklyTargetCard({ target }: { target: DashboardWeeklyTarget }) {
  return (
    <DashboardPanel
      action={<span className="weeklyRemaining">{target.remainingDays} hari tersisa</span>}
      className="dashboardWeeklyTarget"
      eyebrow="Ritme Belajar"
      title="Target Minggu Ini"
    >
      <div className="arcane-weekly-path">
        <div className="weeklyTargetSummary arcane-weekly-path-top">
          <strong className="arcane-weekly-path-value">{target.progressPercent}%</strong>
          <span className="arcane-weekly-path-label">{target.completedSessions} dari {target.targetSessions} sesi selesai</span>
        </div>
        <div className="weeklyTargetTrack arcane-progress" aria-label={`Target mingguan ${target.progressPercent}%`}>
          <span className="arcane-progress-bar" style={{ inlineSize: `${target.progressPercent}%` }} />
        </div>
      </div>
      <ol className="weeklyTargetList">
        {Array.from({ length: target.targetSessions }, (_, index) => (
          <li className={index < target.completedSessions ? "isComplete" : ""} key={index}>
            <span aria-hidden="true">{index < target.completedSessions ? "OK" : ""}</span>
            <strong>{target.sessionLabels[index] ?? `Sesi ${index + 1}`}</strong>
          </li>
        ))}
      </ol>
    </DashboardPanel>
  );
}
