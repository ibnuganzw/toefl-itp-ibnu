import type { ProgressIllustrationModel } from "../../types/progressIllustration";
import { ProgressIllustration } from "./ProgressIllustration";

export function ProgressIllustrationPanel({ model }: { model: ProgressIllustrationModel }) {
  return (
    <section className="progressIllustrationPanel arcane-progress-compass arcane-card" aria-labelledby="progress-illustration-title">
      <div className="progressIllustrationPanelVisual arcane-hero-visual">
        <ProgressIllustration model={model} />
      </div>
      <div className="progressIllustrationPanelCopy arcane-compass-description">
        <p className="arcane-kicker">Ruang Belajar yang Bertumbuh</p>
        <h2 className="arcane-compass-title" id="progress-illustration-title">{model.title}</h2>
        <span>{model.message}</span>
        <div className="progressIllustrationStageTrack arcane-progress" aria-label={`Fase progres ${model.stageIndex + 1} dari 5`}>
          <span className="arcane-progress-bar" style={{ inlineSize: `${model.stageProgressPercent}%` }} />
        </div>
        <div className="progressIllustrationMilestones">
          {model.milestones.map((milestone, index) => (
            <article className={`progressMilestone progressMilestone--${milestone.state}`} key={milestone.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{milestone.label}</strong>
                <small>{milestone.detail}</small>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="progressIllustrationSignals">
        {model.signals.map((signal) => (
          <article className={`progressSignal progressSignal--${signal.id}`} key={signal.id}>
            <span>{signal.label}</span>
            <strong>{signal.valueLabel}</strong>
            <small>{signal.explanation}</small>
            <div aria-hidden="true"><span style={{ inlineSize: `${signal.progressPercent}%` }} /></div>
          </article>
        ))}
      </div>
    </section>
  );
}
