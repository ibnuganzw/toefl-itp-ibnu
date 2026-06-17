import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_FILES = [
  "src/data/imported/structureQuestions.json",
  "src/data/imported/writtenExpressionQuestions.json",
  "src/data/imported/readingPassages.json",
];
const REPORT_PATH = "docs/phase4-formatting-cleanup-report.json";

const CLEANABLE_KEYS = new Set([
  "summary",
  "reasoning",
  "whyCorrect",
  "toeflTrap",
  "quickNote",
  "sourceNotes",
  "sentenceStructureExplanation",
  "incorrectPart",
  "correction",
  "correctedSentence",
  "keyEvidence",
  "paraphrasedEvidence",
]);

const DRY_RUN = process.argv.includes("--dry-run");

const report = {
  generatedAt: new Date().toISOString(),
  mode: DRY_RUN ? "dry-run" : "write",
  scope: "Imported JSON formatting cleanup only. Source DOCX/HTML/TXT files are not modified.",
  files: DATA_FILES,
  changedFields: [],
  ambiguousFindings: [],
  summary: {
    fieldsChanged: 0,
    replacementsApplied: 0,
  },
};

for (const relativePath of DATA_FILES) {
  const absolutePath = path.join(ROOT, relativePath);
  const original = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const normalized = normalizeValue(original, [relativePath], relativePath);
  if (!DRY_RUN) {
    fs.writeFileSync(absolutePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  }
}

report.summary.fieldsChanged = report.changedFields.length;
report.summary.replacementsApplied = report.changedFields.reduce(
  (sum, change) => sum + change.replacements.length,
  0,
);

if (!DRY_RUN) {
  const reportAbsolutePath = path.join(ROOT, REPORT_PATH);
  const finalReport = fs.existsSync(reportAbsolutePath)
    ? mergeReports(JSON.parse(fs.readFileSync(reportAbsolutePath, "utf8")), report)
    : report;
  fs.writeFileSync(reportAbsolutePath, `${JSON.stringify(finalReport, null, 2)}\n`, "utf8");
}

console.log("Imported bank formatting cleanup");
console.log(`Mode: ${report.mode}`);
console.log(`Fields changed: ${report.summary.fieldsChanged}`);
console.log(`Replacements applied: ${report.summary.replacementsApplied}`);
console.log(`Ambiguous findings: ${report.ambiguousFindings.length}`);
if (!DRY_RUN) {
  console.log(`Report: ${REPORT_PATH}`);
}

function normalizeValue(value, fieldPath, filePath) {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeValue(item, [...fieldPath, index], filePath));
  }

  if (value && typeof value === "object") {
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = normalizeValue(child, [...fieldPath, key], filePath);
    }
    return next;
  }

  if (typeof value !== "string") {
    return value;
  }

  const key = String(fieldPath.at(-1));
  const parentKey = String(fieldPath.at(-2));
  const shouldClean =
    CLEANABLE_KEYS.has(key) ||
    (parentKey === "optionAnalysis" && ["A", "B", "C", "D"].includes(key));

  if (!shouldClean) {
    recordAmbiguousIfNeeded(value, fieldPath, filePath);
    return value;
  }

  const { text, replacements } = normalizeText(value);
  if (text !== value) {
    report.changedFields.push({
      file: filePath,
      path: fieldPath.join("."),
      replacements,
      beforeSnippet: snippet(value),
      afterSnippet: snippet(text),
    });
  }

  recordAmbiguousIfNeeded(text, fieldPath, filePath);
  return text;
}

function normalizeText(value) {
  let text = value;
  const replacements = [];

  for (const rule of rules()) {
    const before = text;
    text = text.replace(rule.pattern, (...args) => {
      const match = args[0];
      const replacement =
        typeof rule.replacement === "function" ? rule.replacement(...args) : rule.replacement;
      replacements.push({
        reason: rule.reason,
        before: match,
        after: replacement,
      });
      return replacement;
    });
    if (before === text && rule.reportIfPresent) {
      const match = before.match(rule.pattern);
      if (match) {
        replacements.push({
          reason: rule.reason,
          before: match[0],
          after: match[0],
          note: "Pattern detected but text was unchanged.",
        });
      }
    }
  }

  return { text, replacements };
}

function rules() {
  return [
    {
      pattern: /\b(benar|salah)(?=([A-Z][A-Za-zÀ-ÖØ-öø-ÿ]))/g,
      replacement: (_match, marker) => `${marker}. `,
      reason: "Inserted sentence break after Indonesian correctness marker joined to the next explanation word.",
    },
    {
      pattern: /\b(tidak salah)(?=([A-Z][A-Za-zÀ-ÖØ-öø-ÿ]))/g,
      replacement: (_match, marker) => `${marker}. `,
      reason: "Inserted sentence break after Indonesian non-error marker joined to the next explanation word.",
    },
    {
      pattern: /TOEFLTOEFL/g,
      replacement: "TOEFL\n\nTOEFL",
      reason: "Separated duplicated TOEFL heading/text token caused by DOCX paragraph joining.",
    },
    {
      pattern: /\b(Inti pola|Struktur kalimat|Analisis opsi|Analisis bagian A[–-]D|Jebakan TOEFL|Catatan cepat)(?=[A-Z•])/g,
      replacement: (_match, label) => `${label}\n\n`,
      reason: "Separated DOCX heading label joined to following text.",
    },
    {
      pattern: /\b(Soal|Pilihan)(?=A\.)/g,
      replacement: (_match, label) => `${label}\n\n`,
      reason: "Separated DOCX label joined to option list.",
    },
    {
      pattern: /\b(Soal)(?=[A-Z\[])/g,
      replacement: (_match, label) => `${label}\n\n`,
      reason: "Separated DOCX question label joined to question text.",
    },
    {
      pattern: /\b(Jawaban benar:\s*[A-D])(?=Bagian salah|Perbaikan|Kalimat benar)/g,
      replacement: (_match, label) => `${label}\n\n`,
      reason: "Separated answer label from following Written Expression metadata label.",
    },
    {
      pattern: /\b(Bagian salah:|Perbaikan:|Kalimat benar:)(?=\S)/g,
      replacement: (_match, label) => `${label} `,
      reason: "Added missing space after metadata label punctuation.",
    },
    {
      pattern: /([.!?])(?=([A-Z][a-zÀ-ÖØ-öø-ÿ]))/g,
      replacement: (_match, punctuation) => `${punctuation} `,
      reason: "Added missing space after sentence punctuation where next sentence was joined.",
    },
    {
      pattern: /([.!?])(?=([A-Z]\s))/g,
      replacement: (_match, punctuation) => `${punctuation} `,
      reason: "Added missing space after punctuation joined to a capitalized single-letter token.",
    },
  ];
}

function mergeReports(previous, current) {
  const previousRuns = previous.runs || [
    {
      generatedAt: previous.generatedAt,
      fieldsChanged: previous.summary?.fieldsChanged || previous.changedFields?.length || 0,
      replacementsApplied: previous.summary?.replacementsApplied || 0,
      note: "Earlier cleanup run.",
    },
  ];
  const changedFields = [...(previous.changedFields || []), ...current.changedFields];
  const ambiguousFindings = [...(previous.ambiguousFindings || []), ...current.ambiguousFindings];

  return {
    ...previous,
    generatedAt: current.generatedAt,
    mode: current.mode,
    files: [...new Set([...(previous.files || []), ...current.files])],
    changedFields,
    ambiguousFindings,
    summary: {
      fieldsChanged: changedFields.length,
      replacementsApplied:
        (previous.summary?.replacementsApplied || 0) + current.summary.replacementsApplied,
    },
    runs: [
      ...previousRuns,
      {
        generatedAt: current.generatedAt,
        fieldsChanged: current.summary.fieldsChanged,
        replacementsApplied: current.summary.replacementsApplied,
        note: "Additional cleanup run.",
      },
    ],
  };
}

function recordAmbiguousIfNeeded(value, fieldPath, filePath) {
  const ambiguousPatterns = [
    {
      pattern: /\bbenarnya\b/g,
      reason: "Looks like benar+nya but is normal Indonesian in many contexts; left unchanged.",
    },
  ];

  for (const item of ambiguousPatterns) {
    let match;
    while ((match = item.pattern.exec(value))) {
      report.ambiguousFindings.push({
        file: filePath,
        path: fieldPath.join("."),
        finding: match[0],
        snippet: snippet(value, match.index),
        reason: item.reason,
      });
    }
  }
}

function snippet(value, index = 0) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= 280) return clean;
  const center = Math.min(Math.max(index, 0), clean.length - 1);
  const start = Math.max(0, center - 120);
  const end = Math.min(clean.length, center + 160);
  return `${start > 0 ? "..." : ""}${clean.slice(start, end)}${end < clean.length ? "..." : ""}`;
}
