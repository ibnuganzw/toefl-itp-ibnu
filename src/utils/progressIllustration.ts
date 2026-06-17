import {
  getActiveListeningQuestions,
  getActiveReadingQuestions,
  getActiveStructureQuestions,
  getActiveWrittenExpressionQuestions,
} from "../data/questionBank";
import {
  TOEFL_ITP_ESTIMATED_TOTAL_MIN,
} from "../data/scoreConversion";
import type { StoredProgress } from "../types/appState";
import type {
  ProgressIllustrationMilestone,
  ProgressIllustrationModel,
  ProgressIllustrationStageId,
} from "../types/progressIllustration";
import type { MasterQuestionBank } from "../types/questionTypes";
import { compareEstimateToTarget } from "./scoreEstimation";

const STAGES: Array<{
  id: ProgressIllustrationStageId;
  label: string;
  title: string;
  message: string;
  progressPercent: number;
}> = [
  {
    id: "prepared",
    label: "Ruang Disiapkan",
    title: "Semua perjalanan besar dimulai dari meja yang siap.",
    message: "Selesaikan sesi pertamamu agar ruang belajar ini mulai bertumbuh.",
    progressPercent: 8,
  },
  {
    id: "growing",
    label: "Ritme Tumbuh",
    title: "Kebiasaan belajar mulai meninggalkan jejak.",
    message: "Pertahankan ritme dan jalankan simulasi lengkap untuk membentuk arah yang terukur.",
    progressPercent: 30,
  },
  {
    id: "measured",
    label: "Arah Terukur",
    title: "Sekarang ruang ini tahu ke mana kamu sedang menuju.",
    message: "Estimasi dan diagnostik sudah tersedia. Gunakan keduanya untuk memperkuat bagian yang paling menghambat.",
    progressPercent: 58,
  },
  {
    id: "near",
    label: "Mendekati Target",
    title: "Target sudah terlihat dari meja belajarmu.",
    message: "Jaraknya dekat. Sedikit latihan terarah lebih berharga daripada banyak latihan acak.",
    progressPercent: 84,
  },
  {
    id: "achieved",
    label: "Target Tercapai",
    title: "Ruang belajarmu sedang berada dalam bentuk terbaiknya.",
    message: "Target aktif sudah tercapai. Pertahankan ritme dan pastikan hasil ini dapat diulang.",
    progressPercent: 100,
  },
];

export function buildProgressIllustrationModel(
  bank: MasterQuestionBank,
  progress: StoredProgress,
): ProgressIllustrationModel {
  const totalActiveQuestions =
    getActiveListeningQuestions(bank).length +
    getActiveStructureQuestions(bank).length +
    getActiveWrittenExpressionQuestions(bank).length +
    getActiveReadingQuestions(bank).length;
  const activeIds = new Set([
    ...getActiveListeningQuestions(bank),
    ...getActiveStructureQuestions(bank),
    ...getActiveWrittenExpressionQuestions(bank),
    ...getActiveReadingQuestions(bank),
  ].map((question) => question.id));
  const seenCount = new Set(progress.seenQuestionIds.filter((id) => activeIds.has(id))).size;
  const attemptTotals = Object.entries(progress.attemptsByQuestion).reduce(
    (totals, [id, item]) => {
      if (!activeIds.has(id)) return totals;
      totals.attempts += item.attempts;
      totals.correct += item.correct;
      return totals;
    },
    { attempts: 0, correct: 0 },
  );
  const coveragePercent = percentage(seenCount, totalActiveQuestions);
  const accuracyPercent = percentage(attemptTotals.correct, attemptTotals.attempts);
  const weeklySessions = countCurrentWeekSessions(progress);
  const rhythmPercent = Math.min(100, Math.round((weeklySessions / 5) * 100));
  const estimate = progress.latestScoreEstimate;
  const comparison = compareEstimateToTarget(estimate, progress.scoreTarget);
  const targetProgressPercent = buildTargetProgressPercent(estimate?.totalEstimate, progress.scoreTarget);
  const stageIndex = comparison?.status === "achieved"
    ? 4
    : comparison?.status === "near"
      ? 3
      : estimate
        ? 2
        : progress.history.length
          ? 1
          : 0;
  const stage = STAGES[stageIndex];
  const milestones = buildMilestones(stageIndex);
  const diagnosticBars = (progress.simulationHistory[0]?.diagnosticSnapshot?.bySection ?? [])
    .slice(0, 3)
    .map((area) => ({ id: area.key, label: area.label, accuracy: area.accuracy }));

  return {
    accuracyPercent,
    bookCount: Math.min(6, 1 + Math.floor(coveragePercent / 12)),
    coveragePercent,
    diagnosticBars,
    estimateLabel: estimate ? `Estimasi ${estimate.totalEstimate}` : "Belum ada estimasi lengkap",
    lampIntensity: Math.max(0.2, rhythmPercent / 100),
    message: stage.message,
    milestones,
    nextMilestone: milestones.find((item) => item.state === "active")?.label ?? "Pertahankan hasil",
    pawStepCount: targetProgressPercent === undefined
      ? Math.min(5, stageIndex + 1)
      : Math.min(5, Math.max(1, Math.ceil(targetProgressPercent / 20))),
    plantLeafCount: Math.min(12, 2 + stageIndex * 2 + Math.min(2, weeklySessions)),
    rhythmPercent,
    signals: [
      {
        id: "plant",
        label: "Tanaman perjalanan",
        valueLabel: stage.label,
        explanation: "Pertumbuhan tanaman mengikuti fase perjalanan yang telah terbukti oleh sesi dan estimasi.",
        progressPercent: stage.progressPercent,
      },
      {
        id: "lamp",
        label: "Lampu ritme",
        valueLabel: `${weeklySessions}/5 sesi minggu ini`,
        explanation: "Cahaya lampu menguat ketika target ritme mingguan semakin terpenuhi.",
        progressPercent: rhythmPercent,
      },
      {
        id: "books",
        label: "Rak pengetahuan",
        valueLabel: `${seenCount}/${totalActiveQuestions} soal dipelajari`,
        explanation: "Rak terisi mengikuti cakupan soal aktif yang pernah kamu temui.",
        progressPercent: coveragePercent,
      },
      {
        id: "path",
        label: "Jejak menuju target",
        valueLabel: targetProgressPercent === undefined ? "Menunggu target dan estimasi" : `${targetProgressPercent}% perjalanan target`,
        explanation: "Jejak dihitung relatif dari estimasi minimum yang didukung menuju target aktifmu.",
        progressPercent: targetProgressPercent ?? 0,
      },
    ],
    stageId: stage.id,
    stageIndex,
    stageLabel: stage.label,
    stageProgressPercent: stage.progressPercent,
    targetLabel: progress.scoreTarget ? `Target ${progress.scoreTarget}` : "Target belum ditetapkan",
    targetProgressPercent,
    title: stage.title,
  };
}

function buildMilestones(stageIndex: number): ProgressIllustrationMilestone[] {
  return STAGES.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    detail: milestoneDetail(stage.id),
    state: index < stageIndex ? "unlocked" : index === stageIndex ? "active" : "locked",
  }));
}

function milestoneDetail(id: ProgressIllustrationStageId): string {
  if (id === "prepared") return "Bank dan target siap digunakan.";
  if (id === "growing") return "Satu atau lebih sesi selesai.";
  if (id === "measured") return "Simulasi lengkap membentuk estimasi.";
  if (id === "near") return "Estimasi berada sangat dekat dengan target.";
  return "Estimasi mencapai atau melampaui target aktif.";
}

function buildTargetProgressPercent(estimate: number | undefined, target: number | undefined): number | undefined {
  if (estimate === undefined || target === undefined) return undefined;
  const range = target - TOEFL_ITP_ESTIMATED_TOTAL_MIN;
  if (range <= 0) return estimate >= target ? 100 : 0;
  return clamp(Math.round(((estimate - TOEFL_ITP_ESTIMATED_TOTAL_MIN) / range) * 100), 0, 100);
}

function countCurrentWeekSessions(progress: StoredProgress): number {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  return progress.history.filter((item) => new Date(item.finishedAt) >= weekStart).length;
}

function percentage(numerator: number, denominator: number): number {
  return denominator ? clamp(Math.round((numerator / denominator) * 100), 0, 100) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
