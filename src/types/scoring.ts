export type EstimatedScoreSection = "listening" | "structureWritten" | "reading";

export interface RawSimulationSectionScores {
  listening: number;
  structureWritten: number;
  reading: number;
}

export interface EstimatedSectionScore {
  rawCorrect: number;
  rawQuestionCount: number;
  scaledEstimate: number;
}

export interface SimulationScoreEstimate {
  conversionVersion: string;
  method: "internal-linear-practice-estimate";
  label: "Estimasi Skor Simulasi TOEFL ITP";
  totalEstimate: number;
  rawTotalCorrect: number;
  rawTotalQuestions: number;
  sections: Record<EstimatedScoreSection, EstimatedSectionScore>;
  calculatedAt: string;
}

export type ScoreTargetStatus = "achieved" | "near" | "progressing" | "far";

export interface ScoreTargetComparison {
  targetScore: number;
  gap: number;
  achievementRatio: number;
  gapRatio: number;
  status: ScoreTargetStatus;
}

export type ScoreRevealTone = ScoreTargetStatus | "no-target";

export interface ScoreRevealMessage {
  tone: ScoreRevealTone;
  eyebrow: string;
  headline: string;
  message: string;
  targetSummary: string;
  nextStep: string;
}
