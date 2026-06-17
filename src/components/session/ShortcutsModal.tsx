import { useBodyScrollLock, useFocusTrap } from "../a11y/ArcaneA11y";
import { Button } from "../ui/Button";

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const modalRef = useFocusTrap<HTMLElement>(true, onClose);
  useBodyScrollLock(true);
  const shortcuts = [
    ["1/2/3/4", "Pilih A/B/C/D"],
    ["A/B/C/D", "Pilih A/B/C/D"],
    ["Enter", "Soal berikutnya"],
    ["Shift+Enter", "Soal sebelumnya"],
    ["ArrowRight / ArrowLeft", "Navigasi soal"],
    ["R", "Tandai ragu-ragu"],
    ["P", "Jeda / lanjutkan timer"],
    ["Esc", "Tutup overlay"],
  ];

  return (
    <div className="modalBackdrop arcane-modal-overlay" role="presentation" onClick={onClose}>
      <section
        aria-modal="true"
        className="shortcutModal arcane-exit-modal"
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="questionHeader">
          <div>
            <p className="eyebrow">Shortcut</p>
            <h2>Kontrol Keyboard</h2>
          </div>
          <Button variant="ghost" type="button" onClick={onClose}>
            Tutup
          </Button>
        </div>
        <div className="shortcutList">
          {shortcuts.map(([key, value]) => (
            <div className="shortcutItem" key={key}>
              <kbd>{key}</kbd>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
