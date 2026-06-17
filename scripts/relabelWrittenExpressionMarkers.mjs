import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WRITTEN_PATH = "src/data/imported/writtenExpressionQuestions.json";
const REPORT_PATH = "docs/written-marker-randomization-report.json";
const ANSWER_KEYS = ["A", "B", "C", "D"];
const STANDARD_ORDER = ANSWER_KEYS.join("");
const DRY_RUN = process.argv.includes("--dry-run");

// These were standard ABCD questions whose wrong segment was not first. Turning
// them into mixed-order questions prevents "mixed order = choose the first
// marker" from becoming a reliable shortcut.
const DECOY_IDS = new Set([
  "PSW2-W2",
  "PSW2-W5",
  "AW1",
  "AW3",
  "BW11",
  "BW19",
  "BW18",
  "PSW2-W18",
  "PSW3-W11",
  "PSW2-W19",
  "PSW2-W45",
  "PSW2-W44",
  "PSW2-W43",
  "PSW2-W41",
  "PSW3-W14",
  "PSW3-W17",
  "PSW2-W10",
  "PSW3-W19",
  "LW6",
]);

const MIXED_TARGET_ORDERS = permutations(ANSWER_KEYS).filter((order) => {
  const value = order.join("");
  const sortedTail = order.slice(1).sort(answerKeySort).join("");
  return value !== STANDARD_ORDER && order.slice(1).join("") !== sortedTail;
});

const written = readJson(WRITTEN_PATH);
const before = structuredClone(written);
const changes = [];

for (const question of written) {
  const oldOrder = markerOrder(question.questionText);
  assertValidMarkerOrder(question.id, oldOrder);

  const wasMixed = oldOrder.join("") !== STANDARD_ORDER;
  const isDecoy = DECOY_IDS.has(question.id);
  if (!wasMixed && !isDecoy) continue;

  const targetOrder = targetOrderFor(question.id);
  if (oldOrder.join("") === targetOrder.join("")) continue;

  const mapping = Object.fromEntries(oldOrder.map((oldLabel, index) => [oldLabel, targetOrder[index]]));
  const inverseMapping = Object.fromEntries(Object.entries(mapping).map(([oldLabel, newLabel]) => [newLabel, oldLabel]));
  const oldCorrectAnswer = question.correctAnswer;

  question.questionText = relabelMarkers(question.questionText, mapping);
  question.choices = Object.fromEntries(
    ANSWER_KEYS.map((newLabel) => [newLabel, question.choices[inverseMapping[newLabel]]]),
  );
  question.correctAnswer = mapping[oldCorrectAnswer];
  question.explanation = relabelExplanation(question.explanation, mapping, inverseMapping);
  if (typeof question.sentenceStructureExplanation === "string") {
    question.sentenceStructureExplanation = relabelReferences(question.sentenceStructureExplanation, mapping);
  }

  changes.push({
    id: question.id,
    reason: wasMixed ? "reworked-existing-mixed-order" : "added-mixed-order-decoy",
    beforeMarkerOrder: oldOrder.join(""),
    afterMarkerOrder: targetOrder.join(""),
    beforeCorrectAnswer: oldCorrectAnswer,
    afterCorrectAnswer: question.correctAnswer,
    correctPhysicalPosition: oldOrder.indexOf(oldCorrectAnswer) + 1,
  });
}

verifyTransformation(before, written, changes);

const report = {
  generatedAt: new Date().toISOString(),
  mode: DRY_RUN ? "dry-run" : "write",
  scope: "Written Expression marker relabeling only.",
  policy: {
    existingMixedOrderQuestionsReworked: true,
    standardAnswerAQuestionsLeftUnchanged: true,
    mixedOrderFirstMarkerCorrectTargetRatio: "1:1",
    questionAndCorrectionContentChanged: false,
  },
  before: markerStats(before),
  after: markerStats(written),
  summary: {
    changedQuestions: changes.length,
    reworkedExistingMixedOrder: changes.filter((change) => change.reason === "reworked-existing-mixed-order").length,
    addedMixedOrderDecoys: changes.filter((change) => change.reason === "added-mixed-order-decoy").length,
  },
  changes,
};

if (!DRY_RUN) {
  writeJson(WRITTEN_PATH, written);
  writeJson(REPORT_PATH, report);
}

console.log("Written Expression marker relabeling");
console.log(`Mode: ${report.mode}`);
console.log(`Changed questions: ${report.summary.changedQuestions}`);
console.log(`Reworked existing mixed-order questions: ${report.summary.reworkedExistingMixedOrder}`);
console.log(`Added mixed-order decoys: ${report.summary.addedMixedOrderDecoys}`);
console.log(
  `Mixed-order first-marker correctness: ${report.after.mixedFirstMarkerCorrect}/${report.after.mixedOrderQuestions}`,
);
if (!DRY_RUN) console.log(`Report: ${REPORT_PATH}`);

function relabelExplanation(explanation, mapping, inverseMapping) {
  const relabeled = {};
  for (const [key, value] of Object.entries(explanation)) {
    if (key === "optionAnalysis" || typeof value !== "string") {
      relabeled[key] = value;
      continue;
    }
    relabeled[key] = relabelReferences(value, mapping);
  }

  if (explanation.optionAnalysis) {
    relabeled.optionAnalysis = Object.fromEntries(
      ANSWER_KEYS.map((newLabel) => [
        newLabel,
        relabelReferences(explanation.optionAnalysis[inverseMapping[newLabel]], mapping),
      ]),
    );
  }

  return relabeled;
}

function relabelMarkers(value, mapping) {
  return value.replace(/\[([A-D])\]/g, (_match, label) => `[${mapping[label]}]`);
}

function relabelReferences(value, mapping) {
  const marker = (label) => `\uE000${mapping[label]}\uE001`;
  return value
    .replace(/\[([A-D])\]/g, (_match, label) => `[${marker(label)}]`)
    .replace(
      /\b(Jawaban benar|Answer)(\s*:\s*)([A-D])\b/g,
      (_match, heading, spacing, label) => `${heading}${spacing}${marker(label)}`,
    )
    .replace(
      /\b(Bagian|bagian|Pilihan|pilihan|Opsi|opsi|Jawaban|jawaban)(\s+)([A-D])\b(?!\s*(?:-|–|—|â€“)\s*[A-D])/g,
      (_match, heading, spacing, label) => `${heading}${spacing}${marker(label)}`,
    )
    .replace(/(^|\n)(\s*)([A-D])([.)])/g, (_match, lineStart, spacing, label, punctuation) =>
      `${lineStart}${spacing}${marker(label)}${punctuation}`)
    .replace(/\b([A-D])\.(?=\s+[A-Z*])/g, (_match, label) => `${marker(label)}.`)
    .replace(/\uE000([A-D])\uE001/g, "$1");
}

function verifyTransformation(original, transformed, changeList) {
  assert(original.length === transformed.length, "Written question count changed.");
  const changedIds = new Set(changeList.map((change) => change.id));

  for (let index = 0; index < original.length; index += 1) {
    const oldQuestion = original[index];
    const newQuestion = transformed[index];
    assert(oldQuestion.id === newQuestion.id, `Question ID changed at index ${index}.`);

    const oldOrder = markerOrder(oldQuestion.questionText);
    const newOrder = markerOrder(newQuestion.questionText);
    assertValidMarkerOrder(newQuestion.id, newOrder);
    assert(
      stripMarkers(oldQuestion.questionText) === stripMarkers(newQuestion.questionText),
      `${newQuestion.id}: question content changed beyond marker labels.`,
    );
    assert(
      oldOrder.indexOf(oldQuestion.correctAnswer) === newOrder.indexOf(newQuestion.correctAnswer),
      `${newQuestion.id}: correct physical segment moved.`,
    );
    assert(
      sameStringSet(Object.values(oldQuestion.choices), Object.values(newQuestion.choices)),
      `${newQuestion.id}: choice segment content changed.`,
    );
    assert(
      oldQuestion.incorrectPart === newQuestion.incorrectPart &&
        oldQuestion.correction === newQuestion.correction &&
        oldQuestion.correctedSentence === newQuestion.correctedSentence,
      `${newQuestion.id}: correction content changed.`,
    );
    assertQuestionMarkersMatchChoices(newQuestion);

    if (!changedIds.has(newQuestion.id)) {
      assert(
        JSON.stringify(oldQuestion) === JSON.stringify(newQuestion),
        `${newQuestion.id}: an out-of-scope question changed.`,
      );
    }

    if (oldOrder.join("") === STANDARD_ORDER && oldQuestion.correctAnswer === "A") {
      assert(
        JSON.stringify(oldQuestion) === JSON.stringify(newQuestion),
        `${newQuestion.id}: a standard-order answer-A question changed.`,
      );
    }
  }

  const stats = markerStats(transformed);
  assert(
    stats.mixedFirstMarkerCorrect === stats.mixedFirstMarkerNotCorrect,
    "Mixed-order questions do not have a 1:1 first-marker correctness split.",
  );
  assert(
    transformed
      .filter((question) => markerOrder(question.questionText).join("") !== STANDARD_ORDER)
      .every((question) => hasMixedTail(markerOrder(question.questionText))),
    "At least one mixed-order question still has an alphabetically pasted marker tail.",
  );
}

function assertQuestionMarkersMatchChoices(question) {
  const matches = [...question.questionText.matchAll(/\[([A-D])\]\s*/g)];
  for (const match of matches) {
    const start = (match.index ?? 0) + match[0].length;
    assert(
      question.questionText.startsWith(question.choices[match[1]], start),
      `${question.id}: marker ${match[1]} no longer matches its choice segment.`,
    );
  }
}

function markerStats(questions) {
  const rows = questions.map((question) => {
    const order = markerOrder(question.questionText);
    return {
      correctFirst: order[0] === question.correctAnswer,
      mixed: order.join("") !== STANDARD_ORDER,
    };
  });
  const mixedRows = rows.filter((row) => row.mixed);
  return {
    totalQuestions: questions.length,
    standardOrderQuestions: rows.filter((row) => !row.mixed).length,
    mixedOrderQuestions: mixedRows.length,
    mixedFirstMarkerCorrect: mixedRows.filter((row) => row.correctFirst).length,
    mixedFirstMarkerNotCorrect: mixedRows.filter((row) => !row.correctFirst).length,
  };
}

function markerOrder(value) {
  return [...value.matchAll(/\[([A-D])\]/g)].map((match) => match[1]);
}

function hasMixedTail(order) {
  return order.slice(1).join("") !== order.slice(1).sort(answerKeySort).join("");
}

function targetOrderFor(id) {
  return MIXED_TARGET_ORDERS[fnv1a(id) % MIXED_TARGET_ORDERS.length];
}

function fnv1a(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) =>
    permutations(values.filter((_item, itemIndex) => itemIndex !== index)).map((tail) => [value, ...tail]),
  );
}

function assertValidMarkerOrder(id, order) {
  assert(
    order.length === ANSWER_KEYS.length && new Set(order).size === ANSWER_KEYS.length,
    `${id}: expected exactly one marker for each of A-D.`,
  );
}

function answerKeySort(left, right) {
  return ANSWER_KEYS.indexOf(left) - ANSWER_KEYS.indexOf(right);
}

function stripMarkers(value) {
  return value.replace(/\[([A-D])\]/g, "");
}

function sameStringSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
