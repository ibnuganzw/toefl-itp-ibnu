import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/styles/tokens.css",
  "src/styles/primitives.css",
  "src/components/ui/AppIcon.tsx",
  "src/components/ui/Badge.tsx",
  "src/components/ui/Button.tsx",
  "src/components/ui/SegmentedControl.tsx",
  "src/components/ui/Surface.tsx",
  "src/components/dashboard/DashboardTopNavigation.tsx",
  "src/components/dashboard/DashboardNavItem.tsx",
  "src/styles/navigation.css",
  "src/styles/destination-pages.css",
  "src/styles/progress-illustration.css",
];

for (const filePath of requiredFiles) {
  assert(fs.existsSync(path.join(root, filePath)), `Missing design-system file: ${filePath}`);
}

const mainSource = readText("src/main.tsx");
const tokenImport = mainSource.indexOf('./styles/tokens.css');
const themeImport = mainSource.indexOf('./styles/theme.css');
const primitiveImport = mainSource.indexOf('./styles/primitives.css');
const navigationImport = mainSource.indexOf('./styles/navigation.css');
const homeDashboardImport = mainSource.indexOf('./styles/home-dashboard.css');
const destinationPagesImport = mainSource.indexOf('./styles/destination-pages.css');
const progressIllustrationImport = mainSource.indexOf('./styles/progress-illustration.css');

assert(tokenImport >= 0, "main.tsx must import design tokens.");
assert(themeImport > tokenImport, "Legacy theme must load after tokens during migration.");
assert(primitiveImport > themeImport, "Primitives must load last so shared controls stay consistent.");
assert(navigationImport > primitiveImport, "Navigation styles must load after shared primitives.");
assert(homeDashboardImport > navigationImport, "Home dashboard styles must load after navigation.");
assert(destinationPagesImport > homeDashboardImport, "Destination-page styles must load after Home dashboard styles.");
assert(progressIllustrationImport > destinationPagesImport, "Progress-illustration styles must load after destination-page styles.");

const tokensSource = readText("src/styles/tokens.css");
for (const token of [
  "--ui-font-sans",
  "--ui-color-ink",
  "--ui-color-surface",
  "--ui-space-4",
  "--ui-radius-md",
  "--ui-shadow-sm",
  "--ui-control-md",
]) {
  assert(tokensSource.includes(token), `Missing required token: ${token}`);
}

const componentUsage = {
  "src/components/dashboard/DashboardShell.tsx": ["DashboardTopNavigation", "Surface"],
  "src/components/dashboard/DashboardTopNavigation.tsx": ["AppIcon", "DashboardNavItem"],
  "src/components/screens/HomeScreen.tsx": ["DashboardSummaryCard", "DashboardRecommendationPanel"],
  "src/components/screens/ExploreScreen.tsx": ["DestinationPageHero", "DashboardSubjectCard"],
  "src/components/screens/CollectionScreen.tsx": ["DestinationPageHero", "DashboardFocusPanel"],
  "src/components/screens/TestSpaceScreen.tsx": ["DestinationPageHero", "Button"],
  "src/components/screens/ProgressScreen.tsx": ["DestinationPageHero", "DashboardScoreTargetCard"],
  "src/components/home/DashboardRecommendationPanel.tsx": ["Button"],
  "src/components/home/DashboardPersonalHero.tsx": ["Button"],
  "src/components/screens/SessionScreen.tsx": ["Button"],
  "src/components/session/QuestionRenderer.tsx": ["Badge", "Button"],
};

for (const [filePath, componentNames] of Object.entries(componentUsage)) {
  const source = readText(filePath);
  for (const componentName of componentNames) {
    assert(source.includes(`<${componentName}`), `${filePath} must use ${componentName}.`);
  }
}

const shellSource = readText("src/components/dashboard/DashboardShell.tsx");
assert(!shellSource.includes("function ShellIcon"), "DashboardShell must use the shared AppIcon component.");
assert(!shellSource.includes("function DashboardNavItem"), "DashboardShell must delegate navigation rendering.");

const navigationComponentSource = readText("src/components/dashboard/DashboardTopNavigation.tsx");
for (const navId of ["home", "explore", "collection", "test-space", "progress"]) {
  assert(navigationComponentSource.includes(`id: "${navId}"`), `Top navigation is missing destination: ${navId}`);
}
for (const sectionId of ["listening", "structure-written", "reading", "simulation"]) {
  assert(!navigationComponentSource.includes(`id: "${sectionId}"`), `Test section ${sectionId} must not be a top-level destination.`);
}

const navigationSource = readText("src/styles/navigation.css");
assert(
  navigationSource.includes(".appTopNavigation") && !navigationSource.includes(".appSidebar"),
  "Navigation styles must implement the purpose-based top bar.",
);

console.log("Design-system verification OK");
console.log(`Required design-system files: ${requiredFiles.length}`);

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
