import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

const root = process.cwd();
const READING_BANK_PATH = path.join(root, "src", "data", "imported", "readingPassages.json");
const IMPORT_REPORT_PATH = path.join(root, "src", "data", "imported", "importReport.json");
const IMPORT_AUDIT_PATH = path.join(root, "docs", "additional-reading-part-2-import-report.json");
const MANAGED_PASSAGE_PREFIX = "reading-part2-";
const ANSWER_KEYS = ["A", "B", "C", "D"];
const dryRun = process.argv.includes("--dry-run");

const sources = [
  {
    key: "reading-8-part-2",
    label: "TOEFL ITP Reading Comprehension 8 Soal Part 2",
    path:
      getArg("--source-8") ||
      "C:\\Users\\ibnuh\\Downloads\\TOEFL ITP Reading Comprehension 8 Soal Part 2.docx",
    expectedPassages: 14,
    questionsPerPassage: 8,
  },
  {
    key: "reading-9-part-2",
    label: "TOEFL ITP Reading Comprehension 9 Soal Part 2",
    path:
      getArg("--source-9") ||
      "C:\\Users\\ibnuh\\Downloads\\TOEFL ITP Reading Comprehension 9 Soal Part 2.docx",
    expectedPassages: 10,
    questionsPerPassage: 9,
  },
];

for (const source of sources) assertFile(source.path);

const parsedSources = await Promise.all(
  sources.map(async (source) => {
    const result = await mammoth.extractRawText({ path: source.path });
    assert(result.messages.length === 0, `${source.label} produced DOCX extraction warnings.`);
    return {
      ...source,
      sha256: sha256(source.path),
      passages: parseReadingSource(result.value, source),
    };
  }),
);

const additionalPassages = parsedSources.flatMap((source) => source.passages);
validateImport(additionalPassages, parsedSources);

const currentBank = readJson(READING_BANK_PATH);
const retainedPassages = currentBank.filter((passage) => !passage.id.startsWith(MANAGED_PASSAGE_PREFIX));
validateNoCollisions(retainedPassages, additionalPassages);
const nextBank = [...retainedPassages, ...additionalPassages];

const auditReport = buildAuditReport(parsedSources, currentBank, nextBank);

if (!dryRun) {
  fs.writeFileSync(READING_BANK_PATH, `${JSON.stringify(nextBank, null, 2)}\n`);
  fs.writeFileSync(IMPORT_AUDIT_PATH, `${JSON.stringify(auditReport, null, 2)}\n`);
  updateImportReport(nextBank, parsedSources);
}

console.log("Additional Reading Part 2 import OK");
console.log(
  JSON.stringify(
    {
      mode: dryRun ? "dry-run" : "written",
      addedPassages: additionalPassages.length,
      addedQuestions: countQuestions(additionalPassages),
      totalPassages: nextBank.length,
      totalQuestions: countQuestions(nextBank),
      sources: parsedSources.map((source) => ({
        key: source.key,
        passages: source.passages.length,
        questions: countQuestions(source.passages),
      })),
    },
    null,
    2,
  ),
);

function parseReadingSource(raw, source) {
  const paragraphs = normalizeRaw(raw)
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const passageStarts = findPassageStarts(paragraphs);

  assert(
    passageStarts.length === source.expectedPassages,
    `${source.label}: expected ${source.expectedPassages} passages; found ${passageStarts.length}.`,
  );

  return passageStarts.map((start, passageIndex) => {
    const end = passageStarts[passageIndex + 1]?.index ?? paragraphs.length;
    const questionsMarkerIndex = paragraphs.indexOf("Soal dan Pembahasan", start.naskahIndex + 1);
    assert(
      questionsMarkerIndex > start.naskahIndex && questionsMarkerIndex < end,
      `${source.label}: could not locate question boundary for "${start.title}".`,
    );

    const questionStarts = paragraphs
      .slice(questionsMarkerIndex + 1, end)
      .map((paragraph, index) => ({
        index: questionsMarkerIndex + 1 + index,
        match: matchQuestionHeading(paragraph),
      }))
      .filter((item) => item.match);

    assert(
      questionStarts.length === source.questionsPerPassage,
      `${source.label}: "${start.title}" has ${questionStarts.length} questions; expected ${source.questionsPerPassage}.`,
    );

    const prefix = questionStarts[0].match[1].replace(/\d+$/, "").toLowerCase();
    const passageId = `${MANAGED_PASSAGE_PREFIX}${prefix}-p1`;
    const questions = questionStarts.map((questionStart, questionIndex) => {
      const nextQuestionIndex = questionStarts[questionIndex + 1]?.index ?? end;
      const questionEnd = findQuestionEnd(paragraphs, questionStart.index + 1, nextQuestionIndex);
      return parseReadingQuestion(
        paragraphs.slice(questionStart.index, questionEnd),
        passageId,
        questionStart.match,
        source.key,
        prefix,
      );
    });

    assert(
      questions.every((question) => question.id.startsWith(questionStarts[0].match[1].replace(/\d+$/, ""))),
      `${source.label}: "${start.title}" contains mixed question prefixes.`,
    );

    return {
      id: passageId,
      sourceId: `${questions[0].id}-${questions.at(-1).id}`,
      title: start.title,
      category: "Reading Comprehension",
      topic: start.topic,
      passage: [
        `Subtopik singkat: ${start.topic}`,
        "Naskah",
        ...paragraphs.slice(start.naskahIndex + 1, questionsMarkerIndex),
        "Soal dan Pembahasan",
      ].join("\n\n"),
      active: true,
      questions,
    };
  });
}

function findPassageStarts(paragraphs) {
  const starts = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const match = paragraphs[index].match(/^Passage\s+(\d+)\s+[-\u2013\u2014]\s+(.+)$/);
    if (!match) continue;

    const inlineTopic = splitInlineLabel(match[2], "Subtopik singkat:");
    const hasInlineTopic = Boolean(inlineTopic.value);
    const topicParagraphIndex = hasInlineTopic ? index : index + 1;
    const naskahIndex = hasInlineTopic ? index + 1 : index + 2;
    const topicParagraph = hasInlineTopic ? `Subtopik singkat: ${inlineTopic.value}` : paragraphs[topicParagraphIndex];

    if (
      paragraphs[naskahIndex] !== "Naskah" ||
      !topicParagraph?.startsWith("Subtopik singkat:")
    ) {
      continue;
    }

    starts.push({
      index,
      naskahIndex,
      title: (hasInlineTopic ? inlineTopic.before : match[2]).trim(),
      topic: topicParagraph.slice("Subtopik singkat:".length).trim(),
    });
  }

  return starts;
}

function parseReadingQuestion(paragraphs, passageId, headingMatch, sourceKey, prefix) {
  const sourceNotes = paragraphs.join("\n\n");
  const id = headingMatch[1];
  const headingType = headingMatch[2].trim();
  const questionArea = extractSection(sourceNotes, "Soal:", "Jawaban benar:");
  const parsedChoices = parseChoices(questionArea, id);
  const answerMatch = sourceNotes.match(/Jawaban benar:\s*([A-D])\.\s*([\s\S]*?)(?=Tipe soal:|$)/);
  assert(answerMatch, `Could not parse answer for Reading ${id}.`);

  const correctAnswer = answerMatch[1];
  const answerText = cleanInline(answerMatch[2]);
  assert(
    answerText === parsedChoices.choices[correctAnswer],
    `Reading ${id} answer text does not match choice ${correctAnswer}.`,
  );

  const questionType = required(
    extractSection(sourceNotes, "Tipe soal:", "Lokasi bukti:"),
    `question type for Reading ${id}`,
  );
  const evidenceLocation = required(
    extractSection(sourceNotes, "Lokasi bukti:", "Bukti kunci / Parafrase bukti:"),
    `evidence location for Reading ${id}`,
  );
  const evidence = required(
    extractSection(sourceNotes, "Bukti kunci / Parafrase bukti:", "Inti pemahaman:"),
    `evidence for Reading ${id}`,
  );
  const summary = required(
    extractSectionByCandidates(sourceNotes, "Inti pemahaman:", [
      "Analisis opsi A\u2013D:",
      "Analisis opsi A-D:",
      "Analisis opsi:",
    ]),
    `summary for Reading ${id}`,
  );
  const analysisLabel = findFirstLabel(sourceNotes, [
    "Analisis opsi A\u2013D:",
    "Analisis opsi A-D:",
    "Analisis opsi:",
  ]);
  const optionAnalysis = parseLabeledOptions(
    extractSection(sourceNotes, analysisLabel, "Jebakan TOEFL:"),
    `option analysis for Reading ${id}`,
  );
  const toeflTrap = required(
    extractSection(sourceNotes, "Jebakan TOEFL:", "Catatan cepat:"),
    `TOEFL trap for Reading ${id}`,
  );
  const quickNote = required(extractTailSection(sourceNotes, "Catatan cepat:"), `quick note for Reading ${id}`);
  const readingSkill = slugify(questionType || headingType);

  return {
    id,
    sourceId: `${sourceKey}:${id}`,
    legacyId: id,
    section: "reading",
    passageId,
    active: true,
    difficulty: "unknown",
    questionType,
    readingSkill,
    evidenceLocation,
    keyEvidence: evidence,
    paraphrasedEvidence: evidence,
    questionText: parsedChoices.questionText,
    choices: parsedChoices.choices,
    correctAnswer,
    explanation: {
      summary,
      whyCorrect: required(optionAnalysis[correctAnswer], `correct option analysis for Reading ${id}`),
      optionAnalysis,
      toeflTrap,
      quickNote,
      sourceNotes,
    },
    tags: [prefix, readingSkill, "additional-reading-part-2"],
  };
}

function parseChoices(questionArea, id) {
  const markers = findOrderedMarkers(questionArea, `choices for Reading ${id}`);
  const questionText = required(cleanInline(questionArea.slice(0, markers[0].index)), `question text for Reading ${id}`);
  const choices = {};

  for (let index = 0; index < ANSWER_KEYS.length; index += 1) {
    const marker = markers[index];
    const nextMarker = markers[index + 1];
    choices[marker.key] = required(
      cleanInline(questionArea.slice(marker.end, nextMarker?.index ?? questionArea.length)),
      `choice ${marker.key} for Reading ${id}`,
    );
  }

  return { questionText, choices };
}

function parseLabeledOptions(value, context) {
  const markers = findOrderedMarkers(value, context);
  const analysis = {};

  for (let index = 0; index < ANSWER_KEYS.length; index += 1) {
    const marker = markers[index];
    const nextMarker = markers[index + 1];
    analysis[marker.key] = required(
      cleanBlock(value.slice(marker.end, nextMarker?.index ?? value.length)),
      `${context} ${marker.key}`,
    );
  }

  return analysis;
}

function findOrderedMarkers(value, context) {
  const markers = [];
  let searchFrom = 0;

  for (const key of ANSWER_KEYS) {
    const matcher = new RegExp(`${key}\\.\\s*`, "g");
    matcher.lastIndex = searchFrom;
    const match = matcher.exec(value);
    assert(match, `Missing ${key} marker in ${context}.`);
    markers.push({ key, index: match.index, end: match.index + match[0].length });
    searchFrom = match.index + match[0].length;
  }

  return markers;
}

function validateImport(passages, parsedSources) {
  const expectedPassages = parsedSources.reduce((sum, source) => sum + source.expectedPassages, 0);
  const expectedQuestions = parsedSources.reduce(
    (sum, source) => sum + source.expectedPassages * source.questionsPerPassage,
    0,
  );

  assert(passages.length === expectedPassages, `Expected ${expectedPassages} passages; found ${passages.length}.`);
  assert(countQuestions(passages) === expectedQuestions, `Expected ${expectedQuestions} questions; found ${countQuestions(passages)}.`);
  assertUnique(passages.map((passage) => passage.id), "passage IDs");

  const questions = passages.flatMap((passage) => passage.questions);
  assertUnique(questions.map((question) => question.id), "question IDs");

  for (const passage of passages) {
    assert(passage.passage && passage.title && passage.topic, `Invalid imported passage ${passage.id}.`);
    assert(
      [8, 9].includes(passage.questions.length),
      `Reading passage ${passage.id} has ${passage.questions.length} questions; expected 8 or 9.`,
    );

    for (const question of passage.questions) {
      assert(question.passageId === passage.id, `Reading question ${question.id} has a passage mismatch.`);
      assert(question.questionText && ANSWER_KEYS.includes(question.correctAnswer), `Invalid imported question ${question.id}.`);
      assert(ANSWER_KEYS.every((key) => question.choices[key]), `Question ${question.id} is missing a choice.`);
      assert(question.explanation.summary && question.explanation.whyCorrect, `Question ${question.id} is missing an explanation.`);
      assert(
        ANSWER_KEYS.every((key) => question.explanation.optionAnalysis[key]),
        `Question ${question.id} is missing option analysis.`,
      );
      assert(question.explanation.sourceNotes, `Question ${question.id} is missing source notes.`);
      assert(
        !/Validasi Distribusi|Rekap distribusi|Catatan validasi/i.test(question.explanation.sourceNotes),
        `Question ${question.id} source notes include document-level validation text.`,
      );
    }
  }
}

function validateNoCollisions(retainedPassages, additionalPassages) {
  const retainedPassageIds = new Set(retainedPassages.map((passage) => passage.id));
  const retainedQuestionIds = new Set(retainedPassages.flatMap((passage) => passage.questions.map((question) => question.id)));

  for (const passage of additionalPassages) {
    assert(!retainedPassageIds.has(passage.id), `Passage ID collision: ${passage.id}.`);
    for (const question of passage.questions) {
      assert(!retainedQuestionIds.has(question.id), `Question ID collision: ${question.id}.`);
    }
  }
}

function buildAuditReport(parsedSources, currentBank, nextBank) {
  return {
    generatedAt: new Date().toISOString(),
    status: "complete",
    sources: parsedSources.map((source) => ({
      label: source.label,
      path: source.path,
      sha256: source.sha256,
      parsedSafely: true,
      passageCount: source.passages.length,
      questionCount: countQuestions(source.passages),
      passages: source.passages.map((passage) => ({
        id: passage.id,
        sourceId: passage.sourceId,
        title: passage.title,
        questionCount: passage.questions.length,
      })),
    })),
    before: {
      passageCount: currentBank.length,
      questionCount: countQuestions(currentBank),
    },
    imported: {
      passageCount: parsedSources.reduce((sum, source) => sum + source.passages.length, 0),
      questionCount: parsedSources.reduce((sum, source) => sum + countQuestions(source.passages), 0),
    },
    after: {
      passageCount: nextBank.length,
      questionCount: countQuestions(nextBank),
    },
    notes: [
      "Question content and premium explanations were extracted from the supplied DOCX source files.",
      "Reading questions remain nested under their original passages.",
      "The importer verifies counts, answer text, option analysis, IDs, and passage relationships before writing.",
    ],
  };
}

function updateImportReport(nextBank, parsedSources) {
  const report = readJson(IMPORT_REPORT_PATH);
  const sourceKeys = new Set(parsedSources.map((source) => source.path.toLowerCase()));
  const retainedSources = report.sources.filter((source) => !sourceKeys.has(source.path?.toLowerCase()));
  const sourceEntries = parsedSources.map((source) => ({
    label: source.label,
    path: source.path,
    role: "reading-source",
    parsedSafely: true,
    detectedCount: countQuestions(source.passages),
    notes: [
      `Imported ${source.passages.length} passages with ${source.questionsPerPassage} questions each.`,
      "Reading questions remain nested under their original passages.",
      `Source SHA-256: ${source.sha256}`,
    ],
  }));

  report.generatedAt = new Date().toISOString();
  report.status = "complete";
  report.sources = [...retainedSources, ...sourceEntries];
  report.importedReadingPassageCount = nextBank.filter((passage) => passage.active).length;
  report.importedReadingQuestionCount = countQuestions(nextBank);
  report.uncertainItems = report.uncertainItems || [];
  report.rejectedItems = report.rejectedItems || [];
  report.notes = [
    ...(report.notes || []).filter((note) => note !== "Additional Reading Part 2 imports are repeatable through npm run import:additional-reading-part-2."),
    "Additional Reading Part 2 imports are repeatable through npm run import:additional-reading-part-2.",
  ];

  fs.writeFileSync(IMPORT_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

function findQuestionEnd(paragraphs, start, fallbackEnd) {
  for (let index = start; index < fallbackEnd; index += 1) {
    if (/^(?:Validasi Distribusi|Rekap Distribusi|Rekap distribusi|Catatan validasi)/i.test(paragraphs[index])) {
      return index;
    }
  }
  return fallbackEnd;
}

function matchQuestionHeading(value) {
  return value.match(/^([A-Z]+Q\d+)\s*[-\u2013\u2014]\s*(.+?)(?=Soal:|$)/);
}

function splitInlineLabel(value, label) {
  const index = value.indexOf(label);
  if (index < 0) return { before: value, value: "" };
  return {
    before: value.slice(0, index),
    value: value.slice(index + label.length).trim(),
  };
}

function extractSection(text, startLabel, endLabel) {
  const start = text.indexOf(startLabel);
  if (start < 0) return "";
  const contentStart = start + startLabel.length;
  const end = text.indexOf(endLabel, contentStart);
  return cleanBlock(text.slice(contentStart, end < 0 ? text.length : end));
}

function extractSectionByCandidates(text, startLabel, endLabels) {
  return extractSection(text, startLabel, findFirstLabel(text, endLabels));
}

function extractTailSection(text, label) {
  const start = text.indexOf(label);
  return start < 0 ? "" : cleanBlock(text.slice(start + label.length));
}

function findFirstLabel(text, labels) {
  const found = labels
    .map((label) => ({ label, index: text.indexOf(label) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)[0];
  return found?.label || "";
}

function normalizeRaw(value) {
  return value.replace(/\r/g, "").replace(/\u00a0/g, " ").trim();
}

function cleanBlock(value) {
  return value
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

function cleanInline(value) {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function countQuestions(passages) {
  return passages.reduce((sum, passage) => sum + passage.questions.filter((question) => question.active).length, 0);
}

function assertUnique(values, label) {
  assert(new Set(values).size === values.length, `Imported ${label} must be unique.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function assertFile(filePath) {
  assert(fs.existsSync(filePath) && fs.statSync(filePath).isFile(), `Source file not found: ${filePath}`);
}

function required(value, label) {
  const normalized = typeof value === "string" ? value.trim() : value;
  assert(normalized, `Missing ${label}.`);
  return normalized;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
