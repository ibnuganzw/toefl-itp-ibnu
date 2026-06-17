import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/types/progressIllustration.ts",
  "src/utils/progressIllustration.ts",
  "src/components/progress/ProgressIllustration.tsx",
  "src/components/progress/ProgressIllustrationPanel.tsx",
  "src/styles/progress-illustration.css",
  "docs/progress-illustration-v1.md",
];

for (const filePath of requiredFiles) {
  assert(fs.existsSync(path.join(root, filePath)), `Missing progress-illustration foundation: ${filePath}`);
}

const appSource = readText("src/App.tsx");
const modelSource = readText("src/utils/progressIllustration.ts");
const illustrationSource = readText("src/components/progress/ProgressIllustration.tsx");
const panelSource = readText("src/components/progress/ProgressIllustrationPanel.tsx");
const heroSource = readText("src/components/home/DashboardPersonalHero.tsx");
const progressSource = readText("src/components/screens/ProgressScreen.tsx");
const stylesSource = readText("src/styles/progress-illustration.css");
const mainSource = readText("src/main.tsx");

assert(appSource.includes("buildProgressIllustrationModel(questionBank, progress)"), "App must build one progress-illustration model.");
assert(appSource.includes("illustration={progressIllustration}"), "Home and Progress must receive the shared illustration model.");
for (const sourceSignal of [
  "progress.latestScoreEstimate",
  "progress.scoreTarget",
  "progress.history",
  "progress.seenQuestionIds",
  "progress.attemptsByQuestion",
]) {
  assert(modelSource.includes(sourceSignal), `Progress illustration must use real source data: ${sourceSignal}`);
}
assert(!modelSource.includes("Math.random"), "Progress illustration must remain deterministic.");
for (const stageId of ["prepared", "growing", "measured", "near", "achieved"]) {
  assert(modelSource.includes(`id: "${stageId}"`), `Missing progress stage: ${stageId}`);
}
assert(illustrationSource.includes("<svg") && illustrationSource.includes("data-progress-stage"), "Progress illustration must be a semantic, stage-addressable SVG.");
assert(illustrationSource.includes("model.plantLeafCount") && illustrationSource.includes("model.bookCount") && illustrationSource.includes("model.pawStepCount"), "Visual layers must respond to the model.");
assert(panelSource.includes("model.signals") && panelSource.includes("model.milestones"), "Progress panel must explain signals and milestones.");
assert(heroSource.includes("<ProgressIllustration") && progressSource.includes("<ProgressIllustrationPanel"), "Home and Progress must compose the illustration.");
assert(stylesSource.includes("@media (prefers-reduced-motion: reduce)"), "Progress motion must respect reduced-motion preferences.");
assert(mainSource.includes('./styles/progress-illustration.css'), "Progress-illustration styles must be loaded.");

console.log("Progress-illustration verification OK");
console.log(`Required progress-illustration files: ${requiredFiles.length}`);

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
