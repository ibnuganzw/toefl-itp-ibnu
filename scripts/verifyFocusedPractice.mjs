import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const appSource = readText("src/App.tsx");
const recommendationSource = readText("src/components/home/DashboardRecommendationPanel.tsx");
const focusSource = readText("src/utils/focusedPractice.ts");
const homeSource = readText("src/utils/homeDashboard.ts");
const engineSource = readText("src/utils/sessionEngine.ts");

const server = await createServer({
  appType: "custom",
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  root,
  server: { middlewareMode: true },
});
const engine = await server.ssrLoadModule("/src/utils/sessionEngine.ts");
const focused = await server.ssrLoadModule("/src/utils/focusedPractice.ts");
const dashboard = await server.ssrLoadModule("/src/utils/homeDashboard.ts");
const { questionBank } = await server.ssrLoadModule("/src/data/questionBank.ts");
const { EMPTY_PROGRESS } = await server.ssrLoadModule("/src/utils/progressStorage.ts");

const subjectAgreement = questionBank.structureQuestions.find(
  (question) => question.active && question.grammarPattern === "Subject–Verb Agreement",
);
const subjectAgreementVariant = questionBank.structureQuestions.find(
  (question) => question.active && question.grammarPattern?.includes("Subject–Verb Agreement with"),
);
assert(subjectAgreement && subjectAgreementVariant, "Verification requires Subject–Verb Agreement label variants.");

const agreementTarget = focused.createFocusedPracticeTarget(subjectAgreement);
assert(
  focused.createFocusedPracticeTarget(subjectAgreementVariant).key === agreementTarget.key,
  "Equivalent grammar labels must resolve to one canonical family.",
);
const agreementSession = engine.createFocusedLearningSession(questionBank, agreementTarget);
const agreementRefs = engine.flattenSessionQuestions(agreementSession.units);
assert(agreementRefs.length > 1 && agreementRefs.length <= 20, "Focused grammar session must use the available relevant bank questions.");
assert(
  Array.from({ length: 5 }, () => engine.flattenSessionQuestions(engine.createFocusedLearningSession(questionBank, agreementTarget).units).length)
    .every((count) => count === agreementRefs.length),
  "Focused session question counts must remain stable when units are randomized.",
);
assert(
  agreementRefs.every((ref) => ref.question.section === "structure" && focused.matchesFocusedPractice(ref.question, agreementTarget)),
  "Focused Structure session must not contain unrelated or Written questions.",
);

const mainIdea = questionBank.readingPassages
  .flatMap((passage) => passage.questions)
  .find((question) => question.active && question.readingSkill === "main-idea");
assert(mainIdea, "Verification requires an active Main Idea question.");
const readingTarget = focused.createFocusedPracticeTarget(mainIdea);
const readingRefs = engine.flattenSessionQuestions(engine.createFocusedLearningSession(questionBank, readingTarget).units);
assert(readingRefs.length === 20, "Focused Main Idea session must respect the 20-question recommendation limit.");
assert(
  readingRefs.every((ref) => ref.passage && focused.matchesFocusedPractice(ref.question, readingTarget)),
  "Focused Reading questions must stay nested under their source passages.",
);

const impliedMeaning = questionBank.listeningSets
  .flatMap((set) => set.questions)
  .find((question) => question.active && question.listeningSkill?.includes("Polite Refusal"));
assert(impliedMeaning, "Verification requires an active Polite Refusal Listening question.");
const listeningTarget = focused.createFocusedPracticeTarget(impliedMeaning);
const listeningRefs = engine.flattenSessionQuestions(engine.createFocusedLearningSession(questionBank, listeningTarget).units);
assert(
  listeningRefs.every((ref) => ref.listeningSet && focused.matchesFocusedPractice(ref.question, listeningTarget)),
  "Focused Listening session must keep source audio context without unrelated companion questions.",
);
const sharedListeningSet = questionBank.listeningSets.find((set) => set.active && set.part !== "A");
assert(sharedListeningSet, "Verification requires an active shared-audio Listening set.");
const retryRefs = engine.flattenSessionQuestions(
  engine.createRetrySession(questionBank, [sharedListeningSet.questions.find((question) => question.active).id], "Review", "retry-wrong").units,
);
assert(
  retryRefs.length === sharedListeningSet.questions.filter((question) => question.active).length,
  "Review/retry sessions must still retain the complete shared-audio Listening packet.",
);

const emptyDashboard = dashboard.buildHomeDashboardModel(questionBank, EMPTY_PROGRESS);
assert(emptyDashboard.recommendations.length === 3, "Empty Home must still provide three focused recommendations.");
for (const recommendation of emptyDashboard.recommendations) {
  assert(
    recommendation.questionCount === engine.countFocusedPracticeQuestions(questionBank, recommendation.focusTarget),
    `Recommendation ${recommendation.id} must display its real focused-session question count.`,
  );
}

assert(appSource.includes("createFocusedLearningSession(questionBank, target)"), "App must launch focused sessions through the session engine.");
assert(recommendationSource.includes("onLaunchFocused(item.focusTarget)"), "Recommendation cards must launch their own focus target.");
assert(!recommendationSource.includes("onLaunch(item.launchTarget)"), "Recommendation cards must not launch generic section practice.");
assert(homeSource.includes("countFocusedPracticeQuestions(bank, source.focusTarget)"), "Recommendation counts must come from real focused units.");
assert(engineSource.includes("expandSharedListeningSets: false"), "Focused Listening must exclude unrelated companion questions.");
assert(focusSource.includes("GRAMMAR_RULES") && focusSource.includes("LISTENING_RULES"), "Focused practice must use a documented canonical taxonomy.");

console.log("Focused-practice verification OK");
console.log(`Subject–Verb Agreement focused questions: ${agreementRefs.length}`);
console.log(`Main Idea focused questions: ${readingRefs.length}`);
console.log(`Implied Meaning focused questions: ${listeningRefs.length}`);
await server.close();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
