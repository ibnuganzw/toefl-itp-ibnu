import {
  getActiveListeningQuestions,
  getActiveReadingPassages,
  getActiveReadingQuestions,
  getActiveStructureQuestions,
  getActiveWrittenExpressionQuestions,
} from "../data/questionBank";
import type { StoredProgress } from "../types/appState";
import type {
  CollectionReviewQueue,
  DestinationPagesModel,
  ProgressDiagnosticArea,
} from "../types/destinationPages";
import type { MasterQuestionBank } from "../types/questionTypes";

export function buildDestinationPagesModel(
  bank: MasterQuestionBank,
  progress: StoredProgress,
): DestinationPagesModel {
  const latestSimulation = progress.simulationHistory[0];
  const latestDiagnostic = latestSimulation?.diagnosticSnapshot;

  return {
    exploreInventory: [
      {
        id: "listening",
        title: "Listening",
        detail: "Dialog, longer conversation, dan academic talk dari Part A, B, serta C.",
        countLabel: `${getActiveListeningQuestions(bank).length} soal audio aktif`,
        launchTarget: "listening",
      },
      {
        id: "structure-written",
        title: "Structure & Written",
        detail: "Pola grammar dan identifikasi kesalahan dalam satu ruang latihan gabungan.",
        countLabel: `${getActiveStructureQuestions(bank).length + getActiveWrittenExpressionQuestions(bank).length} soal aktif`,
        launchTarget: "structure-written",
      },
      {
        id: "reading",
        title: "Reading",
        detail: "Passage tetap utuh bersama pertanyaan dan pembahasan sumbernya.",
        countLabel: `${getActiveReadingPassages(bank).length} passage · ${getActiveReadingQuestions(bank).length} soal`,
        launchTarget: "reading",
      },
    ],
    reviewQueues: buildReviewQueues(progress),
    latestDiagnostic: latestDiagnostic
      ? {
          title: latestSimulation.title,
          dateLabel: formatDate(latestSimulation.finishedAt),
          completionRate: latestDiagnostic.response.completionRate,
          accuracy: latestDiagnostic.response.accuracy,
          averageSecondsPerAttempt: latestDiagnostic.pace.averageSecondsPerAttempt,
          weakestAreas: latestDiagnostic.weakestAreas.slice(0, 5).map(toProgressArea),
          strongestAreas: latestDiagnostic.strongestAreas.slice(0, 5).map(toProgressArea),
        }
      : undefined,
    progressTrend: progress.simulationHistory
      .slice(0, 8)
      .reverse()
      .map((item) => ({
        id: item.id,
        dateLabel: formatDate(item.finishedAt),
        title: item.title,
        value: item.scoreEstimate?.totalEstimate ?? item.accuracy,
        valueLabel: item.scoreEstimate ? "Estimasi" : "Akurasi",
        targetLabel: item.scoreTargetAtCompletion ? `Target ${item.scoreTargetAtCompletion}` : undefined,
      })),
  };
}

function buildReviewQueues(progress: StoredProgress): CollectionReviewQueue[] {
  const wrong = collectOutcomeIds(progress, "wrongQuestionIds");
  const doubtful = collectOutcomeIds(progress, "doubtfulQuestionIds");
  return [
    {
      id: "wrong",
      title: "Jawaban Salah",
      detail: "Ulangi soal yang pernah salah agar pembahasan berubah menjadi pemahaman aktif.",
      count: wrong.ids.length,
      questionIds: wrong.ids,
      sourceLabel: wrong.sourceLabel,
    },
    {
      id: "doubtful",
      title: "Soal Ragu-ragu",
      detail: "Kembali ke soal yang pernah ditandai ragu sebelum pola salahnya menetap.",
      count: doubtful.ids.length,
      questionIds: doubtful.ids,
      sourceLabel: doubtful.sourceLabel,
    },
  ];
}

function collectOutcomeIds(
  progress: StoredProgress,
  key: "wrongQuestionIds" | "doubtfulQuestionIds",
): { ids: string[]; sourceLabel?: string } {
  const ids = new Set<string>();
  let sourceLabel: string | undefined;
  for (const item of progress.history) {
    const outcomeIds = item.diagnosticSnapshot?.outcomes[key] ?? [];
    if (outcomeIds.length && !sourceLabel) sourceLabel = item.title;
    for (const id of outcomeIds) ids.add(id);
  }
  return { ids: [...ids], sourceLabel };
}

function toProgressArea(area: {
  key: string;
  label: string;
  category: string;
  accuracy: number;
  attempted: number;
  incorrect: number;
}): ProgressDiagnosticArea {
  return {
    id: `${area.category}:${area.key}`,
    label: area.label,
    category: area.category,
    accuracy: area.accuracy,
    attempted: area.attempted,
    incorrect: area.incorrect,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
