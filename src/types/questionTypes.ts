export type AnswerOptionKey = "A" | "B" | "C" | "D";

export type Difficulty = "easy" | "medium" | "hard" | "unknown";

export type QuestionSection = "structure" | "written-expression" | "reading" | "listening";

export type ListeningPart = "A" | "B" | "C";

export type ListeningSourceType = "short-conversation" | "longer-conversation" | "short-talk";

export type ChoiceSet = Record<AnswerOptionKey, string>;

export type OptionAnalysis = Partial<Record<AnswerOptionKey, string>>;

export interface ExplanationFields {
  summary: string;
  reasoning?: string;
  whyCorrect: string;
  optionAnalysis?: OptionAnalysis;
  toeflTrap?: string;
  quickNote?: string;
  sourceNotes?: string;
}

export interface BaseQuestion {
  id: string;
  sourceId?: string;
  legacyId?: string;
  section: QuestionSection;
  active: boolean;
  difficulty?: Difficulty;
  questionText: string;
  choices: ChoiceSet;
  correctAnswer: AnswerOptionKey;
  explanation: ExplanationFields;
  tags?: string[];
}

export interface StructureQuestion extends BaseQuestion {
  section: "structure";
  grammarPattern?: string;
  sentenceStructureExplanation?: string;
}

export interface WrittenExpressionQuestion extends BaseQuestion {
  section: "written-expression";
  grammarPattern?: string;
  errorFocus?: string;
  incorrectPart?: string;
  correction?: string;
  correctedSentence?: string;
  sentenceStructureExplanation?: string;
}

export interface ReadingQuestion extends BaseQuestion {
  section: "reading";
  passageId: string;
  questionType?: string;
  readingSkill?: string;
  evidenceLocation?: string;
  keyEvidence?: string;
  paraphrasedEvidence?: string;
}

export interface ListeningQuestion extends BaseQuestion {
  section: "listening";
  listeningSetId: string;
  listeningPart: ListeningPart;
  audioUrl?: string;
  questionAudioUrl?: string;
  listeningSkill?: string;
  cue?: string;
}

export interface ReadingPassage {
  id: string;
  sourceId?: string;
  title: string;
  category: string;
  topic?: string;
  passage: string;
  active: boolean;
  questions: ReadingQuestion[];
}

export interface ListeningSet {
  id: string;
  part: ListeningPart;
  sourceType: ListeningSourceType;
  sequence: number;
  title: string;
  description?: string;
  mainAudioTitle?: string;
  mainAudioContext?: string;
  audioSrc: string;
  audioUrl?: string;
  aiGeneratedAudio?: boolean;
  transcript?: string;
  active: boolean;
  questions: ListeningQuestion[];
}

export type SingleQuestion = StructureQuestion | WrittenExpressionQuestion;

export type BankQuestion = SingleQuestion | ReadingQuestion | ListeningQuestion;

export interface MasterQuestionBank {
  version: string;
  structureQuestions: StructureQuestion[];
  writtenExpressionQuestions: WrittenExpressionQuestion[];
  readingPassages: ReadingPassage[];
  listeningSets: ListeningSet[];
}

export type LearningUnit =
  | {
      unitType: "single-question";
      id: string;
      question: SingleQuestion;
    }
  | {
      unitType: "reading-passage";
      id: string;
      passage: ReadingPassage;
    }
  | {
      unitType: "listening-set";
      id: string;
      listeningSet: ListeningSet;
    };

export type SimulationMode =
  | "structure-written"
  | "reading"
  | "full"
  | "custom";

export interface SimulationConfig {
  mode: SimulationMode;
  listeningQuestionCount?: number;
  structureCount?: number;
  writtenCount?: number;
  readingQuestionCount?: number;
  shuffleQuestions: boolean;
  shuffleReadingQuestionsWithinPassage: boolean;
  includeSeenQuestions: boolean;
  timeLimitMinutes?: number;
}

export interface AnswerRecord {
  unitId: string;
  questionId: string;
  selectedAnswer?: AnswerOptionKey;
  correctAnswer: AnswerOptionKey;
  isCorrect: boolean;
  isDoubtful: boolean;
  answeredAt?: string;
  elapsedSeconds?: number;
}

export interface SessionState {
  id: string;
  mode: "learning" | "simulation";
  simulationConfig?: SimulationConfig;
  currentUnitIndex: number;
  currentQuestionIndexWithinUnit?: number;
  units: LearningUnit[];
  answers: Record<string, AnswerRecord>;
  startedAt: string;
  finishedAt?: string;
  paused: boolean;
}

export interface DiagnosticBucket {
  key: string;
  label: string;
  attempted: number;
  correct: number;
  accuracy: number;
}

export interface DiagnosticResult {
  totalAttempted: number;
  totalCorrect: number;
  accuracy: number;
  bySection: DiagnosticBucket[];
  byGrammarPattern: DiagnosticBucket[];
  byReadingSkill: DiagnosticBucket[];
  weakestAreas: DiagnosticBucket[];
}

export interface ImportSourceFile {
  label: string;
  path: string;
  role: "old-html-reference" | "structure-written-source" | "reading-source" | "other";
  parsedSafely: boolean;
  detectedCount?: number;
  notes?: string[];
}

export interface ImportReport {
  generatedAt: string;
  status: "not-started" | "partial" | "complete" | "blocked";
  sources: ImportSourceFile[];
  importedStructureCount: number;
  importedWrittenCount: number;
  importedReadingPassageCount: number;
  importedReadingQuestionCount: number;
  importedListeningSetCount?: number;
  importedListeningQuestionCount?: number;
  uncertainItems: string[];
  rejectedItems: string[];
  notes: string[];
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  questionId?: string;
  passageId?: string;
  listeningSetId?: string;
}

export interface ValidationSummary {
  structureCount: number;
  writtenCount: number;
  structureWrittenCount: number;
  readingPassageCount: number;
  readingQuestionCount: number;
  listeningSetCount: number;
  listeningQuestionCount: number;
  listeningPartCounts: Record<ListeningPart, number>;
  totalActiveQuestions: number;
  duplicateQuestionIds: string[];
  duplicatePassageIds: string[];
  duplicateListeningSetIds: string[];
  invalidAnswerQuestionIds: string[];
  missingExplanationQuestionIds: string[];
  readingIntegrityOk: boolean;
  listeningIntegrityOk: boolean;
}

export interface ValidationReport {
  ok: boolean;
  strictTargetOk: boolean;
  generatedAt: string;
  mode: "normal" | "strict-initial";
  summary: ValidationSummary;
  issues: ValidationIssue[];
}
