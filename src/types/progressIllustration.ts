export type ProgressIllustrationStageId = "prepared" | "growing" | "measured" | "near" | "achieved";

export interface ProgressIllustrationMilestone {
  id: ProgressIllustrationStageId;
  label: string;
  detail: string;
  state: "unlocked" | "active" | "locked";
}

export interface ProgressIllustrationSignal {
  id: "plant" | "lamp" | "books" | "path";
  label: string;
  valueLabel: string;
  explanation: string;
  progressPercent: number;
}

export interface ProgressIllustrationDiagnosticBar {
  id: string;
  label: string;
  accuracy: number;
}

export interface ProgressIllustrationModel {
  stageId: ProgressIllustrationStageId;
  stageIndex: number;
  stageLabel: string;
  title: string;
  message: string;
  stageProgressPercent: number;
  nextMilestone: string;
  targetLabel: string;
  estimateLabel: string;
  plantLeafCount: number;
  bookCount: number;
  pawStepCount: number;
  lampIntensity: number;
  targetProgressPercent?: number;
  coveragePercent: number;
  rhythmPercent: number;
  accuracyPercent: number;
  diagnosticBars: ProgressIllustrationDiagnosticBar[];
  milestones: ProgressIllustrationMilestone[];
  signals: ProgressIllustrationSignal[];
}
