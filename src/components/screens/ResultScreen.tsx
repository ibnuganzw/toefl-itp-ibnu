import { Metric } from "../common/Metric";
import { computeDiagnostic, type DiagnosticArea, type RuntimeSession, formatDuration } from "../../utils/sessionEngine";
import { Button } from "../ui/Button";
import type { ScoreTargetComparison, SimulationScoreEstimate } from "../../types/scoring";
import { scoreTargetFeedback } from "../../utils/scoreEstimation";
import { ScoreRevealModal } from "../result/ScoreRevealModal";

export function ResultScreen({
  diagnostic,
  notice,
  scoreEstimate,
  scoreTargetComparison,
  showScoreReveal,
  session,
  onGoHome,
  onCloseScoreReveal,
  onReview,
  onRetryDoubtful,
  onRetryWrong,
  onTrainWeakest,
}: {
  diagnostic: ReturnType<typeof computeDiagnostic>;
  notice: string;
  scoreEstimate?: SimulationScoreEstimate;
  scoreTargetComparison?: ScoreTargetComparison;
  showScoreReveal: boolean;
  session: RuntimeSession;
  onGoHome: () => void;
  onCloseScoreReveal: () => void;
  onReview: () => void;
  onRetryDoubtful: () => void;
  onRetryWrong: () => void;
  onTrainWeakest: () => void;
}) {
  return (
    <main className="appShell resultShell resultDashboardShell arcane-result-page">
      <section className="resultHero resultDashboardHero arcane-result-hero">
        <div>
          <p className="eyebrow">Hasil Sesi</p>
          <h1>{session.title}</h1>
          <p className="intro">
            Akurasi dihitung dari soal yang dijawab. Pembahasan lengkap tersedia di layar review.
          </p>
        </div>
        <div className="scoreDial arcane-score-sigil">
          <strong>{diagnostic.accuracy}%</strong>
          <span>{diagnostic.totalCorrect}/{diagnostic.totalAttempted} benar</span>
        </div>
      </section>

      {notice ? <p className="notice">{notice}</p> : null}

      {scoreEstimate ? (
        <ScoreEstimatePanel estimate={scoreEstimate} comparison={scoreTargetComparison} />
      ) : null}

      <section className="resultDashboardGrid arcane-diagnosis-grid">
        <div className="resultMainColumn">
          <section className="grid metricsGrid resultMetricGrid arcane-result-metric-grid">
            <Metric label="Total soal" value={diagnostic.totalQuestions} />
            <Metric label="Terjawab" value={diagnostic.totalAttempted} />
            <Metric label="Salah" value={diagnostic.totalIncorrect} />
            <Metric label="Kosong" value={diagnostic.totalUnanswered} />
            <Metric label="Ragu-ragu" value={diagnostic.totalDoubtful} />
            <Metric label="Selesai" value={`${diagnostic.completionRate}%`} />
            <Metric label="Durasi" value={formatDuration(session.elapsedSeconds)} />
          </section>

          <DiagnosticPanel title="Per Bagian" buckets={diagnostic.bySection} />
          <DiagnosticPanel title="Area Prioritas" buckets={diagnostic.weakestAreas} />
        </div>

        <aside className="panel resultInsightPanel arcane-diagnosis-card">
          <div className="sidePanelHeader">
            <div>
              <p className="eyebrow">Insight</p>
              <h2>Kekuatan Utama</h2>
            </div>
          </div>
          <div className="weakList">
            {diagnostic.strongestAreas.map((area) => (
              <div className="weakItem" key={`${area.category}-${area.key}`}>
                <span>
                  <strong>{area.label}</strong>
                  <small>{diagnosticCategoryLabel(area.category)} · {area.correct}/{area.attempted} benar</small>
                </span>
                <strong>{area.accuracy}%</strong>
              </div>
            ))}
            {!diagnostic.strongestAreas.length ? <p className="muted">Belum ada jawaban untuk dianalisis.</p> : null}
          </div>
        </aside>
      </section>

      <div className="resultActions resultCommandBar arcane-result-actions">
        <Button icon="list" variant="primary" type="button" onClick={onReview}>
          Review Pembahasan
        </Button>
        <Button icon="rotate" variant="secondary" type="button" onClick={onRetryWrong}>
          Ulangi Salah
        </Button>
        <Button icon="bookmark" variant="secondary" type="button" onClick={onRetryDoubtful}>
          Ulangi Ragu-ragu
        </Button>
        <Button icon="structure-written" variant="secondary" type="button" onClick={onTrainWeakest}>
          Latih Area Terlemah
        </Button>
        <Button icon="home" variant="ghost" type="button" onClick={onGoHome}>
          Beranda
        </Button>
      </div>

      {showScoreReveal && scoreEstimate ? (
        <ScoreRevealModal
          comparison={scoreTargetComparison}
          estimate={scoreEstimate}
          weakestArea={diagnostic.weakestAreas[0]}
          onClose={onCloseScoreReveal}
          onReview={onReview}
          onTrainWeakest={onTrainWeakest}
        />
      ) : null}
    </main>
  );
}

function ScoreEstimatePanel({
  comparison,
  estimate,
}: {
  comparison?: ScoreTargetComparison;
  estimate: SimulationScoreEstimate;
}) {
  const feedback = comparison ? scoreTargetFeedback(comparison) : undefined;
  return (
    <section className="scoreEstimatePanel arcane-result-state" aria-labelledby="score-estimate-title">
      <div className="scoreEstimateTotal">
        <p className="eyebrow">Estimasi latihan, bukan skor resmi</p>
        <h2 id="score-estimate-title">Estimasi Skor Simulasi TOEFL ITP</h2>
        <strong>{estimate.totalEstimate}</strong>
        <span>{estimate.rawTotalCorrect}/{estimate.rawTotalQuestions} jawaban benar</span>
      </div>
      <div className="scoreEstimateSections">
        <EstimateSection label="Listening" section={estimate.sections.listening} />
        <EstimateSection label="Structure & Written" section={estimate.sections.structureWritten} />
        <EstimateSection label="Reading" section={estimate.sections.reading} />
      </div>
      <div className="scoreEstimateFeedback">
        {comparison && feedback ? (
          <>
            <span>Target {comparison.targetScore}</span>
            <h3>{feedback.headline}</h3>
            <p>{feedback.message}</p>
          </>
        ) : (
          <>
            <span>Target belum ditetapkan</span>
            <h3>Jadikan hasil ini sebagai titik awal</h3>
            <p>Tetapkan target di Beranda agar simulasi berikutnya dapat dibandingkan secara personal.</p>
          </>
        )}
      </div>
    </section>
  );
}

function EstimateSection({
  label,
  section,
}: {
  label: string;
  section: SimulationScoreEstimate["sections"]["listening"];
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{section.scaledEstimate}</strong>
      <small>{section.rawCorrect}/{section.rawQuestionCount} benar</small>
    </div>
  );
}

function DiagnosticPanel({ buckets, title }: { buckets: DiagnosticArea[]; title: string }) {
  return (
    <article className="panel diagnosticPanel arcane-diagnosis-card">
      <h2>{title}</h2>
      <div className="bucketList">
        {buckets.map((bucket) => (
          <div className="bucketItem" key={`${bucket.category}-${bucket.key}`}>
            <div>
              <strong>{bucket.label}</strong>
              <span>
                {diagnosticCategoryLabel(bucket.category)} · {bucket.correct}/{bucket.attempted} benar ·{" "}
                {bucket.unanswered} kosong
              </span>
            </div>
            <meter max={100} min={0} value={bucket.accuracy} />
            <span>{bucket.accuracy}%</span>
          </div>
        ))}
        {!buckets.length ? <p className="muted">Belum ada data.</p> : null}
      </div>
    </article>
  );
}

function diagnosticCategoryLabel(category: DiagnosticArea["category"]): string {
  if (category === "section") return "Bagian";
  if (category === "grammar") return "Pola grammar";
  if (category === "readingSkill") return "Skill Reading";
  return "Skill Listening";
}
