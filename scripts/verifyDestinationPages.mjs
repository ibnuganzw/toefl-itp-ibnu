import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/types/destinationPages.ts",
  "src/utils/destinationPages.ts",
  "src/components/destination/DestinationPageHero.tsx",
  "src/components/screens/ExploreScreen.tsx",
  "src/components/screens/CollectionScreen.tsx",
  "src/components/screens/TestSpaceScreen.tsx",
  "src/components/screens/ProgressScreen.tsx",
  "src/styles/destination-pages.css",
];

for (const filePath of requiredFiles) {
  assert(fs.existsSync(path.join(root, filePath)), `Missing destination-page foundation: ${filePath}`);
}

const appSource = readText("src/App.tsx");
const modelSource = readText("src/utils/destinationPages.ts");
const exploreSource = readText("src/components/screens/ExploreScreen.tsx");
const collectionSource = readText("src/components/screens/CollectionScreen.tsx");
const testSpaceSource = readText("src/components/screens/TestSpaceScreen.tsx");
const progressSource = readText("src/components/screens/ProgressScreen.tsx");
const shellSource = readText("src/components/dashboard/DashboardShell.tsx");
const mainSource = readText("src/main.tsx");

for (const [screen, component] of [
  ["explore", "ExploreScreen"],
  ["collection", "CollectionScreen"],
  ["test-space", "TestSpaceScreen"],
  ["progress", "ProgressScreen"],
]) {
  assert(appSource.includes(`screen === "${screen}"`), `App must render the ${screen} destination.`);
  assert(appSource.includes(`<${component}`), `App must compose ${component}.`);
}

assert(appSource.includes("buildDestinationPagesModel(questionBank, progress)"), "App must build one destination-pages model.");
assert(shellSource.includes('activeScreen === "session" || activeScreen === "result" || activeScreen === "review"'), "Destination pages must own their page headers.");
assert(modelSource.includes("progress.simulationHistory"), "Destination model must use stored simulation history.");
assert(modelSource.includes("wrongQuestionIds") && modelSource.includes("doubtfulQuestionIds"), "Collection queues must use stored diagnostic outcomes.");
assert(exploreSource.includes("<DashboardRecommendationPanel") && exploreSource.includes("<DashboardSubjectCard"), "Explore must expose recommendations and section categories.");
assert(!exploreSource.includes("Apa yang tersedia untuk dipelajari") && !exploreSource.includes("exploreInventoryGrid"), "Explore must not duplicate its learning categories with a decorative inventory section.");
assert(collectionSource.includes("onReviewQueue") && collectionSource.includes("<DashboardFocusPanel"), "Collection must expose real review queues and focused-practice actions.");
assert(!collectionSource.includes("DashboardMiniLessonCard"), "Collection must not present question-specific explanations as generic lessons.");
assert(testSpaceSource.includes('data-simulation-mode="full"'), "Test Space must expose the complete simulation as its primary measurement path.");
assert(!testSpaceSource.includes('data-simulation-mode="structure-written"') && !testSpaceSource.includes('data-simulation-mode="reading"'), "Partial simulations must be configured through the custom builder.");
assert(testSpaceSource.includes("<PackageField") && testSpaceSource.includes("onStartCustomSimulation"), "Test Space must validate and launch custom simulations.");
assert(testSpaceSource.includes("onResumeSession") && testSpaceSource.includes("arcane-resume-trial"), "Test Space must conditionally expose the real stored-session resume action.");
assert(progressSource.includes("<DashboardScoreTargetCard") && progressSource.includes("model.progressTrend") && progressSource.includes("latestDiagnostic"), "Progress must expose target, trend, and diagnostics.");
assert(mainSource.includes('./styles/destination-pages.css'), "Destination-page styles must be loaded.");

for (const arcaneClass of ["arcane-explore", "arcane-explore-hero", "arcane-explore-hero-actions", "arcane-quest-seal", "arcane-catalog", "arcane-discipline-grid"]) {
  assert(exploreSource.includes(arcaneClass), `Explore must retain literal document class: ${arcaneClass}`);
}
for (const arcaneClass of ["arcane-archive", "arcane-archive-hero", "arcane-archive-actions", "arcane-archive-seal", "arcane-archive-toolbar", "arcane-review-queue-card", "arcane-review-top", "arcane-review-footer", "arcane-archive-empty"]) {
  assert(collectionSource.includes(arcaneClass), `Collection must retain literal document class: ${arcaneClass}`);
}
for (const arcaneClass of [
  "arcane-trial-page",
  "arcane-trial-gate",
  "arcane-trial-gate-actions",
  "arcane-trial-stat-pill",
  "arcane-trial-layout",
  "arcane-resume-trial",
  "arcane-trial-mode-card",
  "arcane-trial-mode-top",
  "arcane-trial-mode-footer",
  "arcane-readiness-panel",
  "arcane-trial-rule-card",
  "arcane-builder-layout",
  "arcane-builder-seal",
  "arcane-builder-group",
  "arcane-builder-summary",
  "arcane-section-choice",
  "arcane-section-choice-icon",
  "arcane-section-choice-copy",
  "arcane-stepper",
]) {
  assert(testSpaceSource.includes(arcaneClass), `Test Space must retain literal document class: ${arcaneClass}`);
}
for (const arcaneClass of ["arcane-progress-compass", "arcane-score-ring", "arcane-status-panel", "arcane-status-heading", "arcane-metric-grid"]) {
  assert(progressSource.includes(arcaneClass), `Progress must retain literal document class: ${arcaneClass}`);
}

console.log("Destination-pages verification OK");
console.log(`Required destination-page files: ${requiredFiles.length}`);

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
