import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "src/styles/session-workspace.css",
  "src/components/screens/SessionScreen.tsx",
  "src/components/session/QuestionMap.tsx",
  "src/components/session/QuestionRenderer.tsx",
];

for (const filePath of requiredFiles) {
  assert(fs.existsSync(path.join(root, filePath)), `Missing session workspace foundation: ${filePath}`);
}

const mainSource = readText("src/main.tsx");
const appSource = readText("src/App.tsx");
const screenSource = readText("src/components/screens/SessionScreen.tsx");
const rendererSource = readText("src/components/session/QuestionRenderer.tsx");
const dashboardShellSource = readText("src/components/dashboard/DashboardShell.tsx");
const exitModalSource = readText("src/components/session/ExitSessionModal.tsx");
const stylesSource = readText("src/styles/session-workspace.css");
const redesignStylesSource = readText("src/styles/session-redesign.css");

assert(
  mainSource.indexOf('./styles/session-workspace.css') > mainSource.indexOf('./styles/home-dashboard.css'),
  "Session workspace styles must load after the dashboard styles.",
);
assert(screenSource.includes("data-session-layout={sessionLayout}"), "SessionScreen must expose its active layout.");
assert(rendererSource.includes("data-question-layout={questionLayout}"), "QuestionRenderer must expose its active layout.");
assert(
  rendererSource.includes("explanationDrawerBackdrop") &&
    rendererSource.includes("explanationDrawer") &&
    rendererSource.includes('data-explanation-open="true"'),
  "Learning explanations must open in the dedicated drawer.",
);
assert(
  stylesSource.includes("backdrop-filter: blur(2.5px)") && stylesSource.includes("width: clamp(640px, 52vw, 920px)"),
  "The explanation drawer must cover roughly half the desktop and softly blur the remaining question area.",
);
assert(
  screenSource.includes("activeReadingPassageNumber") &&
    rendererSource.includes("data-reading-passage-label") &&
    rendererSource.includes("Naskah {passageNumber}"),
  "Reading passages must expose their clean Naskah number.",
);
assert(
  appSource.includes('current.mode === "learning" && current.answers[ref.question.id]?.selectedAnswer'),
  "Learning answers must lock after the first selection.",
);
assert(
  rendererSource.includes("disabled={learningMode && Boolean(answer?.selectedAnswer)}"),
  "Locked learning answers must be reflected by the choice controls.",
);
assert(
  dashboardShellSource.includes('data-navigation-hidden={hideNavigation ? "true" : "false"}') &&
    stylesSource.includes('.dashboardFrame[data-navigation-hidden="true"]'),
  "The main navigation must be removable while a session is active.",
);
assert(
  exitModalSource.includes("Yakin ingin keluar?") &&
    exitModalSource.includes("progresmu akan kami simpan") &&
    appSource.includes("activeSession: snapshot"),
  "Leaving an active session must require confirmation and explicitly preserve its snapshot.",
);
assert(stylesSource.includes('.dashboardViewport[data-screen="session"]'), "Desktop session shell must be screen-scoped.");
assert(stylesSource.includes("height: 100dvh"), "Desktop session shell must lock to the viewport height.");
assert(stylesSource.includes(".mapGroups"), "Question list must have an independent scroll region.");
assert(
  stylesSource.includes(".sessionLayout > .questionMap") &&
    stylesSource.includes(".sessionLayout > .questionWorkspace") &&
    stylesSource.includes("order: 0"),
  "Desktop sessions must preserve the Daftar Soal then active-question panel order.",
);
assert(stylesSource.includes(".passageText"), "Reading passage must have an independent scroll region.");
assert(
  stylesSource.includes(".questionPanel") &&
    stylesSource.includes("overscroll-behavior: contain") &&
    stylesSource.includes("scrollbar-gutter: stable"),
  "Question panels must have an independent contained scroll region.",
);
assert(stylesSource.includes("overflow-y: auto"), "Session workspace must define internal vertical scroll.");
assert(
  mainSource.indexOf('./styles/session-redesign.css') > mainSource.indexOf('./styles/arcane.css') &&
    redesignStylesSource.includes("--session-font") &&
    redesignStylesSource.includes(".readingWorkspace"),
  "The reference-led session redesign must load after legacy arcane styles.",
);

console.log("Session workspace verification OK");
console.log(`Required session workspace files: ${requiredFiles.length}`);

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
