import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STRUCTURE_PATH = "src/data/imported/structureQuestions.json";
const WRITTEN_PATH = "src/data/imported/writtenExpressionQuestions.json";
const READING_PATH = "src/data/imported/readingPassages.json";
const REPORT_PATH = "docs/phase4-source-notes-repair-report.json";
const DRY_RUN = process.argv.includes("--dry-run");

const structure = readJson(STRUCTURE_PATH);
const written = readJson(WRITTEN_PATH);
const readingBefore = readJson(READING_PATH);

const beforeSnapshot = {
  structure: structuredClone(structure),
  written: structuredClone(written),
  reading: structuredClone(readingBefore),
};

const report = {
  generatedAt: new Date().toISOString(),
  mode: DRY_RUN ? "dry-run" : "write",
  scope: "Targeted Phase 4 sourceNotes label-order repair only.",
  changedFields: [],
  skippedFields: [],
  integrity: {},
};

repairStructureSourceNotes();
repairWrittenSourceNotes("LW45");
repairWrittenSourceNotes("AW12");

report.integrity = compareIntegrity(beforeSnapshot, { structure, written, reading: readingBefore });

if (!DRY_RUN) {
  writeJson(STRUCTURE_PATH, structure);
  writeJson(WRITTEN_PATH, written);
  writeJson(REPORT_PATH, report);
}

console.log("Phase 4 sourceNotes label-order repair");
console.log(`Mode: ${report.mode}`);
console.log(`Changed sourceNotes fields: ${report.changedFields.length}`);
console.log(`Skipped sourceNotes fields: ${report.skippedFields.length}`);
console.log(`Report: ${REPORT_PATH}`);

function repairStructureSourceNotes() {
  for (const question of structure) {
    const current = question.explanation?.sourceNotes;
    if (typeof current !== "string") continue;

    const title = getTitleLine(current);
    const restStart = current.indexOf("\n\nJawaban benar");
    if (!title || restStart < 0) {
      report.skippedFields.push({
        id: question.id,
        file: STRUCTURE_PATH,
        path: sourceNotesPath(question.id),
        reason: "Could not safely locate title line or Jawaban benar marker.",
        snippet: snippet(current),
      });
      continue;
    }

    const frontMatter = current.slice(title.length, restStart);
    const pilihanIndex = frontMatter.indexOf("\n\nPilihan\n\n");
    const soalIndex = frontMatter.indexOf("\n\nSoal\n\n");
    const hasReversedLabels = pilihanIndex >= 0 && soalIndex >= 0 && pilihanIndex < soalIndex;

    if (!hasReversedLabels) continue;

    const questionText = frontMatter.slice(pilihanIndex + "\n\nPilihan\n\n".length, soalIndex).trim();
    const optionText = frontMatter.slice(soalIndex + "\n\nSoal\n\n".length).trim();

    if (!matchesNormalized(questionText, question.questionText)) {
      report.skippedFields.push({
        id: question.id,
        file: STRUCTURE_PATH,
        path: sourceNotesPath(question.id),
        reason: "Reversed label repair skipped because the detected question text does not match questionText.",
        snippet: snippet(current),
      });
      continue;
    }

    if (!looksLikeOptionList(optionText, question.choices)) {
      report.skippedFields.push({
        id: question.id,
        file: STRUCTURE_PATH,
        path: sourceNotesPath(question.id),
        reason: "Reversed label repair skipped because the detected option list does not match choices A-D.",
        snippet: snippet(current),
      });
      continue;
    }

    const repaired = [
      title,
      "",
      "Soal",
      "",
      questionText,
      "",
      "Pilihan",
      "",
      optionText,
      current.slice(restStart),
    ].join("\n");

    setSourceNotes(question, repaired, {
      file: STRUCTURE_PATH,
      reason: "Restored Structure sourceNotes order from Pilihan/question and Soal/options back to Soal/question then Pilihan/options.",
      before: current,
      after: repaired,
    });
  }
}

function repairWrittenSourceNotes(id) {
  const question = written.find((item) => item.id === id);
  const current = question?.explanation?.sourceNotes;
  if (!question || typeof current !== "string") {
    report.skippedFields.push({
      id,
      file: WRITTEN_PATH,
      path: sourceNotesPath(id),
      reason: "Question or sourceNotes field was not found.",
    });
    return;
  }

  const title = getTitleLine(current);
  const answerIndex = current.indexOf("\n\nJawaban benar:");
  const structureIndex = current.indexOf("\n\nStruktur kalimat\n\n");
  const catatanIndex = current.indexOf("\n\nCatatan cepat\n\n");
  const analysisIndex = current.indexOf("\n\nAnalisis bagian");
  const finalSoalIndex = current.lastIndexOf("\n\nSoal\n\n");

  if (
    !title ||
    answerIndex < 0 ||
    structureIndex < 0 ||
    catatanIndex < 0 ||
    analysisIndex < 0 ||
    finalSoalIndex < 0 ||
    !(answerIndex < structureIndex && structureIndex < catatanIndex && catatanIndex < analysisIndex)
  ) {
    report.skippedFields.push({
      id,
      file: WRITTEN_PATH,
      path: sourceNotesPath(id),
      reason: "Could not safely locate the expected suspicious Written sourceNotes labels.",
      snippet: snippet(current),
    });
    return;
  }

  const firstHeading = current.slice(title.length, answerIndex);
  if (!firstHeading.startsWith("\n\nInti pola\n\n")) {
    report.skippedFields.push({
      id,
      file: WRITTEN_PATH,
      path: sourceNotesPath(id),
      reason: "Written repair skipped because the first heading is not the suspicious Inti pola marker.",
      snippet: snippet(current),
    });
    return;
  }

  const detectedQuestionText = firstHeading.slice("\n\nInti pola\n\n".length).trim();
  if (!matchesNormalized(detectedQuestionText, question.questionText)) {
    report.skippedFields.push({
      id,
      file: WRITTEN_PATH,
      path: sourceNotesPath(id),
      reason: "Written repair skipped because the detected question text does not match questionText.",
      snippet: snippet(current),
    });
    return;
  }

  const metadata = current.slice(answerIndex, structureIndex);
  const summary = current.slice(structureIndex + "\n\nStruktur kalimat\n\n".length, catatanIndex).trim();
  const sentenceStructure = current
    .slice(catatanIndex + "\n\nCatatan cepat\n\n".length, analysisIndex)
    .trim();
  const analysisThroughTrap = current.slice(analysisIndex, finalSoalIndex);
  const quickNote = current.slice(finalSoalIndex + "\n\nSoal\n\n".length).trim();

  if (
    !matchesNormalized(summary, question.explanation.summary) ||
    !matchesNormalized(sentenceStructure, question.sentenceStructureExplanation) ||
    !matchesNormalized(quickNote, question.explanation.quickNote)
  ) {
    report.skippedFields.push({
      id,
      file: WRITTEN_PATH,
      path: sourceNotesPath(id),
      reason: "Written repair skipped because one or more label blocks did not match the validated structured fields.",
      snippet: snippet(current),
    });
    return;
  }

  const repaired = [
    title,
    "",
    "Soal",
    "",
    detectedQuestionText,
    metadata,
    "",
    "Inti pola",
    "",
    summary,
    "",
    "Struktur kalimat",
    "",
    sentenceStructure,
    analysisThroughTrap,
    "",
    "Catatan cepat",
    "",
    quickNote,
  ].join("\n");

  setSourceNotes(question, repaired, {
    file: WRITTEN_PATH,
    reason: "Restored Written sourceNotes labels so Soal, Inti pola, Struktur kalimat, and Catatan cepat match their original block meanings.",
    before: current,
    after: repaired,
  });
}

function setSourceNotes(question, value, change) {
  question.explanation.sourceNotes = value;
  report.changedFields.push({
    id: question.id,
    file: change.file,
    path: sourceNotesPath(question.id),
    beforeSnippet: snippet(change.before),
    afterSnippet: snippet(change.after),
    reason: change.reason,
  });
}

function compareIntegrity(before, after) {
  return {
    changedIdFields:
      changedFields(before.structure, after.structure, ["id", "sourceId", "legacyId"]) +
      changedFields(before.written, after.written, ["id", "sourceId", "legacyId"]),
    changedCorrectAnswerFields:
      changedFields(before.structure, after.structure, ["correctAnswer"]) +
      changedFields(before.written, after.written, ["correctAnswer"]) +
      changedReadingQuestions(before.reading, after.reading, ["correctAnswer"]),
    changedChoiceFields:
      changedChoiceFields(before.structure, after.structure) +
      changedChoiceFields(before.written, after.written) +
      changedReadingChoices(before.reading, after.reading),
    changedQuestionTextFields:
      changedFields(before.structure, after.structure, ["questionText"]) +
      changedFields(before.written, after.written, ["questionText"]) +
      changedReadingQuestions(before.reading, after.reading, ["questionText"]),
    changedReadingPassageTextFields: changedReadingPassageText(before.reading, after.reading),
    changedReadingNesting: changedReadingNesting(before.reading, after.reading),
    changedNonSourceNotesFields:
      changedNonSourceNotesFields(before.structure, after.structure) +
      changedNonSourceNotesFields(before.written, after.written) +
      changedNonSourceNotesFields(before.reading, after.reading),
  };
}

function changedFields(before, after, keys) {
  let count = 0;
  for (let index = 0; index < before.length; index += 1) {
    for (const key of keys) {
      if (before[index]?.[key] !== after[index]?.[key]) count += 1;
    }
  }
  return count;
}

function changedChoiceFields(before, after) {
  let count = 0;
  for (let index = 0; index < before.length; index += 1) {
    for (const key of ["A", "B", "C", "D"]) {
      if (before[index]?.choices?.[key] !== after[index]?.choices?.[key]) count += 1;
    }
  }
  return count;
}

function changedReadingQuestions(before, after, keys) {
  let count = 0;
  const beforeQuestions = before.flatMap((passage) => passage.questions || []);
  const afterQuestions = after.flatMap((passage) => passage.questions || []);
  for (let index = 0; index < beforeQuestions.length; index += 1) {
    for (const key of keys) {
      if (beforeQuestions[index]?.[key] !== afterQuestions[index]?.[key]) count += 1;
    }
  }
  return count;
}

function changedReadingChoices(before, after) {
  let count = 0;
  const beforeQuestions = before.flatMap((passage) => passage.questions || []);
  const afterQuestions = after.flatMap((passage) => passage.questions || []);
  for (let index = 0; index < beforeQuestions.length; index += 1) {
    for (const key of ["A", "B", "C", "D"]) {
      if (beforeQuestions[index]?.choices?.[key] !== afterQuestions[index]?.choices?.[key]) {
        count += 1;
      }
    }
  }
  return count;
}

function changedReadingPassageText(before, after) {
  let count = 0;
  for (let index = 0; index < before.length; index += 1) {
    if (before[index]?.passageText !== after[index]?.passageText) count += 1;
    if (before[index]?.text !== after[index]?.text) count += 1;
  }
  return count;
}

function changedReadingNesting(before, after) {
  const beforeMap = before.flatMap((passage) =>
    (passage.questions || []).map((question) => `${passage.id}:${question.id}`),
  );
  const afterMap = after.flatMap((passage) =>
    (passage.questions || []).map((question) => `${passage.id}:${question.id}`),
  );
  return JSON.stringify(beforeMap) === JSON.stringify(afterMap) ? 0 : 1;
}

function changedNonSourceNotesFields(before, after) {
  let count = 0;
  walk(before, after, []);
  return count;

  function walk(left, right, trail) {
    if (trail.at(-1) === "sourceNotes") return;
    if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
      if (left !== right) count += 1;
      return;
    }

    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      walk(left[key], right[key], [...trail, key]);
    }
  }
}

function sourceNotesPath(id) {
  return `${id}.explanation.sourceNotes`;
}

function looksLikeOptionList(text, choices) {
  const cleanText = compact(text);
  return ["A", "B", "C", "D"].every((key) =>
    cleanText.includes(compact(`${key}. ${choices[key]}`)) ||
    cleanText.includes(compact(`${key}.${choices[key]}`)),
  );
}

function matchesNormalized(left, right) {
  return compact(left) === compact(right);
}

function compact(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function getTitleLine(value) {
  return String(value).split(/\r?\n/, 1)[0]?.trim();
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function snippet(value) {
  const clean = compact(value);
  if (clean.length <= 320) return clean;
  return `${clean.slice(0, 300)}...`;
}
