import {
  getActiveListeningSetById,
  getActiveListeningSets,
  getActiveListeningQuestions,
  getActiveReadingPassages,
  getActiveStructureQuestions,
  getActiveWrittenExpressionQuestions,
} from "../data/questionBank";
import {
  LISTENING_MAIN_AUDIO_PLAY_LIMITS,
  TOEFL_ITP_LISTENING_QUESTION_COUNT,
  TOEFL_ITP_LISTENING_TIME_LIMIT_MINUTES,
} from "../data/listeningBank";
import type {
  AnswerOptionKey,
  AnswerRecord,
  BankQuestion,
  DiagnosticBucket,
  LearningUnit,
  ListeningQuestion,
  ListeningSet,
  MasterQuestionBank,
  QuestionSection,
  ReadingPassage,
  ReadingQuestion,
  SingleQuestion,
  SimulationConfig,
} from "../types/questionTypes";
import type { DiagnosticArea, SessionDiagnostic } from "../types/diagnostics";
import { shuffle } from "./shuffle";
import {
  matchesFocusedPractice,
  type FocusedPracticeTarget,
} from "./focusedPractice";
import {
  createListeningPackageUnits,
  createReadingPackageUnits,
  normalizeFixedPackageQuestionCount,
  SessionBlueprintUnavailableError,
  type FixedPackageQuestionCount,
} from "./sessionBlueprints";

export type LearningScope = "structure" | "structure-written" | "written-expression" | "reading" | "listening";

export type SessionKind =
  | "learn-structure"
  | "learn-structure-written"
  | "learn-written-expression"
  | "learn-reading"
  | "learn-listening"
  | "learn-listening-prototype"
  | "simulation-structure-written"
  | "simulation-reading"
  | "simulation-full"
  | "simulation-listening"
  | "simulation-listening-prototype"
  | "simulation-custom"
  | "retry-wrong"
  | "retry-doubtful"
  | "learn-focused"
  | "train-weakest";

export interface SessionBlueprint {
  id: string;
  title: string;
  subtitle: string;
  mode: "learning" | "simulation";
  kind: SessionKind;
  units: LearningUnit[];
  timeLimitSeconds?: number;
  config?: SimulationConfig;
  createdAt: string;
}

export interface RuntimeSession extends SessionBlueprint {
  currentIndex: number;
  answers: Record<string, AnswerRecord>;
  listeningPlayCounts?: Record<string, number>;
  elapsedSeconds: number;
  remainingSeconds?: number;
  paused: boolean;
  startedAt: string;
  finishedAt?: string;
  finishReason?: "manual" | "time";
}

export interface QuestionRef {
  key: string;
  globalIndex: number;
  sectionIndex: number;
  sectionQuestionCount: number;
  displaySection: "listening" | "structure-written" | "reading";
  unitIndex: number;
  questionIndexWithinUnit: number;
  unitId: string;
  question: BankQuestion;
  passage?: ReadingPassage;
  listeningSet?: ListeningSet;
}

export type { DiagnosticArea, SessionDiagnostic } from "../types/diagnostics";

export interface StoredSessionSnapshot {
  id: string;
  title: string;
  subtitle: string;
  mode: "learning" | "simulation";
  kind: SessionKind;
  startedAt: string;
  createdAt: string;
  currentIndex: number;
  answers: Record<string, AnswerRecord>;
  listeningPlayCounts?: Record<string, number>;
  elapsedSeconds: number;
  remainingSeconds?: number;
  timeLimitSeconds?: number;
  config?: SimulationConfig;
  unitRefs: StoredUnitRef[];
}

export type StoredUnitRef =
  | { unitType: "single-question"; id: string }
  | { unitType: "reading-passage"; id: string; questionIds: string[] }
  | { unitType: "listening-set"; id: string; questionIds: string[] };

export const ANSWER_KEYS: AnswerOptionKey[] = ["A", "B", "C", "D"];

export const DEFAULT_SIMULATION_CONFIGS: Record<
  "structure-written" | "reading" | "full",
  Required<Pick<SimulationConfig, "listeningQuestionCount" | "structureCount" | "writtenCount" | "readingQuestionCount">> &
    Pick<
      SimulationConfig,
      | "mode"
      | "timeLimitMinutes"
      | "shuffleQuestions"
      | "shuffleReadingQuestionsWithinPassage"
      | "includeSeenQuestions"
    >
> = {
  "structure-written": {
    mode: "structure-written",
    listeningQuestionCount: 0,
    structureCount: 15,
    writtenCount: 25,
    readingQuestionCount: 0,
    timeLimitMinutes: 25,
    shuffleQuestions: true,
    shuffleReadingQuestionsWithinPassage: false,
    includeSeenQuestions: true,
  },
  reading: {
    mode: "reading",
    listeningQuestionCount: 0,
    structureCount: 0,
    writtenCount: 0,
    readingQuestionCount: 50,
    timeLimitMinutes: 55,
    shuffleQuestions: true,
    shuffleReadingQuestionsWithinPassage: false,
    includeSeenQuestions: true,
  },
  full: {
    mode: "full",
    listeningQuestionCount: TOEFL_ITP_LISTENING_QUESTION_COUNT,
    structureCount: 15,
    writtenCount: 25,
    readingQuestionCount: 50,
    timeLimitMinutes: TOEFL_ITP_LISTENING_TIME_LIMIT_MINUTES + 25 + 55,
    shuffleQuestions: true,
    shuffleReadingQuestionsWithinPassage: false,
    includeSeenQuestions: true,
  },
};

export function createLearningSession(
  bank: MasterQuestionBank,
  scope: LearningScope,
  options: { maxQuestions?: number; shuffleUnits?: boolean; title?: string } = {},
): SessionBlueprint {
  const maxQuestions = Math.min(Math.max(options.maxQuestions ?? 100, 1), 100);
  const units = createLearningUnits(bank, scope, options.shuffleUnits ?? false, maxQuestions);
  const labels: Record<LearningScope, string> = {
    structure: "Structure",
    "structure-written": "Structure & Written",
    "written-expression": "Written Expression",
    reading: "Reading",
    listening: "Listening",
  };

  return {
    id: createId("learn"),
    title: options.title ?? `Mode Belajar: ${labels[scope]}`,
    subtitle: `Latihan bebas maksimal ${maxQuestions} soal dengan pembahasan langsung setelah jawaban dipilih.`,
    mode: "learning",
    kind: `learn-${scope}` as SessionKind,
    units,
    createdAt: new Date().toISOString(),
  };
}

export function createSimulationSession(
  bank: MasterQuestionBank,
  mode: SimulationConfig["mode"],
  overrides: Partial<SimulationConfig> = {},
): SessionBlueprint {
  const defaults =
    mode === "custom"
      ? {
          mode,
          listeningQuestionCount: TOEFL_ITP_LISTENING_QUESTION_COUNT,
          structureCount: 15,
          writtenCount: 25,
          readingQuestionCount: 50,
          timeLimitMinutes: TOEFL_ITP_LISTENING_TIME_LIMIT_MINUTES + 25 + 55,
          shuffleQuestions: true,
          shuffleReadingQuestionsWithinPassage: false,
          includeSeenQuestions: true,
        }
      : DEFAULT_SIMULATION_CONFIGS[mode];

  const config: SimulationConfig = {
    ...defaults,
    ...overrides,
    mode,
    shuffleQuestions: overrides.shuffleQuestions ?? defaults.shuffleQuestions,
    shuffleReadingQuestionsWithinPassage:
      overrides.shuffleReadingQuestionsWithinPassage ?? defaults.shuffleReadingQuestionsWithinPassage,
    includeSeenQuestions: overrides.includeSeenQuestions ?? defaults.includeSeenQuestions,
  };

  const units = createSimulationUnits(bank, config);
  const totalQuestionCount = units.reduce((sum, unit) => sum + countQuestionsInUnit(unit), 0);
  const titles: Record<SimulationConfig["mode"], string> = {
    "structure-written": "Simulasi Structure & Written",
    reading: "Simulasi Reading",
    full: "Simulasi Lengkap",
    custom: "Simulasi Kustom",
  };
  const subtitles: Record<SimulationConfig["mode"], string> = {
    "structure-written": `${(config.structureCount ?? 0) + (config.writtenCount ?? 0)} soal · ${
      config.timeLimitMinutes ?? 0
    } menit`,
    reading: `${config.readingQuestionCount ?? 0} soal · ${config.timeLimitMinutes ?? 0} menit`,
    full: `${
      (config.listeningQuestionCount ?? 0) +
      (config.structureCount ?? 0) +
      (config.writtenCount ?? 0) +
      (config.readingQuestionCount ?? 0)
    } soal · ${config.timeLimitMinutes ?? 0} menit`,
    custom: "Komposisi dan waktu mengikuti pengaturan yang dipilih.",
  };

  return {
    id: createId("sim"),
    title: titles[mode],
    subtitle: `${totalQuestionCount} soal - ${config.timeLimitMinutes ?? 0} menit`,
    mode: "simulation",
    kind: `simulation-${mode}` as SessionKind,
    units,
    timeLimitSeconds: config.timeLimitMinutes ? config.timeLimitMinutes * 60 : undefined,
    config,
    createdAt: new Date().toISOString(),
  };
}

export function createListeningSession(
  bank: MasterQuestionBank,
  mode: "learning" | "simulation",
  questionCount: FixedPackageQuestionCount = 50,
): SessionBlueprint {
  const packageQuestionCount = mode === "simulation" ? TOEFL_ITP_LISTENING_QUESTION_COUNT : questionCount;
  const units = createListeningPackageUnits(bank, normalizeFixedPackageQuestionCount(packageQuestionCount));
  const maxPlays = LISTENING_MAIN_AUDIO_PLAY_LIMITS[mode];

  return {
    id: createId(mode === "learning" ? "learn-listening" : "sim-listening"),
    title: mode === "learning" ? "Mode Belajar: Listening" : "Simulasi Listening",
    subtitle:
      mode === "learning"
        ? `${packageQuestionCount} soal berbasis paket Part A, Part B, dan Part C. Audio utama dapat diputar maksimal ${maxPlays} kali.`
        : `${TOEFL_ITP_LISTENING_QUESTION_COUNT} soal target - ${TOEFL_ITP_LISTENING_TIME_LIMIT_MINUTES} menit - urutan Part A, Part B, lalu Part C.`,
    mode,
    kind: mode === "learning" ? "learn-listening" : "simulation-listening",
    units,
    timeLimitSeconds: mode === "simulation" ? TOEFL_ITP_LISTENING_TIME_LIMIT_MINUTES * 60 : undefined,
    createdAt: new Date().toISOString(),
  };
}

export function createRuntimeSession(blueprint: SessionBlueprint): RuntimeSession {
  return {
    ...blueprint,
    currentIndex: 0,
    answers: {},
    elapsedSeconds: 0,
    remainingSeconds: blueprint.timeLimitSeconds,
    paused: false,
    startedAt: new Date().toISOString(),
  };
}

export function createRetrySession(
  bank: MasterQuestionBank,
  questionIds: string[],
  title: string,
  kind: "retry-wrong" | "retry-doubtful" | "train-weakest",
): SessionBlueprint {
  const units = createUnitsFromQuestionIds(bank, questionIds);
  return {
    id: createId(kind),
    title,
    subtitle: "Sesi dibuat dari hasil latihan terakhir.",
    mode: "learning",
    kind,
    units,
    createdAt: new Date().toISOString(),
  };
}

export function createFocusedLearningSession(
  bank: MasterQuestionBank,
  target: FocusedPracticeTarget,
): SessionBlueprint {
  const units = createFocusedPracticeUnits(bank, target, true);
  const totalQuestionCount = units.reduce((sum, unit) => sum + countQuestionsInUnit(unit), 0);

  if (!totalQuestionCount) {
    throw new SessionBlueprintUnavailableError(`Belum ada soal aktif yang cocok untuk fokus ${target.label}.`);
  }

  return {
    id: createId("learn-focused"),
    title: `Latihan Fokus: ${sectionLabel(target.section)} · ${target.label}`,
    subtitle: `${totalQuestionCount} soal relevan dipilih langsung dari master bank berdasarkan keluarga skill yang sama.`,
    mode: "learning",
    kind: "learn-focused",
    units,
    createdAt: new Date().toISOString(),
  };
}

export function countFocusedPracticeQuestions(
  bank: MasterQuestionBank,
  target: FocusedPracticeTarget,
): number {
  return createFocusedPracticeUnits(bank, target, false)
    .reduce((sum, unit) => sum + countQuestionsInUnit(unit), 0);
}

export function flattenSessionQuestions(units: LearningUnit[]): QuestionRef[] {
  const refs: QuestionRef[] = [];

  units.forEach((unit, unitIndex) => {
    if (unit.unitType === "single-question") {
      refs.push({
        key: unit.question.id,
        globalIndex: refs.length,
        sectionIndex: 0,
        sectionQuestionCount: 0,
        displaySection: displaySectionForQuestion(unit.question.section),
        unitIndex,
        questionIndexWithinUnit: 0,
        unitId: unit.id,
        question: unit.question,
      });
      return;
    }

    if (unit.unitType === "listening-set") {
      unit.listeningSet.questions
        .filter((question) => question.active)
        .forEach((question, questionIndexWithinUnit) => {
          refs.push({
            key: `${unit.listeningSet.id}:${question.id}`,
            globalIndex: refs.length,
            sectionIndex: 0,
            sectionQuestionCount: 0,
            displaySection: "listening",
            unitIndex,
            questionIndexWithinUnit,
            unitId: unit.id,
            question,
            listeningSet: unit.listeningSet,
          });
        });
      return;
    }

    unit.passage.questions
      .filter((question) => question.active)
      .forEach((question, questionIndexWithinUnit) => {
        refs.push({
          key: `${unit.passage.id}:${question.id}`,
          globalIndex: refs.length,
          sectionIndex: 0,
          sectionQuestionCount: 0,
          displaySection: "reading",
          unitIndex,
          questionIndexWithinUnit,
          unitId: unit.id,
          question,
          passage: unit.passage,
        });
      });
  });

  const totals = new Map<QuestionRef["displaySection"], number>();
  const indexes = new Map<QuestionRef["displaySection"], number>();
  for (const ref of refs) totals.set(ref.displaySection, (totals.get(ref.displaySection) ?? 0) + 1);
  for (const ref of refs) {
    ref.sectionIndex = indexes.get(ref.displaySection) ?? 0;
    ref.sectionQuestionCount = totals.get(ref.displaySection) ?? 0;
    indexes.set(ref.displaySection, ref.sectionIndex + 1);
  }

  return refs;
}

export function createAnswerRecord(
  ref: QuestionRef,
  selectedAnswer: AnswerOptionKey | undefined,
  existing: AnswerRecord | undefined,
  elapsedSeconds: number,
): AnswerRecord {
  return {
    unitId: ref.unitId,
    questionId: ref.question.id,
    selectedAnswer,
    correctAnswer: ref.question.correctAnswer,
    isCorrect: selectedAnswer === ref.question.correctAnswer,
    isDoubtful: existing?.isDoubtful ?? false,
    answeredAt: selectedAnswer ? new Date().toISOString() : existing?.answeredAt,
    elapsedSeconds,
  };
}

export function toggleDoubtfulRecord(
  ref: QuestionRef,
  existing: AnswerRecord | undefined,
  elapsedSeconds: number,
): AnswerRecord {
  return {
    unitId: ref.unitId,
    questionId: ref.question.id,
    selectedAnswer: existing?.selectedAnswer,
    correctAnswer: ref.question.correctAnswer,
    isCorrect: existing?.selectedAnswer === ref.question.correctAnswer,
    isDoubtful: !existing?.isDoubtful,
    answeredAt: existing?.answeredAt,
    elapsedSeconds,
  };
}

export function computeDiagnostic(session: RuntimeSession): SessionDiagnostic {
  const refs = flattenSessionQuestions(session.units);
  const attemptedRefs = refs.filter((ref) => Boolean(session.answers[ref.question.id]?.selectedAnswer));
  const correctRefs = attemptedRefs.filter((ref) => session.answers[ref.question.id]?.isCorrect);
  const doubtfulRefs = refs.filter((ref) => session.answers[ref.question.id]?.isDoubtful);

  const bySection = bucketize(
    refs,
    session.answers,
    sectionKey,
    (key) => sectionLabel(key as QuestionSection),
    "section",
  );
  const byGrammarPattern = bucketize(
    refs.filter((ref) => isSingleQuestionSection(ref.question.section)),
    session.answers,
    grammarKey,
    grammarLabel,
    "grammar",
  );
  const byReadingSkill = bucketize(
    refs.filter((ref) => ref.question.section === "reading"),
    session.answers,
    readingSkillKey,
    readingSkillLabel,
    "readingSkill",
  );
  const byListeningSkill = bucketize(
    refs.filter((ref) => ref.question.section === "listening"),
    session.answers,
    listeningSkillKey,
    listeningSkillLabel,
    "listeningSkill",
  );

  const allAreas = [...bySection, ...byGrammarPattern, ...byReadingSkill, ...byListeningSkill];
  const weakestAreas = allAreas
      .filter((bucket) => bucket.attempted > 0)
      .sort((left, right) => left.accuracy - right.accuracy || right.attempted - left.attempted)
      .slice(0, 5);
  const strongestAreas = allAreas
    .filter((bucket) => bucket.attempted > 0)
    .sort((left, right) => right.accuracy - left.accuracy || right.attempted - left.attempted)
    .slice(0, 5);

  return {
    totalQuestions: refs.length,
    totalAttempted: attemptedRefs.length,
    totalCorrect: correctRefs.length,
    totalIncorrect: attemptedRefs.length - correctRefs.length,
    totalUnanswered: refs.length - attemptedRefs.length,
    totalDoubtful: doubtfulRefs.length,
    accuracy: attemptedRefs.length ? Math.round((correctRefs.length / attemptedRefs.length) * 100) : 0,
    completionRate: refs.length ? Math.round((attemptedRefs.length / refs.length) * 100) : 0,
    bySection,
    byGrammarPattern,
    byReadingSkill,
    byListeningSkill,
    weakestAreas,
    strongestAreas,
  };
}

export function createStoredSnapshot(session: RuntimeSession): StoredSessionSnapshot {
  return {
    id: session.id,
    title: session.title,
    subtitle: session.subtitle,
    mode: session.mode,
    kind: session.kind,
    startedAt: session.startedAt,
    createdAt: session.createdAt,
    currentIndex: session.currentIndex,
    answers: session.answers,
    listeningPlayCounts: session.listeningPlayCounts,
    elapsedSeconds: session.elapsedSeconds,
    remainingSeconds: session.remainingSeconds,
    timeLimitSeconds: session.timeLimitSeconds,
    config: session.config,
    unitRefs: session.units.map((unit): StoredUnitRef => {
      if (unit.unitType === "single-question") {
        return { unitType: "single-question", id: unit.question.id };
      }
      if (unit.unitType === "listening-set") {
        return {
          unitType: "listening-set",
          id: unit.listeningSet.id,
          questionIds: unit.listeningSet.questions.map((question) => question.id),
        };
      }
      return {
        unitType: "reading-passage",
        id: unit.passage.id,
        questionIds: unit.passage.questions.map((question) => question.id),
      };
    }),
  };
}

export function restoreSessionFromSnapshot(
  bank: MasterQuestionBank,
  snapshot: StoredSessionSnapshot,
): RuntimeSession | null {
  const units = restoreUnitsFromRefs(bank, snapshot.unitRefs);
  if (!units.length) return null;

  const refs = flattenSessionQuestions(units);
  if (!refs.length) return null;

  return {
    id: snapshot.id,
    title: snapshot.title,
    subtitle: snapshot.subtitle,
    mode: snapshot.mode,
    kind: snapshot.kind,
    units,
    currentIndex: Math.min(snapshot.currentIndex, refs.length - 1),
    answers: snapshot.answers,
    listeningPlayCounts: snapshot.listeningPlayCounts,
    elapsedSeconds: snapshot.elapsedSeconds,
    remainingSeconds: snapshot.remainingSeconds,
    timeLimitSeconds: snapshot.timeLimitSeconds,
    config: snapshot.config,
    paused: false,
    startedAt: snapshot.startedAt,
    createdAt: snapshot.createdAt,
  };
}

export function questionIdsForDiagnosticArea(bank: MasterQuestionBank, area: DiagnosticArea): string[] {
  const singles = [...getActiveStructureQuestions(bank), ...getActiveWrittenExpressionQuestions(bank)];
  const readingQuestions = getActiveReadingPassages(bank).flatMap((passage) =>
    passage.questions.filter((question) => question.active),
  );
  const listeningQuestions = getActiveListeningQuestions(bank);

  if (area.category === "section") {
    return [...singles, ...readingQuestions, ...listeningQuestions]
      .filter((question) => question.section === area.key)
      .map((question) => question.id);
  }

  if (area.category === "grammar") {
    return singles
      .filter((question) => getSingleQuestionPattern(question) === area.key)
      .map((question) => question.id);
  }

  if (area.category === "readingSkill") {
    return readingQuestions
      .filter((question) => readingSkillKey({ question } as QuestionRef) === area.key)
      .map((question) => question.id);
  }

  return listeningQuestions
    .filter((question) => listeningSkillKey({ question } as QuestionRef) === area.key)
    .map((question) => question.id);
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function sectionLabel(section: QuestionSection): string {
  if (section === "structure") return "Structure";
  if (section === "written-expression") return "Written Expression";
  if (section === "listening") return "Listening";
  return "Reading";
}

function createLearningUnits(
  bank: MasterQuestionBank,
  scope: LearningScope,
  shouldShuffle: boolean,
  maxQuestions: number,
): LearningUnit[] {
  if (scope === "reading") {
    return createReadingPackageUnits(bank, normalizeFixedPackageQuestionCount(maxQuestions), {
      shuffleQuestionsWithinPassage: shouldShuffle,
    });
  }

  if (scope === "listening") {
    return createListeningPackageUnits(bank, normalizeFixedPackageQuestionCount(maxQuestions));
  }

  const units: LearningUnit[] = [];

  if (scope === "structure" || scope === "structure-written") {
    units.push(
      ...getActiveStructureQuestions(bank).map((question) => ({
        unitType: "single-question" as const,
        id: question.id,
        question,
      })),
    );
  }

  if (scope === "written-expression" || scope === "structure-written") {
    units.push(
      ...getActiveWrittenExpressionQuestions(bank).map((question) => ({
        unitType: "single-question" as const,
        id: question.id,
        question,
      })),
    );
  }

  const orderedUnits = shouldShuffle ? shuffle(units) : units;
  return takeUnitsWithinQuestionLimit(orderedUnits, maxQuestions);
}

function createSimulationUnits(bank: MasterQuestionBank, config: SimulationConfig): LearningUnit[] {
  const listeningUnits = config.listeningQuestionCount
    ? createListeningPackageUnits(bank, normalizeFixedPackageQuestionCount(config.listeningQuestionCount))
    : [];
  const structure = takeActive(getActiveStructureQuestions(bank), config.structureCount ?? 0, config.shuffleQuestions);
  const written = takeActive(
    getActiveWrittenExpressionQuestions(bank),
    config.writtenCount ?? 0,
    config.shuffleQuestions,
  );
  const readingUnits = config.readingQuestionCount
    ? createReadingPackageUnits(bank, normalizeFixedPackageQuestionCount(config.readingQuestionCount), {
        shuffleQuestionsWithinPassage: config.shuffleReadingQuestionsWithinPassage,
      })
    : [];

  const singleUnits: LearningUnit[] = [
    ...structure.map((question) => ({
      unitType: "single-question" as const,
      id: question.id,
      question,
    })),
    ...written.map((question) => ({
      unitType: "single-question" as const,
      id: question.id,
      question,
    })),
  ];

  const units =
    config.mode === "structure-written"
      ? singleUnits
      : config.mode === "reading"
        ? readingUnits
        : [...listeningUnits, ...singleUnits, ...readingUnits];

  return config.mode === "structure-written" || config.mode === "reading"
    ? config.shuffleQuestions
      ? shuffle(units)
      : units
    : units;
}

function createFocusedPracticeUnits(
  bank: MasterQuestionBank,
  target: FocusedPracticeTarget,
  shouldShuffle: boolean,
): LearningUnit[] {
  const questionIds = [
    ...getActiveStructureQuestions(bank),
    ...getActiveWrittenExpressionQuestions(bank),
    ...getActiveReadingPassages(bank).flatMap((passage) => passage.questions.filter((question) => question.active)),
    ...getActiveListeningQuestions(bank),
  ]
    .filter((question) => matchesFocusedPractice(question, target))
    .map((question) => question.id);
  const units = createUnitsFromQuestionIds(bank, questionIds, { expandSharedListeningSets: false });
  return takeFocusedUnitsWithinQuestionLimit(shouldShuffle ? shuffle(units) : units, target.questionLimit);
}

function createUnitsFromQuestionIds(
  bank: MasterQuestionBank,
  questionIds: string[],
  options: { expandSharedListeningSets?: boolean } = {},
): LearningUnit[] {
  const idSet = new Set(questionIds);
  const units: LearningUnit[] = [];

  for (const question of getActiveStructureQuestions(bank)) {
    if (idSet.has(question.id)) {
      units.push({ unitType: "single-question", id: question.id, question });
    }
  }

  for (const question of getActiveWrittenExpressionQuestions(bank)) {
    if (idSet.has(question.id)) {
      units.push({ unitType: "single-question", id: question.id, question });
    }
  }

  for (const passage of getActiveReadingPassages(bank)) {
    const questions = passage.questions.filter((question) => question.active && idSet.has(question.id));
    if (questions.length) {
      units.push({
        unitType: "reading-passage",
        id: passage.id,
        passage: { ...passage, questions },
      });
    }
  }

  for (const listeningSet of getActiveListeningSets(bank)) {
    const questions = selectListeningQuestionsForIds(listeningSet, idSet, options.expandSharedListeningSets ?? true);
    if (questions.length) {
      units.push({
        unitType: "listening-set",
        id: listeningSet.id,
        listeningSet: cloneListeningSetForSession(listeningSet, questions),
      });
    }
  }

  return units;
}

function restoreUnitsFromRefs(bank: MasterQuestionBank, refs: StoredUnitRef[]): LearningUnit[] {
  const structureById = new Map(getActiveStructureQuestions(bank).map((question) => [question.id, question]));
  const writtenById = new Map(getActiveWrittenExpressionQuestions(bank).map((question) => [question.id, question]));
  const passageById = new Map(getActiveReadingPassages(bank).map((passage) => [passage.id, passage]));
  const units: LearningUnit[] = [];

  for (const ref of refs) {
    if (ref.unitType === "single-question") {
      const question = structureById.get(ref.id) ?? writtenById.get(ref.id);
      if (question) units.push({ unitType: "single-question", id: question.id, question });
      continue;
    }

    const passage = passageById.get(ref.id);
    if (!passage && ref.unitType === "listening-set") {
      const listeningSet = getActiveListeningSetById(ref.id, bank);
      if (!listeningSet) continue;
      const idSet = new Set(ref.questionIds);
      const questions = listeningSet.questions.filter((question) => idSet.has(question.id));
      if (questions.length) {
        units.push({
          unitType: "listening-set",
          id: listeningSet.id,
          listeningSet: cloneListeningSetForSession(listeningSet, questions),
        });
      }
      continue;
    }
    if (!passage) continue;

    const idSet = new Set(ref.questionIds);
    const questions = passage.questions.filter((question) => idSet.has(question.id));
    if (questions.length) {
      units.push({ unitType: "reading-passage", id: passage.id, passage: { ...passage, questions } });
    }
  }

  return units;
}

function cloneListeningSetForSession(
  listeningSet: ListeningSet,
  selectedQuestions: ListeningQuestion[] = listeningSet.questions.filter((question) => question.active),
): ListeningSet {
  return {
    ...listeningSet,
    questions: selectedQuestions,
  };
}

function selectListeningQuestionsForIds(
  listeningSet: ListeningSet,
  idSet: Set<string>,
  expandSharedListeningSets: boolean,
): ListeningQuestion[] {
  const activeQuestions = listeningSet.questions.filter((question) => question.active);
  const selectedQuestions = activeQuestions.filter((question) => idSet.has(question.id));
  if (!selectedQuestions.length) return [];
  return listeningSet.part === "A" || !expandSharedListeningSets ? selectedQuestions : activeQuestions;
}

function takeActive<T>(items: T[], count: number, shouldShuffle: boolean): T[] {
  if (count <= 0) return [];
  const available = shouldShuffle ? shuffle(items) : [...items];
  return available.slice(0, Math.min(count, available.length));
}

function takeUnitsWithinQuestionLimit(units: LearningUnit[], maxQuestions: number): LearningUnit[] {
  const selected: LearningUnit[] = [];
  let totalQuestions = 0;

  for (const unit of units) {
    const unitQuestionCount = countQuestionsInUnit(unit);
    if (unitQuestionCount <= 0) continue;
    if (totalQuestions + unitQuestionCount > maxQuestions) continue;
    selected.push(unit);
    totalQuestions += unitQuestionCount;
    if (totalQuestions >= maxQuestions) break;
  }

  return selected;
}

function takeFocusedUnitsWithinQuestionLimit(units: LearningUnit[], maxQuestions: number): LearningUnit[] {
  const selected: LearningUnit[] = [];
  let remaining = maxQuestions;

  for (const unit of units) {
    if (remaining <= 0) break;
    if (unit.unitType === "single-question") {
      if (unit.question.active) {
        selected.push(unit);
        remaining -= 1;
      }
      continue;
    }

    if (unit.unitType === "listening-set") {
      const questions = unit.listeningSet.questions.filter((question) => question.active).slice(0, remaining);
      if (questions.length) {
        selected.push({
          ...unit,
          listeningSet: cloneListeningSetForSession(unit.listeningSet, questions),
        });
        remaining -= questions.length;
      }
      continue;
    }

    const questions = unit.passage.questions.filter((question) => question.active).slice(0, remaining);
    if (questions.length) {
      selected.push({
        ...unit,
        passage: { ...unit.passage, questions },
      });
      remaining -= questions.length;
    }
  }

  return selected;
}

function countQuestionsInUnit(unit: LearningUnit): number {
  if (unit.unitType === "single-question") return unit.question.active ? 1 : 0;
  if (unit.unitType === "listening-set") return unit.listeningSet.questions.filter((question) => question.active).length;
  return unit.passage.questions.filter((question) => question.active).length;
}

function bucketize(
  refs: QuestionRef[],
  answers: Record<string, AnswerRecord>,
  keyGetter: (ref: QuestionRef) => string,
  labelGetter: (key: string) => string,
  category: DiagnosticArea["category"],
): DiagnosticArea[] {
  const buckets = new Map<string, { totalQuestions: number; attempted: number; correct: number; doubtful: number }>();

  for (const ref of refs) {
    const key = keyGetter(ref);
    const current = buckets.get(key) ?? { totalQuestions: 0, attempted: 0, correct: 0, doubtful: 0 };
    const answer = answers[ref.question.id];
    current.totalQuestions += 1;
    if (answer?.selectedAnswer) current.attempted += 1;
    if (answer?.isCorrect) current.correct += 1;
    if (answer?.isDoubtful) current.doubtful += 1;
    buckets.set(key, current);
  }

  return [...buckets.entries()]
    .map(([key, value]) => ({
      key,
      label: labelGetter(key),
        attempted: value.attempted,
        correct: value.correct,
        totalQuestions: value.totalQuestions,
        incorrect: value.attempted - value.correct,
        unanswered: value.totalQuestions - value.attempted,
        doubtful: value.doubtful,
        accuracy: value.attempted ? Math.round((value.correct / value.attempted) * 100) : 0,
        completionRate: value.totalQuestions ? Math.round((value.attempted / value.totalQuestions) * 100) : 0,
        category,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function sectionKey(ref: QuestionRef): string {
  return ref.question.section;
}

function isSingleQuestionSection(section: QuestionSection): section is "structure" | "written-expression" {
  return section === "structure" || section === "written-expression";
}

function grammarKey(ref: QuestionRef): string {
  return getSingleQuestionPattern(ref.question as SingleQuestion);
}

function grammarLabel(key: string): string {
  return key;
}

function readingSkillKey(ref: QuestionRef): string {
  const question = ref.question as ReadingQuestion;
  return question.readingSkill || question.questionType || "Reading Skill Umum";
}

function readingSkillLabel(key: string): string {
  return key;
}

function listeningSkillKey(ref: QuestionRef): string {
  const question = ref.question as ListeningQuestion;
  return question.listeningSkill || `Listening Part ${question.listeningPart}`;
}

function listeningSkillLabel(key: string): string {
  return key;
}

function getSingleQuestionPattern(question: SingleQuestion): string {
  return question.grammarPattern || question.tags?.[0] || "Grammar Umum";
}

function displaySectionForQuestion(section: QuestionSection): QuestionRef["displaySection"] {
  if (section === "listening") return "listening";
  if (section === "reading") return "reading";
  return "structure-written";
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
