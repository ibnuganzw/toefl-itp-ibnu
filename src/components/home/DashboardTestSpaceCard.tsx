import type { DashboardTestSpace } from "../../types/homeDashboard";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

export function DashboardTestSpaceCard({
  testSpace,
  onStartSimulation,
}: {
  testSpace: DashboardTestSpace;
  onStartSimulation: () => void;
}) {
  return (
    <article className="dashboardTestSpaceCard arcane-trial-gate arcane-card">
      <div className="dashboardTestSpaceIcon" aria-hidden="true">
        <AppIcon name="simulation" />
      </div>
      <div className="dashboardTestSpaceCopy arcane-trial-gate-content">
        <p className="arcane-kicker">Ruang Uji</p>
        <h2 className="arcane-trial-gate-title">{testSpace.title}</h2>
        <span className="arcane-trial-gate-description">{testSpace.detail}</span>
        <div className="dashboardTestSpaceSignals arcane-trial-gate-stats">
          <strong>{testSpace.readinessLabel}</strong>
          <span>{testSpace.targetLabel}</span>
          <span>{testSpace.lastEstimateLabel}</span>
        </div>
      </div>
      <Button
        data-subject-id="simulation"
        icon="arrow-right"
        iconPosition="end"
        variant="primary"
        type="button"
        onClick={onStartSimulation}
      >
        Mulai Simulasi Lengkap
      </Button>
    </article>
  );
}
