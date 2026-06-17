import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

const ROOT = process.cwd();
const DEFAULT_SOURCE = "C:\\Users\\ibnuh\\Downloads\\Revisi Premium TOEFL ITP SW Part 1.docx";
const STRUCTURE_PATH = path.join(ROOT, "src", "data", "imported", "structureQuestions.json");
const WRITTEN_PATH = path.join(ROOT, "src", "data", "imported", "writtenExpressionQuestions.json");
const REPORT_PATH = path.join(ROOT, "docs", "premium-structure-written-explanation-import-report.json");
const ANSWER_KEYS = ["A", "B", "C", "D"];
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

const source = getArg("--source") ?? DEFAULT_SOURCE;
const shouldWrite = process.argv.includes("--write");

if (!fs.existsSync(source)) throw new Error(`Source document not found: ${source}`);

const structureQuestions = readJson(STRUCTURE_PATH);
const writtenQuestions = readJson(WRITTEN_PATH);
const questionsById = new Map([...structureQuestions, ...writtenQuestions].map((question) => [question.id, question]));
const html = (await mammoth.convertToHtml({ path: source })).value;
const blocks = parseTopLevelBlocks(html);
const sourceQuestions = parseSourceQuestions(blocks);
const audit = [];

for (const sourceQuestion of sourceQuestions) {
  const bankQuestion = questionsById.get(sourceQuestion.id);
  if (!bankQuestion) {
    audit.push({ id: sourceQuestion.id, severity: "error", issue: "Question ID is missing from the active bank." });
    continue;
  }

  compareQuestionIdentity(bankQuestion, sourceQuestion, audit);
  bankQuestion.questionText = sourceQuestion.questionText;
  bankQuestion.choices = sourceQuestion.choices;
  bankQuestion.explanation = {
    ...bankQuestion.explanation,
    summary: sourceQuestion.summary,
    reasoning: sourceQuestion.reasoning,
    whyCorrect: sourceQuestion.optionAnalysis[bankQuestion.correctAnswer] ?? sourceQuestion.reasoning,
    optionAnalysis: sourceQuestion.optionAnalysis,
    toeflTrap: sourceQuestion.toeflTrap,
    quickNote: sourceQuestion.quickNote,
    sourceNotes: sourceQuestion.sourceNotes,
  };
  bankQuestion.sentenceStructureExplanation = sourceQuestion.sentenceStructureExplanation;

  if (bankQuestion.section === "written-expression") {
    bankQuestion.incorrectPart = sourceQuestion.incorrectPart;
    bankQuestion.correction = sourceQuestion.correction;
    bankQuestion.correctedSentence = sourceQuestion.correctedSentence;
  }
}

const missingSourceIds = [...questionsById.keys()].filter((id) => !sourceQuestions.some((question) => question.id === id));
for (const id of missingSourceIds) {
  audit.push({ id, severity: "error", issue: "Active bank question is missing from the revision document." });
}

const report = {
  generatedAt: new Date().toISOString(),
  source,
  mode: shouldWrite ? "write" : "dry-run",
  detectedQuestionCount: sourceQuestions.length,
  updatedStructureCount: sourceQuestions.filter((question) => question.section === "structure").length,
  updatedWrittenCount: sourceQuestions.filter((question) => question.section === "written-expression").length,
  audit,
};

const errors = audit.filter((item) => item.severity === "error");
if (errors.length) {
  console.error(JSON.stringify(report, null, 2));
  throw new Error(`Premium explanation import stopped because ${errors.length} identity audit error(s) were found.`);
}

if (shouldWrite) {
  writeJson(STRUCTURE_PATH, structureQuestions);
  writeJson(WRITTEN_PATH, writtenQuestions);
  writeJson(REPORT_PATH, report);
}

console.log("Premium Structure/Written explanation import");
console.log(`Source: ${source}`);
console.log(`Mode: ${report.mode}`);
console.log(`Detected questions: ${report.detectedQuestionCount}`);
console.log(`Structure explanations: ${report.updatedStructureCount}`);
console.log(`Written explanations: ${report.updatedWrittenCount}`);
console.log(`Identity audit warnings: ${audit.length}`);
if (!shouldWrite) console.log("Dry run only. Add --write after reviewing the identity audit.");

function parseTopLevelBlocks(value) {
  return [...value.matchAll(/<(p|ul|ol)>([\s\S]*?)<\/\1>/g)].map((match) => {
    const type = match[1];
    const innerHtml = match[2];
    const text = htmlToPlainText(innerHtml);
    const leadingStrong = innerHtml.match(/^<strong>([\s\S]*?)<\/strong>/)?.[1];
    return {
      type,
      innerHtml,
      text,
      label: leadingStrong ? htmlToPlainText(leadingStrong) : "",
    };
  });
}

function parseSourceQuestions(allBlocks) {
  const headings = allBlocks
    .map((block, index) => {
      const match = block.text.match(/^(?:\d+\.\s*)?((?:LS|LW|AS|AW|BS|BW)\d+)\s*[—–-]\s*(.+)$/);
      return match ? { index, id: match[1], title: match[2].trim() } : null;
    })
    .filter(Boolean);
  const actualHeadings = headings.filter(({ index }) => normalizeLabel(allBlocks[index + 1]?.label) === "soal");

  return actualHeadings.map((heading) => {
    const nextBoundary = headings.find((candidate) => candidate.index > heading.index)?.index ?? allBlocks.length;
    const questionBlocks = allBlocks.slice(heading.index, nextBoundary);
    const section = /^(?:LS|AS|BS)/.test(heading.id) ? "structure" : "written-expression";
    const correctAnswer = questionBlocks
      .map((block) => block.text.match(/^Jawaban benar\s*:\s*([A-D])/i)?.[1])
      .find(Boolean);
    const optionAnalysis = extractOptionAnalysis(questionBlocks);

    return {
      id: heading.id,
      title: heading.title,
      section,
      questionText: extractSingleSection(questionBlocks, ["Soal"]),
      choices:
        section === "structure"
          ? extractStructureChoices(extractSection(questionBlocks, ["Pilihan"]))
          : extractWrittenChoices(extractSingleSection(questionBlocks, ["Soal"])),
      correctAnswer,
      summary: extractSection(questionBlocks, ["Inti pola"]),
      reasoning: extractSection(questionBlocks, ["Cara membaca kalimat"]),
      sentenceStructureExplanation: extractSection(questionBlocks, [
        "Struktur kalimat",
        "Struktur kalimat setelah diperbaiki",
      ]),
      optionAnalysis,
      toeflTrap: extractSection(questionBlocks, ["Jebakan TOEFL"]),
      quickNote: extractSection(questionBlocks, ["Catatan cepat"]),
      incorrectPart: extractSingleSection(questionBlocks, ["Bagian salah"]),
      correction: extractSingleSection(questionBlocks, ["Perbaikan"]),
      correctedSentence: stripOuterEmphasis(extractSingleSection(questionBlocks, ["Kalimat benar"])),
      sourceNotes: blocksToPlainText(questionBlocks),
    };
  });
}

function extractOptionAnalysis(questionBlocks) {
  const start = questionBlocks.findIndex((block) =>
    ["analisis pilihan", "analisis bagian a-d"].includes(normalizeLabel(block.label)),
  );
  if (start < 0) return {};

  const analysis = {};
  for (const block of questionBlocks.slice(start + 1)) {
    if (["jebakan toefl", "catatan cepat"].includes(normalizeLabel(block.label))) break;
    const match = block.label.match(/^([A-D])\.\s*(.+)$/);
    if (!match) continue;
    const bodyHtml = stripLeadingStrong(block.innerHtml);
    analysis[match[1]] = blocksToMarkdown([{ ...block, innerHtml: bodyHtml, label: "", text: htmlToPlainText(bodyHtml) }]);
  }
  return analysis;
}

function extractSection(questionBlocks, labels) {
  const labelSet = new Set(labels.map(normalizeLabel));
  const start = questionBlocks.findIndex((block) => labelSet.has(normalizeLabel(block.label)));
  if (start < 0) return "";

  const values = [];
  const firstRemainder = stripLeadingStrong(questionBlocks[start].innerHtml);
  if (htmlToPlainText(firstRemainder)) {
    values.push({ ...questionBlocks[start], innerHtml: firstRemainder, label: "", text: htmlToPlainText(firstRemainder) });
  }

  for (const block of questionBlocks.slice(start + 1)) {
    if (isSectionLabel(block.label) || isDocumentTail(block.text)) break;
    values.push(block);
  }
  return blocksToMarkdown(values);
}

function extractSingleSection(questionBlocks, labels) {
  const value = extractSection(questionBlocks, labels);
  return value.split(/\n{2,}/)[0]?.replace(/^>\s*/, "").trim() ?? "";
}

function blocksToMarkdown(valueBlocks) {
  return valueBlocks
    .map((block) => {
      if (block.type === "ul" || block.type === "ol") {
        const marker = block.type === "ul" ? "- " : "1. ";
        return [...block.innerHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)]
          .map((match) => `${marker}${inlineHtmlToMarkdown(match[1])}`)
          .join("\n");
      }

      const fullStrong = block.innerHtml.match(/^<strong>([\s\S]*?)<\/strong>$/);
      if (fullStrong && wordCount(htmlToPlainText(fullStrong[1])) > 12) {
        return `> ${htmlToPlainText(fullStrong[1])}`;
      }
      return inlineHtmlToMarkdown(block.innerHtml);
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function inlineHtmlToMarkdown(value) {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, (_, content) => emphasizeInline(content))
      .replace(/<em>([\s\S]*?)<\/em>/gi, (_, content) => emphasizeInline(content))
      .replace(/<[^>]+>/g, ""),
  ).trim();
}

function emphasizeInline(value) {
  const text = htmlToPlainText(value);
  return wordCount(text) <= 12 ? `*${text}*` : text;
}

function stripLeadingStrong(value) {
  return value.replace(/^<strong>[\s\S]*?<\/strong>(?:<br\s*\/?>)?/, "");
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

function compareQuestionIdentity(bankQuestion, sourceQuestion, audit) {
  if (normalizeIdentity(bankQuestion.questionText) !== normalizeIdentity(sourceQuestion.questionText)) {
    audit.push({
      id: sourceQuestion.id,
      severity: "warning",
      issue: "Question text was synchronized to the revision document.",
      bank: bankQuestion.questionText,
      source: sourceQuestion.questionText,
    });
  }
  for (const key of ANSWER_KEYS) {
    if (normalizeIdentity(bankQuestion.choices[key]) !== normalizeIdentity(sourceQuestion.choices[key])) {
      audit.push({
        id: sourceQuestion.id,
        severity: "warning",
        issue: `Choice ${key} was synchronized to the revision document.`,
        bank: bankQuestion.choices[key],
        source: sourceQuestion.choices[key],
      });
    }
  }
  if (bankQuestion.correctAnswer !== sourceQuestion.correctAnswer) {
    audit.push({
      id: sourceQuestion.id,
      severity: "error",
      issue: `Correct answer differs: bank ${bankQuestion.correctAnswer}, source ${sourceQuestion.correctAnswer}.`,
    });
  }
  for (const field of ["summary", "reasoning", "toeflTrap", "quickNote"]) {
    if (!sourceQuestion[field]?.trim()) {
      audit.push({ id: sourceQuestion.id, severity: "error", issue: `Revision document is missing ${field}.` });
    }
  }
  for (const key of ANSWER_KEYS) {
    if (!sourceQuestion.optionAnalysis[key]?.trim()) {
      audit.push({ id: sourceQuestion.id, severity: "error", issue: `Revision document is missing option analysis ${key}.` });
    }
  }
}

function extractStructureChoices(value) {
  const choices = {};
  const matches = [...value.matchAll(/(?:^|\n)([A-D])\.\s*([\s\S]*?)(?=\n[A-D]\.\s*|$)/g)];
  for (const match of matches) choices[match[1]] = match[2].trim();
  return choices;
}

function extractWrittenChoices(value) {
  const choices = {};
  const matches = [...value.matchAll(/\[([A-D])\]\s*([\s\S]*?)(?=\s*\[[A-D]\]|$)/g)];
  for (const match of matches) choices[match[1]] = match[2].trim();
  return choices;
}

function normalizeIdentity(value) {
  return value
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim()
    .toLowerCase();
}

function normalizeLabel(value = "") {
  return value.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}

function isSectionLabel(value) {
  const normalized = normalizeLabel(value);
  return SECTION_LABELS.some((label) => {
    const candidate = normalizeLabel(label);
    return normalized === candidate || normalized.startsWith(`${candidate}:`);
  });
}

function isDocumentTail(value) {
  return /^(?:Evaluasi|Revisi Premium|Penutup|Catatan cakupan|Catatan audit|Daftar|Batch|Standar final)/i.test(value);
}

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function stripOuterEmphasis(value) {
  return value.startsWith("*") && value.endsWith("*") ? value.slice(1, -1) : value;
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
