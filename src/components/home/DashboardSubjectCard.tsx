import { useState } from "react";
import type { DashboardLaunchTarget, DashboardSubject } from "../../types/homeDashboard";
import type { FixedPackageQuestionCount } from "../../utils/sessionBlueprints";
import { AppIcon, type AppIconName } from "../ui/AppIcon";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";

const ICONS: Record<DashboardSubject["id"], AppIconName> = {
  listening: "listening",
  reading: "reading",
  simulation: "simulation",
  "structure-written": "structure-written",
};

export function DashboardSubjectCard({
  item,
  onLaunch,
}: {
  item: DashboardSubject;
  onLaunch: (target: DashboardLaunchTarget, questionCount?: FixedPackageQuestionCount) => void;
}) {
  const [questionCount, setQuestionCount] = useState<FixedPackageQuestionCount>(50);

  return (
    <article
      className={`dashboardSubjectCard arcane-discipline-card arcane-card arcane-card-hover tone-${item.tone}`}
      data-launch-target={item.launchTarget}
      data-subject-card={item.id}
    >
      <div className="arcane-discipline-top">
        <div>
          <strong className="arcane-discipline-title">{item.title}</strong>
          <span className="arcane-discipline-subtitle">{item.metric}</span>
        </div>
        <span className="dashboardSubjectIcon arcane-discipline-icon" aria-hidden="true">
          <AppIcon name={ICONS[item.id]} />
        </span>
      </div>
      <span className="arcane-discipline-description">{item.detail}</span>
      {item.packageQuestionCounts ? (
        <SegmentedControl
          ariaLabel={`Jumlah soal ${item.title}`}
          className="dashboardSubjectPackages"
          options={item.packageQuestionCounts.map((count) => ({ label: count, value: count }))}
          value={questionCount}
          onChange={setQuestionCount}
        />
      ) : null}
      <div className="arcane-discipline-footer">
        <small className="arcane-discipline-note">Pilih jumlah soal, lalu mulai sesi latihan.</small>
        <Button
          data-subject-id={item.id}
          icon="arrow-right"
          iconPosition="end"
          size="sm"
          variant="secondary"
          type="button"
          onClick={() => onLaunch(item.launchTarget, item.packageQuestionCounts ? questionCount : undefined)}
        >
          Mulai
        </Button>
      </div>
    </article>
  );
}
