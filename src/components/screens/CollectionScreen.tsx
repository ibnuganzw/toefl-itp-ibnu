import { useState } from "react";
import type { DestinationPagesModel } from "../../types/destinationPages";
import type { HomeDashboardModel } from "../../types/homeDashboard";
import type { FocusedPracticeTarget } from "../../utils/focusedPractice";
import { DestinationPageHero } from "../destination/DestinationPageHero";
import { DashboardFocusPanel } from "../home/DashboardFocusPanel";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

export function CollectionScreen({
  dashboard,
  model,
  notice,
  onReviewQueue,
  onStartFocusedPractice,
}: {
  dashboard: HomeDashboardModel;
  model: DestinationPagesModel;
  notice: string;
  onReviewQueue: (questionIds: string[], title: string, kind: "wrong" | "doubtful") => void;
  onStartFocusedPractice: (target: FocusedPracticeTarget) => void;
}) {
  const [filter, setFilter] = useState<"all" | "wrong" | "doubtful">("all");
  const visibleQueues = filter === "all"
    ? model.reviewQueues
    : model.reviewQueues.filter((queue) => queue.id === filter);

  return (
    <main className="destinationPage destinationPage--collection arcane-page arcane-archive">
      {notice ? <p className="notice dashboardNotice">{notice}</p> : null}
      <DestinationPageHero
        actions={(
          <div className="arcane-archive-actions">
            <Button variant="primary" type="button" onClick={() => document.getElementById("antrian-review")?.scrollIntoView({ behavior: "smooth" })}>
              Buka Antrian Review
            </Button>
          </div>
        )}
        className="arcane-archive-hero"
        aside={(
          <div className="arcane-hero-seal-stack">
            <div
              aria-label={`${model.reviewQueues.reduce((sum, queue) => sum + queue.count, 0)} soal menunggu review`}
              className="arcane-archive-seal"
            >
              <div className="arcane-archive-seal-inner">
                {model.reviewQueues.reduce((sum, queue) => sum + queue.count, 0)}
              </div>
            </div>
            <strong>Soal menunggu review</strong>
          </div>
        )}
        eyebrow="Koleksi Belajar"
        icon="bookmark"
        title="Kembali ke hal yang layak dipahami lebih dalam."
      >
        Koleksi ini dibentuk otomatis dari jawaban salah, soal ragu-ragu, dan area yang paling membutuhkan perhatian.
      </DestinationPageHero>

      <section className="arcane-archive-toolbar" aria-label="Filter koleksi belajar">
        <div className="arcane-archive-filter-group">
          {([
            ["all", "Semua"],
            ["wrong", "Jawaban Salah"],
            ["doubtful", "Ragu-ragu"],
          ] as const).map(([value, label]) => (
            <button
              aria-pressed={filter === value}
              className={`arcane-filter-chip ${filter === value ? "is-active" : ""}`}
              key={value}
              type="button"
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="arcane-badge arcane-badge-warning">
          {visibleQueues.reduce((sum, queue) => sum + queue.count, 0)} soal ditampilkan
        </span>
      </section>

      <section className="destinationSection arcane-section" id="antrian-review">
        <header className="destinationSectionHeader arcane-section-header">
          <div>
            <p className="arcane-kicker">Antrian Review</p>
            <h2 className="arcane-section-title">Ubah kesalahan dan keraguan menjadi sesi baru</h2>
          </div>
          <span>Terbentuk dari riwayat nyata</span>
        </header>
        <div className="reviewQueueGrid arcane-review-grid">
          {visibleQueues.map((queue) => (
            <article className={`reviewQueueCard arcane-review-queue-card arcane-card reviewQueueCard--${queue.id}`} key={queue.id}>
              <div className="arcane-review-top">
                <div>
                  <div className="arcane-review-meta">
                    <p className="arcane-review-label">{queue.id === "wrong" ? "Perlu Diperbaiki" : "Perlu Dipastikan"}</p>
                  </div>
                  <strong className="arcane-review-count">{queue.count}</strong>
                </div>
                <span className="reviewQueueIcon arcane-review-icon" aria-hidden="true">
                  <AppIcon name={queue.id === "wrong" ? "rotate" : "bookmark"} />
                </span>
              </div>
              <div>
                <h2 className="arcane-review-title">{queue.title}</h2>
                <span className="arcane-review-subtitle">{queue.detail}</span>
              </div>
              <div className="arcane-review-footer">
                <small className="arcane-review-note">{queue.sourceLabel ? `Terbaru dari ${queue.sourceLabel}` : "Belum ada sumber review"}</small>
                <Button
                  disabled={!queue.count}
                  variant={queue.count ? "primary" : "secondary"}
                  type="button"
                  onClick={() => onReviewQueue(queue.questionIds, `Review ${queue.title}`, queue.id)}
                >
                  {queue.count ? "Mulai Review" : "Antrian Kosong"}
                </Button>
              </div>
            </article>
          ))}
          {!visibleQueues.length ? (
            <article className="destinationEmptyState arcane-empty arcane-archive-empty">
              <span className="arcane-archive-empty-icon" aria-hidden="true"><AppIcon name="bookmark" /></span>
              <h3 className="arcane-empty-title">Belum ada antrian pada filter ini.</h3>
              <p className="arcane-empty-description">Soal salah dan ragu-ragu akan muncul setelah tersimpan dari sesi nyata.</p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="collectionLearningGrid collectionLearningGrid--focus-only">
        <DashboardFocusPanel areas={dashboard.focusAreas} onLaunchFocused={onStartFocusedPractice} />
      </section>
    </main>
  );
}
