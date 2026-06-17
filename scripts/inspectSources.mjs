import fs from "node:fs";
import path from "node:path";

const DEFAULT_SOURCES = {
  html: "C:\\Users\\ibnuh\\Downloads\\Test_TOEFL_revisi_FIX_kunci_C.html",
  structureWritten: "C:\\Users\\ibnuh\\Downloads\\Soal TOEFL ITP\\Structure and Written.docx",
  reading: "C:\\Users\\ibnuh\\Downloads\\Soal TOEFL ITP\\Reading Comprehension.docx",
};

const mammoth = await loadMammoth();

console.log("Source inventory");
console.log("================");
inspectHtml(DEFAULT_SOURCES.html);
await inspectDocx("Structure/Written DOCX", DEFAULT_SOURCES.structureWritten, detectStructureWritten);
await inspectDocx("Reading DOCX", DEFAULT_SOURCES.reading, detectReading);

async function loadMammoth() {
  try {
    return await import("mammoth");
  } catch {
    return null;
  }
}

function inspectHtml(filePath) {
  console.log("");
  console.log("Old HTML app reference");
  console.log(`Path: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.log("Status: missing");
    return;
  }
  const html = fs.readFileSync(filePath, "utf8");
  console.log(`Bytes: ${fs.statSync(filePath).size}`);
  console.log(`Simulation A mentions: ${count(html, /Simulation\s*A|Simulasi\s*A/gi)}`);
  console.log(`Simulation B mentions: ${count(html, /Simulation\s*B|Simulasi\s*B/gi)}`);
  console.log(`Mode Belajar mentions: ${count(html, /Mode\s*Belajar|belajar|learning/gi)}`);
  console.log(`Timer mentions: ${count(html, /timer/gi)}`);
  console.log(`Ragu/doubt mentions: ${count(html, /ragu|doubt/gi)}`);
  console.log("Role: behavior reference only");
}

async function inspectDocx(label, filePath, detector) {
  console.log("");
  console.log(label);
  console.log(`Path: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.log("Status: missing");
    return;
  }
  console.log(`Bytes: ${fs.statSync(filePath).size}`);
  if (!mammoth) {
    console.log("Status: DOCX text extraction requires npm install for mammoth.");
    return;
  }
  const result = await mammoth.extractRawText({ path: filePath });
  detector(result.value);
}

function detectStructureWritten(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const groups = new Map();
  for (const line of lines) {
    const match = line.match(/^(?:\d+\.\s*)?(LS|LW|AS|AW|BS|BW)(\d+)\b/i);
    if (!match) continue;
    const prefix = match[1].toUpperCase();
    const number = Number(match[2]);
    if (!groups.has(prefix)) groups.set(prefix, new Set());
    groups.get(prefix).add(number);
  }
  for (const prefix of ["LS", "LW", "AS", "AW", "BS", "BW"]) {
    const values = [...(groups.get(prefix) || [])].sort((a, b) => a - b);
    console.log(`${prefix}: ${values.length}${values.length ? ` (${values[0]}-${values.at(-1)})` : ""}`);
  }
  const structureCount = (groups.get("LS")?.size || 0) + (groups.get("AS")?.size || 0) + (groups.get("BS")?.size || 0);
  const writtenCount = (groups.get("LW")?.size || 0) + (groups.get("AW")?.size || 0) + (groups.get("BW")?.size || 0);
  console.log(`Detected Structure total: ${structureCount}`);
  console.log(`Detected Written total: ${writtenCount}`);
  console.log(`Detected Structure/Written total: ${structureCount + writtenCount}`);
}

function detectReading(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const questionGroups = new Map();
  const passageHeadings = [];
  for (const line of lines) {
    const passageHeading = line.match(/^(?:Passage|Naskah)\s+\d+\b.+/i);
    if (passageHeading) {
      passageHeadings.push(line);
    }

    const question = line.match(/^([A-Z]{1,8}Q)(\d+)\s*[-–—]\s+/i);
    if (!question) continue;
    const prefix = question[1].toUpperCase();
    const number = Number(question[2]);
    if (!questionGroups.has(prefix)) questionGroups.set(prefix, new Set());
    questionGroups.get(prefix).add(number);
  }

  for (const [prefix, valuesSet] of questionGroups.entries()) {
    const values = [...valuesSet].sort((a, b) => a - b);
    console.log(`${prefix}: ${values.length}${values.length ? ` (${values[0]}-${values.at(-1)})` : ""}`);
  }
  const questionCount = [...questionGroups.values()].reduce((sum, values) => sum + values.size, 0);
  console.log(`Detected passage headings: ${passageHeadings.length}`);
  console.log(`Detected Reading question total: ${questionCount}`);
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}
