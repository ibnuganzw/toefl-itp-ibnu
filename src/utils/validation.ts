import type {
  AnswerOptionKey,
  BankQuestion,
  ListeningPart,
  ListeningSet,
  MasterQuestionBank,
  ReadingPassage,
  ValidationIssue,
  ValidationReport,
  ValidationSummary,
} from "../types/questionTypes";

const ANSWER_KEYS: AnswerOptionKey[] = ["A", "B", "C", "D"];
const LISTENING_PARTS: ListeningPart[] = ["A", "B", "C"];
const LISTENING_SOURCE_BY_PART: Record<ListeningPart, ListeningSet["sourceType"]> = {
  A: "short-conversation",
  B: "longer-conversation",
  C: "short-talk",
};

const INITIAL_TARGETS = {
  structureWritten: 180,
  readingQuestions: 120,
  readingPassages: 15,
  totalQuestions: 300,
};

export function validateQuestionBank(
  bank: MasterQuestionBank,
  options: { strictInitialTarget?: boolean } = {},
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const activeStructure = bank.structureQuestions.filter((question) => question.active);
  const activeWritten = bank.writtenExpressionQuestions.filter((question) => question.active);
  const activeReadingPassages = bank.readingPassages.filter((passage) => passage.active);
  const activeReadingQuestions = activeReadingPassages.flatMap((passage) =>
    Array.isArray(passage.questions) ? passage.questions.filter((question) => question.active) : [],
  );
  const activeListeningSets = bank.listeningSets.filter((set) => set.active);
  const activeListeningQuestions = activeListeningSets.flatMap((set) =>
    Array.isArray(set.questions) ? set.questions.filter((question) => question.active) : [],
  );
  const allQuestions: BankQuestion[] = [
    ...activeStructure,
    ...activeWritten,
    ...activeReadingQuestions,
    ...activeListeningQuestions,
  ];

  const duplicateQuestionIds = findDuplicates(allQuestions.map((question) => question.id).filter(Boolean));
  const duplicatePassageIds = findDuplicates(activeReadingPassages.map((passage) => passage.id).filter(Boolean));
  const duplicateListeningSetIds = findDuplicates(activeListeningSets.map((set) => set.id).filter(Boolean));
  for (const questionId of duplicateQuestionIds) {
    issues.push({
      severity: "error",
      code: "duplicate-question-id",
      message: `Duplicate question ID: ${questionId}`,
      questionId,
    });
  }
  for (const passageId of duplicatePassageIds) {
    issues.push({
      severity: "error",
      code: "duplicate-passage-id",
      message: `Duplicate Reading passage ID: ${passageId}`,
      passageId,
    });
  }
  for (const listeningSetId of duplicateListeningSetIds) {
    issues.push({
      severity: "error",
      code: "duplicate-listening-set-id",
      message: `Duplicate Listening set ID: ${listeningSetId}`,
      listeningSetId,
    });
  }

  for (const question of activeStructure) {
    validateCommonQuestionFields(question, issues);
    validatePremiumStructureWrittenQuestion(question, issues);
    validateExpectedSection(question, "structure", issues);
  }

  for (const question of activeWritten) {
    validateCommonQuestionFields(question, issues);
    validatePremiumStructureWrittenQuestion(question, issues);
    validateExpectedSection(question, "written-expression", issues);
  }

  for (const question of activeReadingQuestions) {
    validateCommonQuestionFields(question, issues);
    validateExpectedSection(question, "reading", issues);
  }

  for (const question of activeListeningQuestions) {
    validateCommonQuestionFields(question, issues);
    validateExpectedSection(question, "listening", issues);
  }

  validateReadingPassages(activeReadingPassages, issues);
  validateListeningSets(activeListeningSets, issues);

  const invalidAnswerQuestionIds = issues
    .filter((issue) => issue.code === "invalid-answer")
    .map((issue) => issue.questionId)
    .filter((value): value is string => Boolean(value));

  const missingExplanationQuestionIds = issues
    .filter((issue) => issue.code === "missing-explanation")
    .map((issue) => issue.questionId)
    .filter((value): value is string => Boolean(value));

  const readingIntegrityOk = !issues.some((issue) => issue.code.startsWith("reading-"));
  const listeningIntegrityOk = !issues.some(
    (issue) => issue.severity === "error" && issue.code.startsWith("listening-"),
  );

  const summary: ValidationSummary = {
    structureCount: activeStructure.length,
    writtenCount: activeWritten.length,
    structureWrittenCount: activeStructure.length + activeWritten.length,
    readingPassageCount: activeReadingPassages.length,
    readingQuestionCount: activeReadingQuestions.length,
    listeningSetCount: activeListeningSets.length,
    listeningQuestionCount: activeListeningQuestions.length,
    listeningPartCounts: countListeningQuestionsByPart(activeListeningSets),
    totalActiveQuestions:
      activeStructure.length + activeWritten.length + activeReadingQuestions.length + activeListeningQuestions.length,
    duplicateQuestionIds,
    duplicatePassageIds,
    duplicateListeningSetIds,
    invalidAnswerQuestionIds,
    missingExplanationQuestionIds,
    readingIntegrityOk,
    listeningIntegrityOk,
  };

  const strictTargetOk = validateStrictInitialTargets(summary, issues, Boolean(options.strictInitialTarget));
  const blockingIssues = issues.filter((issue) => issue.severity === "error");

  return {
    ok: blockingIssues.length === 0,
    strictTargetOk,
    generatedAt: new Date().toISOString(),
    mode: options.strictInitialTarget ? "strict-initial" : "normal",
    summary,
    issues,
  };
}

function validateCommonQuestionFields(question: BankQuestion, issues: ValidationIssue[]) {
  if (!question.id) {
    issues.push({
      severity: "error",
      code: "missing-question-id",
      message: "Active question is missing an ID.",
    });
  }

  const missingChoices = ANSWER_KEYS.filter((key) => !question.choices?.[key]?.trim());
  if (missingChoices.length > 0) {
    issues.push({
      severity: "error",
      code: "missing-choice",
      message: `Question ${question.id || "(missing ID)"} is missing choices: ${missingChoices.join(", ")}`,
      questionId: question.id,
    });
  }

  if (!ANSWER_KEYS.includes(question.correctAnswer)) {
    issues.push({
      severity: "error",
      code: "invalid-answer",
      message: `Question ${question.id || "(missing ID)"} has invalid answer key: ${question.correctAnswer}`,
      questionId: question.id,
    });
  }

  if (!question.explanation?.summary?.trim() || !question.explanation?.whyCorrect?.trim()) {
    issues.push({
      severity: "error",
      code: "missing-explanation",
      message: `Question ${question.id || "(missing ID)"} is missing required explanation fields.`,
      questionId: question.id,
    });
  }
}

function validatePremiumStructureWrittenQuestion(question: BankQuestion, issues: ValidationIssue[]) {
  const missingOptionAnalysis = ANSWER_KEYS.filter((key) => !question.explanation?.optionAnalysis?.[key]?.trim());
  if (!question.explanation?.reasoning?.trim() || missingOptionAnalysis.length > 0) {
    issues.push({
      severity: "error",
      code: "missing-premium-sw-explanation",
      message: `Question ${question.id || "(missing ID)"} is missing premium Structure/Written reasoning or option analysis.`,
      questionId: question.id,
    });
  }

  if (
    question.section === "written-expression" &&
    (!question.incorrectPart?.trim() || !question.correction?.trim() || !question.correctedSentence?.trim())
  ) {
    issues.push({
      severity: "error",
      code: "missing-written-correction",
      message: `Written question ${question.id || "(missing ID)"} is missing its structured correction summary.`,
      questionId: question.id,
    });
  }
}

function validateExpectedSection(
  question: BankQuestion,
  expectedSection: BankQuestion["section"],
  issues: ValidationIssue[],
) {
  if (question.section !== expectedSection) {
    issues.push({
      severity: "error",
      code: "invalid-section",
      message: `Question ${question.id || "(missing ID)"} is in the ${expectedSection} collection but has section ${question.section}.`,
      questionId: question.id,
    });
  }
}

function validateReadingPassages(passages: ReadingPassage[], issues: ValidationIssue[]) {
  const questionToPassage = new Map<string, string>();

  for (const passage of passages) {
    if (!passage.id) {
      issues.push({
        severity: "error",
        code: "reading-passage-missing-id",
        message: "Active Reading passage is missing an ID.",
      });
    }

    if (!passage.passage?.trim()) {
      issues.push({
        severity: "error",
        code: "reading-passage-missing-text",
        message: `Reading passage ${passage.id || "(missing ID)"} is missing passage text.`,
        passageId: passage.id,
      });
    }

    if (!Array.isArray(passage.questions)) {
      issues.push({
        severity: "error",
        code: "reading-passage-invalid-questions",
        message: `Reading passage ${passage.id || "(missing ID)"} must have a questions array.`,
        passageId: passage.id,
      });
      continue;
    }

    const activeQuestions = passage.questions.filter((question) => question.active);
    if (![8, 9].includes(activeQuestions.length)) {
      issues.push({
        severity: "error",
        code: "reading-passage-question-count",
        message: `Reading passage ${passage.id || "(missing ID)"} has ${activeQuestions.length} active questions; expected 8 or 9.`,
        passageId: passage.id,
      });
    }

    for (const question of activeQuestions) {
      if (question.passageId !== passage.id) {
        issues.push({
          severity: "error",
          code: "reading-question-passage-mismatch",
          message: `Reading question ${question.id || "(missing ID)"} references ${question.passageId}, but is nested under ${passage.id}.`,
          questionId: question.id,
          passageId: passage.id,
        });
      }

      const previousPassageId = questionToPassage.get(question.id);
      if (previousPassageId && previousPassageId !== passage.id) {
        issues.push({
          severity: "error",
          code: "reading-question-multiple-passages",
          message: `Reading question ${question.id} appears in both ${previousPassageId} and ${passage.id}.`,
          questionId: question.id,
          passageId: passage.id,
        });
      }
      questionToPassage.set(question.id, passage.id);
    }
  }
}

function validateListeningSets(listeningSets: ListeningSet[], issues: ValidationIssue[]) {
  const questionToSet = new Map<string, string>();

  for (const listeningSet of listeningSets) {
    if (!listeningSet.id) {
      issues.push({
        severity: "error",
        code: "listening-set-missing-id",
        message: "Active Listening set is missing an ID.",
      });
    }

    if (!LISTENING_PARTS.includes(listeningSet.part)) {
      issues.push({
        severity: "error",
        code: "listening-set-invalid-part",
        message: `Listening set ${listeningSet.id || "(missing ID)"} has invalid part: ${listeningSet.part}.`,
        listeningSetId: listeningSet.id,
      });
    }

    if (listeningSet.sourceType !== LISTENING_SOURCE_BY_PART[listeningSet.part]) {
      issues.push({
        severity: "error",
        code: "listening-source-type-mismatch",
        message: `Listening set ${listeningSet.id || "(missing ID)"} is ${listeningSet.part} but has source type ${listeningSet.sourceType}.`,
        listeningSetId: listeningSet.id,
      });
    }

    if (!Number.isFinite(listeningSet.sequence) || listeningSet.sequence < 1) {
      issues.push({
        severity: "error",
        code: "listening-set-invalid-sequence",
        message: `Listening set ${listeningSet.id || "(missing ID)"} must have a positive sequence number.`,
        listeningSetId: listeningSet.id,
      });
    }

    if (!listeningSet.audioSrc?.trim() && !listeningSet.audioUrl?.trim()) {
      issues.push({
        severity: "error",
        code: "listening-set-missing-audio",
        message: `Listening set ${listeningSet.id || "(missing ID)"} is missing audio metadata.`,
        listeningSetId: listeningSet.id,
      });
    }
    validateListeningAudioPath(listeningSet.audioSrc, "listening-set-invalid-audio-src", "audioSrc", issues, {
      listeningSetId: listeningSet.id,
    });
    validateListeningAudioPath(listeningSet.audioUrl, "listening-set-invalid-audio-url", "audioUrl", issues, {
      listeningSetId: listeningSet.id,
    });

    if (!Array.isArray(listeningSet.questions)) {
      issues.push({
        severity: "error",
        code: "listening-set-invalid-questions",
        message: `Listening set ${listeningSet.id || "(missing ID)"} must have a questions array.`,
        listeningSetId: listeningSet.id,
      });
      continue;
    }

    const activeQuestions = listeningSet.questions.filter((question) => question.active);
    if (!activeQuestions.length) {
      issues.push({
        severity: "error",
        code: "listening-set-empty",
        message: `Listening set ${listeningSet.id || "(missing ID)"} has no active questions.`,
        listeningSetId: listeningSet.id,
      });
    }

    if (listeningSet.part === "A" && activeQuestions.length !== 1) {
      issues.push({
        severity: "error",
        code: "listening-part-a-question-count",
        message: `Part A set ${listeningSet.id || "(missing ID)"} has ${activeQuestions.length} active questions; expected exactly 1.`,
        listeningSetId: listeningSet.id,
      });
    }

    if (listeningSet.part !== "A" && activeQuestions.length === 1) {
      issues.push({
        severity: "warning",
        code: "listening-multi-question-set-incomplete",
        message: `Part ${listeningSet.part} set ${listeningSet.id || "(missing ID)"} has 1 active question; Part B/C packets should normally contain multiple questions.`,
        listeningSetId: listeningSet.id,
      });
    }

    if (listeningSet.part === "B" && ![3, 4].includes(activeQuestions.length)) {
      issues.push({
        severity: "error",
        code: "listening-part-b-question-count",
        message: `Listening Part B set ${listeningSet.id || "(missing ID)"} has ${activeQuestions.length} active questions; expected 3 or 4.`,
        listeningSetId: listeningSet.id,
      });
    }

    if (listeningSet.part === "C" && ![4, 5].includes(activeQuestions.length)) {
      issues.push({
        severity: "error",
        code: "listening-part-c-question-count",
        message: `Listening Part C set ${listeningSet.id || "(missing ID)"} has ${activeQuestions.length} active questions; expected 4 or 5.`,
        listeningSetId: listeningSet.id,
      });
    }

    for (const question of activeQuestions) {
      if (question.listeningSetId !== listeningSet.id) {
        issues.push({
          severity: "error",
          code: "listening-question-set-mismatch",
          message: `Listening question ${question.id || "(missing ID)"} references ${question.listeningSetId}, but is nested under ${listeningSet.id}.`,
          questionId: question.id,
          listeningSetId: listeningSet.id,
        });
      }

      if (question.listeningPart !== listeningSet.part) {
        issues.push({
          severity: "error",
          code: "listening-question-part-mismatch",
          message: `Listening question ${question.id || "(missing ID)"} is tagged Part ${question.listeningPart}, but its set is Part ${listeningSet.part}.`,
          questionId: question.id,
          listeningSetId: listeningSet.id,
        });
      }

      validateListeningAudioPath(
        question.questionAudioUrl,
        "listening-question-invalid-audio-url",
        "questionAudioUrl",
        issues,
        {
          questionId: question.id,
          listeningSetId: listeningSet.id,
        },
      );

      const previousSetId = questionToSet.get(question.id);
      if (previousSetId && previousSetId !== listeningSet.id) {
        issues.push({
          severity: "error",
          code: "listening-question-multiple-sets",
          message: `Listening question ${question.id} appears in both ${previousSetId} and ${listeningSet.id}.`,
          questionId: question.id,
          listeningSetId: listeningSet.id,
        });
      }
      questionToSet.set(question.id, listeningSet.id);
    }
  }
}

function validateListeningAudioPath(
  audioPath: string | undefined,
  code: string,
  fieldLabel: string,
  issues: ValidationIssue[],
  ids: Pick<ValidationIssue, "questionId" | "listeningSetId">,
) {
  if (!audioPath?.trim()) return;
  if (!audioPath.startsWith("/audio/listening/") || !audioPath.endsWith(".mp3")) {
    issues.push({
      severity: "error",
      code,
      message: `Listening ${fieldLabel} must point to /audio/listening/*.mp3: ${audioPath}`,
      ...ids,
    });
  }
}

function countListeningQuestionsByPart(listeningSets: ListeningSet[]): Record<ListeningPart, number> {
  const counts: Record<ListeningPart, number> = { A: 0, B: 0, C: 0 };
  for (const listeningSet of listeningSets) {
    counts[listeningSet.part] += listeningSet.questions.filter((question) => question.active).length;
  }
  return counts;
}

function validateStrictInitialTargets(
  summary: ValidationSummary,
  issues: ValidationIssue[],
  includeIssues: boolean,
) {
  const failures: ValidationIssue[] = [];
  const initialTargetQuestionCount = summary.structureWrittenCount + summary.readingQuestionCount;

  if (summary.structureWrittenCount < INITIAL_TARGETS.structureWritten) {
    failures.push({
      severity: "error",
      code: "strict-structure-written-count",
      message: `Strict target expects ${INITIAL_TARGETS.structureWritten} Structure/Written questions; found ${summary.structureWrittenCount}.`,
    });
  }
  if (summary.readingQuestionCount < INITIAL_TARGETS.readingQuestions) {
    failures.push({
      severity: "error",
      code: "strict-reading-question-count",
      message: `Strict target expects ${INITIAL_TARGETS.readingQuestions} Reading questions; found ${summary.readingQuestionCount}.`,
    });
  }
  if (summary.readingPassageCount < INITIAL_TARGETS.readingPassages) {
    failures.push({
      severity: "error",
      code: "strict-reading-passage-count",
      message: `Strict target expects ${INITIAL_TARGETS.readingPassages} Reading passages; found ${summary.readingPassageCount}.`,
    });
  }
  if (initialTargetQuestionCount < INITIAL_TARGETS.totalQuestions) {
    failures.push({
      severity: "error",
      code: "strict-total-question-count",
      message: `Strict target expects ${INITIAL_TARGETS.totalQuestions} active Structure/Written + Reading questions; found ${initialTargetQuestionCount}.`,
    });
  }

  if (includeIssues) {
    issues.push(...failures);
  }

  return failures.length === 0;
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates].sort();
}
