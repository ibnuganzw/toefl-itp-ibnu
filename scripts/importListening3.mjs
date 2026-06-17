import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

const ROOT = process.cwd();
const SOURCE_ROOT = "C:\\Users\\ibnuh\\Downloads\\Audio Listening 3";
const SOURCE_DOCX = path.join(SOURCE_ROOT, "TOEFL ITP Listening Comprehension Part 3 Final.docx");
const BANK_PATH = path.join(ROOT, "src", "data", "imported", "listeningSets.json");
const AUDIO_DESTINATION = path.join(ROOT, "public", "audio", "listening");
const REPORT_PATH = path.join(ROOT, "docs", "listening-3-import-report.json");
const ANSWER_KEYS = ["A", "B", "C", "D"];
const shouldWrite = process.argv.includes("--write");

assertFile(SOURCE_DOCX);
assertDirectory(SOURCE_ROOT);

const raw = normalizeRaw((await mammoth.extractRawText({ path: SOURCE_DOCX })).value);
const currentBank = readJson(BANK_PATH);
const retainedBank = currentBank.filter((set) => !set.id.startsWith("listening-3-"));
const importedSets = parseListening3(raw, retainedBank);
const audioCopies = buildAudioCopies();
const issues = validateImport(importedSets, retainedBank, audioCopies);
const blockingIssues = issues.filter((issue) => issue.severity === "error");
const nextBank = [...retainedBank, ...importedSets];

const report = {
  generatedAt: new Date().toISOString(),
  mode: shouldWrite ? "write" : "dry-run",
  sourceDocument: SOURCE_DOCX,
  sourceAudioRoot: SOURCE_ROOT,
  numberingRule: "Part letter plus local source number is authoritative because local numbers overlap across Parts A, B, and C.",
  importedSetCount: importedSets.length,
  importedQuestionCount: countQuestions(importedSets),
  importedQuestionCountsByPart: countQuestionsByPart(importedSets),
  audioFileCount: audioCopies.length,
  totalSetCount: nextBank.length,
  totalQuestionCount: countQuestions(nextBank),
  sets: importedSets.map((set) => ({
    id: set.id,
    part: set.part,
    sourceNumbers: set.questions.map((question) => question.legacyId),
    audioUrl: set.audioUrl,
    questionAudioUrls: set.questions.map((question) => question.questionAudioUrl).filter(Boolean),
  })),
  issues,
};

if (blockingIssues.length) {
  console.error(JSON.stringify(report, null, 2));
  throw new Error(`Listening 3 import stopped because ${blockingIssues.length} blocking issue(s) were found.`);
}

if (shouldWrite) {
  writeJson(BANK_PATH, nextBank);
  writeJson(REPORT_PATH, report);
  fs.mkdirSync(AUDIO_DESTINATION, { recursive: true });
  for (const copy of audioCopies) {
    const destination = path.join(AUDIO_DESTINATION, copy.destination);
    fs.copyFileSync(copy.source, destination);
    assert(sha256(copy.source) === sha256(destination), `Copied audio hash mismatch: ${copy.destination}`);
  }
}

console.log("Listening 3 import");
console.log(`Mode: ${report.mode}`);
console.log(`Imported sets: ${report.importedSetCount}`);
console.log(`Imported questions: ${report.importedQuestionCount} (${formatPartCounts(report.importedQuestionCountsByPart)})`);
console.log(`Audio files: ${report.audioFileCount}`);
console.log(`Blocking issues: ${blockingIssues.length}`);
if (!shouldWrite) console.log("Dry run only. Add --write after reviewing the mapping.");

function parseListening3(text, retainedSets) {
  const maxSequences = {
    A: maxSequence(retainedSets, "A"),
    B: maxSequence(retainedSets, "B"),
    C: maxSequence(retainedSets, "C"),
  };
  const sets = parsePartA(text, maxSequences.A);
  sets.push(...parseGroupedParts(text, "B", maxSequences.B));
  sets.push(...parseGroupedParts(text, "C", maxSequences.C));
  return sets;
}

function parsePartA(text, sequenceBase) {
  const headings = [...text.matchAll(/^Question\s+(\d+)Skill:\s*(.*?)Setting \/ Topic:\s*([^\n]+)$/gm)];
  assert(headings.length === 60, `Expected 60 Part A question headings; found ${headings.length}.`);

  return headings.map((heading, index) => {
    const sourceNumber = Number(heading[1]);
    assert(sourceNumber === index + 1, `Part A numbering must run from 1 through 60; found ${sourceNumber} at position ${index + 1}.`);
    const end = headings[index + 1]?.index ?? text.indexOf("TOEFL ITP Listening ComprehensionPart B");
    const sourceNotes = trimAtSectionBoundary(text.slice(heading.index, end));
    const question = parseQuestion(sourceNotes, "A", sourceNumber, heading[2]);
    const setId = `listening-3-a-q${pad(sourceNumber, 2)}`;
    const audioUrl = `/audio/listening/paket-3-a-soal-${pad(sourceNumber, 2)}.mp3`;

    return {
      id: setId,
      part: "A",
      sourceType: "short-conversation",
      sequence: sequenceBase + index + 1,
      title: `Part A - Short Conversation ${sequenceBase + index + 1}`,
      description: `Listening 3 Part A source question ${sourceNumber}.`,
      mainAudioTitle: `Short Conversation ${sequenceBase + index + 1}`,
      mainAudioContext: cleanInline(heading[3]),
      audioSrc: audioUrl,
      audioUrl,
      aiGeneratedAudio: false,
      transcript: extractPartATranscript(sourceNotes),
      active: true,
      questions: [toBankQuestion(question, setId)],
    };
  });
}

function parseGroupedParts(text, part, sequenceBase) {
  const groupPattern = new RegExp(
    `^Part ${part} — ([^\\n]+?)Questions (\\d+)[–-](\\d+)([^\\n]*)$`,
    "gm",
  );
  const groups = [...text.matchAll(groupPattern)];
  const expectedGroups = part === "B" ? 4 : 6;
  assert(groups.length === expectedGroups, `Expected ${expectedGroups} Part ${part} groups; found ${groups.length}.`);

  return groups.map((group, groupIndex) => {
    const startNumber = Number(group[2]);
    const endNumber = Number(group[3]);
    const groupEnd = groups[groupIndex + 1]?.index ?? nextPartBoundary(text, group.index, part);
    const groupChunk = trimAtSectionBoundary(text.slice(group.index, groupEnd));
    const questionHeadings = [...groupChunk.matchAll(/^Question\s+(\d+)Narrator:\s*([^\n]+)$/gm)];
    const expectedQuestionCount = endNumber - startNumber + 1;
    assert(
      questionHeadings.length === expectedQuestionCount,
      `Part ${part} ${startNumber}-${endNumber} expected ${expectedQuestionCount} questions; found ${questionHeadings.length}.`,
    );
    const firstQuestionIndex = questionHeadings[0]?.index;
    assert(Number.isInteger(firstQuestionIndex), `Part ${part} ${startNumber}-${endNumber} is missing question headings.`);
    const audioScriptIndex = groupChunk.indexOf("\nAudio Script");
    assert(audioScriptIndex >= 0 && audioScriptIndex < firstQuestionIndex, `Part ${part} ${startNumber}-${endNumber} is missing its main audio script.`);
    const transcriptStart = audioScriptIndex + "\nAudio Script".length;
    const transcript = normalizeTranscript(groupChunk.slice(transcriptStart, firstQuestionIndex).trim());
    const setId = `listening-3-${part.toLowerCase()}-${part === "B" ? "conversation" : "talk"}-${startNumber}-${endNumber}`;
    const questions = questionHeadings.map((heading, questionIndex) => {
      const sourceNumber = Number(heading[1]);
      assert(
        sourceNumber === startNumber + questionIndex,
        `Part ${part} ${startNumber}-${endNumber} has unexpected question number ${sourceNumber}.`,
      );
      const end = questionHeadings[questionIndex + 1]?.index ?? groupChunk.length;
      return toBankQuestion(parseQuestion(groupChunk.slice(heading.index, end), part, sourceNumber), setId);
    });
    const audioUrl = `/audio/listening/paket-3-${part.toLowerCase()}-${part === "B" ? "dialog" : "talk"}-${startNumber}-${endNumber}.mp3`;

    return {
      id: setId,
      part,
      sourceType: part === "B" ? "longer-conversation" : "short-talk",
      sequence: sequenceBase + groupIndex + 1,
      title: `Part ${part} - ${cleanInline(group[1])}`,
      description: `Listening 3 source questions ${startNumber}-${endNumber}.`,
      mainAudioTitle: cleanInline(group[1]),
      mainAudioContext: extractGroupContext(groupChunk.slice(0, audioScriptIndex)),
      audioSrc: audioUrl,
      audioUrl,
      aiGeneratedAudio: false,
      transcript,
      active: true,
      questions,
    };
  });
}

function parseQuestion(sourceNotes, part, sourceNumber, headingSkill = "") {
  const choiceMatch = sourceNotes.match(
    /\nA\.\s*([\s\S]*?)\s*B\.\s*([\s\S]*?)\s*C\.\s*([\s\S]*?)\s*D\.\s*([\s\S]*?)\s*\nAnswer:\s*([A-D])(?:Skill:\s*([^\n]+))?/,
  );
  assert(choiceMatch, `Could not parse Part ${part} question ${sourceNumber}.`);
  const questionArea = sourceNotes.slice(0, choiceMatch.index);
  const questionText = lastMatchValue(questionArea, /Question:\s*([^\n]+)/g);
  const listeningSkill = cleanInline(headingSkill || choiceMatch[6] || "Listening Comprehension");
  const optionAnalysis = parseOptionAnalysis(extractSection(sourceNotes, "Analisis opsi", "TOEFL Trap"));

  return {
    part,
    sourceNumber,
    questionText: required(questionText, `question text for Part ${part} ${sourceNumber}`),
    choices: {
      A: cleanInline(choiceMatch[1]),
      B: cleanInline(choiceMatch[2]),
      C: cleanInline(choiceMatch[3]),
      D: cleanInline(choiceMatch[4]),
    },
    correctAnswer: choiceMatch[5],
    listeningSkill,
    cue: required(extractSection(sourceNotes, "Petunjuk audio", "Alur inferensi"), `audio cue for Part ${part} ${sourceNumber}`),
    explanation: {
      summary: required(extractSection(sourceNotes, "Inti skill", "Petunjuk audio"), `summary for Part ${part} ${sourceNumber}`),
      whyCorrect: required(extractSection(sourceNotes, "Alur inferensi", "Analisis opsi"), `inference for Part ${part} ${sourceNumber}`),
      optionAnalysis,
      toeflTrap: required(extractSection(sourceNotes, "TOEFL Trap", "Catatan cepat"), `TOEFL trap for Part ${part} ${sourceNumber}`),
      quickNote: required(extractTailSection(sourceNotes, "Catatan cepat"), `quick note for Part ${part} ${sourceNumber}`),
      sourceNotes: sourceNotes.trim(),
    },
  };
}

function toBankQuestion(question, listeningSetId) {
  const localId = `${question.part}-${pad(question.sourceNumber, 3)}`;
  return {
    id: `listening-3-${question.part.toLowerCase()}-q${pad(question.sourceNumber, 3)}`,
    sourceId: `LC3-${localId}`,
    legacyId: `LC3-${localId}`,
    section: "listening",
    listeningSetId,
    listeningPart: question.part,
    active: true,
    difficulty: "unknown",
    questionText: question.questionText,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    listeningSkill: question.listeningSkill,
    cue: question.cue,
    tags: [question.listeningSkill, "listening-3"],
    ...(question.part === "A"
      ? {}
      : {
          questionAudioUrl: `/audio/listening/paket-3-${question.part.toLowerCase()}-soal-${question.sourceNumber}.mp3`,
        }),
  };
}

function buildAudioCopies() {
  const copies = [];
  const seenSourcePaths = new Set();

  for (let number = 1; number <= 60; number += 1) {
    copies.push(
      audioCopy(
        path.join(SOURCE_ROOT, "Paket A", `Soal ${number}.mp3`),
        `paket-3-a-soal-${pad(number, 2)}.mp3`,
        seenSourcePaths,
      ),
    );
  }

  for (const part of ["B", "C"]) {
    const folder = path.join(SOURCE_ROOT, `Paket ${part}`);
    for (const fileName of fs.readdirSync(folder).filter((name) => name.toLowerCase().endsWith(".mp3"))) {
      const source = path.join(folder, fileName);
      const mainMatch = fileName.match(new RegExp(`^${part} (?:Untuk|Unuk) Soal (\\d+)-(\\d+)\\.mp3$`, "i"));
      const questionMatch = fileName.match(new RegExp(`^Soal ${part} (\\d+)\\.mp3$`, "i"));
      if (mainMatch) {
        const [, start, end] = mainMatch;
        copies.push(
          audioCopy(
            source,
            `paket-3-${part.toLowerCase()}-${part === "B" ? "dialog" : "talk"}-${start}-${end}.mp3`,
            seenSourcePaths,
          ),
        );
      } else if (questionMatch) {
        copies.push(
          audioCopy(source, `paket-3-${part.toLowerCase()}-soal-${Number(questionMatch[1])}.mp3`, seenSourcePaths),
        );
      } else {
        throw new Error(`Unrecognized Listening 3 audio marker: ${source}`);
      }
    }
  }

  return copies;
}

function validateImport(importedSets, retainedSets, audioCopies) {
  const issues = [];
  const questions = importedSets.flatMap((set) => set.questions);
  const expectedCounts = { A: 60, B: 16, C: 24 };
  const actualCounts = countQuestionsByPart(importedSets);

  if (importedSets.length !== 70) issues.push(error(`Expected 70 Listening 3 sets; found ${importedSets.length}.`));
  if (questions.length !== 100) issues.push(error(`Expected 100 Listening 3 questions; found ${questions.length}.`));
  for (const part of ["A", "B", "C"]) {
    if (actualCounts[part] !== expectedCounts[part]) {
      issues.push(error(`Expected ${expectedCounts[part]} Part ${part} questions; found ${actualCounts[part]}.`));
    }
  }
  if (audioCopies.length !== 110) issues.push(error(`Expected 110 Listening 3 audio files; found ${audioCopies.length}.`));

  const ids = new Set(retainedSets.flatMap((set) => [set.id, ...set.questions.map((question) => question.id)]));
  const sourceIds = new Set(retainedSets.flatMap((set) => set.questions.map((question) => question.sourceId).filter(Boolean)));
  const destinations = new Set();
  const fingerprints = new Map();

  for (const set of retainedSets) {
    for (const question of set.questions) fingerprints.set(questionFingerprint(set, question), question.id);
  }

  for (const set of importedSets) {
    if (ids.has(set.id)) issues.push(error(`Listening set ID already exists: ${set.id}`));
    ids.add(set.id);
    const expectedSetSize = set.part === "A" ? 1 : 4;
    if (set.questions.length !== expectedSetSize) {
      issues.push(error(`Listening set ${set.id} has ${set.questions.length} questions; expected ${expectedSetSize}.`));
    }
    for (const question of set.questions) {
      if (ids.has(question.id)) issues.push(error(`Listening question ID already exists: ${question.id}`));
      ids.add(question.id);
      if (sourceIds.has(question.sourceId)) issues.push(error(`Listening source ID already exists: ${question.sourceId}`));
      sourceIds.add(question.sourceId);
      if (question.listeningSetId !== set.id || question.listeningPart !== set.part) {
        issues.push(error(`Question ${question.id} is attached to the wrong Listening set or part.`));
      }
      if (!question.questionText || !ANSWER_KEYS.includes(question.correctAnswer)) {
        issues.push(error(`Question ${question.id} is missing text or a valid answer.`));
      }
      if (ANSWER_KEYS.some((key) => !question.choices[key] || !question.explanation.optionAnalysis[key])) {
        issues.push(error(`Question ${question.id} is missing a choice or option analysis.`));
      }
      const fingerprint = questionFingerprint(set, question);
      const duplicate = fingerprints.get(fingerprint);
      if (duplicate) issues.push(error(`Question ${question.id} exactly duplicates existing question ${duplicate}.`));
      fingerprints.set(fingerprint, question.id);
    }
  }

  for (const copy of audioCopies) {
    if (destinations.has(copy.destination)) issues.push(error(`Duplicate audio destination: ${copy.destination}`));
    destinations.add(copy.destination);
    if (!fs.existsSync(copy.source)) issues.push(error(`Missing source audio: ${copy.source}`));
    else if (!isMp3(copy.source)) issues.push(error(`Invalid MP3 header: ${copy.source}`));
  }

  return issues;
}

function questionFingerprint(set, question) {
  return normalizeIdentity(
    [set.transcript, question.questionText, ...ANSWER_KEYS.map((key) => question.choices[key])].join("|"),
  );
}

function audioCopy(source, destination, seenSourcePaths) {
  assertFile(source);
  assert(!seenSourcePaths.has(source), `Source audio was mapped more than once: ${source}`);
  seenSourcePaths.add(source);
  return { source, destination };
}

function extractPartATranscript(sourceNotes) {
  const match = sourceNotes.match(/Audio Script:\s*([\s\S]*?)\n\s*Question:/);
  return required(normalizeTranscript(match?.[1] || ""), "Part A transcript");
}

function normalizeTranscript(value) {
  const speaker =
    "(?:Narrator|Woman|Man|Speaker|Professor|Lecturer|Dr\\. [A-Z][a-z]+|Ms\\. [A-Z][a-z]+|Mr\\. [A-Z][a-z]+|[A-Z][a-z]+(?: [A-Z][a-z]+)?)";
  return value
    .replace(new RegExp(`\\s*(?=${speaker}:)`, "g"), "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

function extractGroupContext(value) {
  const setting = value.match(/Setting(?: \/ Context)?:\s*(.*?)(?=Speakers?:|Estimated|$)/)?.[1];
  const speakers = value.match(/Speakers?:\s*(.*?)(?=Estimated|Setting|$)/)?.[1];
  return [setting, speakers].filter(Boolean).map(cleanInline).join(". ") || "Listening 3 academic audio packet.";
}

function parseOptionAnalysis(value) {
  const analysis = {};
  for (const key of ANSWER_KEYS) {
    const match = value.match(new RegExp(`${key}(?:\\.\\s*|\\s+)([\\s\\S]*?)(?=[A-D](?:\\.\\s*|\\s+)|$)`));
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

function trimAtSectionBoundary(chunk) {
  const boundaries = ["\nAnswer Key Summary", "\nTOEFL ITP Listening Comprehension"];
  let end = chunk.length;
  for (const boundary of boundaries) {
    const index = chunk.indexOf(boundary);
    if (index >= 0) end = Math.min(end, index);
  }
  return chunk.slice(0, end).trim();
}

function nextPartBoundary(text, start, part) {
  const candidates = [
    text.indexOf("\nAnswer Key Summary", start),
    part === "B" ? text.indexOf("TOEFL ITP Listening ComprehensionPart C", start) : -1,
  ].filter((index) => index >= 0);
  return candidates.length ? Math.min(...candidates) : text.length;
}

function maxSequence(sets, part) {
  return Math.max(0, ...sets.filter((set) => set.part === part).map((set) => set.sequence || 0));
}

function countQuestions(items) {
  return items.reduce((sum, item) => sum + item.questions.filter((question) => question.active).length, 0);
}

function countQuestionsByPart(sets) {
  return sets.reduce(
    (counts, set) => {
      counts[set.part] += set.questions.filter((question) => question.active).length;
      return counts;
    },
    { A: 0, B: 0, C: 0 },
  );
}

function formatPartCounts(counts) {
  return `Part A ${counts.A}, Part B ${counts.B}, Part C ${counts.C}`;
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

function normalizeIdentity(value) {
  return value.toLowerCase().replace(/[—–]/g, "-").replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

function lastMatchValue(text, regex) {
  return [...text.matchAll(regex)].at(-1)?.[1]?.trim() || "";
}

function isMp3(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 3);
  return header.toString() === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function error(message) {
  return { severity: "error", message };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pad(value, width) {
  return String(value).padStart(width, "0");
}
