import fs from "node:fs";
import path from "node:path";

const DEFAULT_SOURCE = "C:\\Users\\ibnuh\\Downloads\\Soal TOEFL ITP\\Reading Comprehension.docx";
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
const detection = detectReading(result.value);

console.log("Reading import template");
console.log(`Source: ${source}`);
for (const group of detection.questionGroups) {
  console.log(`${group.prefix}: ${group.count}${group.count ? ` (${group.first}-${group.last})` : ""}`);
}
console.log(`Detected passage headings: ${detection.passageHeadings.length}`);
console.log(`Detected Reading question total: ${detection.totalQuestionCount}`);
console.log("No active bank JSON was written. Reading questions must stay nested under verified passages.");

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
        detection,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote detection report: ${outputPath}`);
}

function detectReading(text) {
  const questionMap = new Map();
  const passageHeadings = [];
  for (const line of text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const passageHeading = line.match(/^(?:Passage|Naskah)\s+\d+\b.+/i);
    if (passageHeading) {
      passageHeadings.push(line);
    }

    const question = line.match(/^([A-Z]{1,8}Q)(\d+)\s*[-–—]\s+/i);
    if (!question) continue;
    const prefix = question[1].toUpperCase();
    const number = Number(question[2]);
    if (!questionMap.has(prefix)) questionMap.set(prefix, new Set());
    questionMap.get(prefix).add(number);
  }

  const questionGroups = [...questionMap.entries()].map(([prefix, valuesSet]) => {
    const values = [...valuesSet].sort((a, b) => a - b);
    return {
      prefix,
      count: values.length,
      first: values[0],
      last: values.at(-1),
      numbers: values,
    };
  });

  return {
    passageHeadings,
    questionGroups,
    totalQuestionCount: questionGroups.reduce((sum, group) => sum + group.count, 0),
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
