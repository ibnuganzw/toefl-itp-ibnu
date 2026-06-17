import type { DestinationPagesModel, ProgressDiagnosticArea } from "../../types/destinationPages";
import type { HomeDashboardModel } from "../../types/homeDashboard";
import type { ProgressIllustrationModel } from "../../types/progressIllustration";
import { DestinationPageHero } from "../destination/DestinationPageHero";
import { DashboardHistoryPanel } from "../home/DashboardHistoryPanel";
import { DashboardScoreTargetCard } from "../home/DashboardScoreTargetCard";
import { DashboardSummaryCard } from "../home/DashboardSummaryCard";
import { DashboardWeeklyTargetCard } from "../home/DashboardWeeklyTargetCard";
import { ProgressIllustrationPanel } from "../progress/ProgressIllustrationPanel";

export function ProgressScreen({
  dashboard,
  illustration,
  model,
  notice,
  onUpdateScoreTarget,
}: {
  dashboard: HomeDashboardModel;
  illustration: ProgressIllustrationModel;
  model: DestinationPagesModel;
  notice: string;
  onUpdateScoreTarget: (target: number | undefined) => void;
}) {
  return (
    <main className="destinationPage destinationPage--progress arcane-page arcane-progress-compass">
      {notice ? <p className="notice dashboardNotice">{notice}</p> : null}
      <DestinationPageHero
        className="arcane-progress-compass"
        aside={(
          <div className="arcane-hero-seal-stack">
            <div
              aria-label={dashboard.scoreGoal.latestEstimate ? `Estimasi terakhir ${dashboard.scoreGoal.latestEstimate}` : "Belum ada estimasi"}
              className="arcane-score-ring"
            >
              <div className="arcane-score-ring-inner">
                <span className="arcane-score-ring-value">{dashboard.scoreGoal.latestEstimate ?? "--"}</span>
                <span className="arcane-score-ring-label">Estimasi</span>
              </div>
            </div>
            <strong>{dashboard.scoreGoal.gap !== undefined && dashboard.scoreGoal.gap > 0 ? `${dashboard.scoreGoal.gap} poin menuju target` : dashboard.scoreGoal.status ? "Target dalam jangkauan" : "Menunggu simulasi lengkap"}</strong>
          </div>
        )}
        eyebrow="Perkembangan"
        icon="analytics"
        title="Lihat perubahan yang nyata, lalu putuskan langkah berikutnya."
      >
        Target, hasil simulasi, ritme belajar, dan diagnostik dibaca bersama agar angka selalu memiliki konteks.
      </DestinationPageHero>

      <ProgressIllustrationPanel model={illustration} />

      <DashboardScoreTargetCard goal={dashboard.scoreGoal} onUpdate={onUpdateScoreTarget} />

      <section className="dashboardSummaryGrid arcane-metric-grid" aria-label="Ringkasan perkembangan">
        {dashboard.summary.map((item) => <DashboardSummaryCard item={item} key={item.id} />)}
      </section>

      <section className="progressAnalysisGrid arcane-home-grid">
        <article className="progressTrendPanel arcane-card arcane-history-card">
          <header className="arcane-panel-top">
            <p className="arcane-kicker">Tren Simulasi</p>
            <h2 className="arcane-panel-title">Perjalanan hasilmu</h2>
          </header>
          <div className="progressTrendList">
            {model.progressTrend.map((item) => (
              <div className="progressTrendItem" key={item.id}>
                <span>{item.dateLabel}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.targetLabel ?? "Tanpa target tersimpan"}</small>
                </div>
                <em><small>{item.valueLabel}</small>{item.value}</em>
              </div>
            ))}
            {!model.progressTrend.length ? <div className="destinationEmptyState arcane-empty">Selesaikan simulasi untuk membentuk tren hasil.</div> : null}
          </div>
        </article>
        <DashboardWeeklyTargetCard target={dashboard.weeklyTarget} />
      </section>

      <section className="latestDiagnosticPanel arcane-card arcane-status-panel">
        <header className="destinationSectionHeader arcane-section-header arcane-status-heading">
          <div>
            <p className="arcane-kicker">Diagnostik Terbaru</p>
            <h2 className="arcane-section-title arcane-status-title">{model.latestDiagnostic?.title ?? "Belum ada snapshot simulasi"}</h2>
          </div>
          {model.latestDiagnostic ? <span className="arcane-status-subtitle">{model.latestDiagnostic.dateLabel} · {model.latestDiagnostic.averageSecondsPerAttempt} detik/jawaban</span> : null}
        </header>
        {model.latestDiagnostic ? (
          <>
            <div className="diagnosticHeadlineStats arcane-metric-grid">
              <div><span>Akurasi</span><strong>{model.latestDiagnostic.accuracy}%</strong></div>
              <div><span>Kelengkapan</span><strong>{model.latestDiagnostic.completionRate}%</strong></div>
              <div><span>Estimasi terakhir</span><strong>{dashboard.scoreGoal.latestEstimate ?? "Belum ada"}</strong></div>
            </div>
            <div className="diagnosticAreaColumns">
              <DiagnosticAreaList areas={model.latestDiagnostic.weakestAreas} title="Area yang paling menghambat" />
              <DiagnosticAreaList areas={model.latestDiagnostic.strongestAreas} title="Area yang paling stabil" />
            </div>
          </>
        ) : <div className="destinationEmptyState arcane-empty">Jalankan simulasi untuk membuka diagnostik lintas bagian.</div>}
      </section>

      <DashboardHistoryPanel sessions={dashboard.recentSessions} />
    </main>
  );
}

function DiagnosticAreaList({ areas, title }: { areas: ProgressDiagnosticArea[]; title: string }) {
  return (
    <section className="diagnosticAreaList">
      <h3>{title}</h3>
      {areas.map((area) => (
        <div key={area.id}>
          <span><strong>{area.label}</strong><small>{area.attempted} percobaan · {area.incorrect} salah</small></span>
          <em>{area.accuracy}%</em>
        </div>
      ))}
    </section>
  );
}
