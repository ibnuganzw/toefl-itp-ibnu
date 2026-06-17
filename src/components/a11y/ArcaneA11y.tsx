import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ArcaneAnnouncement = {
  copy?: string;
  duration?: number;
  title: string;
  type?: "success" | "warning" | "danger";
};

type QuestionHotkeyOptions = {
  enabled?: boolean;
  onNext?: () => void;
  onOpenReview?: () => void;
  onPrevious?: () => void;
  onSelectAnswer?: (answer: "A" | "B" | "C" | "D") => void;
  onToggleMark?: () => void;
};

const LiveRegionContext = createContext<((message: ArcaneAnnouncement) => void) | null>(null);
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function ArcaneSkipLink({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a className="arcane-skip-link" href={`#${targetId}`}>
      Lewati ke konten utama
    </a>
  );
}

export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="arcane-sr-only">{children}</span>;
}

export function ArcaneLiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ArcaneAnnouncement | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  const announce = useCallback((nextMessage: ArcaneAnnouncement) => {
    window.clearTimeout(timeoutRef.current);
    setMessage(nextMessage);
    timeoutRef.current = window.setTimeout(() => setMessage(null), nextMessage.duration ?? 3200);
  }, []);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return (
    <LiveRegionContext.Provider value={announce}>
      {children}
      <div className="arcane-live-region" aria-atomic="true" aria-live="polite">
        {message ? (
          <div className={`arcane-toast is-${message.type ?? "success"}`}>
            <span className={`arcane-status-icon is-${message.type ?? "success"}`} aria-hidden="true">
              {message.type === "danger" ? "!" : message.type === "warning" ? "?" : "OK"}
            </span>
            <div>
              <p className="arcane-toast-title">{message.title}</p>
              {message.copy ? <p className="arcane-toast-copy">{message.copy}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useArcaneAnnounce() {
  return useContext(LiveRegionContext) ?? (() => undefined);
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.classList.add("arcane-body-locked");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("arcane-body-locked");
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);
}

export function useEscapeKey(enabled: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscape();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onEscape]);
}

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void,
): RefObject<T | null> {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!container) return;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true",
      );

    container.scrollTo({ top: 0 });
    container.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;

      const items = getFocusable();
      if (!items.length) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items.at(-1)!;
      if (document.activeElement === container) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [active, onEscape]);

  return containerRef;
}

export function useQuestionHotkeys({
  enabled = true,
  onNext,
  onOpenReview,
  onPrevious,
  onSelectAnswer,
  onToggleMark,
}: QuestionHotkeyOptions) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable) return;

      const key = event.key.toLowerCase();
      if (["a", "b", "c", "d"].includes(key)) {
        event.preventDefault();
        onSelectAnswer?.(key.toUpperCase() as "A" | "B" | "C" | "D");
      } else if (key === "arrowleft") {
        event.preventDefault();
        onPrevious?.();
      } else if (key === "arrowright") {
        event.preventDefault();
        onNext?.();
      } else if (key === "m") {
        event.preventDefault();
        onToggleMark?.();
      } else if (key === "r") {
        event.preventDefault();
        onOpenReview?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onNext, onOpenReview, onPrevious, onSelectAnswer, onToggleMark]);
}
