import type { DashboardLaunchTarget, HomeDashboardModel } from "../../types/homeDashboard";
import type { LearningScope } from "../../utils/sessionEngine";
import type { FixedPackageQuestionCount } from "../../utils/sessionBlueprints";
import type { FocusedPracticeTarget } from "../../utils/focusedPractice";
import { DestinationPageHero } from "../destination/DestinationPageHero";
import { DashboardFocusPanel } from "../home/DashboardFocusPanel";
import { DashboardRecommendationPanel } from "../home/DashboardRecommendationPanel";
import { DashboardSubjectCard } from "../home/DashboardSubjectCard";
import { Button } from "../ui/Button";

export function ExploreScreen({
  dashboard,
  notice,
  onStartLearning,
  onStartFocusedPractice,
  onStartListening,
}: {
  dashboard: HomeDashboardModel;
  notice: string;
  onStartLearning: (scope: LearningScope, questionCount?: FixedPackageQuestionCount) => void;
  onStartFocusedPractice: (target: FocusedPracticeTarget) => void;
  onStartListening: (mode: "learning", questionCount?: FixedPackageQuestionCount) => void;
}) {
  const launch = (target: DashboardLaunchTarget, questionCount: FixedPackageQuestionCount = 50) => {
    if (target === "listening") {
      onStartListening("learning", questionCount);
      return;
    }
    if (target !== "simulation") onStartLearning(target, questionCount);
  };

  return (
    <main className="destinationPage destinationPage--explore arcane-page arcane-explore">
      {notice ? <p className="notice dashboardNotice">{notice}</p> : null}
      <DestinationPageHero
        actions={(
          <div className="arcane-explore-hero-actions">
            <Button variant="primary" type="button" onClick={() => document.getElementById("rekomendasi")?.scrollIntoView({ behavior: "smooth" })}>
              Mulai Rekomendasi
            </Button>
            <Button variant="secondary" type="button" onClick={() => document.getElementById("katalog-latihan")?.scrollIntoView({ behavior: "smooth" })}>
              Lihat Katalog
            </Button>
          </div>
        )}
        className="arcane-explore-hero arcane-quest-board"
        aside={(
          <div className="arcane-hero-seal-stack">
            <div
              aria-label={`${dashboard.recommendations.length} rekomendasi aktif`}
              className="arcane-quest-seal"
            >
              <div className="arcane-quest-seal-inner">{dashboard.recommendations.length}</div>
            </div>
            <strong>{dashboard.summary.find((item) => item.id === "active-questions")?.value ?? 0} soal aktif tervalidasi</strong>
          </div>
        )}
        eyebrow="Jelajahi"
        icon="sparkles"
        title="Temukan latihan berdasarkan kebutuhan, bukan tebakan."
      >
        Mulai dari rekomendasi diagnostik, pilih bagian tes, lalu tentukan ukuran sesi yang sanggup kamu selesaikan.
      </DestinationPageHero>

      <section className="destinationSection destinationSection--recommendation arcane-section" id="rekomendasi">
        <DashboardRecommendationPanel recommendations={dashboard.recommendations} onLaunchFocused={onStartFocusedPractice} />
        <DashboardFocusPanel areas={dashboard.focusAreas} onLaunchFocused={onStartFocusedPractice} />
      </section>

      <section className="destinationSection arcane-section arcane-catalog" id="katalog-latihan">
        <header className="destinationSectionHeader arcane-section-header">
          <div>
            <p className="arcane-kicker">Katalog Latihan</p>
            <h2 className="arcane-section-title">Bagian tes sebagai kategori belajar</h2>
          </div>
          <span>Pilih paket 25, 50, atau 100 soal</span>
        </header>
        <div className="destinationSubjectGrid arcane-discipline-grid">
          {dashboard.subjects.filter((item) => item.id !== "simulation").map((item) => (
            <DashboardSubjectCard item={item} key={item.id} onLaunch={launch} />
          ))}
        </div>
      </section>
    </main>
  );
}
