import type { DashboardRecentSession } from "../../types/homeDashboard";
import { DashboardPanel } from "./DashboardPanel";

export function DashboardHistoryPanel({ sessions }: { sessions: DashboardRecentSession[] }) {
  return (
    <DashboardPanel className="dashboardHistoryPanel arcane-history-card" eyebrow="Perkembangan" title="Riwayat Simulasi">
      <div className="dashboardHistoryList arcane-review-list">
        {sessions.map((session) => (
          <details className="dashboardHistoryItem" key={session.id}>
            <summary>
              <span>{session.finishedLabel}</span>
              <div>
                <strong>{session.title}</strong>
                <small>{session.meta}</small>
                {session.focusLabel ? <small>Prioritas: {session.focusLabel}</small> : null}
              </div>
              <em>
                <small>{session.resultLabel}</small>
                {session.resultValue}
              </em>
            </summary>
            <div className="dashboardHistoryDetails">
              {session.targetLabel ? <p>{session.targetLabel}</p> : null}
              {session.sections.map((section) => (
                <div key={section.label}>
                  <span>
                    <strong>{section.label}</strong>
                    <small>{section.attempted}/{section.totalQuestions} terjawab / {section.unanswered} kosong</small>
                  </span>
                  <em>{section.accuracy}%</em>
                </div>
              ))}
              {!session.sections.length ? <small>Snapshot diagnostik belum tersedia untuk hasil lama ini.</small> : null}
            </div>
          </details>
        ))}
        {!sessions.length ? (
          <div className="dashboardEmptyState arcane-empty arcane-history-empty">
            <strong>Belum ada hasil simulasi</strong>
            <span>Diagnostik simulasi akan tersimpan dan muncul di sini.</span>
          </div>
        ) : null}
      </div>
    </DashboardPanel>
  );
}
