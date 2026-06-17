import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/types/homeDashboard.ts",
  "src/utils/homeDashboard.ts",
  "src/styles/home-dashboard.css",
  "src/components/home/DashboardPanel.tsx",
  "src/components/home/DashboardSummaryCard.tsx",
  "src/components/home/DashboardRecommendationPanel.tsx",
  "src/components/home/DashboardSubjectCard.tsx",
  "src/components/home/DashboardFocusPanel.tsx",
  "src/components/home/DashboardHistoryPanel.tsx",
  "src/components/home/DashboardWeeklyTargetCard.tsx",
  "src/components/home/DashboardScoreTargetCard.tsx",
  "src/components/home/DashboardPersonalHero.tsx",
  "src/components/home/DashboardTestSpaceCard.tsx",
];

for (const filePath of requiredFiles) {
  assert(fs.existsSync(path.join(root, filePath)), `Missing Home dashboard foundation: ${filePath}`);
}

const appSource = readText("src/App.tsx");
const homeSource = readText("src/components/screens/HomeScreen.tsx");
const selectorSource = readText("src/utils/homeDashboard.ts");
const sessionSource = readText("src/utils/sessionEngine.ts");
const mainSource = readText("src/main.tsx");

assert(appSource.includes("buildHomeDashboardModel(questionBank, progress)"), "App must build one Home dashboard model.");
assert(!appSource.includes("homeMode"), "Legacy Home mode state must not return.");
assert(!appSource.includes("customConfig"), "Legacy Home custom form state must not return.");

for (const componentName of [
  "DashboardSummaryCard",
  "DashboardRecommendationPanel",
  "DashboardSubjectCard",
  "DashboardFocusPanel",
  "DashboardHistoryPanel",
  "DashboardWeeklyTargetCard",
  "DashboardScoreTargetCard",
  "DashboardPersonalHero",
  "DashboardTestSpaceCard",
]) {
  assert(homeSource.includes(`<${componentName}`), `HomeScreen must compose ${componentName}.`);
}

assert(!homeSource.includes("validationReport"), "HomeScreen must consume a ready dashboard model.");
assert(!homeSource.includes("attemptsByQuestion"), "HomeScreen must not calculate progress data.");
for (const legacyClass of ["workspaceHeaderPanel", "dashboardTaskSection", "homeSidePanel"]) {
  assert(!homeSource.includes(legacyClass), `HomeScreen must not restore legacy Home class: ${legacyClass}`);
}
assert(!fs.existsSync(path.join(root, "src/components/home/DashboardActionCard.tsx")), "Legacy DashboardActionCard must stay removed.");
assert(!fs.existsSync(path.join(root, "src/components/forms/NumberField.tsx")), "Legacy Home NumberField must stay removed.");
assert(selectorSource.includes("export function buildHomeDashboardModel"), "Home dashboard selector must be exported.");
assert(selectorSource.includes("progress.simulationHistory.slice(0, 3)"), "Home dashboard must prioritize simulation history.");
assert(!selectorSource.includes("buildMiniLesson"), "Home must not present question-specific explanations as generic lessons.");
assert(!homeSource.includes("DashboardMiniLessonCard"), "Home must not restore the decorative Mini Lesson card.");
assert(selectorSource.includes("buildPersonalBrief"), "Home must derive a personal learning brief from real progress.");
assert(appSource.includes('screen === "explore"'), "Explore must be a dedicated top-level screen.");
assert(appSource.includes('screen === "collection"'), "Collection must be a dedicated top-level screen.");
assert(appSource.includes('screen === "test-space"'), "Test Space must be a dedicated top-level screen.");
assert(appSource.includes('screen === "progress"'), "Progress must be a dedicated top-level screen.");
assert(sessionSource.includes('"structure-written"'), "Learning scope must support Structure & Written.");
assert(!selectorSource.includes('title: "Mixed"'), "Home dashboard must not restore Mixed learning.");
assert(
  selectorSource.match(/packageQuestionCounts: \[25, 50, 100\]/g)?.length === 3,
  "Listening, Structure & Written, and Reading cards must expose fixed packages.",
);
assert(mainSource.includes('./styles/home-dashboard.css'), "Home dashboard styles must be loaded.");

for (const arcaneClass of [
  "arcane-home",
  "arcane-progress-compass",
  "arcane-metric-grid",
  "arcane-quest-board",
  "arcane-discipline-grid",
  "arcane-archive",
]) {
  assert(homeSource.includes(arcaneClass), `Home must retain literal document class: ${arcaneClass}`);
}

for (const [filePath, arcaneClass] of [
  ["src/components/home/DashboardPersonalHero.tsx", "arcane-hero-title"],
  ["src/components/home/DashboardRecommendationPanel.tsx", "arcane-recommendation-panel"],
  ["src/components/home/DashboardSubjectCard.tsx", "arcane-discipline-card"],
  ["src/components/home/DashboardSubjectCard.tsx", "arcane-discipline-top"],
  ["src/components/home/DashboardSubjectCard.tsx", "arcane-discipline-footer"],
  ["src/components/home/DashboardScoreTargetCard.tsx", "arcane-target-panel"],
  ["src/components/home/DashboardSummaryCard.tsx", "arcane-metric-card"],
  ["src/components/home/DashboardTestSpaceCard.tsx", "arcane-trial-gate"],
  ["src/components/home/DashboardWeeklyTargetCard.tsx", "arcane-weekly-path"],
]) {
  assert(readText(filePath).includes(arcaneClass), `${filePath} must retain literal document class: ${arcaneClass}`);
}

console.log("Home dashboard foundation verification OK");
console.log(`Required Home dashboard files: ${requiredFiles.length}`);

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
