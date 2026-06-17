import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REPORT_PATH = "docs/phase4-formatting-cleanup-report.json";
const reportFile = path.join(ROOT, REPORT_PATH);
const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const files = new Map();

for (const relativePath of report.files) {
  files.set(relativePath, JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")));
}

let repairedFields = 0;
let repairedTokens = 0;

for (const change of report.changedFields) {
  const data = files.get(change.file);
  if (!data) continue;

  const fieldPath = change.path.slice(`${change.file}.`.length).split(".");
  const current = getAtPath(data, fieldPath);
  if (typeof current !== "string") continue;

  let repaired = current;
  for (const replacement of change.replacements) {
    const intended = intendedReplacement(replacement);
    if (!intended) continue;
    if (repaired.includes(replacement.after)) {
      repaired = repaired.replace(replacement.after, intended);
      replacement.after = intended;
      repairedTokens += 1;
    }
  }

  if (repaired !== current) {
    setAtPath(data, fieldPath, repaired);
    change.afterSnippet = snippet(repaired);
    repairedFields += 1;
  }
}

for (const [relativePath, data] of files.entries()) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

report.backreferenceRepair = {
  repairedAt: new Date().toISOString(),
  repairedFields,
  repairedTokens,
  reason:
    "Repair literal $1 placeholders created by the first cleanup run's replacement-callback bug.",
};
fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("Formatting cleanup backreference repair");
console.log(`Fields repaired: ${repairedFields}`);
console.log(`Tokens repaired: ${repairedTokens}`);

function intendedReplacement(replacement) {
  if (replacement.after === "$1. ") {
    return `${replacement.before}. `;
  }
  if (replacement.after === "$1\n\n") {
    return `${replacement.before}\n\n`;
  }
  if (replacement.after === "$1 ") {
    return `${replacement.before} `;
  }
  return null;
}

function getAtPath(value, parts) {
  let current = value;
  for (const part of parts) {
    current = current?.[numericOrString(part)];
  }
  return current;
}

function setAtPath(value, parts, nextValue) {
  let current = value;
  for (const part of parts.slice(0, -1)) {
    current = current[numericOrString(part)];
  }
  current[numericOrString(parts.at(-1))] = nextValue;
}

function numericOrString(value) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function snippet(value) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= 280) return clean;
  return `${clean.slice(0, 260)}...`;
}
