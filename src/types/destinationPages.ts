import type { DashboardLaunchTarget } from "./homeDashboard";

export interface ExploreInventoryItem {
  id: "listening" | "structure-written" | "reading";
  title: string;
  detail: string;
  countLabel: string;
  launchTarget: DashboardLaunchTarget;
}

export interface CollectionReviewQueue {
  id: "wrong" | "doubtful";
  title: string;
  detail: string;
  count: number;
  questionIds: string[];
  sourceLabel?: string;
}

export interface ProgressDiagnosticArea {
  id: string;
  label: string;
  category: string;
  accuracy: number;
  attempted: number;
  incorrect: number;
}

export interface ProgressTrendItem {
  id: string;
  dateLabel: string;
  title: string;
  value: number;
  valueLabel: string;
  targetLabel?: string;
}

export interface DestinationPagesModel {
  exploreInventory: ExploreInventoryItem[];
  reviewQueues: CollectionReviewQueue[];
  latestDiagnostic?: {
    title: string;
    dateLabel: string;
    completionRate: number;
    accuracy: number;
    averageSecondsPerAttempt: number;
    weakestAreas: ProgressDiagnosticArea[];
    strongestAreas: ProgressDiagnosticArea[];
  };
  progressTrend: ProgressTrendItem[];
}
