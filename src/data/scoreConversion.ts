import type { EstimatedScoreSection } from "../types/scoring";
import conversionData from "./scoreConversionTables.json";

export const SCORE_ESTIMATION_VERSION = conversionData.version;
export const SCORE_ESTIMATION_METHOD = "internal-linear-practice-estimate" as const;

export const TOEFL_ITP_ESTIMATED_TOTAL_MIN = conversionData.totalMin;
export const TOEFL_ITP_ESTIMATED_TOTAL_MAX = conversionData.totalMax;

export const SCORE_ESTIMATION_SECTION_QUESTION_COUNTS: Record<EstimatedScoreSection, number> =
  conversionData.sectionQuestionCounts;

export const SCORE_ESTIMATION_SECTION_RANGES: Record<
  EstimatedScoreSection,
  { min: number; max: number }
> = conversionData.sectionRanges;

export const SCORE_ESTIMATION_TABLES: Record<EstimatedScoreSection, readonly number[]> =
  conversionData.tables;

export const SCORE_ESTIMATION_METADATA = {
  version: SCORE_ESTIMATION_VERSION,
  method: SCORE_ESTIMATION_METHOD,
  level: "TOEFL ITP Level 1 / PBT-style practice composition",
  totalFormula: "(Listening + Structure/Written + Reading) x 10 / 3",
  rounding: "nearest integer",
  limitation:
    "Internal linear practice estimate. It does not reproduce ETS form equating and must never be presented as an official score.",
} as const;
