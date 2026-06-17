import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const appSource = readText("src/App.tsx");
const storageSource = readText("src/utils/progressStorage.ts");
const homeSource = readText("src/utils/homeDashboard.ts");
const historyPanelSource = readText("src/components/home/DashboardHistoryPanel.tsx");
const resultSource = readText("src/components/screens/ResultScreen.tsx");

const server = await createServer({
  appType: "custom",
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  root,
  server: { middlewareMode: true },
});
const engine = await server.ssrLoadModule("/src/utils/sessionEngine.ts");
const historyDiagnostics = await server.ssrLoadModule("/src/utils/historyDiagnostics.ts");
const { questionBank } = await server.ssrLoadModule("/src/data/questionBank.ts");

const blueprint = engine.createLearningSession(questionBank, "structure-written", {
  maxQuestions: 25,
  shuffleUnits: false,
});
const session = engine.createRuntimeSession(blueprint);
const refs = engine.flattenSessionQuestions(session.units);
assert(refs.length === 25, "Verification session must contain 25 questions.");

const correctRef = refs[0];
const wrongRef = refs[1];
const doubtfulRef = refs[2];
const wrongAnswer = engine.ANSWER_KEYS.find((key) => key !== wrongRef.question.correctAnswer);

session.answers[correctRef.question.id] = engine.createAnswerRecord(
  correctRef,
  correctRef.question.correctAnswer,
  undefined,
  20,
);
session.answers[wrongRef.question.id] = engine.createAnswerRecord(wrongRef, wrongAnswer, undefined, 40);
session.answers[doubtfulRef.question.id] = engine.toggleDoubtfulRecord(doubtfulRef, undefined, 45);
session.elapsedSeconds = 125;
session.finishedAt = "2026-06-12T00:00:00.000Z";

const diagnostic = engine.computeDiagnostic(session);
const snapshot = historyDiagnostics.createDiagnosticSnapshot(session, diagnostic);

assert(diagnostic.totalAttempted === 2, "Diagnostic must count attempted questions.");
assert(diagnostic.totalCorrect === 1, "Diagnostic must count correct questions.");
assert(diagnostic.totalIncorrect === 1, "Diagnostic must count incorrect questions.");
assert(diagnostic.totalUnanswered === 23, "Diagnostic must count unanswered questions.");
assert(diagnostic.totalDoubtful === 1, "Diagnostic must count doubtful questions independently.");
assert(diagnostic.completionRate === 8, "Completion rate must be based on all questions.");
assert(diagnostic.byGrammarPattern.length > 0, "Grammar diagnostics must be retained.");
assert(diagnostic.weakestAreas.length > 0, "Weakest areas must be generated.");
assert(diagnostic.strongestAreas.length > 0, "Strongest areas must be generated.");
assert(snapshot.version === "session-diagnostic-v1", "Snapshot must have a stable version.");
assert(snapshot.outcomes.wrongQuestionIds.includes(wrongRef.question.id), "Wrong question IDs must be stored.");
assert(snapshot.outcomes.doubtfulQuestionIds.includes(doubtfulRef.question.id), "Doubtful question IDs must be stored.");
assert(snapshot.outcomes.unansweredQuestionIds.length === 23, "Unanswered question IDs must be stored.");
assert(snapshot.pace.averageSecondsPerAttempt === 63, "Average pace must be deterministic.");

assert(storageSource.includes('"toefl-itp-ibnu-progress-v3"'), "Progress storage must use schema v3.");
assert(storageSource.includes('"toefl-itp-ibnu-progress-v2"'), "Storage must migrate schema v2.");
assert(appSource.includes("createDiagnosticSnapshot(session, diagnostic)"), "Finished sessions must store a diagnostic snapshot.");
assert(appSource.includes("progress.simulationHistory"), "Simulation history must be retained separately.");
assert(homeSource.includes("progress.simulationHistory.slice(0, 3)"), "Home must consume simulation history.");
assert(historyPanelSource.includes("<details"), "Simulation history must expose expandable diagnostics.");
assert(resultSource.includes('title="Area Prioritas"'), "Result screen must expose priority diagnostics.");
assert(resultSource.includes("diagnostic.strongestAreas"), "Result screen must expose strongest areas.");

console.log("History and diagnostic verification OK");
console.log(`Snapshot version: ${snapshot.version}`);
console.log(`Response summary: ${snapshot.response.correct} correct, ${snapshot.response.incorrect} incorrect, ${snapshot.response.unanswered} unanswered`);
await server.close();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
