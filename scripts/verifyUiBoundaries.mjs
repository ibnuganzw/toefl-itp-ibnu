import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appSource = readText("src/App.tsx");
const homeSource = readText("src/components/screens/HomeScreen.tsx");
const sessionSource = readText("src/components/screens/SessionScreen.tsx");
const themeSource = readText("src/styles/theme.css");

const requiredComponents = [
  "src/components/dashboard/DashboardShell.tsx",
  "src/components/dashboard/DashboardTopNavigation.tsx",
  "src/components/dashboard/DashboardNavItem.tsx",
  "src/components/screens/HomeScreen.tsx",
  "src/components/screens/ExploreScreen.tsx",
  "src/components/screens/CollectionScreen.tsx",
  "src/components/screens/TestSpaceScreen.tsx",
  "src/components/screens/ProgressScreen.tsx",
  "src/components/screens/SessionScreen.tsx",
  "src/components/screens/ResultScreen.tsx",
  "src/components/screens/ReviewScreen.tsx",
  "src/components/result/ScoreRevealModal.tsx",
  "src/components/session/QuestionRenderer.tsx",
  "src/components/session/QuestionMap.tsx",
  "src/components/session/ShortcutsModal.tsx",
  "src/components/listening/ListeningPanel.tsx",
  "src/components/listening/QuestionAudioPlayer.tsx",
  "src/components/questions/ExplanationPanel.tsx",
  "src/components/home/DashboardPanel.tsx",
  "src/components/home/DashboardSummaryCard.tsx",
  "src/components/home/DashboardRecommendationPanel.tsx",
  "src/components/home/DashboardSubjectCard.tsx",
  "src/components/home/DashboardFocusPanel.tsx",
  "src/components/home/DashboardHistoryPanel.tsx",
  "src/components/home/DashboardWeeklyTargetCard.tsx",
  "src/components/home/DashboardPersonalHero.tsx",
  "src/components/home/DashboardTestSpaceCard.tsx",
  "src/components/destination/DestinationPageHero.tsx",
  "src/components/progress/ProgressIllustration.tsx",
  "src/components/progress/ProgressIllustrationPanel.tsx",
];

for (const componentPath of requiredComponents) {
  assert(fs.existsSync(path.join(root, componentPath)), `Missing UI boundary: ${componentPath}`);
}

for (const componentName of [
  "DashboardShell",
  "HomeScreen",
  "ExploreScreen",
  "CollectionScreen",
  "TestSpaceScreen",
  "ProgressScreen",
  "SessionScreen",
  "ResultScreen",
  "ReviewScreen",
]) {
  assert(
    !appSource.includes(`function ${componentName}(`),
    `App.tsx must orchestrate ${componentName}, not define it.`,
  );
}

assert(
  appSource.includes('useState<Screen>("home")'),
  "App must open directly on Home.",
);
assert(
  !appSource.includes("SplashScreen") && !appSource.includes('"splash"'),
  "App must not restore a splash gate.",
);
assert(
  !fs.existsSync(path.join(root, "src/components/screens/SplashScreen.tsx")) &&
    !themeSource.includes(".splash"),
  "Removed splash component and styles must stay removed.",
);

for (const componentName of [
  "QuestionRenderer",
  "QuestionMap",
  "ShortcutsModal",
  "ListeningPanel",
  "QuestionAudioPlayer",
]) {
  assert(
    !sessionSource.includes(`function ${componentName}(`),
    `SessionScreen.tsx must compose ${componentName}, not define it.`,
  );
}

assert(
  !homeSource.includes("document.querySelector"),
  "HomeScreen must not use global DOM selectors to coordinate its child controls.",
);
assert(
  !sessionSource.includes("document.querySelector"),
  "SessionScreen must not use global DOM selectors to coordinate its child controls.",
);

console.log("UI boundary verification OK");
console.log(`Required component boundaries: ${requiredComponents.length}`);

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
