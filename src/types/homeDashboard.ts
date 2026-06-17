import type { LearningScope } from "../utils/sessionEngine";
import type { FixedPackageQuestionCount } from "../utils/sessionBlueprints";
import type { FocusedPracticeTarget } from "../utils/focusedPractice";
import type { ScoreTargetStatus } from "./scoring";

export type DashboardTone = "blue" | "green" | "amber" | "violet" | "neutral";
export type DashboardLaunchTarget = LearningScope | "simulation";

export interface DashboardSummaryItem {
  id: "active-questions" | "learning-progress" | "accuracy" | "weekly-target" | "last-session";
  label: string;
  value: string;
  detail: string;
  tone: DashboardTone;
  progressPercent?: number;
}

export interface DashboardRecommendation {
  id: string;
  title: string;
  focus: string;
  detail: string;
  questionCount: number;
  accuracy?: number;
  launchTarget: DashboardLaunchTarget;
  focusTarget: FocusedPracticeTarget;
  tone: DashboardTone;
}

export interface DashboardSubject {
  id: string;
  title: string;
  detail: string;
  metric: string;
  launchTarget: DashboardLaunchTarget;
  packageQuestionCounts?: FixedPackageQuestionCount[];
  tone: DashboardTone;
}

export interface DashboardFocusArea {
  id: string;
  label: string;
  attempted: number;
  accuracy: number;
  launchTarget: DashboardLaunchTarget;
  focusTarget: FocusedPracticeTarget;
}

export interface DashboardRecentSession {
  id: string;
  title: string;
  meta: string;
  finishedLabel: string;
  resultLabel: string;
  resultValue: string;
  targetLabel?: string;
  focusLabel?: string;
  sections: Array<{
    label: string;
    accuracy: number;
    attempted: number;
    totalQuestions: number;
    unanswered: number;
  }>;
}

export interface DashboardWeeklyTarget {
  completedSessions: number;
  targetSessions: number;
  progressPercent: number;
  remainingDays: number;
  sessionLabels: string[];
}

export interface DashboardActiveSession {
  title: string;
  meta: string;
}

export interface DashboardScoreGoal {
  targetScore?: number;
  latestEstimate?: number;
  bestEstimate?: number;
  gap?: number;
  status?: ScoreTargetStatus;
}

export interface DashboardPersonalBrief {
  eyebrow: string;
  title: string;
  message: string;
  primaryAction: "resume" | "launch";
  primaryLabel: string;
  primaryTarget?: DashboardLaunchTarget;
  primaryFocusTarget?: FocusedPracticeTarget;
  targetSummary: string;
  focusSummary: string;
  rhythmSummary: string;
}

export interface DashboardTestSpace {
  title: string;
  detail: string;
  readinessLabel: string;
  targetLabel: string;
  lastEstimateLabel: string;
}

export interface HomeDashboardModel {
  personalBrief: DashboardPersonalBrief;
  testSpace: DashboardTestSpace;
  scoreGoal: DashboardScoreGoal;
  summary: DashboardSummaryItem[];
  recommendations: DashboardRecommendation[];
  subjects: DashboardSubject[];
  focusAreas: DashboardFocusArea[];
  recentSessions: DashboardRecentSession[];
  weeklyTarget: DashboardWeeklyTarget;
  activeSession?: DashboardActiveSession;
}
