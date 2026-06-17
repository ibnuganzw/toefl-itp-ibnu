import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mammoth from "mammoth";

const root = process.cwd();
const DEFAULT_LISTENING_SOURCE =
  "C:\\Users\\ibnuh\\Downloads\\Audio Listening 2\\TOEFL ITP Listening Comprehension Part 2 (1).docx";
const DEFAULT_LISTENING_AUDIO_ROOT = "C:\\Users\\ibnuh\\Downloads\\Audio Listening 2";
const DEFAULT_READING_SOURCE =
  "C:\\Users\\ibnuh\\Downloads\\Reading\\Revisi_Final_Reading_Comprehension_TOEFL_Style_Revised_Options_Explanations_clean.docx";
const LISTENING_BANK_PATH = path.join(root, "src", "data", "imported", "listeningSets.json");
const READING_BANK_PATH = path.join(root, "src", "data", "imported", "readingPassages.json");
const LISTENING_AUDIO_DESTINATION = path.join(root, "public", "audio", "listening");
const ANSWER_KEYS = ["A", "B", "C", "D"];
const dryRun = process.argv.includes("--dry-run");

const listeningSource = getArg("--listening-source") || DEFAULT_LISTENING_SOURCE;
const listeningAudioRoot = getArg("--listening-audio-root") || DEFAULT_LISTENING_AUDIO_ROOT;
const readingSource = getArg("--reading-source") || DEFAULT_READING_SOURCE;

assertFile(listeningSource);
assertFile(readingSource);
assertDirectory(listeningAudioRoot);

const [listeningRaw, readingRaw] = await Promise.all([
  extractRawText(listeningSource),
  extractRawText(readingSource),
]);

const additionalListeningSets = parseListening(listeningRaw);
const additionalReadingPassages = parseReading(readingRaw);
const audioCopies = buildAudioCopies(listeningAudioRoot);

validateImport(additionalListeningSets, additionalReadingPassages, audioCopies);

const listeningBank = readJson(LISTENING_BANK_PATH).filter((set) => !set.id.startsWith("listening-2-"));
const readingBank = readJson(READING_BANK_PATH).filter((passage) => !passage.id.startsWith("reading-additional-"));
const nextListeningBank = [...listeningBank, ...additionalListeningSets];
const nextReadingBank = [...readingBank, ...additionalReadingPassages];

if (!dryRun) {
  fs.writeFileSync(LISTENING_BANK_PATH, `${JSON.stringify(nextListeningBank, null, 2)}\n`);
  fs.writeFileSync(READING_BANK_PATH, `${JSON.stringify(nextReadingBank, null, 2)}\n`);
  fs.mkdirSync(LISTENING_AUDIO_DESTINATION, { recursive: true });
  for (const copy of audioCopies) {
    const destination = path.join(LISTENING_AUDIO_DESTINATION, copy.destination);
    fs.copyFileSync(copy.source, destination);
    assert(sha256(copy.source) === sha256(destination), `Copied audio hash mismatch: ${copy.destination}`);
  }
}

const summary = {
  mode: dryRun ? "dry-run" : "written",
  listening: {
    addedSets: additionalListeningSets.length,
    addedQuestions: countQuestions(additionalListeningSets),
    totalSets: nextListeningBank.length,
    totalQuestions: countQuestions(nextListeningBank),
  },
  reading: {
    addedPassages: additionalReadingPassages.length,
    addedQuestions: countQuestions(additionalReadingPassages),
    totalPassages: nextReadingBank.length,
    totalQuestions: countQuestions(nextReadingBank),
  },
  audioFilesCopied: audioCopies.length,
};

console.log("Additional bank import OK");
console.log(JSON.stringify(summary, null, 2));

function parseListening(raw) {
  const text = normalizeRaw(raw);
  const questionMatches = [...text.matchAll(/^Question\s+(\d+)(?=Skill:|\s|$)/gm)];
  const sourceQuestions = questionMatches.map((match, index) => {
    const end = questionMatches[index + 1]?.index ?? text.length;
    const chunk = trimAtSectionBoundary(text.slice(match.index, end));
    return parseListeningQuestion(Number(match[1]), chunk);
  });

  assert(sourceQuestions.length === 50, `Expected 50 additional Listening questions; found ${sourceQuestions.length}.`);
  assert(
    sourceQuestions.every((question, index) => question.sourceNumber === index + 1),
    "Additional Listening question numbering must run continuously from 1 through 50.",
  );

  const sets = [];
  for (const question of sourceQuestions.filter((item) => item.sourceNumber <= 30)) {
    const sourceNumber = question.sourceNumber;
    const globalNumber = sourceNumber + 50;
    const listeningSetId = `listening-2-a-q${pad(sourceNumber, 2)}`;
    const audioUrl = `/audio/listening/paket-2-a-soal-${pad(sourceNumber, 2)}.mp3`;
    sets.push({
      id: listeningSetId,
      part: "A",
      sourceType: "short-conversation",
      sequence: sourceNumber + 30,
      title: `Part A - Short Conversation ${sourceNumber + 30}`,
      description: `Additional package question ${sourceNumber}.`,
      mainAudioTitle: `Short Conversation ${sourceNumber + 30}`,
      mainAudioContext: "Short academic conversation from additional Listening package.",
      audioSrc: audioUrl,
      audioUrl,
      aiGeneratedAudio: false,
      transcript: extractPartATranscript(question.explanation.sourceNotes),
      active: true,
      questions: [toListeningBankQuestion(question, globalNumber, listeningSetId, "A")],
    });
  }

  const groupDefinitions = [
    { part: "B", sequence: 3, start: 31, end: 34, slug: "b-conversation-31-34", title: "Longer Conversation 3" },
    { part: "B", sequence: 4, start: 35, end: 37, slug: "b-conversation-35-37", title: "Longer Conversation 4" },
    { part: "C", sequence: 4, start: 38, end: 41, slug: "c-talk-38-41", title: "Short Talk 4" },
    { part: "C", sequence: 5, start: 42, end: 46, slug: "c-talk-42-46", title: "Short Talk 5" },
    { part: "C", sequence: 6, start: 47, end: 50, slug: "c-talk-47-50", title: "Short Talk 6" },
  ];

  for (const definition of groupDefinitions) {
    const questions = sourceQuestions.filter(
      (question) => question.sourceNumber >= definition.start && question.sourceNumber <= definition.end,
    );
    const listeningSetId = `listening-2-${definition.slug}`;
    const kind = definition.part === "B" ? "dialog" : "talk";
    const audioUrl = `/audio/listening/paket-2-${definition.part.toLowerCase()}-${kind}-${definition.start}-${definition.end}.mp3`;
    const firstQuestionIndex = questionMatches.find((match) => Number(match[1]) === definition.start)?.index;
    assert(Number.isInteger(firstQuestionIndex), `Could not locate Listening question ${definition.start}.`);
    const audioScriptIndex = text.lastIndexOf("\nAudio Script", firstQuestionIndex);
    assert(audioScriptIndex >= 0, `Could not locate main audio script for questions ${definition.start}-${definition.end}.`);
    const transcript = normalizeTranscript(
      text.slice(audioScriptIndex + "\nAudio Script".length, firstQuestionIndex).trim(),
    );
    const contextBlock = text.slice(Math.max(0, audioScriptIndex - 500), audioScriptIndex);

    sets.push({
      id: listeningSetId,
      part: definition.part,
      sourceType: definition.part === "B" ? "longer-conversation" : "short-talk",
      sequence: definition.sequence,
      title: `Part ${definition.part} - ${definition.title}`,
      description: `Questions ${definition.start + 50}-${definition.end + 50}.`,
      mainAudioTitle: extractListeningTitle(contextBlock, definition.title),
      mainAudioContext: extractListeningContext(contextBlock),
      audioSrc: audioUrl,
      audioUrl,
      aiGeneratedAudio: false,
      transcript,
      active: true,
      questions: questions.map((question) =>
        toListeningBankQuestion(question, question.sourceNumber + 50, listeningSetId, definition.part),
      ),
    });
  }

  return sets;
}

function parseListeningQuestion(sourceNumber, sourceNotes) {
  const choiceMatch = sourceNotes.match(
    /\nA\.\s*([\s\S]*?)\s*B\.\s*([\s\S]*?)\s*C\.\s*([\s\S]*?)\s*D\.\s*([\s\S]*?)\s*\nAnswer:\s*([A-D])/,
  );
  assert(choiceMatch, `Could not parse choices for additional Listening question ${sourceNumber}.`);

  const questionArea = sourceNotes.slice(0, choiceMatch.index);
  const questionText =
    lastMatchValue(questionArea, /Question:\s*([^\n]+)/g) ||
    lastMatchValue(questionArea, /Narrator:\s*([^\n]+)/g);
  const headingSkill = sourceNotes.match(/^Question\s+\d+\s*Skill:\s*([^\n]+)/)?.[1];
  const answerSkill = sourceNotes.match(/\nAnswer:\s*[A-D]\s*Skill:\s*([^\n]+)/)?.[1];
  const listeningSkill = (headingSkill || answerSkill || "Listening Comprehension").trim();
  const optionAnalysis = parseOptionAnalysis(extractSection(sourceNotes, "Analisis opsi", "TOEFL Trap"));

  return {
    sourceNumber,
    questionText: required(questionText, `question text for Listening ${sourceNumber}`),
    choices: {
      A: cleanInline(choiceMatch[1]),
      B: cleanInline(choiceMatch[2]),
      C: cleanInline(choiceMatch[3]),
      D: cleanInline(choiceMatch[4]),
    },
    correctAnswer: choiceMatch[5],
    listeningSkill,
    cue: required(extractSection(sourceNotes, "Petunjuk audio", "Alur inferensi"), `audio cue for Listening ${sourceNumber}`),
    explanation: {
      summary: required(extractSection(sourceNotes, "Inti skill", "Petunjuk audio"), `summary for Listening ${sourceNumber}`),
      whyCorrect: required(extractSection(sourceNotes, "Alur inferensi", "Analisis opsi"), `inference for Listening ${sourceNumber}`),
      optionAnalysis,
      toeflTrap: required(extractSection(sourceNotes, "TOEFL Trap", "Catatan cepat"), `TOEFL trap for Listening ${sourceNumber}`),
      quickNote: required(extractTailSection(sourceNotes, "Catatan cepat"), `quick note for Listening ${sourceNumber}`),
      sourceNotes: sourceNotes.trim(),
    },
  };
}

function toListeningBankQuestion(question, globalNumber, listeningSetId, part) {
  const bankQuestion = {
    id: `listening-q${pad(globalNumber, 3)}`,
    sourceId: `LC2-${pad(question.sourceNumber, 3)}`,
    legacyId: `LC2-${pad(question.sourceNumber, 3)}`,
    section: "listening",
    listeningSetId,
    listeningPart: part,
    active: true,
    difficulty: "unknown",
    questionText: question.questionText,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    listeningSkill: question.listeningSkill,
    cue: question.cue,
    tags: [question.listeningSkill, "additional-listening-package"],
  };
  if (part !== "A") {
    bankQuestion.questionAudioUrl = `/audio/listening/paket-2-${part.toLowerCase()}-soal-${question.sourceNumber}.mp3`;
  }
  return bankQuestion;
}

function parseReading(raw) {
  const paragraphs = normalizeRaw(raw)
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const passageStarts = paragraphs
    .map((paragraph, index) => ({ index, match: paragraph.match(/^Passage\s+(\d+)\s+[—-]\s+(.+)$/) }))
    .filter((item) => item.match);

  assert(passageStarts.length === 8, `Expected 8 additional Reading passages; found ${passageStarts.length}.`);

  return passageStarts.map((start, passageIndex) => {
    const end = passageStarts[passageIndex + 1]?.index ?? paragraphs.length;
    const passageParagraphs = paragraphs.slice(start.index, end);
    const recapIndex = passageParagraphs.indexOf("Rekap Distribusi Kunci Jawaban");
    const contentEnd = recapIndex >= 0 ? recapIndex : passageParagraphs.length;
    const questionStarts = passageParagraphs
      .slice(0, contentEnd)
      .map((paragraph, index) => ({ index, match: paragraph.match(/^([A-Z]+Q\d+)\s+[—-]\s+(.+)$/) }))
      .filter((item) => item.match);
    assert(
      questionStarts.length === 9,
      `Expected 9 questions in Reading passage ${start.match[1]}; found ${questionStarts.length}.`,
    );

    const naskahIndex = passageParagraphs.indexOf("Naskah");
    const questionsIndex = passageParagraphs.indexOf("Soal dan Pembahasan");
    assert(naskahIndex > 0 && questionsIndex > naskahIndex, `Could not locate Reading passage boundaries for ${start.match[2]}.`);
    const firstQuestionId = questionStarts[0].match[1];
    const prefix = firstQuestionId.replace(/\d+$/, "").toLowerCase();
    const passageId = `reading-additional-${prefix}-p1`;
    const questions = questionStarts.map((questionStart, questionIndex) => {
      const questionEnd = questionStarts[questionIndex + 1]?.index ?? contentEnd;
      return parseReadingQuestion(
        passageParagraphs.slice(questionStart.index, questionEnd),
        passageId,
        questionStart.match[1],
        questionStart.match[2],
        prefix,
      );
    });

    return {
      id: passageId,
      sourceId: `${questions[0].id}-${questions.at(-1).id}`,
      title: start.match[2].trim(),
      category: "Reading Comprehension",
      topic: passageParagraphs[1],
      passage: [passageParagraphs[1], "Naskah", ...passageParagraphs.slice(naskahIndex + 1, questionsIndex), "Soal dan Pembahasan"].join(
        "\n\n",
      ),
      active: true,
      questions,
    };
  });
}

function parseReadingQuestion(paragraphs, passageId, id, headingType, prefix) {
  const sourceNotes = paragraphs.join("\n\n");
  const choices = {};
  for (const key of ANSWER_KEYS) {
    const choice = paragraphs.find((paragraph) => paragraph.startsWith(`${key}. `));
    choices[key] = required(choice?.slice(3), `choice ${key} for Reading ${id}`);
  }
  const answerMatch = sourceNotes.match(/Jawaban benar:\s*([A-D])\.\s*([^\n]+)/);
  assert(answerMatch, `Could not parse answer for Reading ${id}.`);
  const correctAnswer = answerMatch[1];
  assert(
    cleanInline(answerMatch[2]) === cleanInline(choices[correctAnswer]),
    `Reading ${id} answer text does not match choice ${correctAnswer}.`,
  );
  const optionAnalysis = parseOptionAnalysis(extractSection(sourceNotes, "Analisis opsi:", "Jebakan TOEFL:"));
  const questionType = required(extractInlineLabel(sourceNotes, "Tipe soal:"), `question type for Reading ${id}`);
  const evidence = required(
    extractSection(sourceNotes, "Bukti kunci / Parafrase bukti:", "Inti pemahaman:"),
    `evidence for Reading ${id}`,
  );

  return {
    id,
    sourceId: `reading-additional-docx:${id}`,
    legacyId: id,
    section: "reading",
    passageId,
    active: true,
    difficulty: "unknown",
    questionType,
    readingSkill: slugify(questionType || headingType),
    evidenceLocation: required(extractInlineLabel(sourceNotes, "Lokasi bukti:"), `evidence location for Reading ${id}`),
    keyEvidence: evidence,
    paraphrasedEvidence: evidence,
    questionText: required(extractInlineLabel(sourceNotes, "Soal:"), `question text for Reading ${id}`),
    choices,
    correctAnswer,
    explanation: {
      summary: required(extractSection(sourceNotes, "Inti pemahaman:", "Analisis opsi:"), `summary for Reading ${id}`),
      whyCorrect: required(optionAnalysis[correctAnswer], `correct option analysis for Reading ${id}`),
      optionAnalysis,
      toeflTrap: required(extractSection(sourceNotes, "Jebakan TOEFL:", "Catatan cepat:"), `TOEFL trap for Reading ${id}`),
      quickNote: required(extractTailSection(sourceNotes, "Catatan cepat:"), `quick note for Reading ${id}`),
      sourceNotes,
    },
    tags: [prefix, slugify(questionType || headingType), "additional-reading-package"],
  };
}

function buildAudioCopies(sourceRoot) {
  const copies = [];
  for (let number = 1; number <= 30; number += 1) {
    copies.push({
      source: path.join(sourceRoot, "Paket A", `Soal ${number}.mp3`),
      destination: `paket-2-a-soal-${pad(number, 2)}.mp3`,
    });
  }

  for (const group of [
    { part: "B", label: "B1 Untuk Soal 31-34.mp3", kind: "dialog", start: 31, end: 34 },
    { part: "B", label: "B2 Untuk Soal 35-37.mp3", kind: "dialog", start: 35, end: 37 },
    { part: "C", label: "C1 Untuk Soal 38-41.mp3", kind: "talk", start: 38, end: 41 },
    { part: "C", label: "C2 Untuk Soal 42-46.mp3", kind: "talk", start: 42, end: 46 },
    { part: "C", label: "C3 Untuk Soal 47-50.mp3", kind: "talk", start: 47, end: 50 },
  ]) {
    const folder = `Paket ${group.part}`;
    copies.push({
      source: path.join(sourceRoot, folder, group.label),
      destination: `paket-2-${group.part.toLowerCase()}-${group.kind}-${group.start}-${group.end}.mp3`,
    });
    for (let number = group.start; number <= group.end; number += 1) {
      copies.push({
        source: path.join(sourceRoot, folder, `Soal ${number}.mp3`),
        destination: `paket-2-${group.part.toLowerCase()}-soal-${number}.mp3`,
      });
    }
  }
  return copies;
}

function validateImport(listeningSets, readingPassages, audioCopies) {
  assert(listeningSets.length === 35, `Expected 35 additional Listening sets; found ${listeningSets.length}.`);
  assert(countQuestions(listeningSets) === 50, `Expected 50 additional Listening questions; found ${countQuestions(listeningSets)}.`);
  assert(readingPassages.length === 8, `Expected 8 additional Reading passages; found ${readingPassages.length}.`);
  assert(countQuestions(readingPassages) === 72, `Expected 72 additional Reading questions; found ${countQuestions(readingPassages)}.`);
  assert(audioCopies.length === 55, `Expected 55 additional Listening audio files; found ${audioCopies.length}.`);
  assert(
    new Set(audioCopies.map((copy) => copy.destination)).size === audioCopies.length,
    "Additional Listening audio destinations must be unique.",
  );
  for (const copy of audioCopies) assertFile(copy.source);

  const allQuestions = [...listeningSets, ...readingPassages].flatMap((item) => item.questions);
  for (const question of allQuestions) {
    assert(question.id && question.questionText && ANSWER_KEYS.includes(question.correctAnswer), `Invalid imported question ${question.id}.`);
    assert(ANSWER_KEYS.every((key) => question.choices[key]), `Question ${question.id} is missing a choice.`);
    assert(question.explanation.summary && question.explanation.whyCorrect, `Question ${question.id} is missing an explanation.`);
    assert(
      ANSWER_KEYS.every((key) => question.explanation.optionAnalysis[key]),
      `Question ${question.id} is missing option analysis.`,
    );
    assert(question.explanation.sourceNotes, `Question ${question.id} is missing verbatim source notes.`);
    assert(
      !question.explanation.sourceNotes.includes("Rekap Distribusi Kunci Jawaban"),
      `Question ${question.id} source notes include a document-level answer recap.`,
    );
  }
}

function extractPartATranscript(sourceNotes) {
  const match = sourceNotes.match(/Audio Script:\s*([\s\S]*?)\n\s*Question:/);
  return required(normalizeTranscript(match?.[1] || ""), "Part A transcript");
}

function normalizeTranscript(value) {
  return value
    .replace(/\s*(?=(?:Woman|Man|Narrator|Lecturer|Speaker)\s*(?:\([^)]*\))?:)/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

function extractListeningTitle(contextBlock, fallback) {
  const lines = contextBlock.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const named = [...lines].reverse().find((line) => /^(?:Mini Lecture|Campus Announcement|Short Academic Talk):/.test(line));
  return named ? named.replace(/^[^:]+:\s*/, "") : `${fallback} - Additional Package`;
}

function extractListeningContext(contextBlock) {
  const setting = contextBlock.match(/Setting:\s*([^\n]+?)(?=Speakers?:|\n|$)/)?.[1]?.trim();
  const speakers = contextBlock.match(/Speakers?:\s*([^\n]+?)(?=Setting:|\n|$)/)?.[1]?.trim();
  return [setting, speakers].filter(Boolean).join(". ") || "Additional TOEFL-style Listening package.";
}

function parseOptionAnalysis(value) {
  const analysis = {};
  for (const key of ANSWER_KEYS) {
    const match = value.match(new RegExp(`${key}\\.\\s*([\\s\\S]*?)(?=[A-D]\\.\\s|$)`));
    analysis[key] = required(match?.[1]?.trim(), `option analysis ${key}`);
  }
  return analysis;
}

function extractSection(text, startLabel, endLabel) {
  const start = text.indexOf(startLabel);
  if (start < 0) return "";
  const contentStart = start + startLabel.length;
  const end = text.indexOf(endLabel, contentStart);
  return cleanBlock(text.slice(contentStart, end < 0 ? text.length : end));
}

function extractTailSection(text, label) {
  const start = text.indexOf(label);
  return start < 0 ? "" : cleanBlock(text.slice(start + label.length));
}

function extractInlineLabel(text, label) {
  const match = text.match(new RegExp(`${escapeRegex(label)}\\s*([^\\n]+)`));
  return match?.[1]?.trim() || "";
}

function trimAtSectionBoundary(chunk) {
  const boundaries = ["\nAnswer Key Summary", "\nTOEFL ITP Listening Comprehension"];
  let end = chunk.length;
  for (const boundary of boundaries) {
    const index = chunk.indexOf(boundary);
    if (index >= 0) end = Math.min(end, index);
  }
  return chunk.slice(0, end).trim();
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

function normalizeRaw(value) {
  return value.replace(/\r/g, "").replace(/\u00a0/g, " ").trim();
}

function lastMatchValue(text, regex) {
  return [...text.matchAll(regex)].at(-1)?.[1]?.trim() || "";
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function countQuestions(items) {
  return items.reduce((sum, item) => sum + item.questions.filter((question) => question.active).length, 0);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function extractRawText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function assertFile(filePath) {
  assert(fs.existsSync(filePath) && fs.statSync(filePath).isFile(), `Source file not found: ${filePath}`);
}

function assertDirectory(directoryPath) {
  assert(fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory(), `Source directory not found: ${directoryPath}`);
}

function required(value, label) {
  const normalized = typeof value === "string" ? value.trim() : value;
  assert(normalized, `Missing ${label}.`);
  return normalized;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pad(value, width) {
  return String(value).padStart(width, "0");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
