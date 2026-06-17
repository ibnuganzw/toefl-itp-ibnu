import { type FormEvent, useState } from "react";
import type { HomeDashboardModel } from "../../types/homeDashboard";
import type { SimulationConfig } from "../../types/questionTypes";
import { READING_SLOT_BLUEPRINTS, type FixedPackageQuestionCount } from "../../utils/sessionBlueprints";
import { DestinationPageHero } from "../destination/DestinationPageHero";
import { DashboardHistoryPanel } from "../home/DashboardHistoryPanel";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

export function TestSpaceScreen({
  dashboard,
  notice,
  onResumeSession,
  onStartCustomSimulation,
  onStartSimulation,
}: {
  dashboard: HomeDashboardModel;
  notice: string;
  onResumeSession: () => void;
  onStartCustomSimulation: (config: Partial<SimulationConfig>) => void;
  onStartSimulation: () => void;
}) {
  const [error, setError] = useState("");
  const [custom, setCustom] = useState({
    listeningQuestionCount: 25,
    structureCount: 15,
    writtenCount: 25,
    readingQuestionCount: 25,
    timeLimitMinutes: 75,
  });
  const customTotal =
    custom.listeningQuestionCount +
    custom.structureCount +
    custom.writtenCount +
    readingPackageTotal(custom.readingQuestionCount);
  const customProducesEstimate =
    custom.listeningQuestionCount === 50 &&
    custom.structureCount + custom.writtenCount === 40 &&
    custom.readingQuestionCount === 50;

  const submitCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isCompatiblePackage = (value: number) => value === 0 || value === 25 || value === 50;
    const isValidSectionCount = (value: number) =>
      Number.isInteger(value) && value >= 0 && value <= 50 && value % 5 === 0;
    const isValidTime = Number.isInteger(custom.timeLimitMinutes) &&
      custom.timeLimitMinutes >= 10 &&
      custom.timeLimitMinutes <= 180;

    if (
      !customTotal ||
      !isCompatiblePackage(custom.listeningQuestionCount) ||
      !isCompatiblePackage(custom.readingQuestionCount) ||
      !isValidSectionCount(custom.structureCount) ||
      !isValidSectionCount(custom.writtenCount) ||
      !isValidTime
    ) {
      setError("Gunakan paket Listening/Reading 0, 25, atau 50 soal; Structure/Written kelipatan 5; dan waktu 10-180 menit.");
      return;
    }

    setError("");
    onStartCustomSimulation({
      ...custom,
      includeSeenQuestions: true,
      shuffleQuestions: true,
      shuffleReadingQuestionsWithinPassage: false,
    });
  };

  return (
    <main className="destinationPage destinationPage--test-space arcane-page arcane-trial-page">
      {notice ? <p className="notice dashboardNotice">{notice}</p> : null}
      <DestinationPageHero
        actions={(
          <div className="arcane-trial-gate-actions">
            <Button icon="arrow-right" iconPosition="end" variant="primary" type="button" onClick={onStartSimulation}>
              Mulai Simulasi Lengkap
            </Button>
            <Button variant="secondary" type="button" onClick={() => document.getElementById("trial-builder")?.scrollIntoView({ behavior: "smooth" })}>
              Rancang Simulasi Parsial
            </Button>
          </div>
        )}
        aside={(
          <div className="arcane-trial-gate-stats arcane-trial-status-panel" aria-label="Ringkasan ruang uji">
            <div className="arcane-trial-status-primary">
              <span className="arcane-trial-stat-dot" aria-hidden="true" />
              <div>
                <span className="arcane-trial-status-label">Status estimasi</span>
                <strong>{dashboard.testSpace.readinessLabel}</strong>
              </div>
            </div>
            <dl className="arcane-trial-status-details">
              <div className="arcane-trial-stat-pill">
                <dt>Target aktif</dt>
                <dd>{dashboard.scoreGoal.targetScore ?? "Belum diatur"}</dd>
              </div>
              <div className="arcane-trial-stat-pill">
                <dt>Estimasi terakhir</dt>
                <dd>{dashboard.scoreGoal.latestEstimate ?? "Belum tersedia"}</dd>
              </div>
            </dl>
          </div>
        )}
        className="arcane-trial-gate"
        eyebrow="Ruang Uji"
        icon="simulation"
        title="Ukur gambaran utuhmu. Atur bagian tertentu hanya saat diperlukan."
      >
        Simulasi Lengkap memperbarui estimasi total internal. Simulasi parsial dipakai untuk menguji bagian tertentu tanpa menghasilkan estimasi total.
      </DestinationPageHero>

      <div className="arcane-trial-layout">
        <div className="arcane-trial-modes">
      {dashboard.activeSession ? (
        <section className="arcane-resume-trial arcane-card">
          <div>
            <span className="arcane-kicker">Sesi Terbuka</span>
            <h2 className="arcane-resume-title">{dashboard.activeSession.title}</h2>
            <p className="arcane-resume-copy">Lanjutkan dari posisi terakhir tanpa mengulang sesi dari awal.</p>
            <div className="arcane-resume-meta">
              <span className="arcane-badge arcane-badge-active">{dashboard.activeSession.meta}</span>
            </div>
          </div>
          <Button icon="arrow-right" iconPosition="end" variant="primary" type="button" onClick={onResumeSession}>
            Lanjutkan Sesi
          </Button>
        </section>
      ) : null}
      <section className="simulationModeGrid arcane-trial-mode-grid" id="mode-simulasi">
        <article className="simulationModeCard arcane-trial-mode-card arcane-trial-mode-card--primary arcane-card arcane-card-hover simulationModeCard--full">
          <div className="arcane-trial-mode-top">
            <div>
              <p className="arcane-kicker">Pengukuran Utama</p>
              <h2 className="arcane-trial-mode-title">Simulasi Lengkap</h2>
              <p className="arcane-trial-mode-subtitle">Listening, Structure & Written, Reading</p>
            </div>
            <span className="arcane-trial-mode-icon" aria-hidden="true"><AppIcon name="simulation" /></span>
          </div>
          <strong className="arcane-trial-mode-meta">140 soal / 115 menit</strong>
          <div className="arcane-trial-mode-description">
            Jalani seluruh rangkaian untuk memperbarui estimasi skor total internal dan memperoleh diagnostik lintas bagian.
          </div>
          <div className="arcane-trial-mode-outcomes" aria-label="Hasil simulasi lengkap">
            <TrialOutcome label="Cakupan" value="Semua bagian tes" />
            <TrialOutcome label="Hasil utama" value="Estimasi total + diagnostik" />
            <TrialOutcome label="Gunakan saat" value="Siap mengukur progres menyeluruh" />
          </div>
          <div className="arcane-trial-mode-footer">
            <span className="arcane-trial-mode-note">Estimasi bersifat internal dan bukan skor resmi TOEFL ITP.</span>
            <Button
              data-simulation-mode="full"
              icon="arrow-right"
              iconPosition="end"
              variant="primary"
              type="button"
              onClick={onStartSimulation}
            >
              Mulai Simulasi Lengkap
            </Button>
          </div>
        </article>
      </section>

      <section className="customSimulationPanel arcane-builder-page arcane-card" id="trial-builder">
        <header className="arcane-builder-hero">
          <div className="arcane-builder-description">
            <p className="arcane-kicker">Simulasi Parsial & Kustom</p>
            <h2 className="arcane-builder-title">Uji bagian yang ingin kamu ukur</h2>
            <span>Pilih Listening saja, Structure & Written saja, Reading saja, atau susun kombinasi sendiri. Hanya komposisi lengkap tervalidasi yang dapat memperbarui estimasi total.</span>
          </div>
          <div className="arcane-builder-seal" aria-label={`${customTotal} soal, ${custom.timeLimitMinutes} menit`}>
            <div className="arcane-builder-seal-inner">
              <strong>{customTotal}</strong>
              <span>soal</span>
            </div>
          </div>
        </header>

        <form className="arcane-builder-layout" onSubmit={submitCustom}>
          <div className="arcane-builder-panel arcane-builder-group">
            <div className="arcane-builder-group-header">
              <div>
                <span className="arcane-kicker">Komposisi Simulasi</span>
                <h3 className="arcane-builder-group-title">Susun bagian yang ingin diuji</h3>
              </div>
              <span className="arcane-builder-group-copy">Pilih paket atau atur jumlah soal untuk setiap bagian.</span>
            </div>
            <div className="arcane-builder-control-grid">
              <PackageField
                description="Pilih paket soal Listening."
                label="Listening"
                value={custom.listeningQuestionCount}
                onChange={(value) => setCustom({ ...custom, listeningQuestionCount: value })}
              />
              <CustomField
                description="Atur jumlah soal penyelesaian kalimat."
                label="Structure"
                max={50}
                min={0}
                step={5}
                value={custom.structureCount}
                onChange={(value) => setCustom({ ...custom, structureCount: value })}
              />
              <CustomField
                description="Atur jumlah soal identifikasi kesalahan."
                label="Written"
                max={50}
                min={0}
                step={5}
                value={custom.writtenCount}
                onChange={(value) => setCustom({ ...custom, writtenCount: value })}
              />
              <PackageField
                description="Pilih paket soal Reading."
                label="Reading"
                optionLabel={(value) => `Paket ${value}`}
                optionMeta={(value) => `${readingPackageTotal(value)} soal`}
                value={custom.readingQuestionCount}
                onChange={(value) => setCustom({ ...custom, readingQuestionCount: value })}
              />
              <CustomField
                description="Tentukan batas waktu untuk seluruh komposisi."
                label="Waktu Pengerjaan"
                max={180}
                min={10}
                step={5}
                unit="menit"
                value={custom.timeLimitMinutes}
                onChange={(value) => setCustom({ ...custom, timeLimitMinutes: value })}
              />
            </div>
          </div>

          <aside className="arcane-builder-summary" aria-label="Ringkasan simulasi kustom">
            <div className="arcane-summary-heading">
              <div className="arcane-summary-copy">
                <span className="arcane-kicker">Ringkasan Simulasi</span>
                <h3 className="arcane-summary-title">Komposisi siap dimulai</h3>
              </div>
              <div className="arcane-summary-total" aria-label={`${customTotal} soal`}>
                <strong>{customTotal}</strong>
                <span>soal</span>
              </div>
            </div>
            <dl className="arcane-summary-list">
              <SummaryRow label="Listening" value={`${custom.listeningQuestionCount} soal`} />
              <SummaryRow label="Structure & Written" value={`${custom.structureCount + custom.writtenCount} soal`} />
              <SummaryRow label="Reading" value={`${readingPackageTotal(custom.readingQuestionCount)} soal`} />
              <SummaryRow label="Batas waktu" value={`${custom.timeLimitMinutes} menit`} />
            </dl>
            <p className="arcane-summary-warning">
              {customProducesEstimate
                ? "Komposisi lengkap ini memenuhi syarat untuk memperbarui estimasi skor total internal."
                : "Komposisi ini menghasilkan diagnostik belajar tanpa memperbarui estimasi skor total."}
            </p>
            <div className="arcane-builder-actions">
              <Button disabled={!customTotal} variant="primary" type="submit">Mulai Simulasi Pilihan</Button>
            </div>
            {error ? <small className="customSimulationError" role="alert">{error}</small> : null}
          </aside>
        </form>
      </section>

      <section className="arcane-trial-rule-card arcane-card">
        <div>
          <span className="arcane-kicker">Aturan Ruang Uji</span>
          <h2 className="arcane-section-title">Simulasi dibuat untuk mengukur arah, bukan menggantikan tes resmi</h2>
          <p className="arcane-section-description">Hasil dipakai sebagai estimasi internal dan bahan diagnosis belajar untuk menentukan bagian yang perlu dilatih ulang.</p>
        </div>
        <div className="arcane-trial-rule-grid">
          <TrialRule label="Lengkap" value="Estimasi total + diagnostik" />
          <TrialRule label="Parsial" value="Diagnostik tanpa estimasi total" />
          <TrialRule label="Setelah sesi" value="Review dan Pembahasan" />
        </div>
      </section>

      <DashboardHistoryPanel sessions={dashboard.recentSessions} />
        </div>

        <aside className="arcane-readiness-panel arcane-card">
          <div className="arcane-readiness-heading">
            <span className="arcane-readiness-icon" aria-hidden="true"><AppIcon name="check" /></span>
            <div>
              <span className="arcane-kicker">Kesiapan Sesi</span>
              <h2 className="arcane-readiness-title">Siap masuk Ruang Uji</h2>
            </div>
          </div>
          <div className="arcane-readiness-status">
            <span className="arcane-readiness-status-label">Status pengukuranmu</span>
            <strong>{dashboard.testSpace.readinessLabel}</strong>
            <p>Pilih Simulasi Lengkap untuk membentuk atau memperbarui estimasi total internal.</p>
          </div>
          <p className="arcane-readiness-copy">Sebelum memulai, siapkan kondisi yang membantu hasil sesi menggambarkan kemampuanmu dengan lebih jujur.</p>
          <ul className="arcane-readiness-list">
            <li className="arcane-readiness-item">Pilih tempat yang tenang sebelum memulai.</li>
            <li className="arcane-readiness-item">Usahakan menyelesaikan sesi tanpa jeda panjang.</li>
            <li className="arcane-readiness-item">Setelah selesai, baca pembahasan dan pola kelemahan.</li>
          </ul>
          <p className="arcane-readiness-note">Simulasi parsial tetap berguna untuk diagnostik, tetapi tidak memperbarui estimasi total.</p>
        </aside>
      </div>
    </main>
  );
}

function PackageField({
  description,
  label,
  onChange,
  optionLabel = (value) => `${value} soal`,
  optionMeta = () => "Paket tervalidasi",
  value,
}: {
  description: string;
  label: string;
  onChange: (value: number) => void;
  optionLabel?: (value: number) => string;
  optionMeta?: (value: number) => string;
  value: number;
}) {
  return (
    <fieldset
      aria-label={label}
      className="customSimulationField arcane-builder-control arcane-builder-control--package"
    >
      <div className="arcane-control-copy">
        <span className="arcane-control-label">{label}</span>
        <p className="arcane-control-description">{description}</p>
      </div>
      <div className="arcane-section-choice-grid">
        {[25, 50].map((option) => (
          <button
            aria-pressed={value === option}
            className={`arcane-section-choice ${value === option ? "is-selected" : ""}`}
            key={option}
            type="button"
            onClick={() => onChange(value === option ? 0 : option)}
          >
            <span className="arcane-section-choice-top">
              <span className="arcane-section-choice-icon" aria-hidden="true">{option}</span>
              <span className="arcane-section-choice-check" aria-hidden="true">
                {value === option ? <AppIcon name="check" /> : null}
              </span>
            </span>
            <strong className="arcane-section-choice-title">{optionLabel(option)}</strong>
            <span className="arcane-section-choice-subtitle">{optionMeta(option)}</span>
            <span className="arcane-section-choice-copy">
              {label} memakai paket bank tervalidasi.
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function readingPackageTotal(value: number): number {
  if (!value) return 0;
  const slots = READING_SLOT_BLUEPRINTS[value as FixedPackageQuestionCount];
  return slots?.reduce((sum, count) => sum + count, 0) ?? value;
}

function CustomField({
  description,
  label,
  max,
  min,
  onChange,
  step,
  unit = "soal",
  value,
}: {
  description: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const update = (nextValue: number) => onChange(Math.min(max, Math.max(min, nextValue)));

  return (
    <fieldset aria-label={label} className="customSimulationField arcane-builder-control arcane-builder-control--stepper">
      <div className="arcane-control-row">
        <div className="arcane-control-copy">
          <span className="arcane-control-label">{label}</span>
          <p className="arcane-control-description">{description}</p>
          <span className="arcane-control-hint">Rentang {min}-{max} {unit}, bertambah {step}.</span>
        </div>
        <div className="arcane-stepper">
          <button
            aria-label={`Kurangi ${label}`}
            className="arcane-stepper-button"
            disabled={value <= min}
            type="button"
            onClick={() => update(value - step)}
          >
            -
          </button>
          <label className="arcane-stepper-display">
            <input
              aria-label={label}
              className="arcane-input arcane-stepper-value"
              max={max}
              min={min}
              step={step}
              type="number"
              value={value}
              onChange={(event) => update(Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : min)}
            />
            <span>{unit}</span>
          </label>
          <button
            aria-label={`Tambah ${label}`}
            className="arcane-stepper-button"
            disabled={value >= max}
            type="button"
            onClick={() => update(value + step)}
          >
            +
          </button>
        </div>
      </div>
    </fieldset>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="arcane-summary-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TrialOutcome({ label, value }: { label: string; value: string }) {
  return (
    <div className="arcane-trial-mode-outcome">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrialRule({ label, value }: { label: string; value: string }) {
  return (
    <div className="arcane-trial-rule-item">
      <span className="arcane-trial-rule-label">{label}</span>
      <strong className="arcane-trial-rule-value">{value}</strong>
    </div>
  );
}
