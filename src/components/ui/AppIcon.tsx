import type { ReactNode } from "react";

export type AppIconName =
  | "arrow-left"
  | "arrow-right"
  | "analytics"
  | "bookmark"
  | "calendar"
  | "check"
  | "clock"
  | "document"
  | "home"
  | "list"
  | "listening"
  | "logo"
  | "pause"
  | "play"
  | "reading"
  | "rotate"
  | "simulation"
  | "sparkles"
  | "structure-written"
  | "target"
  | "volume";

export function AppIcon({ className = "", name }: { className?: string; name: AppIconName }) {
  if (name === "logo") {
    return (
      <svg
        aria-hidden="true"
        className={`uiIcon ${className}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <path d="M12 2.5 20 6v6.2c0 4.6-3.2 7.6-8 9.3-4.8-1.7-8-4.7-8-9.3V6Z" />
        <path d="M8.2 9.2h7.6M12 9.2v7.1M9.3 16.3h5.4" />
        <path d="m7.7 6.7 1.5-1.5m7.1 1.5-1.5-1.5" />
      </svg>
    );
  }

  if (name === "structure-written") {
    return (
      <svg
        aria-hidden="true"
        className={`uiIcon ${className}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <rect x="5" y="3" width="14" height="18" rx="2.5" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    );
  }

  const paths: Record<Exclude<AppIconName, "logo" | "structure-written">, ReactNode> = {
    analytics: (
      <>
        <path d="M5 19v-7m7 7V5m7 14v-4" />
        <path d="M4 19h16" />
      </>
    ),
    "arrow-left": <path d="m15 18-6-6 6-6M9 12h11" />,
    "arrow-right": <path d="m9 18 6-6-6-6m6 6H4" />,
    bookmark: <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21Z" />,
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M7 3v4m10-4v4M3.5 9h17" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    document: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2.5" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    home: (
      <>
        <path d="m4 11 8-7 8 7" />
        <path d="M6.5 10.5V20h5v-5h3v5h5v-9.5" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </>
    ),
    listening: (
      <>
        <path d="M5 14v-2a7 7 0 0 1 14 0v2" />
        <path d="M5 14h3v6H6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Zm14 0h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z" />
      </>
    ),
    pause: <path d="M8 5v14m8-14v14" />,
    play: <path d="m8 5 11 7-11 7Z" />,
    reading: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z" />
        <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z" />
      </>
    ),
    rotate: <path d="M20 7v5h-5M4 17v-5h5m9.5-3A7 7 0 0 0 6.7 6.7L4 9m16 6-2.7 2.3A7 7 0 0 1 5.5 15" />,
    simulation: (
      <>
        <path d="M5 19V9m7 10V5m7 14v-7M4 19h16" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4Z" />
        <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
        <path d="m5 14 .7 1.8 1.8.7-1.8.7L5 19l-.7-1.8-1.8-.7 1.8-.7Z" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="m12 12 7-7" />
      </>
    ),
    volume: (
      <>
        <path d="M5 10v4h4l5 4V6l-5 4Z" />
        <path d="M17 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={`uiIcon ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}
