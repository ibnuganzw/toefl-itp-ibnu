import fs from "node:fs";
import path from "node:path";

const ANSWER_KEYS = ["A", "B", "C", "D"];
const LISTENING_PARTS = ["A", "B", "C"];
const LISTENING_SOURCE_BY_PART = {
  A: "short-conversation",
  B: "longer-conversation",
  C: "short-talk",
};
const STRICT_TARGETS = {
  structureWritten: 180,
  readingQuestions: 120,
  readingPassages: 15,
  totalQuestions: 300,
};

const root = process.cwd();
const strict = process.argv.includes("--strict");

const bank = {
  structureQuestions: readJson("src/data/imported/structureQuestions.json"),
  writtenExpressionQuestions: readJson("src/data/imported/writtenExpressionQuestions.json"),
  readingPassages: readJson("src/data/imported/readingPassages.json"),
  listeningSets: readJson("src/data/imported/listeningSets.json"),
};

const report = validate(bank, { strict });
printReport(report);

const hasErrors = report.issues.some((issue) => issue.severity === "error");
process.exitCode = hasErrors ? 1 : 0;

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validate(currentBank, options) {
  const issues = [];
  const activeStructure = currentBank.structureQuestions.filter((question) => question.active);
  const activeWritten = currentBank.writtenExpressionQuestions.filter((question) => question.active);
  const activeReadingPassages = currentBank.readingPassages.filter((passage) => passage.active);
  const activeReadingQuestions = activeReadingPassages.flatMap((passage) =>
    Array.isArray(passage.questions) ? passage.questions.filter((question) => question.active) : [],
  );
  const activeListeningSets = currentBank.listeningSets.filter((set) => set.active);
  const activeListeningQuestions = activeListeningSets.flatMap((set) =>
    Array.isArray(set.questions) ? set.questions.filter((question) => question.active) : [],
  );
  const allQuestions = [...activeStructure, ...activeWritten, ...activeReadingQuestions, ...activeListeningQuestions];
  const duplicateQuestionIds = findDuplicates(allQuestions.map((question) => question.id).filter(Boolean));
  const duplicatePassageIds = findDuplicates(activeReadingPassages.map((passage) => passage.id).filter(Boolean));
  const duplicateListeningSetIds = findDuplicates(activeListeningSets.map((set) => set.id).filter(Boolean));

  for (const questionId of duplicateQuestionIds) {
    issues.push(error("duplicate-question-id", `Duplicate question ID: ${questionId}`, { questionId }));
  }
  for (const passageId of duplicatePassageIds) {
    issues.push(error("duplicate-passage-id", `Duplicate Reading passage ID: ${passageId}`, { passageId }));
  }
  for (const listeningSetId of duplicateListeningSetIds) {
    issues.push(error("duplicate-listening-set-id", `Duplicate Listening set ID: ${listeningSetId}`, { listeningSetId }));
  }

  for (const question of activeStructure) {
    validateQuestion(question, issues);
    validatePremiumStructureWrittenQuestion(question, issues);
    validateExpectedSection(question, "structure", issues);
  }

  for (const question of activeWritten) {
    validateQuestion(question, issues);
    validatePremiumStructureWrittenQuestion(question, issues);
    validateExpectedSection(question, "written-expression", issues);
    validateWrittenMarkers(question, issues);
  }

  for (const question of activeReadingQuestions) {
    validateQuestion(question, issues);
    validateExpectedSection(question, "reading", issues);
  }

  for (const question of activeListeningQuestions) {
    validateQuestion(question, issues);
    validateExpectedSection(question, "listening", issues);
  }

  validateReading(activeReadingPassages, issues);
  validateListening(activeListeningSets, issues);
  validateWrittenMarkerLeakage(activeWritten, issues);

  const summary = {
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
    invalidAnswerQuestionIds: issueQuestionIds(issues, "invalid-answer"),
    missingExplanationQuestionIds: issueQuestionIds(issues, "missing-explanation"),
    readingIntegrityOk: !issues.some((issue) => issue.code.startsWith("reading-")),
    listeningIntegrityOk: !issues.some(
      (issue) => issue.severity === "error" && issue.code.startsWith("listening-"),
    ),
  };

  const strictIssues = strictTargetIssues(summary);
  if (options.strict) {
    issues.push(...strictIssues);
  }

  return {
    mode: options.strict ? "strict-initial" : "normal",
    ok: !issues.some((issue) => issue.severity === "error"),
    strictTargetOk: strictIssues.length === 0,
    summary,
    issues,
  };
}

function validateQuestion(question, issues) {
  if (!question.id) {
    issues.push(error("missing-question-id", "Active question is missing an ID."));
  }

  const missingChoices = ANSWER_KEYS.filter((key) => !question.choices?.[key]?.trim());
  if (missingChoices.length > 0) {
    issues.push(
      error(
        "missing-choice",
        `Question ${question.id || "(missing ID)"} is missing choices: ${missingChoices.join(", ")}`,
        { questionId: question.id },
      ),
    );
  }

  if (!ANSWER_KEYS.includes(question.correctAnswer)) {
    issues.push(
      error("invalid-answer", `Question ${question.id || "(missing ID)"} has invalid answer key.`, {
        questionId: question.id,
      }),
    );
  }

  if (!question.explanation?.summary?.trim() || !question.explanation?.whyCorrect?.trim()) {
    issues.push(
      error("missing-explanation", `Question ${question.id || "(missing ID)"} is missing explanation fields.`, {
        questionId: question.id,
      }),
    );
  }
}

function validatePremiumStructureWrittenQuestion(question, issues) {
  const missingOptionAnalysis = ANSWER_KEYS.filter((key) => !question.explanation?.optionAnalysis?.[key]?.trim());
  if (!question.explanation?.reasoning?.trim() || missingOptionAnalysis.length) {
    issues.push(
      error(
        "missing-premium-sw-explanation",
        `Question ${question.id || "(missing ID)"} is missing premium Structure/Written reasoning or option analysis.`,
        { questionId: question.id },
      ),
    );
  }

  if (
    question.section === "written-expression" &&
    (!question.incorrectPart?.trim() || !question.correction?.trim() || !question.correctedSentence?.trim())
  ) {
    issues.push(
      error(
        "missing-written-correction",
        `Written question ${question.id || "(missing ID)"} is missing its structured correction summary.`,
        { questionId: question.id },
      ),
    );
  }
}

function validateWrittenMarkers(question, issues) {
  const markers = [...question.questionText.matchAll(/\[([A-D])\]\s*/g)];
  const markerKeys = markers.map((match) => match[1]);

  if (markers.length !== ANSWER_KEYS.length || new Set(markerKeys).size !== ANSWER_KEYS.length) {
    issues.push(
      error(
        "written-invalid-marker-set",
        `Written question ${question.id || "(missing ID)"} must contain exactly one marker for each of A-D.`,
        { questionId: question.id },
      ),
    );
    return;
  }

  for (const marker of markers) {
    const start = (marker.index ?? 0) + marker[0].length;
    if (!question.questionText.startsWith(question.choices[marker[1]], start)) {
      issues.push(
        error(
          "written-marker-choice-mismatch",
          `Written question ${question.id || "(missing ID)"} marker ${marker[1]} does not match its choice segment.`,
          { questionId: question.id },
        ),
      );
    }
  }

  if (
    markerKeys.join("") !== ANSWER_KEYS.join("") &&
    markerKeys[0] === question.correctAnswer &&
    markerKeys.slice(1).join("") === markerKeys.slice(1).sort(answerKeySort).join("")
  ) {
    issues.push(
      error(
        "written-pasted-answer-first-order",
        `Written question ${question.id || "(missing ID)"} exposes the answer as the first marker followed by an alphabetically pasted tail.`,
        { questionId: question.id },
      ),
    );
  }
}

function validateWrittenMarkerLeakage(questions, issues) {
  const mixed = questions.filter((question) => writtenMarkerKeys(question).join("") !== ANSWER_KEYS.join(""));
  if (!mixed.length) return;

  const firstMarkerCorrect = mixed.filter((question) => writtenMarkerKeys(question)[0] === question.correctAnswer).length;
  const firstMarkerNotCorrect = mixed.length - firstMarkerCorrect;
  const firstMarkerCorrectRatio = firstMarkerCorrect / mixed.length;

  if (!firstMarkerCorrect || !firstMarkerNotCorrect) {
    issues.push(
      error(
        "written-mixed-order-answer-leak",
        `Mixed-order Written questions must include both first-marker-correct and first-marker-not-correct examples; found ${firstMarkerCorrect} and ${firstMarkerNotCorrect}.`,
      ),
    );
  }

  if (firstMarkerCorrectRatio < 0.4 || firstMarkerCorrectRatio > 0.6) {
    issues.push(
      error(
        "written-mixed-order-answer-bias",
        `Mixed-order Written questions must keep first-marker correctness between 40% and 60%; found ${firstMarkerCorrect}/${mixed.length}.`,
      ),
    );
  }
}

function writtenMarkerKeys(question) {
  return [...question.questionText.matchAll(/\[([A-D])\]/g)].map((match) => match[1]);
}

function answerKeySort(left, right) {
  return ANSWER_KEYS.indexOf(left) - ANSWER_KEYS.indexOf(right);
}

function validateExpectedSection(question, expectedSection, issues) {
  if (question.section !== expectedSection) {
    issues.push(
      error(
        "invalid-section",
        `Question ${question.id || "(missing ID)"} is in the ${expectedSection} collection but has section ${question.section}.`,
        { questionId: question.id },
      ),
    );
  }
}

function validateReading(passages, issues) {
  const questionToPassage = new Map();

  for (const passage of passages) {
    if (!passage.id) {
      issues.push(error("reading-passage-missing-id", "Active Reading passage is missing an ID."));
    }

    if (!passage.passage?.trim()) {
      issues.push(
        error("reading-passage-missing-text", `Reading passage ${passage.id || "(missing ID)"} is missing text.`, {
          passageId: passage.id,
        }),
      );
    }

    if (!Array.isArray(passage.questions)) {
      issues.push(
        error("reading-passage-invalid-questions", `Reading passage ${passage.id || "(missing ID)"} must have a questions array.`, {
          passageId: passage.id,
        }),
      );
      continue;
    }

    const activeQuestions = passage.questions.filter((question) => question.active);
    if (![8, 9].includes(activeQuestions.length)) {
      issues.push(
        error(
          "reading-passage-question-count",
          `Reading passage ${passage.id || "(missing ID)"} has ${activeQuestions.length} active questions; expected 8 or 9.`,
          { passageId: passage.id },
        ),
      );
    }

    for (const question of activeQuestions) {
      if (question.passageId !== passage.id) {
        issues.push(
          error(
            "reading-question-passage-mismatch",
            `Reading question ${question.id || "(missing ID)"} references ${question.passageId}, but is nested under ${passage.id}.`,
            { questionId: question.id, passageId: passage.id },
          ),
        );
      }

      const previousPassage = questionToPassage.get(question.id);
      if (previousPassage && previousPassage !== passage.id) {
        issues.push(
          error("reading-question-multiple-passages", `Reading question ${question.id} appears in multiple passages.`, {
            questionId: question.id,
            passageId: passage.id,
          }),
        );
      }
      questionToPassage.set(question.id, passage.id);
    }
  }
}

function validateListening(listeningSets, issues) {
  const questionToSet = new Map();

  for (const listeningSet of listeningSets) {
    if (!listeningSet.id) {
      issues.push(error("listening-set-missing-id", "Active Listening set is missing an ID."));
    }

    if (!LISTENING_PARTS.includes(listeningSet.part)) {
      issues.push(
        error(
          "listening-set-invalid-part",
          `Listening set ${listeningSet.id || "(missing ID)"} has invalid part: ${listeningSet.part}.`,
          { listeningSetId: listeningSet.id },
        ),
      );
    }

    if (listeningSet.sourceType !== LISTENING_SOURCE_BY_PART[listeningSet.part]) {
      issues.push(
        error(
          "listening-source-type-mismatch",
          `Listening set ${listeningSet.id || "(missing ID)"} is ${listeningSet.part} but has source type ${listeningSet.sourceType}.`,
          { listeningSetId: listeningSet.id },
        ),
      );
    }

    if (!Number.isFinite(listeningSet.sequence) || listeningSet.sequence < 1) {
      issues.push(
        error(
          "listening-set-invalid-sequence",
          `Listening set ${listeningSet.id || "(missing ID)"} must have a positive sequence number.`,
          { listeningSetId: listeningSet.id },
        ),
      );
    }

    if (!listeningSet.audioSrc?.trim() && !listeningSet.audioUrl?.trim()) {
      issues.push(
        error("listening-set-missing-audio", `Listening set ${listeningSet.id || "(missing ID)"} is missing audio metadata.`, {
          listeningSetId: listeningSet.id,
        }),
      );
    }
    validateListeningAudioPath(listeningSet.audioSrc, "listening-set-invalid-audio-src", "audioSrc", issues, {
      listeningSetId: listeningSet.id,
    });
    validateListeningAudioPath(listeningSet.audioUrl, "listening-set-invalid-audio-url", "audioUrl", issues, {
      listeningSetId: listeningSet.id,
    });

    if (!Array.isArray(listeningSet.questions)) {
      issues.push(
        error("listening-set-invalid-questions", `Listening set ${listeningSet.id || "(missing ID)"} must have a questions array.`, {
          listeningSetId: listeningSet.id,
        }),
      );
      continue;
    }

    const activeQuestions = listeningSet.questions.filter((question) => question.active);
    if (!activeQuestions.length) {
      issues.push(
        error("listening-set-empty", `Listening set ${listeningSet.id || "(missing ID)"} has no active questions.`, {
          listeningSetId: listeningSet.id,
        }),
      );
    }

    if (listeningSet.part === "A" && activeQuestions.length !== 1) {
      issues.push(
        error(
          "listening-part-a-question-count",
          `Part A set ${listeningSet.id || "(missing ID)"} has ${activeQuestions.length} active questions; expected exactly 1.`,
          { listeningSetId: listeningSet.id },
        ),
      );
    }

    if (listeningSet.part !== "A" && activeQuestions.length === 1) {
      issues.push(
        warning(
          "listening-multi-question-set-incomplete",
          `Part ${listeningSet.part} set ${listeningSet.id || "(missing ID)"} has 1 active question; Part B/C packets should normally contain multiple questions.`,
          { listeningSetId: listeningSet.id },
        ),
      );
    }

    if (listeningSet.part === "B" && ![3, 4].includes(activeQuestions.length)) {
      issues.push(
        error(
          "listening-part-b-question-count",
          `Listening Part B set ${listeningSet.id || "(missing ID)"} has ${activeQuestions.length} active questions; expected 3 or 4.`,
          { listeningSetId: listeningSet.id },
        ),
      );
    }

    if (listeningSet.part === "C" && ![4, 5].includes(activeQuestions.length)) {
      issues.push(
        error(
          "listening-part-c-question-count",
          `Listening Part C set ${listeningSet.id || "(missing ID)"} has ${activeQuestions.length} active questions; expected 4 or 5.`,
          { listeningSetId: listeningSet.id },
        ),
      );
    }

    for (const question of activeQuestions) {
      if (question.listeningSetId !== listeningSet.id) {
        issues.push(
          error(
            "listening-question-set-mismatch",
            `Listening question ${question.id || "(missing ID)"} references ${question.listeningSetId}, but is nested under ${listeningSet.id}.`,
            { questionId: question.id, listeningSetId: listeningSet.id },
          ),
        );
      }

      if (question.listeningPart !== listeningSet.part) {
        issues.push(
          error(
            "listening-question-part-mismatch",
            `Listening question ${question.id || "(missing ID)"} is tagged Part ${question.listeningPart}, but its set is Part ${listeningSet.part}.`,
            { questionId: question.id, listeningSetId: listeningSet.id },
          ),
        );
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

      const previousSet = questionToSet.get(question.id);
      if (previousSet && previousSet !== listeningSet.id) {
        issues.push(
          error("listening-question-multiple-sets", `Listening question ${question.id} appears in multiple Listening sets.`, {
            questionId: question.id,
            listeningSetId: listeningSet.id,
          }),
        );
      }
      questionToSet.set(question.id, listeningSet.id);
    }
  }
}

function validateListeningAudioPath(audioPath, code, fieldLabel, issues, extra) {
  if (!audioPath?.trim()) return;
  if (!audioPath.startsWith("/audio/listening/") || !audioPath.endsWith(".mp3")) {
    issues.push(error(code, `Listening ${fieldLabel} must point to /audio/listening/*.mp3: ${audioPath}`, extra));
  }
}

function countListeningQuestionsByPart(listeningSets) {
  const counts = { A: 0, B: 0, C: 0 };
  for (const listeningSet of listeningSets) {
    counts[listeningSet.part] += listeningSet.questions.filter((question) => question.active).length;
  }
  return counts;
}

function strictTargetIssues(summary) {
  const issues = [];
  const initialTargetQuestionCount = summary.structureWrittenCount + summary.readingQuestionCount;
  if (summary.structureWrittenCount < STRICT_TARGETS.structureWritten) {
    issues.push(
      error(
        "strict-structure-written-count",
        `Strict target expects ${STRICT_TARGETS.structureWritten} Structure/Written questions; found ${summary.structureWrittenCount}.`,
      ),
    );
  }
  if (summary.readingQuestionCount < STRICT_TARGETS.readingQuestions) {
    issues.push(
      error(
        "strict-reading-question-count",
        `Strict target expects ${STRICT_TARGETS.readingQuestions} Reading questions; found ${summary.readingQuestionCount}.`,
      ),
    );
  }
  if (summary.readingPassageCount < STRICT_TARGETS.readingPassages) {
    issues.push(
      error(
        "strict-reading-passage-count",
        `Strict target expects ${STRICT_TARGETS.readingPassages} Reading passages; found ${summary.readingPassageCount}.`,
      ),
    );
  }
  if (initialTargetQuestionCount < STRICT_TARGETS.totalQuestions) {
    issues.push(
      error(
        "strict-total-question-count",
        `Strict target expects ${STRICT_TARGETS.totalQuestions} active Structure/Written + Reading questions; found ${initialTargetQuestionCount}.`,
      ),
    );
  }
  return issues;
}

function error(code, message, extra = {}) {
  return { severity: "error", code, message, ...extra };
}

function warning(code, message, extra = {}) {
  return { severity: "warning", code, message, ...extra };
}

function issueQuestionIds(issues, code) {
  return issues.filter((issue) => issue.code === code).map((issue) => issue.questionId).filter(Boolean);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
}

function printReport(report) {
  const { summary } = report;
  console.log(`Bank validation mode: ${report.mode}`);
  console.log(`Structure count: ${summary.structureCount}`);
  console.log(`Written count: ${summary.writtenCount}`);
  console.log(`Structure + Written count: ${summary.structureWrittenCount}`);
  console.log(`Reading passage count: ${summary.readingPassageCount}`);
  console.log(`Reading question count: ${summary.readingQuestionCount}`);
  console.log(`Listening set count: ${summary.listeningSetCount}`);
  console.log(
    `Listening question count: ${summary.listeningQuestionCount} (Part A ${summary.listeningPartCounts.A}, Part B ${summary.listeningPartCounts.B}, Part C ${summary.listeningPartCounts.C})`,
  );
  console.log(`Total active question count: ${summary.totalActiveQuestions}`);
  console.log(`Duplicate ID check: ${summary.duplicateQuestionIds.length === 0 ? "OK" : summary.duplicateQuestionIds.join(", ")}`);
  console.log(`Duplicate passage ID check: ${summary.duplicatePassageIds.length === 0 ? "OK" : summary.duplicatePassageIds.join(", ")}`);
  console.log(
    `Duplicate Listening set ID check: ${
      summary.duplicateListeningSetIds.length === 0 ? "OK" : summary.duplicateListeningSetIds.join(", ")
    }`,
  );
  console.log(`Invalid answer check: ${summary.invalidAnswerQuestionIds.length === 0 ? "OK" : summary.invalidAnswerQuestionIds.join(", ")}`);
  console.log(
    `Missing explanation check: ${summary.missingExplanationQuestionIds.length === 0 ? "OK" : summary.missingExplanationQuestionIds.join(", ")}`,
  );
  console.log(`Reading passage integrity check: ${summary.readingIntegrityOk ? "OK" : "FAILED"}`);
  console.log(`Listening packet integrity check: ${summary.listeningIntegrityOk ? "OK" : "FAILED"}`);
  console.log(`Strict initial target: ${report.strictTargetOk ? "COMPLETE" : "INCOMPLETE"}`);

  if (report.issues.length > 0) {
    console.log("");
    console.log("Issues:");
    for (const issue of report.issues) {
      console.log(`- [${issue.severity}] ${issue.code}: ${issue.message}`);
    }
  }
}
