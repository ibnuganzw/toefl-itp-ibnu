import type { LearningUnit, ListeningPart, ListeningSet, MasterQuestionBank, ReadingPassage } from "../types/questionTypes";
import { shuffle } from "./shuffle";

export type FixedPackageQuestionCount = 25 | 50 | 100;

export const FIXED_PACKAGE_QUESTION_COUNTS: FixedPackageQuestionCount[] = [25, 50, 100];

export const READING_SLOT_BLUEPRINTS: Record<FixedPackageQuestionCount, number[]> = {
  25: [9, 8, 8],
  50: [9, 9, 8, 8, 8, 8],
  100: [9, 9, 8, 8, 8, 8, 9, 9, 8, 8, 8, 8],
};

interface ListeningBlockPattern {
  partA: number;
  partB: number[];
  partC: number[];
}

const LISTENING_25_PATTERN: ListeningBlockPattern = {
  partA: 16,
  partB: [4],
  partC: [5],
};

export const LISTENING_50_PATTERNS: ListeningBlockPattern[] = [
  {
    partA: 30,
    partB: [4, 3],
    partC: [5, 4, 4],
  },
  {
    partA: 30,
    partB: [4, 4],
    partC: [4, 4, 4],
  },
];

export class SessionBlueprintUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionBlueprintUnavailableError";
  }
}

export function isSessionBlueprintUnavailableError(error: unknown): error is SessionBlueprintUnavailableError {
  return error instanceof SessionBlueprintUnavailableError;
}

export function normalizeFixedPackageQuestionCount(value: number): FixedPackageQuestionCount {
  if (FIXED_PACKAGE_QUESTION_COUNTS.includes(value as FixedPackageQuestionCount)) {
    return value as FixedPackageQuestionCount;
  }
  throw new SessionBlueprintUnavailableError("Paket latihan hanya tersedia dalam jumlah 25, 50, atau 100 soal.");
}

export function createReadingPackageUnits(
  bank: MasterQuestionBank,
  questionCount: FixedPackageQuestionCount,
  options: { shuffleQuestionsWithinPassage?: boolean } = {},
): LearningUnit[] {
  const slots = READING_SLOT_BLUEPRINTS[questionCount];
  const passagesBySize = new Map<number, ReadingPassage[]>();

  for (const passage of bank.readingPassages.filter((item) => item.active)) {
    const activeQuestions = passage.questions.filter((question) => question.active);
    const bucket = passagesBySize.get(activeQuestions.length) ?? [];
    bucket.push(passage);
    passagesBySize.set(activeQuestions.length, bucket);
  }

  const requiredBySize = countSlotSizes(slots);
  const fixedBlueprintAvailable = [...requiredBySize].every(
    ([size, required]) => (passagesBySize.get(size)?.length ?? 0) >= required,
  );

  if (!fixedBlueprintAvailable) {
    return createCompatibleReadingPackageUnits(bank, questionCount, options);
  }

  const shuffledBuckets = new Map(
    [...passagesBySize.entries()].map(([size, passages]) => [size, shuffle(passages)]),
  );

  return slots.map((size) => {
    const passage = shuffledBuckets.get(size)?.shift();
    if (!passage) {
      throw new SessionBlueprintUnavailableError(`Passage Reading untuk slot ${size} soal tidak tersedia.`);
    }
    const activeQuestions = passage.questions.filter((question) => question.active);
    return {
      unitType: "reading-passage" as const,
      id: passage.id,
      passage: {
        ...passage,
        questions: options.shuffleQuestionsWithinPassage ? shuffle(activeQuestions) : activeQuestions,
      },
    };
  });
}

function createCompatibleReadingPackageUnits(
  bank: MasterQuestionBank,
  questionCount: FixedPackageQuestionCount,
  options: { shuffleQuestionsWithinPassage?: boolean },
): LearningUnit[] {
  const passages = shuffle(bank.readingPassages.filter((passage) => passage.active));
  const units: LearningUnit[] = [];
  let remaining = questionCount;

  for (const passage of passages) {
    if (remaining <= 0) break;
    const activeQuestions = passage.questions.filter((question) => question.active);
    const orderedQuestions = options.shuffleQuestionsWithinPassage ? shuffle(activeQuestions) : activeQuestions;
    const selectedQuestions = orderedQuestions.slice(0, remaining);
    if (!selectedQuestions.length) continue;

    units.push({
      unitType: "reading-passage",
      id: passage.id,
      passage: {
        ...passage,
        questions: selectedQuestions,
      },
    });
    remaining -= selectedQuestions.length;
  }

  if (remaining > 0) {
    throw new SessionBlueprintUnavailableError(
      `Paket Reading ${questionCount} soal membutuhkan ${questionCount} soal aktif yang tetap terhubung dengan passage asalnya. Bank aktif masih kekurangan ${remaining} soal.`,
    );
  }

  return units;
}

export function createListeningPackageUnits(
  bank: MasterQuestionBank,
  questionCount: FixedPackageQuestionCount,
): LearningUnit[] {
  const sequences = listeningPatternSequences(questionCount);

  for (const sequence of shuffle(sequences)) {
    const selected = selectListeningSequence(bank, sequence);
    if (selected) return selected;
  }

  const activeSets = bank.listeningSets.filter((set) => set.active);
  const partACount = activeSets
    .filter((set) => set.part === "A")
    .reduce((sum, set) => sum + activeQuestionCount(set), 0);
  const partBSizes = summarizeSetSizes(activeSets, "B");
  const partCSizes = summarizeSetSizes(activeSets, "C");
  throw new SessionBlueprintUnavailableError(
    `Paket Listening ${questionCount} soal belum dapat dibentuk dari bank aktif. Tersedia Part A ${partACount} soal, paket Part B ${partBSizes}, dan paket Part C ${partCSizes}.`,
  );
}

function listeningPatternSequences(questionCount: FixedPackageQuestionCount): ListeningBlockPattern[][] {
  if (questionCount === 25) return [[LISTENING_25_PATTERN]];
  if (questionCount === 50) return LISTENING_50_PATTERNS.map((pattern) => [pattern]);
  return LISTENING_50_PATTERNS.flatMap((first) =>
    LISTENING_50_PATTERNS.map((second) => [first, second]),
  );
}

function selectListeningSequence(
  bank: MasterQuestionBank,
  sequence: ListeningBlockPattern[],
): LearningUnit[] | null {
  const availableByPart = new Map<ListeningPart, ListeningSet[]>(
    (["A", "B", "C"] as ListeningPart[]).map((part) => [
      part,
      shuffle(bank.listeningSets.filter((set) => set.active && set.part === part)),
    ]),
  );
  const selected: ListeningSet[] = [];

  for (const block of sequence) {
    const partA = takeSetsForSlots(availableByPart.get("A") ?? [], Array.from({ length: block.partA }, () => 1));
    const partB = takeSetsForSlots(availableByPart.get("B") ?? [], block.partB);
    const partC = takeSetsForSlots(availableByPart.get("C") ?? [], block.partC);
    if (!partA || !partB || !partC) return null;
    selected.push(...partA, ...partB, ...partC);
  }

  return selected.map((listeningSet) => ({
    unitType: "listening-set" as const,
    id: listeningSet.id,
    listeningSet: {
      ...listeningSet,
      questions: listeningSet.questions.filter((question) => question.active),
    },
  }));
}

function takeSetsForSlots(available: ListeningSet[], slots: number[]): ListeningSet[] | null {
  const selected: ListeningSet[] = [];
  for (const slotSize of slots) {
    const index = available.findIndex((set) => activeQuestionCount(set) === slotSize);
    if (index < 0) return null;
    selected.push(available[index]);
    available.splice(index, 1);
  }
  return selected;
}

function activeQuestionCount(set: ListeningSet): number {
  return set.questions.filter((question) => question.active).length;
}

function countSlotSizes(slots: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const size of slots) counts.set(size, (counts.get(size) ?? 0) + 1);
  return counts;
}

function summarizeSetSizes(sets: ListeningSet[], part: ListeningPart): string {
  const sizes = sets.filter((set) => set.part === part).map(activeQuestionCount);
  return sizes.length ? sizes.join(", ") : "belum ada";
}
