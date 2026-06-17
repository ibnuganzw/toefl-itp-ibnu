import { type FormEvent, useEffect, useState } from "react";
import {
  TOEFL_ITP_ESTIMATED_TOTAL_MAX,
  TOEFL_ITP_ESTIMATED_TOTAL_MIN,
} from "../../data/scoreConversion";
import type { DashboardScoreGoal } from "../../types/homeDashboard";
import { Button } from "../ui/Button";

const STATUS_LABELS = {
  achieved: "Target tercapai",
  near: "Sedikit lagi",
  progressing: "Sedang berkembang",
  far: "Perkuat fondasi",
} as const;

export function DashboardScoreTargetCard({
  goal,
  onUpdate,
}: {
  goal: DashboardScoreGoal;
  onUpdate: (target: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(goal.targetScore?.toString() ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(goal.targetScore?.toString() ?? "");
  }, [goal.targetScore]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = Number(draft);
    if (
      !draft.trim() ||
      !Number.isFinite(target) ||
      target < TOEFL_ITP_ESTIMATED_TOTAL_MIN ||
      target > TOEFL_ITP_ESTIMATED_TOTAL_MAX
    ) {
      setError(
        `Masukkan target antara ${TOEFL_ITP_ESTIMATED_TOTAL_MIN} dan ${TOEFL_ITP_ESTIMATED_TOTAL_MAX}.`,
      );
      return;
    }
    setError("");
    onUpdate(target);
  };

  return (
    <section className="dashboardScoreTarget arcane-target-panel arcane-card" aria-labelledby="score-target-title">
      <div className="dashboardScoreTargetIntro arcane-target-copy">
        <p className="arcane-kicker">Tujuan Utama</p>
        <h2 className="arcane-target-title" id="score-target-title">Target Estimasi TOEFL ITP</h2>
        <span>
          Target ini fleksibel dan dibandingkan dengan hasil simulasi lengkap 50-40-50.
        </span>
      </div>

      <div className="dashboardScoreTargetStats arcane-metric-grid">
        <ScoreTargetStat label="Target" value={goal.targetScore ?? "Belum diatur"} />
        <ScoreTargetStat label="Estimasi terakhir" value={goal.latestEstimate ?? "Belum ada"} />
        <ScoreTargetStat label="Estimasi terbaik" value={goal.bestEstimate ?? "Belum ada"} />
        <ScoreTargetStat
          label="Status"
          value={goal.status ? STATUS_LABELS[goal.status] : "Menunggu simulasi"}
        />
      </div>

      <form className="dashboardScoreTargetForm arcane-target-input-group" onSubmit={submit}>
        <label htmlFor="score-target-input">Ubah target</label>
        <div>
          <input
            className="arcane-input arcane-target-input"
            id="score-target-input"
            inputMode="numeric"
            max={TOEFL_ITP_ESTIMATED_TOTAL_MAX}
            min={TOEFL_ITP_ESTIMATED_TOTAL_MIN}
            placeholder="Contoh: 477"
            type="number"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button size="sm" type="submit" variant="primary">Simpan Target</Button>
          {goal.targetScore !== undefined ? (
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setError("");
                onUpdate(undefined);
              }}
            >
              Hapus
            </Button>
          ) : null}
        </div>
        {error ? <small role="alert">{error}</small> : null}
        {goal.gap !== undefined && goal.gap > 0 ? (
          <small>Estimasi terakhir membutuhkan {goal.gap} poin lagi untuk mencapai target.</small>
        ) : null}
      </form>
    </section>
  );
}

function ScoreTargetStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
