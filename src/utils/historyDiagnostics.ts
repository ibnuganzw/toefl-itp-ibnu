import type { StoredDiagnosticSnapshot } from "../types/diagnostics";
import { flattenSessionQuestions, type RuntimeSession, type SessionDiagnostic } from "./sessionEngine";

export const DIAGNOSTIC_SNAPSHOT_VERSION = "session-diagnostic-v1" as const;
export const MAX_STORED_HISTORY_ITEMS = 30;
export const MAX_STORED_SIMULATION_HISTORY_ITEMS = 20;

export function createDiagnosticSnapshot(
  session: RuntimeSession,
  diagnostic: SessionDiagnostic,
): StoredDiagnosticSnapshot {
  const refs = flattenSessionQuestions(session.units);
  const wrongQuestionIds: string[] = [];
  const doubtfulQuestionIds: string[] = [];
  const unansweredQuestionIds: string[] = [];

  for (const ref of refs) {
    const answer = session.answers[ref.question.id];
    if (!answer?.selectedAnswer) unansweredQuestionIds.push(ref.question.id);
    else if (!answer.isCorrect) wrongQuestionIds.push(ref.question.id);
    if (answer?.isDoubtful) doubtfulQuestionIds.push(ref.question.id);
  }

  return {
    version: DIAGNOSTIC_SNAPSHOT_VERSION,
    generatedAt: session.finishedAt ?? new Date().toISOString(),
    response: {
      totalQuestions: diagnostic.totalQuestions,
      attempted: diagnostic.totalAttempted,
      correct: diagnostic.totalCorrect,
      incorrect: diagnostic.totalIncorrect,
      unanswered: diagnostic.totalUnanswered,
      doubtful: diagnostic.totalDoubtful,
      accuracy: diagnostic.accuracy,
      completionRate: diagnostic.completionRate,
    },
    pace: {
      durationSeconds: session.elapsedSeconds,
      averageSecondsPerAttempt: diagnostic.totalAttempted
        ? Math.round(session.elapsedSeconds / diagnostic.totalAttempted)
        : 0,
    },
    outcomes: {
      wrongQuestionIds,
      doubtfulQuestionIds,
      unansweredQuestionIds,
    },
    bySection: diagnostic.bySection,
    byGrammarPattern: diagnostic.byGrammarPattern,
    byReadingSkill: diagnostic.byReadingSkill,
    byListeningSkill: diagnostic.byListeningSkill,
    weakestAreas: diagnostic.weakestAreas,
    strongestAreas: diagnostic.strongestAreas,
  };
}

export function isSimulationHistoryTitle(title: string): boolean {
  return title.toLocaleLowerCase("id-ID").startsWith("simulasi");
}
