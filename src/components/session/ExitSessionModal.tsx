import { useBodyScrollLock, useFocusTrap } from "../a11y/ArcaneA11y";
import { Button } from "../ui/Button";

export function ExitSessionModal({
  answeredCount,
  totalQuestions,
  onCancel,
  onConfirm,
}: {
  answeredCount: number;
  totalQuestions: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const modalRef = useFocusTrap<HTMLElement>(true, onCancel);
  useBodyScrollLock(true);

  return (
    <div className="modalBackdrop exitSessionBackdrop arcane-modal-overlay" role="presentation">
      <section
        aria-labelledby="exit-session-title"
        aria-modal="true"
        className="exitSessionModal arcane-exit-modal"
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="exitSessionIcon arcane-exit-modal-icon" aria-hidden="true">
          !
        </div>
        <div className="exitSessionCopy arcane-exit-modal-copy">
          <p className="eyebrow">Sesi Belum Selesai</p>
          <h2 id="exit-session-title">Yakin ingin keluar?</h2>
          <p>
            Kamu baru mengerjakan <strong>{answeredCount} dari {totalQuestions} soal</strong>. Tidak apa-apa,
            progresmu akan kami simpan dan dapat dilanjutkan dari Beranda.
          </p>
        </div>
        <div className="exitSessionActions arcane-exit-modal-actions">
          <Button autoFocus icon="arrow-left" type="button" variant="secondary" onClick={onCancel}>
            Tidak, lanjutkan
          </Button>
          <Button icon="home" type="button" variant="primary" onClick={onConfirm}>
            Ya, keluar
          </Button>
        </div>
      </section>
    </div>
  );
}
