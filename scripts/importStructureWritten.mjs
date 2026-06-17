import fs from "node:fs";
import path from "node:path";

const DEFAULT_SOURCE = "C:\\Users\\ibnuh\\Downloads\\Soal TOEFL ITP\\Structure and Written.docx";
const source = getArg("--source") || DEFAULT_SOURCE;
const out = getArg("--out");
const mammoth = await loadMammoth();

if (!mammoth) {
  console.error("DOCX extraction requires mammoth. Run npm install, then rerun this script.");
  process.exit(1);
}

if (!fs.existsSync(source)) {
  console.error(`Source file not found: ${source}`);
  process.exit(1);
}

const result = await mammoth.extractRawText({ path: source });
const headings = detectHeadings(result.value);
const summary = summarize(headings);

console.log("Structure/Written import template");
console.log(`Source: ${source}`);
for (const [prefix, values] of Object.entries(summary.byPrefix)) {
  console.log(`${prefix}: ${values.length}${values.length ? ` (${values[0]}-${values.at(-1)})` : ""}`);
}
console.log(`Detected Structure total: ${summary.structureCount}`);
console.log(`Detected Written total: ${summary.writtenCount}`);
console.log(`Detected total: ${summary.totalCount}`);
console.log("No active bank JSON was written. Review parsed fields before promoting items to src/data/imported.");

if (out) {
  const outputPath = path.resolve(out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        source,
        generatedAt: new Date().toISOString(),
        status: "detected-headings-only",
        summary,
        headings,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote detection report: ${outputPath}`);
}

function detectHeadings(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(?:\d+\.\s*)?(LS|LW|AS|AW|BS|BW)(\d+)\b/i);
      if (!match) return null;
      return {
        legacyId: `${match[1].toUpperCase()}${match[2]}`,
        prefix: match[1].toUpperCase(),
        number: Number(match[2]),
        title: line,
      };
    })
    .filter(Boolean);
}

function summarize(headings) {
  const byPrefix = {};
  for (const prefix of ["LS", "LW", "AS", "AW", "BS", "BW"]) {
    byPrefix[prefix] = [
      ...new Set(headings.filter((heading) => heading.prefix === prefix).map((heading) => heading.number)),
    ].sort((a, b) => a - b);
  }
  const structureCount = byPrefix.LS.length + byPrefix.AS.length + byPrefix.BS.length;
  const writtenCount = byPrefix.LW.length + byPrefix.AW.length + byPrefix.BW.length;
  return {
    byPrefix,
    structureCount,
    writtenCount,
    totalCount: structureCount + writtenCount,
  };
}

async function loadMammoth() {
  try {
    return await import("mammoth");
  } catch {
    return null;
  }
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
