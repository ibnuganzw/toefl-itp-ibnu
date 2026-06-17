import type { ReactNode } from "react";

export type DashboardScreen = DashboardNav | "session" | "result" | "review";
export type DashboardNav = "home" | "explore" | "collection" | "test-space" | "progress";

export interface ShellStat {
  label: string;
  value: string | number;
}

export interface DashboardShellProps {
  activeNav: DashboardNav;
  activeScreen: DashboardScreen;
  children: ReactNode;
  stats: ShellStat[];
  subtitle: string;
  title: string;
  hideNavigation?: boolean;
  onNavigate: (destination: DashboardNav) => void;
}
