import type { DashboardRecommendation } from "../../types/homeDashboard";
import type { FocusedPracticeTarget } from "../../utils/focusedPractice";
import { Button } from "../ui/Button";
import { DashboardPanel } from "./DashboardPanel";

export function DashboardRecommendationPanel({
  recommendations,
  onLaunchFocused,
}: {
  recommendations: DashboardRecommendation[];
  onLaunchFocused: (target: FocusedPracticeTarget) => void;
}) {
  return (
    <DashboardPanel
      className="dashboardRecommendationPanel arcane-recommendation-panel"
      eyebrow="Rekomendasi Hari Ini"
      title="Latihan yang paling relevan"
    >
      <div className="dashboardRecommendationList arcane-trial-list">
        {recommendations.map((item) => (
          <button
            className={`dashboardRecommendationItem arcane-trial-card tone-${item.tone}`}
            data-launch-target={item.launchTarget}
            data-focus-category={item.focusTarget.category}
            data-focus-key={item.focusTarget.key}
            key={item.id}
            type="button"
            onClick={() => onLaunchFocused(item.focusTarget)}
          >
            <span className="recommendationMarker" aria-hidden="true" />
            <span>
              <strong className="arcane-trial-title">{item.title} / {item.focus}</strong>
              <small className="arcane-trial-description">{item.detail}</small>
            </span>
            <span className="recommendationMeta arcane-trial-meta">
              <strong>{item.questionCount} soal</strong>
              <small>{item.accuracy === undefined ? "Mulai fokus" : `${item.accuracy}% akurasi`}</small>
            </span>
          </button>
        ))}
      </div>
      <Button
        icon="arrow-right"
        iconPosition="end"
        variant="primary"
        type="button"
        disabled={!recommendations.length}
        onClick={() => recommendations[0] && onLaunchFocused(recommendations[0].focusTarget)}
      >
        Mulai Rekomendasi
      </Button>
    </DashboardPanel>
  );
}
