import type { StoredHistoryItem, StoredProgress, StoredQuestionProgress } from "../types/appState";
import type { SimulationScoreEstimate } from "../types/scoring";
import type { StoredDiagnosticSnapshot } from "../types/diagnostics";
import {
  isSimulationHistoryTitle,
  MAX_STORED_HISTORY_ITEMS,
  MAX_STORED_SIMULATION_HISTORY_ITEMS,
} from "./historyDiagnostics";
import { normalizeScoreTarget } from "./scoreEstimation";

export const PROGRESS_STORAGE_KEY = "toefl-itp-ibnu-progress-v3";
export const LEGACY_PROGRESS_STORAGE_KEYS = ["toefl-itp-ibnu-progress-v2", "toefl-itp-ibnu-progress-v1"] as const;

export const EMPTY_PROGRESS: StoredProgress = {
  seenQuestionIds: [],
  attemptsByQuestion: {},
  history: [],
  simulationHistory: [],
};

export function loadProgress(): StoredProgress {
  try {
    const current = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (current) return normalizeStoredProgress(JSON.parse(current));

    for (const key of LEGACY_PROGRESS_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const migrated = normalizeStoredProgress(JSON.parse(legacy));
      saveProgress(migrated);
      return migrated;
    }
  } catch {
    return EMPTY_PROGRESS;
  }

  return EMPTY_PROGRESS;
}

export function saveProgress(progress: StoredProgress) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

function normalizeStoredProgress(value: unknown): StoredProgress {
  const candidate = isRecord(value) ? value : {};
  const normalizedTarget = normalizeScoreTarget(candidate.scoreTarget);
  const history = Array.isArray(candidate.history)
    ? candidate.history
        .map(normalizeHistoryItem)
        .filter((item): item is StoredHistoryItem => Boolean(item))
        .slice(0, MAX_STORED_HISTORY_ITEMS)
    : [];
  const storedSimulationHistory = Array.isArray(candidate.simulationHistory)
    ? candidate.simulationHistory
        .map(normalizeHistoryItem)
        .filter((item): item is StoredHistoryItem => Boolean(item))
    : [];
  const simulationHistory = (
    storedSimulationHistory.length
      ? storedSimulationHistory
      : history.filter(isSimulationHistoryItem)
  ).slice(0, MAX_STORED_SIMULATION_HISTORY_ITEMS);
  const historicalEstimates = history
    .map((item) => normalizeScoreEstimate(item.scoreEstimate))
    .filter((item): item is SimulationScoreEstimate => Boolean(item));
  const latestScoreEstimate =
    normalizeScoreEstimate(candidate.latestScoreEstimate) ?? historicalEstimates[0];
  const storedBest =
    typeof candidate.bestScoreEstimate === "number" && Number.isFinite(candidate.bestScoreEstimate)
      ? candidate.bestScoreEstimate
      : undefined;
  const bestScoreEstimate = [storedBest, ...historicalEstimates.map((item) => item.totalEstimate)]
    .filter((item): item is number => item !== undefined)
    .reduce<number | undefined>((best, item) => (best === undefined ? item : Math.max(best, item)), undefined);

  return {
    seenQuestionIds: Array.isArray(candidate.seenQuestionIds)
      ? candidate.seenQuestionIds.filter((item): item is string => typeof item === "string")
      : [],
    attemptsByQuestion: normalizeAttempts(candidate.attemptsByQuestion),
    history,
    simulationHistory,
    activeSession: isRecord(candidate.activeSession)
      ? (candidate.activeSession as unknown as StoredProgress["activeSession"])
      : undefined,
    scoreTarget: normalizedTarget,
    latestScoreEstimate,
    bestScoreEstimate,
  };
}

function isSimulationHistoryItem(item: StoredHistoryItem): boolean {
  return item.sessionKind?.startsWith("simulation-") || Boolean(item.scoreEstimate) || isSimulationHistoryTitle(item.title);
}

function normalizeScoreEstimate(value: unknown): SimulationScoreEstimate | undefined {
  if (
    !isRecord(value) ||
    value.method !== "internal-linear-practice-estimate" ||
    typeof value.totalEstimate !== "number" ||
    !Number.isFinite(value.totalEstimate) ||
    !isRecord(value.sections)
  ) {
    return undefined;
  }
  return value as unknown as SimulationScoreEstimate;
}

function normalizeHistoryItem(value: unknown): StoredHistoryItem | undefined {
  if (!isStoredHistoryItem(value)) return undefined;
  return {
    ...value,
    diagnosticSnapshot: isStoredDiagnosticSnapshot(value.diagnosticSnapshot)
      ? value.diagnosticSnapshot
      : undefined,
    scoreEstimate: normalizeScoreEstimate(value.scoreEstimate),
  };
}

function normalizeAttempts(value: unknown): Record<string, StoredQuestionProgress> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, StoredQuestionProgress] => {
      const item = entry[1];
      return (
        isRecord(item) &&
        typeof item.attempts === "number" &&
        typeof item.correct === "number" &&
        typeof item.doubtful === "number"
      );
    }),
  );
}

function isStoredHistoryItem(value: unknown): value is StoredHistoryItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.finishedAt === "string" &&
    typeof value.totalQuestions === "number" &&
    typeof value.attempted === "number" &&
    typeof value.correct === "number" &&
    typeof value.accuracy === "number" &&
    typeof value.durationSeconds === "number"
  );
}

export function isStoredDiagnosticSnapshot(value: unknown): value is StoredDiagnosticSnapshot {
  return (
    isRecord(value) &&
    value.version === "session-diagnostic-v1" &&
    typeof value.generatedAt === "string" &&
    isRecord(value.response) &&
    typeof value.response.totalQuestions === "number" &&
    typeof value.response.attempted === "number" &&
    typeof value.response.correct === "number" &&
    typeof value.response.incorrect === "number" &&
    typeof value.response.unanswered === "number" &&
    typeof value.response.doubtful === "number" &&
    typeof value.response.completionRate === "number" &&
    Array.isArray(value.bySection) &&
    Array.isArray(value.weakestAreas) &&
    isRecord(value.outcomes) &&
    Array.isArray(value.outcomes.wrongQuestionIds) &&
    Array.isArray(value.outcomes.doubtfulQuestionIds) &&
    Array.isArray(value.outcomes.unansweredQuestionIds)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
