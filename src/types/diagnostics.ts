import type { DiagnosticBucket } from "./questionTypes";

export type DiagnosticCategory = "section" | "grammar" | "readingSkill" | "listeningSkill";

export interface DiagnosticArea extends DiagnosticBucket {
  category: DiagnosticCategory;
  totalQuestions: number;
  incorrect: number;
  unanswered: number;
  doubtful: number;
  completionRate: number;
}

export interface SessionDiagnostic {
  totalQuestions: number;
  totalAttempted: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  totalDoubtful: number;
  accuracy: number;
  completionRate: number;
  bySection: DiagnosticArea[];
  byGrammarPattern: DiagnosticArea[];
  byReadingSkill: DiagnosticArea[];
  byListeningSkill: DiagnosticArea[];
  weakestAreas: DiagnosticArea[];
  strongestAreas: DiagnosticArea[];
}

export interface StoredDiagnosticSnapshot {
  version: "session-diagnostic-v1";
  generatedAt: string;
  response: {
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    doubtful: number;
    accuracy: number;
    completionRate: number;
  };
  pace: {
    durationSeconds: number;
    averageSecondsPerAttempt: number;
  };
  outcomes: {
    wrongQuestionIds: string[];
    doubtfulQuestionIds: string[];
    unansweredQuestionIds: string[];
  };
  bySection: DiagnosticArea[];
  byGrammarPattern: DiagnosticArea[];
  byReadingSkill: DiagnosticArea[];
  byListeningSkill: DiagnosticArea[];
  weakestAreas: DiagnosticArea[];
  strongestAreas: DiagnosticArea[];
}
