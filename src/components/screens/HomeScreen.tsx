import type { DashboardLaunchTarget, HomeDashboardModel } from "../../types/homeDashboard";
import type { LearningScope } from "../../utils/sessionEngine";
import type { FixedPackageQuestionCount } from "../../utils/sessionBlueprints";
import type { FocusedPracticeTarget } from "../../utils/focusedPractice";
import { DashboardFocusPanel } from "../home/DashboardFocusPanel";
import { DashboardHistoryPanel } from "../home/DashboardHistoryPanel";
import { DashboardPersonalHero } from "../home/DashboardPersonalHero";
import { DashboardRecommendationPanel } from "../home/DashboardRecommendationPanel";
import { DashboardSubjectCard } from "../home/DashboardSubjectCard";
import { DashboardSummaryCard } from "../home/DashboardSummaryCard";
import { DashboardTestSpaceCard } from "../home/DashboardTestSpaceCard";
import { DashboardWeeklyTargetCard } from "../home/DashboardWeeklyTargetCard";
import { DashboardScoreTargetCard } from "../home/DashboardScoreTargetCard";

export function HomeScreen({
  dashboard,
  notice,
  onClearStoredSession,
  onExplore,
  onStartLearning,
  onStartFocusedPractice,
  onStartListening,
  onStartSimulation,
  onUpdateScoreTarget,
}: {
  dashboard: HomeDashboardModel;
  notice: string;
  onClearStoredSession: () => void;
  onExplore: () => void;
  onStartLearning: (scope: LearningScope, questionCount?: FixedPackageQuestionCount) => void;
  onStartFocusedPractice: (target: FocusedPracticeTarget) => void;
  onStartListening: (mode: "learning" | "simulation", questionCount?: FixedPackageQuestionCount) => void;
  onStartSimulation: (mode: "structure-written" | "reading" | "full") => void;
  onUpdateScoreTarget: (target: number | undefined) => void;
}) {
  const launch = (target: DashboardLaunchTarget, questionCount: FixedPackageQuestionCount = 50) => {
    if (target === "simulation") {
      onStartSimulation("full");
      return;
    }
    if (target === "listening") {
      onStartListening("learning", questionCount);
      return;
    }
    onStartLearning(target, questionCount);
  };

  return (
    <main className="homeDashboardV2 arcane-page arcane-home">
      {notice ? <p className="notice dashboardNotice">{notice}</p> : null}

      <DashboardPersonalHero
        onExplore={onExplore}
        onStartSimulation={() => onStartSimulation("full")}
      />

      {dashboard.activeSession ? (
        <button className="personalSessionReset" type="button" onClick={onClearStoredSession}>
          Abaikan sesi tersimpan dan mulai ulang
        </button>
      ) : null}

      <section className="homeLearningZone arcane-section arcane-progress-compass" data-home-zone="progress">
        <header className="homeLearningZoneHeader arcane-section-header arcane-compass-header">
          <div>
            <p className="arcane-kicker">Perkembangan</p>
            <h2 className="arcane-section-title arcane-compass-title">Kompas belajar dan targetmu</h2>
          </div>
          <span>Semua angka berasal dari sesi nyata</span>
        </header>
        <DashboardScoreTargetCard goal={dashboard.scoreGoal} onUpdate={onUpdateScoreTarget} />
        <section className="dashboardSummaryGrid arcane-metric-grid" aria-label="Ringkasan belajar">
          {dashboard.summary.map((item) => (
            <DashboardSummaryCard item={item} key={item.id} />
          ))}
        </section>
        <div className="homeProgressGrid">
          <DashboardHistoryPanel sessions={dashboard.recentSessions} />
          <DashboardWeeklyTargetCard target={dashboard.weeklyTarget} />
        </div>
      </section>

      <section className="homeLearningZone arcane-section arcane-quest-board" data-home-zone="explore">
        <header className="homeLearningZoneHeader arcane-section-header">
          <div>
            <p className="arcane-kicker">Jelajahi</p>
            <h2 className="arcane-section-title">Pilih latihan yang benar-benar berguna hari ini</h2>
          </div>
          <span>Bagian tes menjadi kategori, bukan navigasi utama</span>
        </header>
        <DashboardRecommendationPanel recommendations={dashboard.recommendations} onLaunchFocused={onStartFocusedPractice} />
        <div className="dashboardSubjectGrid arcane-discipline-grid" aria-label="Bagian latihan">
          {dashboard.subjects.filter((item) => item.id !== "simulation").map((item) => (
            <DashboardSubjectCard item={item} key={item.id} onLaunch={launch} />
          ))}
        </div>
      </section>

      <section className="homeLearningZone arcane-section" data-home-zone="test-space">
        <DashboardTestSpaceCard
          testSpace={dashboard.testSpace}
          onStartSimulation={() => onStartSimulation("full")}
        />
      </section>

      <section className="homeLearningZone arcane-section arcane-archive" data-home-zone="collection">
        <header className="homeLearningZoneHeader arcane-section-header">
          <div>
            <p className="arcane-kicker">Koleksi Belajar</p>
            <h2 className="arcane-section-title">Fokus yang perlu kamu perbaiki berikutnya</h2>
          </div>
          <span>Dibentuk dari percobaan dan diagnostik nyata</span>
        </header>
        <div className="homeCollectionGrid homeCollectionGrid--focus-only">
          <DashboardFocusPanel areas={dashboard.focusAreas} onLaunchFocused={onStartFocusedPractice} />
        </div>
      </section>
    </main>
  );
}
