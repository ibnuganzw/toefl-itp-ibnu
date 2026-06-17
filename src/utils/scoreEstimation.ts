import {
  SCORE_ESTIMATION_METHOD,
  SCORE_ESTIMATION_SECTION_QUESTION_COUNTS,
  SCORE_ESTIMATION_TABLES,
  SCORE_ESTIMATION_VERSION,
  TOEFL_ITP_ESTIMATED_TOTAL_MAX,
  TOEFL_ITP_ESTIMATED_TOTAL_MIN,
} from "../data/scoreConversion";
import type {
  EstimatedScoreSection,
  RawSimulationSectionScores,
  ScoreTargetComparison,
  ScoreRevealMessage,
  ScoreTargetStatus,
  SimulationScoreEstimate,
} from "../types/scoring";
import { flattenSessionQuestions, type RuntimeSession } from "./sessionEngine";

export const SCORE_TARGET_STATUS_THRESHOLDS = {
  nearGapRatio: 0.08,
  progressingGapRatio: 0.18,
} as const;

export function estimateFromRawSectionScores(
  rawScores: RawSimulationSectionScores,
  calculatedAt = new Date().toISOString(),
): SimulationScoreEstimate | undefined {
  if (!hasValidRawScores(rawScores)) return undefined;

  const sections = {
    listening: estimateSection("listening", rawScores.listening),
    structureWritten: estimateSection("structureWritten", rawScores.structureWritten),
    reading: estimateSection("reading", rawScores.reading),
  };
  const totalEstimate = Math.round(
    ((sections.listening.scaledEstimate +
      sections.structureWritten.scaledEstimate +
      sections.reading.scaledEstimate) *
      10) /
      3,
  );

  return {
    calculatedAt,
    conversionVersion: SCORE_ESTIMATION_VERSION,
    label: "Estimasi Skor Simulasi TOEFL ITP",
    method: SCORE_ESTIMATION_METHOD,
    rawTotalCorrect: rawScores.listening + rawScores.structureWritten + rawScores.reading,
    rawTotalQuestions: Object.values(SCORE_ESTIMATION_SECTION_QUESTION_COUNTS).reduce((sum, value) => sum + value, 0),
    sections,
    totalEstimate,
  };
}

export function estimateSimulationScore(session: RuntimeSession): SimulationScoreEstimate | undefined {
  if (!isEligibleCompleteSimulation(session)) return undefined;

  const rawScores: RawSimulationSectionScores = {
    listening: 0,
    structureWritten: 0,
    reading: 0,
  };
  const questionCounts: RawSimulationSectionScores = {
    listening: 0,
    structureWritten: 0,
    reading: 0,
  };

  for (const ref of flattenSessionQuestions(session.units)) {
    const section = scoreSectionForDisplaySection(ref.displaySection);
    questionCounts[section] += 1;
    if (session.answers[ref.question.id]?.isCorrect) rawScores[section] += 1;
  }

  if (!hasExactQuestionCounts(questionCounts)) return undefined;
  return estimateFromRawSectionScores(rawScores, session.finishedAt ?? new Date().toISOString());
}

export function compareEstimateToTarget(
  estimate: SimulationScoreEstimate | undefined,
  targetScore: number | undefined,
): ScoreTargetComparison | undefined {
  const normalizedTarget = normalizeScoreTarget(targetScore);
  if (!estimate || normalizedTarget === undefined) return undefined;

  const gap = normalizedTarget - estimate.totalEstimate;
  const achievementRatio = roundRatio(estimate.totalEstimate / normalizedTarget);
  const gapRatio = roundRatio(Math.max(gap, 0) / normalizedTarget);

  return {
    achievementRatio,
    gap,
    gapRatio,
    status: targetStatus(gap, gapRatio),
    targetScore: normalizedTarget,
  };
}

export function normalizeScoreTarget(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded < TOEFL_ITP_ESTIMATED_TOTAL_MIN || rounded > TOEFL_ITP_ESTIMATED_TOTAL_MAX) return undefined;
  return rounded;
}

export function scoreTargetFeedback(comparison: ScoreTargetComparison): {
  headline: string;
  message: string;
} {
  if (comparison.status === "achieved") {
    const surplus = Math.abs(comparison.gap);
    return {
      headline: "Target tercapai",
      message:
        surplus > 0
          ? `Estimasi ini melampaui targetmu sebesar ${surplus} poin. Pertahankan ritmenya.`
          : "Estimasi ini tepat mencapai targetmu. Pertahankan ritmenya.",
    };
  }
  if (comparison.status === "near") {
    return {
      headline: "Sedikit lagi",
      message: `Tinggal ${comparison.gap} poin menuju target. Fokuskan latihan pada bagian terlemahmu.`,
    };
  }
  if (comparison.status === "progressing") {
    return {
      headline: "Terus dorong progresmu",
      message: `Masih ada selisih ${comparison.gap} poin. Latihan terarah akan lebih berguna daripada sekadar menambah jumlah soal.`,
    };
  }
  return {
    headline: "Bangun fondasi lebih kuat",
    message: `Selisih terhadap target masih ${comparison.gap} poin. Mulai dari area terlemah dan ukur kembali melalui simulasi lengkap.`,
  };
}

export function buildScoreRevealMessage(
  estimate: SimulationScoreEstimate,
  comparison: ScoreTargetComparison | undefined,
  weakestAreaLabel?: string,
): ScoreRevealMessage {
  const focus = weakestAreaLabel
    ? `Mulai dari ${weakestAreaLabel}, lalu ukur kembali lewat simulasi lengkap.`
    : "Tinjau hasil per bagian, lalu pilih latihan yang paling membutuhkan perhatian.";

  if (!comparison) {
    return {
      tone: "no-target",
      eyebrow: "Titik Awal Baru",
      headline: `Estimasi pertamamu: ${estimate.totalEstimate}`,
      message: "Hasil ini sudah dapat menjadi patokan. Tetapkan target agar simulasi berikutnya punya arah yang lebih tajam.",
      targetSummary: "Target belum ditetapkan",
      nextStep: focus,
    };
  }

  if (comparison.status === "achieved") {
    const surplus = Math.abs(comparison.gap);
    return {
      tone: "achieved",
      eyebrow: "Target Tercapai",
      headline: surplus ? `Kamu melampaui target sebesar ${surplus} poin.` : "Kamu tepat mencapai target.",
      message: "Kerja kerasmu terbukti pada simulasi ini. Pertahankan bagian terkuat dan tetap bereskan hambatan utama.",
      targetSummary: `Estimasi ${estimate.totalEstimate} · Target ${comparison.targetScore}`,
      nextStep: focus,
    };
  }

  if (comparison.status === "near") {
    return {
      tone: "near",
      eyebrow: "Sedikit Lagi",
      headline: `${comparison.gap} poin lagi menuju target.`,
      message: "Jaraknya sudah dekat. Latihan berikutnya harus terarah, bukan sekadar menambah jumlah soal.",
      targetSummary: `Estimasi ${estimate.totalEstimate} · Target ${comparison.targetScore}`,
      nextStep: focus,
    };
  }

  if (comparison.status === "progressing") {
    return {
      tone: "progressing",
      eyebrow: "Progres Terlihat",
      headline: `Masih ada selisih ${comparison.gap} poin.`,
      message: "Hasil ini belum cukup untuk targetmu, tetapi arahnya sudah dapat dibaca dan diperbaiki.",
      targetSummary: `Estimasi ${estimate.totalEstimate} · Target ${comparison.targetScore}`,
      nextStep: focus,
    };
  }

  return {
    tone: "far",
    eyebrow: "Saatnya Bangun Fondasi",
    headline: `Target masih berjarak ${comparison.gap} poin.`,
    message: "Hasil ini sedang jujur kepadamu. Fokus pada perbaikan mendasar sebelum mengejar simulasi berikutnya.",
    targetSummary: `Estimasi ${estimate.totalEstimate} · Target ${comparison.targetScore}`,
    nextStep: focus,
  };
}

function estimateSection(section: EstimatedScoreSection, rawCorrect: number) {
  return {
    rawCorrect,
    rawQuestionCount: SCORE_ESTIMATION_SECTION_QUESTION_COUNTS[section],
    scaledEstimate: SCORE_ESTIMATION_TABLES[section][rawCorrect],
  };
}

function hasValidRawScores(scores: RawSimulationSectionScores): boolean {
  return (Object.keys(SCORE_ESTIMATION_SECTION_QUESTION_COUNTS) as EstimatedScoreSection[]).every(
    (section) =>
      Number.isInteger(scores[section]) &&
      scores[section] >= 0 &&
      scores[section] <= SCORE_ESTIMATION_SECTION_QUESTION_COUNTS[section],
  );
}

function hasExactQuestionCounts(scores: RawSimulationSectionScores): boolean {
  return (Object.keys(SCORE_ESTIMATION_SECTION_QUESTION_COUNTS) as EstimatedScoreSection[]).every(
    (section) => scores[section] === SCORE_ESTIMATION_SECTION_QUESTION_COUNTS[section],
  );
}

function isEligibleCompleteSimulation(session: RuntimeSession): boolean {
  if (session.mode !== "simulation") return false;
  if (session.kind === "simulation-full") return true;
  if (session.kind !== "simulation-custom" || !session.config) return false;

  return (
    session.config.listeningQuestionCount === SCORE_ESTIMATION_SECTION_QUESTION_COUNTS.listening &&
    (session.config.structureCount ?? 0) + (session.config.writtenCount ?? 0) ===
      SCORE_ESTIMATION_SECTION_QUESTION_COUNTS.structureWritten &&
    session.config.readingQuestionCount === SCORE_ESTIMATION_SECTION_QUESTION_COUNTS.reading
  );
}

function scoreSectionForDisplaySection(
  section: ReturnType<typeof flattenSessionQuestions>[number]["displaySection"],
): EstimatedScoreSection {
  if (section === "structure-written") return "structureWritten";
  return section;
}

function targetStatus(gap: number, gapRatio: number): ScoreTargetStatus {
  if (gap <= 0) return "achieved";
  if (gapRatio <= SCORE_TARGET_STATUS_THRESHOLDS.nearGapRatio) return "near";
  if (gapRatio <= SCORE_TARGET_STATUS_THRESHOLDS.progressingGapRatio) return "progressing";
  return "far";
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
