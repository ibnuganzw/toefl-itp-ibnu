import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const blueprintSource = readText("src/utils/sessionBlueprints.ts");
const sessionSource = readText("src/utils/sessionEngine.ts");
const appSource = readText("src/App.tsx");
const navigationSource = readText("src/components/dashboard/DashboardTopNavigation.tsx");
const homeSource = readText("src/utils/homeDashboard.ts");
const readingPassages = readJson("src/data/imported/readingPassages.json").filter((passage) => passage.active);
const listeningSets = readJson("src/data/imported/listeningSets.json").filter((set) => set.active);

assert(blueprintSource.includes("25: [9, 8, 8]"), "Reading 25 blueprint must be exactly 9 + 8 + 8.");
assert(
  blueprintSource.includes("50: [9, 9, 8, 8, 8, 8]"),
  "Reading 50 blueprint must place two 9-question passages first.",
);
assert(
  blueprintSource.includes("100: [9, 9, 8, 8, 8, 8, 9, 9, 8, 8, 8, 8]"),
  "Reading 100 blueprint must repeat the fixed 50-question slot cycle.",
);
assert(blueprintSource.includes("partA: 16") && blueprintSource.includes("partB: [4]") && blueprintSource.includes("partC: [5]"), "Listening 25 blueprint must be 16 + 4 + 5.");
assert(
  blueprintSource.includes("partA: 30") &&
    blueprintSource.includes("partB: [4, 3]") &&
    blueprintSource.includes("partC: [5, 4, 4]") &&
    blueprintSource.includes("partB: [4, 4]") &&
    blueprintSource.includes("partC: [4, 4, 4]"),
  "Listening 50 must support both approved B/C patterns.",
);
assert(
  blueprintSource.includes("shuffle(sequences)") &&
    blueprintSource.includes("shuffle(bank.listeningSets") &&
    blueprintSource.includes("shuffle(passages)"),
  "Fixed blueprints must preserve randomized selection.",
);
assert(
  blueprintSource.includes("createCompatibleReadingPackageUnits") &&
    blueprintSource.includes("selectedQuestions = orderedQuestions.slice(0, remaining)"),
  "Reading packages must remain launchable while preserving passage ownership before 9-question passages are added.",
);
assert(
  sessionSource.includes("sectionIndex") && sessionSource.includes("sectionQuestionCount"),
  "Question references must carry section-local numbering.",
);
assert(
  sessionSource.includes("createListeningPackageUnits") && sessionSource.includes("createReadingPackageUnits"),
  "All session construction must use the fixed package blueprint module.",
);
assert(!appSource.includes("startLearning(\"all\")"), "Mixed learning launch must be removed.");
assert(!navigationSource.includes('id: "mixed"'), "Mixed navigation must be removed.");
assert(!homeSource.includes('title: "Mixed"'), "Mixed Home card must be removed.");

for (const passage of readingPassages) {
  const count = passage.questions.filter((question) => question.active).length;
  assert([8, 9].includes(count), `Reading passage ${passage.id} must contain 8 or 9 active questions.`);
}
for (const set of listeningSets) {
  const count = set.questions.filter((question) => question.active).length;
  if (set.part === "A") assert(count === 1, `Listening Part A set ${set.id} must contain 1 question.`);
  if (set.part === "B") assert([3, 4].includes(count), `Listening Part B set ${set.id} must contain 3 or 4 questions.`);
  if (set.part === "C") assert([4, 5].includes(count), `Listening Part C set ${set.id} must contain 4 or 5 questions.`);
}

const readingNineCount = readingPassages.filter((passage) => passage.questions.filter((question) => question.active).length === 9).length;
const readingEightCount = readingPassages.filter((passage) => passage.questions.filter((question) => question.active).length === 8).length;
const listeningQuestionCount = listeningSets.reduce(
  (sum, set) => sum + set.questions.filter((question) => question.active).length,
  0,
);
const listeningPartACount = listeningSets
  .filter((set) => set.part === "A")
  .reduce((sum, set) => sum + set.questions.filter((question) => question.active).length, 0);
const listeningPartBSizes = listeningSets
  .filter((set) => set.part === "B")
  .map((set) => set.questions.filter((question) => question.active).length);
const listeningPartCSizes = listeningSets
  .filter((set) => set.part === "C")
  .map((set) => set.questions.filter((question) => question.active).length);
assert(listeningQuestionCount >= 100, "Listening 100 requires at least 100 active Listening questions.");
assert(readingNineCount >= 1 && readingEightCount >= 2, "Reading 25 requires one 9-question passage and two 8-question passages.");
assert(listeningPartACount >= 60, "Listening 100 requires at least 60 active Part A questions.");
assert(
  countValue(listeningPartBSizes, 4) >= 2 && countValue(listeningPartBSizes, 3) >= 2,
  "Listening 100 requires two complete 4 + 3 Part B blocks.",
);
assert(
  countValue(listeningPartCSizes, 5) >= 2 && countValue(listeningPartCSizes, 4) >= 4,
  "Listening 100 requires two complete 5 + 4 + 4 Part C blocks.",
);
console.log("Session blueprint verification OK");
console.log(`Reading 25 blueprint: 9 + 8 + 8 = 25`);
console.log(`Reading 9-question passages available: ${readingNineCount}`);
console.log(`Reading 8-question passages available: ${readingEightCount}`);
console.log("Listening 25, 50, and 100 blueprints are available.");

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countValue(values, expected) {
  return values.filter((value) => value === expected).length;
}
