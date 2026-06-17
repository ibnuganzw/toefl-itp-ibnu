import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

const ROOT = process.cwd();
const STRUCTURE_PATH = path.join(ROOT, "src", "data", "imported", "structureQuestions.json");
const WRITTEN_PATH = path.join(ROOT, "src", "data", "imported", "writtenExpressionQuestions.json");
const REPORT_PATH = path.join(ROOT, "docs", "additional-premium-structure-written-import-report.json");
const ANSWER_KEYS = ["A", "B", "C", "D"];
const SOURCES = [
  {
    key: "PSW2",
    tag: "psw2",
    path: "C:\\Users\\ibnuh\\Downloads\\Soal Premium TOEFL ITP Part 2.docx",
  },
  {
    key: "PSW3",
    tag: "psw3",
    path: "C:\\Users\\ibnuh\\Downloads\\TOEFL ITP Structure Written Part 3.docx",
  },
];
const SECTION_LABELS = [
  "Soal",
  "Pilihan",
  "Jawaban benar",
  "Bagian salah",
  "Perbaikan",
  "Kalimat benar",
  "Inti pola",
  "Cara membaca kalimat",
  "Struktur kalimat",
  "Struktur kalimat setelah diperbaiki",
  "Analisis pilihan",
  "Analisis bagian A-D",
  "Analisis bagian A–D",
  "Jebakan TOEFL",
  "Catatan cepat",
];
const shouldWrite = process.argv.includes("--write");
const structureQuestions = readJson(STRUCTURE_PATH);
const writtenQuestions = readJson(WRITTEN_PATH);
const retainedStructureQuestions = structureQuestions.filter((question) => !isManagedAdditionalQuestion(question));
const retainedWrittenQuestions = writtenQuestions.filter((question) => !isManagedAdditionalQuestion(question));
const existingIds = new Set([...retainedStructureQuestions, ...retainedWrittenQuestions].map((question) => question.id));
const existingQuestionTexts = new Map(
  [...retainedStructureQuestions, ...retainedWrittenQuestions].map((question) => [
    normalizeIdentity(question.questionText),
    question.id,
  ]),
);
const importedQuestionTexts = new Map();
const importedStructure = [];
const importedWritten = [];
const skippedDuplicates = [];
const issues = [];
const sourceReports = [];

for (const source of SOURCES) {
  if (!fs.existsSync(source.path)) throw new Error(`Source document not found: ${source.path}`);
  const html = (await mammoth.convertToHtml({ path: source.path })).value;
  const blocks = parseTopLevelBlocks(html);
  const candidates = parseSourceQuestions(blocks, source);
  const seenSourceQuestions = new Map();
  const accepted = [];

  for (const candidate of candidates) {
    const normalizedQuestion = normalizeIdentity(candidate.questionText);
    const repeatedLocalId = seenSourceQuestions.get(normalizedQuestion);
    if (repeatedLocalId) {
      skippedDuplicates.push({
        source: source.path,
        id: candidate.id,
        duplicateOf: repeatedLocalId,
        reason: "Exact repeated question block inside the same source document.",
      });
      continue;
    }
    seenSourceQuestions.set(normalizedQuestion, candidate.id);

    const existingDuplicate = existingQuestionTexts.get(normalizedQuestion);
    const importedDuplicate = importedQuestionTexts.get(normalizedQuestion);
    if (existingDuplicate || importedDuplicate) {
      skippedDuplicates.push({
        source: source.path,
        id: candidate.id,
        duplicateOf: existingDuplicate ?? importedDuplicate,
        reason: "Exact question text already exists in the master bank or another additional source.",
      });
      continue;
    }

    validateCandidate(candidate, issues);
    accepted.push(candidate);
    importedQuestionTexts.set(normalizedQuestion, candidate.id);
  }

  importedStructure.push(...accepted.filter((question) => question.section === "structure"));
  importedWritten.push(...accepted.filter((question) => question.section === "written-expression"));
  sourceReports.push({
    key: source.key,
    path: source.path,
    detectedBlocks: candidates.length,
    acceptedStructure: accepted.filter((question) => question.section === "structure").length,
    acceptedWritten: accepted.filter((question) => question.section === "written-expression").length,
    skippedDuplicateBlocks: skippedDuplicates.filter((item) => item.source === source.path).length,
  });
}

for (const question of [...importedStructure, ...importedWritten]) {
  if (existingIds.has(question.id)) {
    issues.push({ severity: "error", id: question.id, issue: "Generated master-bank ID already exists." });
  }
  existingIds.add(question.id);
}

const blockingIssues = issues.filter((issue) => issue.severity === "error");
const report = {
  generatedAt: new Date().toISOString(),
  mode: shouldWrite ? "write" : "dry-run",
  sources: sourceReports,
  importedStructureCount: importedStructure.length,
  importedWrittenCount: importedWritten.length,
  importedTotalCount: importedStructure.length + importedWritten.length,
  skippedDuplicates,
  issues,
};

if (blockingIssues.length) {
  console.error(JSON.stringify(report, null, 2));
  throw new Error(`Additional premium SW import stopped because ${blockingIssues.length} blocking issue(s) were found.`);
}

if (shouldWrite) {
  writeJson(STRUCTURE_PATH, [...retainedStructureQuestions, ...importedStructure]);
  writeJson(WRITTEN_PATH, [...retainedWrittenQuestions, ...importedWritten]);
  writeJson(REPORT_PATH, report);
}

console.log("Additional premium Structure/Written import");
console.log(`Mode: ${report.mode}`);
for (const source of sourceReports) {
  console.log(
    `${source.key}: ${source.acceptedStructure} Structure + ${source.acceptedWritten} Written; ${source.skippedDuplicateBlocks} duplicate blocks skipped.`,
  );
}
console.log(`Imported unique questions: ${report.importedTotalCount}`);
console.log(`Skipped duplicate blocks: ${report.skippedDuplicates.length}`);
console.log(`Blocking issues: ${blockingIssues.length}`);
if (!shouldWrite) console.log("Dry run only. Add --write after reviewing the report.");

function parseSourceQuestions(allBlocks, source) {
  const headings = allBlocks
    .map((block, index) => {
      const match = block.text.match(/^(?:\d+\.\s*)?([SW]\d+)\s*[—–-]\s*(.+)$/);
      return match ? { index, legacyId: match[1], title: match[2].trim() } : null;
    })
    .filter(Boolean);
  const actualHeadings = headings.filter(({ index }) => normalizeLabel(allBlocks[index + 1]?.lines[0]) === "soal");

  return actualHeadings.map((heading) => {
    const nextBoundary = headings.find((candidate) => candidate.index > heading.index)?.index ?? allBlocks.length;
    const questionBlocks = allBlocks.slice(heading.index, nextBoundary);
    const section = heading.legacyId.startsWith("S") ? "structure" : "written-expression";
    const id = `${source.key}-${heading.legacyId}`;
    const writtenPrompt = section === "written-expression" ? extractWrittenPrompt(questionBlocks) : null;
    const questionText = writtenPrompt?.questionText ?? extractSingleSection(questionBlocks, ["Soal"]);
    const choices =
      section === "structure"
        ? extractStructureChoicesFromBlocks(questionBlocks)
        : writtenPrompt.choices;
    const correctAnswer = questionBlocks
      .map((block) => block.text.match(/^Jawaban benar\s*:\s*([A-D])/i)?.[1])
      .find(Boolean);
    const optionAnalysis = extractOptionAnalysis(questionBlocks);
    const reasoning = extractSection(questionBlocks, ["Cara membaca kalimat"]);

    return {
      id,
      sourceId: `${source.key.toLowerCase()}:${heading.legacyId}`,
      legacyId: heading.legacyId,
      section,
      active: true,
      difficulty: "unknown",
      questionText,
      choices,
      correctAnswer,
      explanation: {
        summary: extractSection(questionBlocks, ["Inti pola"]),
        reasoning,
        whyCorrect: optionAnalysis[correctAnswer] ?? reasoning,
        optionAnalysis,
        toeflTrap: extractSection(questionBlocks, ["Jebakan TOEFL"]),
        quickNote: extractSection(questionBlocks, ["Catatan cepat"]),
        sourceNotes: blocksToPlainText(questionBlocks),
      },
      tags: [source.tag],
      grammarPattern: heading.title,
      ...(section === "structure"
        ? {
            sentenceStructureExplanation: extractSection(questionBlocks, [
              "Struktur kalimat",
              "Struktur kalimat setelah diperbaiki",
            ]),
          }
        : {
            errorFocus: heading.title,
            sentenceStructureExplanation: extractSection(questionBlocks, [
              "Struktur kalimat setelah diperbaiki",
              "Struktur kalimat",
            ]),
            incorrectPart: extractSingleSection(questionBlocks, ["Bagian salah"]),
            correction: extractSingleSection(questionBlocks, ["Perbaikan"]),
            correctedSentence: stripOuterEmphasis(extractSingleSection(questionBlocks, ["Kalimat benar"])),
          }),
    };
  });
}

function parseTopLevelBlocks(value) {
  return [...value.matchAll(/<(p|ul|ol)>([\s\S]*?)<\/\1>/g)].map((match) => {
    const type = match[1];
    const innerHtml = match[2];
    const text = htmlToPlainText(innerHtml);
    return {
      type,
      innerHtml,
      text,
      lines: text.split("\n").map((line) => line.trim()).filter(Boolean),
    };
  });
}

function extractSection(questionBlocks, labels) {
  const labelSet = new Set(labels.map(normalizeLabel));
  const start = questionBlocks.findIndex((block) => labelSet.has(normalizeLabel(block.lines[0])));
  if (start < 0) return "";

  const values = [];
  const firstRemainder = questionBlocks[start].lines.slice(1).join("\n");
  if (firstRemainder) values.push(textBlock(firstRemainder));

  for (const block of questionBlocks.slice(start + 1)) {
    if (isSectionLabel(block.lines[0]) || isDocumentTail(block.text)) break;
    values.push(block);
  }
  return blocksToMarkdown(values);
}

function extractSingleSection(questionBlocks, labels) {
  return stripOuterEmphasis(extractSection(questionBlocks, labels).split(/\n{2,}/)[0]?.trim() ?? "");
}

function extractOptionAnalysis(questionBlocks) {
  const start = questionBlocks.findIndex((block) =>
    ["analisis pilihan", "analisis bagian a-d"].includes(normalizeLabel(block.lines[0])),
  );
  if (start < 0) return {};

  const analysis = {};
  let currentKey;
  for (const block of questionBlocks.slice(start)) {
    if (block !== questionBlocks[start] && ["jebakan toefl", "catatan cepat"].includes(normalizeLabel(block.lines[0]))) {
      break;
    }
    const lines = block === questionBlocks[start] ? block.lines.slice(1) : block.lines;
    for (const line of lines) {
      const match = line.match(/^([A-D])\.\s*(.*)$/);
      if (match) {
        currentKey = match[1];
        analysis[currentKey] = match[2] ? inlineTextToMarkdown(match[2]) : "";
      } else if (currentKey) {
        analysis[currentKey] = appendMarkdown(analysis[currentKey], inlineTextToMarkdown(line));
      }
    }
  }
  return analysis;
}

function blocksToMarkdown(valueBlocks) {
  return valueBlocks
    .flatMap((block) => {
      const lines = block.lines.length ? block.lines : [block.text];
      if (lines.every((line) => /^•\s*/.test(line))) {
        return [lines.map((line) => `- ${inlineTextToMarkdown(line.replace(/^•\s*/, ""))}`).join("\n")];
      }
      if (lines.some((line) => /^•\s*/.test(line))) {
        const beforeBullets = [];
        const bullets = [];
        for (const line of lines) {
          if (/^•\s*/.test(line)) bullets.push(`- ${inlineTextToMarkdown(line.replace(/^•\s*/, ""))}`);
          else beforeBullets.push(inlineTextToMarkdown(line));
        }
        return [beforeBullets.join("\n"), bullets.join("\n")].filter(Boolean);
      }
      return [lines.map(inlineTextToMarkdown).join("\n")];
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function inlineTextToMarkdown(value) {
  const clean = value.trim();
  if (!clean) return "";
  if (shouldEmphasizeStandalone(clean)) return `*${clean}*`;
  return clean;
}

function shouldEmphasizeStandalone(value) {
  const words = value.split(/\s+/).filter(Boolean);
  return (
    words.length <= 14 &&
    (/[+=>]/.test(value) ||
      /\b(?:not only|but also|rarely|never|hardly|scarcely|under no circumstances|which was|that was|would have|had \w+ed)\b/i.test(
        value,
      ))
  );
}

function extractStructureChoicesFromBlocks(questionBlocks) {
  const choices = {};
  const choiceBlock = questionBlocks.find((block) => normalizeLabel(block.lines[0]) === "pilihan");
  if (!choiceBlock) return choices;

  let activeChoice;
  for (const line of choiceBlock.lines.slice(1)) {
    const match = line.match(/^([A-D])\.\s*(.*)$/);
    if (match) {
      activeChoice = match[1];
      choices[activeChoice] = match[2].trim();
    } else if (activeChoice && line.trim()) {
      choices[activeChoice] = `${choices[activeChoice]} ${line.trim()}`.trim();
    }
  }

  for (const [key, value] of Object.entries(choices)) {
    choices[key] = stripOuterEmphasis(value);
  }
  return choices;
}

function extractWrittenPrompt(questionBlocks) {
  const questionBlock = questionBlocks.find((block) => normalizeLabel(block.lines[0]) === "soal");
  if (!questionBlock) return { questionText: "", choices: {} };

  const firstBreak = questionBlock.innerHtml.match(/<br\s*\/?>/i);
  const promptHtml = firstBreak
    ? questionBlock.innerHtml.slice((firstBreak.index ?? 0) + firstBreak[0].length)
    : questionBlock.innerHtml.replace(/^Soal\s*/i, "");
  const choices = {};
  const boldSegments = [...promptHtml.matchAll(/<strong>([\s\S]*?)<\/strong>/gi)];

  for (const segment of boldSegments) {
    const boldText = htmlToPlainText(segment[1]);
    const match = boldText.match(/^\[([A-D])\]\s*([\s\S]+)$/);
    if (match) choices[match[1]] = match[2].trim();
  }

  return {
    questionText: htmlToPlainText(promptHtml),
    choices,
  };
}

function validateCandidate(question, targetIssues) {
  const missingChoices = ANSWER_KEYS.filter((key) => !question.choices[key]?.trim());
  const missingOptionAnalysis = ANSWER_KEYS.filter((key) => !question.explanation.optionAnalysis[key]?.trim());
  const requiredFields = [
    ["questionText", question.questionText],
    ["correctAnswer", question.correctAnswer],
    ["summary", question.explanation.summary],
    ["reasoning", question.explanation.reasoning],
    ["toeflTrap", question.explanation.toeflTrap],
    ["quickNote", question.explanation.quickNote],
  ];
  if (question.section === "written-expression") {
    requiredFields.push(["sentenceStructureExplanation", question.sentenceStructureExplanation]);
  }

  for (const [field, value] of requiredFields) {
    if (!value?.trim()) targetIssues.push({ severity: "error", id: question.id, issue: `Missing ${field}.` });
  }
  if (!ANSWER_KEYS.includes(question.correctAnswer)) {
    targetIssues.push({ severity: "error", id: question.id, issue: "Invalid correct answer." });
  }
  if (missingChoices.length) {
    targetIssues.push({ severity: "error", id: question.id, issue: `Missing choices: ${missingChoices.join(", ")}.` });
  }
  if (missingOptionAnalysis.length) {
    targetIssues.push({
      severity: "error",
      id: question.id,
      issue: `Missing option analysis: ${missingOptionAnalysis.join(", ")}.`,
    });
  }
  if (question.section === "written-expression") {
    for (const key of ANSWER_KEYS) {
      const marker = `[${key}]`;
      const markerIndex = question.questionText.indexOf(marker);
      const optionStart = markerIndex + marker.length;
      const textAfterMarker = question.questionText.slice(optionStart).trimStart();
      if (markerIndex < 0 || !textAfterMarker.startsWith(question.choices[key] ?? "")) {
        targetIssues.push({
          severity: "error",
          id: question.id,
          issue: `Written choice ${key} does not match the bold text immediately after ${marker}.`,
        });
      }
    }
  }
  if (
    question.section === "written-expression" &&
    (!question.incorrectPart?.trim() || !question.correction?.trim() || !question.correctedSentence?.trim())
  ) {
    targetIssues.push({ severity: "error", id: question.id, issue: "Missing structured Written correction." });
  }
}

function appendMarkdown(current, addition) {
  return [current, addition].filter(Boolean).join("\n");
}

function textBlock(value) {
  return { type: "p", innerHtml: value, text: value, lines: value.split("\n").filter(Boolean) };
}

function blocksToPlainText(valueBlocks) {
  return valueBlocks.map((block) => block.text).filter(Boolean).join("\n\n").trim();
}

function htmlToPlainText(value) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function normalizeIdentity(value) {
  return value.replace(/[—–]/g, "-").replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim().toLowerCase();
}

function normalizeLabel(value = "") {
  return value.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim().replace(/:\s*$/, "").toLowerCase();
}

function isManagedAdditionalQuestion(question) {
  return SOURCES.some((source) => question.id.startsWith(`${source.key}-`));
}

function isSectionLabel(value) {
  const normalized = normalizeLabel(value);
  return SECTION_LABELS.some((label) => {
    const candidate = normalizeLabel(label);
    return normalized === candidate || normalized.startsWith(`${candidate}:`);
  });
}

function isDocumentTail(value) {
  return /^(?:TOEFL ITP|Structure|Written Expression|Soal [SW]\d|Batch|Penutup|Evaluasi)/i.test(value);
}

function stripOuterEmphasis(value) {
  return value.startsWith("*") && value.endsWith("*") ? value.slice(1, -1) : value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
