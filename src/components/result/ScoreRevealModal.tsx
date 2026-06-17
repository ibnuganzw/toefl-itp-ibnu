import type { DiagnosticArea } from "../../types/diagnostics";
import type { ScoreTargetComparison, SimulationScoreEstimate } from "../../types/scoring";
import { buildScoreRevealMessage } from "../../utils/scoreEstimation";
import { useBodyScrollLock, useFocusTrap } from "../a11y/ArcaneA11y";
import { Button } from "../ui/Button";

export function ScoreRevealModal({
  comparison,
  estimate,
  weakestArea,
  onClose,
  onReview,
  onTrainWeakest,
}: {
  comparison?: ScoreTargetComparison;
  estimate: SimulationScoreEstimate;
  weakestArea?: DiagnosticArea;
  onClose: () => void;
  onReview: () => void;
  onTrainWeakest: () => void;
}) {
  const reveal = buildScoreRevealMessage(estimate, comparison, weakestArea?.label);
  const modalRef = useFocusTrap<HTMLElement>(true, onClose);
  useBodyScrollLock(true);

  return (
    <div className="modalBackdrop scoreRevealBackdrop arcane-modal-overlay" role="presentation" onClick={onClose}>
      <section
        aria-labelledby="score-reveal-title"
        aria-modal="true"
        className={`scoreRevealModal scoreRevealModal--${reveal.tone} arcane-result-state`}
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="scoreRevealLead">
          <div className="scoreRevealCopy">
            <p>{reveal.eyebrow}</p>
            <h2 id="score-reveal-title">{reveal.headline}</h2>
            <span>{reveal.targetSummary}</span>
            <strong>{estimate.totalEstimate}</strong>
            <small>Estimasi latihan, bukan skor resmi</small>
          </div>
          <div className="scoreRevealMessage">
            <p>{reveal.message}</p>
            <div>
              <span>Langkah berikutnya</span>
              <strong>{reveal.nextStep}</strong>
            </div>
          </div>
        </div>

        <div className="scoreRevealSections" aria-label="Estimasi per bagian">
          <RevealSection label="Listening" score={estimate.sections.listening.scaledEstimate} raw={`${estimate.sections.listening.rawCorrect}/${estimate.sections.listening.rawQuestionCount}`} />
          <RevealSection label="Structure & Written" score={estimate.sections.structureWritten.scaledEstimate} raw={`${estimate.sections.structureWritten.rawCorrect}/${estimate.sections.structureWritten.rawQuestionCount}`} />
          <RevealSection label="Reading" score={estimate.sections.reading.scaledEstimate} raw={`${estimate.sections.reading.rawCorrect}/${estimate.sections.reading.rawQuestionCount}`} />
          <div className="scoreRevealPriority">
            <span>Area penghambat utama</span>
            <strong>{weakestArea?.label ?? "Belum cukup data"}</strong>
            <small>
              {weakestArea
                ? `${weakestArea.correct}/${weakestArea.attempted} benar / akurasi ${weakestArea.accuracy}%`
                : "Jawab lebih banyak soal untuk membuka diagnosis area."}
            </small>
          </div>
        </div>

        <div className="scoreRevealActions">
          <Button icon="analytics" variant="primary" type="button" onClick={onClose}>
            Lihat Hasil Lengkap
          </Button>
          <Button icon="list" variant="secondary" type="button" onClick={onReview}>
            Review Pembahasan
          </Button>
          {weakestArea ? (
            <Button icon="structure-written" variant="secondary" type="button" onClick={onTrainWeakest}>
              Latih Area Prioritas
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function RevealSection({ label, raw, score }: { label: string; raw: string; score: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{score}</strong>
      <small>{raw} benar</small>
    </div>
  );
}
