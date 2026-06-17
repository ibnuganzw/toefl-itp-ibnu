import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, "src/data/scoreConversionTables.json"), "utf8"));
const estimationSource = readText("src/utils/scoreEstimation.ts");
const appSource = readText("src/App.tsx");
const resultSource = readText("src/components/screens/ResultScreen.tsx");
const homeSource = readText("src/components/home/DashboardScoreTargetCard.tsx");

const sections = ["listening", "structureWritten", "reading"];
const server = await createServer({
  appType: "custom",
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  root,
  server: { middlewareMode: true },
});
const scoring = await server.ssrLoadModule("/src/utils/scoreEstimation.ts");

assert(data.version === "practice-linear-level1-v1", "Conversion data must have a stable version.");
assert(data.method === "internal-linear-practice-estimate", "Conversion method must remain explicitly internal.");

for (const section of sections) {
  const expectedLength = data.sectionQuestionCounts[section] + 1;
  const table = data.tables[section];
  assert(table.length === expectedLength, `${section} table must contain one value for every raw score.`);
  assert(table[0] === data.sectionRanges[section].min, `${section} minimum must match its documented range.`);
  assert(table.at(-1) === data.sectionRanges[section].max, `${section} maximum must match its documented range.`);
  assert(table.every((value, index) => index === 0 || value >= table[index - 1]), `${section} table must be monotonic.`);
}

assert(totalFor({ listening: 0, structureWritten: 0, reading: 0 }) === data.totalMin, "Minimum total must be 310.");
assert(totalFor({ listening: 50, structureWritten: 40, reading: 50 }) === data.totalMax, "Maximum total must be 677.");
assert(totalFor({ listening: 25, structureWritten: 20, reading: 25 }) === 497, "Midpoint example must stay deterministic.");

assert(estimationSource.includes("hasExactQuestionCounts(questionCounts)"), "Only exact 50-40-50 sessions may receive an estimate.");
assert(estimationSource.includes("normalizeScoreTarget"), "Target normalization must be centralized.");
assert(estimationSource.includes("gapRatio"), "Target comparison must be relative.");
assert(!estimationSource.includes("targetScore === 550"), "Target logic must not hardcode 550.");
assert(!estimationSource.includes("targetScore === 477"), "Target logic must not hardcode 477.");
assert(appSource.includes("scoreTargetAtCompletion"), "History must snapshot the target at completion.");
assert(appSource.includes('simulationConfig: session.mode === "simulation" ? session.config : undefined'), "Simulation history must retain its configuration.");
assert(appSource.includes("estimateSimulationScore"), "App must calculate eligible simulation estimates.");
assert(resultSource.includes("Estimasi latihan, bukan skor resmi"), "Result UI must disclose estimate limitations.");
assert(homeSource.includes("Ubah target"), "Home must expose a target editor.");

const estimate510 = { totalEstimate: 510 };
assert(scoring.estimateFromRawSectionScores({ listening: 0, structureWritten: 0, reading: 0 }).totalEstimate === 310, "Production estimator must return 310 at minimum.");
assert(scoring.estimateFromRawSectionScores({ listening: 50, structureWritten: 40, reading: 50 }).totalEstimate === 677, "Production estimator must return 677 at maximum.");
assert(scoring.estimateFromRawSectionScores({ listening: 51, structureWritten: 40, reading: 50 }) === undefined, "Production estimator must reject invalid raw counts.");
assert(scoring.normalizeScoreTarget(477) === 477, "Production target normalization must accept 477.");
assert(scoring.normalizeScoreTarget(550) === 550, "Production target normalization must accept 550.");
assert(scoring.normalizeScoreTarget(700) === undefined, "Production target normalization must reject unsupported targets.");
assert(scoring.compareEstimateToTarget(estimate510, 477).status === "achieved", "510 must achieve a flexible 477 target.");
assert(scoring.compareEstimateToTarget(estimate510, 550).status === "near", "510 must be near a flexible 550 target.");
assert(scoring.compareEstimateToTarget({ totalEstimate: 450 }, 477).status === "near", "The same score must adapt to its selected target.");

console.log("Score estimation verification OK");
console.log(`Conversion version: ${data.version}`);
console.log(`Supported complete composition: ${sections.map((section) => data.sectionQuestionCounts[section]).join("-")}`);
await server.close();

function totalFor(raw) {
  const sectionTotal = sections.reduce((sum, section) => sum + data.tables[section][raw[section]], 0);
  return Math.round((sectionTotal * 10) / 3);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
