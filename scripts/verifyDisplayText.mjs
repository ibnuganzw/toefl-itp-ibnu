import fs from "node:fs";
import path from "node:path";
import { cleanDisplayText } from "../src/utils/displayText.ts";

const root = process.cwd();
const importedDataDir = path.join(root, "src", "data", "imported");
const renderedQuestionFields = new Set([
  "summary",
  "reasoning",
  "whyCorrect",
  "toeflTrap",
  "quickNote",
  "sentenceStructureExplanation",
  "evidenceLocation",
  "keyEvidence",
  "paraphrasedEvidence",
  "listeningSkill",
  "cue",
  "incorrectPart",
  "correction",
  "correctedSentence",
]);
const leadingJudgmentPatterns = [
  /^\s*(?:[A-D]\s*[.)]\s*)?(?:opsi\s+ini\s+)?(?:tidak\s+)?(?:benar|salah)(?:\s+sebagai\s+jawaban\s+except)?(?:(?:\s+karena\s+)|\s*(?:[.!,:;]|[-\u2013\u2014])+\s*)/i,
  /^\s*(?:[A-D]\s*[.)]\s*)?[^.!?\n]{1,140}?\s+[-\u2013\u2014]+\s+(?:tidak\s+)?(?:benar|salah)(?:\s+sebagai\s+jawaban\s+except)?(?:(?:\s+karena\s+)|\s*(?:[.!,:;]|[-\u2013\u2014])+\s*)/i,
  /^\s*(?:[A-D]\s*[.)]\s*)?[^,.!?;:\n]{1,100}?\s+(?:tidak\s+)?(?:benar|salah)(?:\s+sebagai\s+jawaban\s+except)?\s+karena\s+/i,
];
const renderedFields = [];

for (const fileName of fs.readdirSync(importedDataDir).filter((file) => file.endsWith(".json"))) {
  const value = JSON.parse(fs.readFileSync(path.join(importedDataDir, fileName), "utf8"));
  collectRenderedFields(value, [], fileName);
}

const emptyFields = renderedFields.filter(({ raw, clean }) => raw.trim() && !clean);
const residualFields = renderedFields.filter(({ clean }) =>
  clean.split(/\n{2,}/).some((paragraph) => leadingJudgmentPatterns.some((pattern) => pattern.test(paragraph))),
);
const nonIdempotentFields = renderedFields.filter(({ clean }) => cleanDisplayText(clean) !== clean);

assert(emptyFields.length === 0, `${emptyFields.length} rendered explanation fields became empty after cleanup.`);
assert(residualFields.length === 0, `${residualFields.length} leading answer judgments remain visible.`);
assert(nonIdempotentFields.length === 0, `${nonIdempotentFields.length} fields still contain stacked cleanup artifacts.`);

console.log("Display text verification OK");
console.log(`Rendered explanation fields checked: ${renderedFields.length}`);
console.log(`Fields cleaned for display: ${renderedFields.filter(({ raw, clean }) => raw !== clean).length}`);

function collectRenderedFields(value, trail, fileName) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRenderedFields(item, [...trail, index], fileName));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const nextTrail = [...trail, key];
    if (
      typeof child === "string" &&
      (renderedQuestionFields.has(key) || trail.includes("optionAnalysis"))
    ) {
      renderedFields.push({
        fileName,
        fieldPath: nextTrail.join("."),
        raw: child,
        clean: cleanDisplayText(child),
      });
    }
    collectRenderedFields(child, nextTrail, fileName);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
