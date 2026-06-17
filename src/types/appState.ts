import type { SessionKind, StoredSessionSnapshot } from "../utils/sessionEngine";
import type { StoredDiagnosticSnapshot } from "./diagnostics";
import type { SimulationConfig } from "./questionTypes";
import type { ScoreTargetComparison, SimulationScoreEstimate } from "./scoring";

export interface StoredQuestionProgress {
  attempts: number;
  correct: number;
  doubtful: number;
  lastAnsweredAt?: string;
}

export interface StoredHistoryItem {
  id: string;
  title: string;
  finishedAt: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  accuracy: number;
  durationSeconds: number;
  sessionKind?: SessionKind;
  simulationConfig?: SimulationConfig;
  diagnosticSnapshot?: StoredDiagnosticSnapshot;
  scoreEstimate?: SimulationScoreEstimate;
  scoreTargetAtCompletion?: number;
  scoreTargetComparison?: ScoreTargetComparison;
}

export interface StoredProgress {
  seenQuestionIds: string[];
  attemptsByQuestion: Record<string, StoredQuestionProgress>;
  history: StoredHistoryItem[];
  simulationHistory: StoredHistoryItem[];
  activeSession?: StoredSessionSnapshot;
  scoreTarget?: number;
  latestScoreEstimate?: SimulationScoreEstimate;
  bestScoreEstimate?: number;
}
