import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const appSource = readText("src/App.tsx");
const modalSource = readText("src/components/result/ScoreRevealModal.tsx");
const resultSource = readText("src/components/screens/ResultScreen.tsx");
const scoringSource = readText("src/utils/scoreEstimation.ts");

const server = await createServer({
  appType: "custom",
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  root,
  server: { middlewareMode: true },
});
const scoring = await server.ssrLoadModule("/src/utils/scoreEstimation.ts");
const estimate = scoring.estimateFromRawSectionScores({
  listening: 27,
  structureWritten: 22,
  reading: 29,
});

assert(estimate, "Verification estimate must exist.");

const achieved = scoring.buildScoreRevealMessage(
  estimate,
  scoring.compareEstimateToTarget(estimate, estimate.totalEstimate - 10),
  "Main Idea",
);
const near = scoring.buildScoreRevealMessage(
  estimate,
  scoring.compareEstimateToTarget(estimate, estimate.totalEstimate + 20),
  "Main Idea",
);
const progressing = scoring.buildScoreRevealMessage(
  estimate,
  scoring.compareEstimateToTarget(estimate, estimate.totalEstimate + 70),
  "Main Idea",
);
const far = scoring.buildScoreRevealMessage(
  estimate,
  scoring.compareEstimateToTarget(estimate, estimate.totalEstimate + 160),
  "Main Idea",
);
const noTarget = scoring.buildScoreRevealMessage(estimate, undefined, "Main Idea");

assert(achieved.tone === "achieved", "Reveal message must support achieved targets.");
assert(near.tone === "near", "Reveal message must support near targets.");
assert(progressing.tone === "progressing", "Reveal message must support progressing targets.");
assert(far.tone === "far", "Reveal message must support far targets.");
assert(noTarget.tone === "no-target", "Reveal message must support missing targets.");
assert(near.nextStep.includes("Main Idea"), "Reveal message must include the primary diagnostic obstacle.");
assert(!scoringSource.includes("targetScore === 550"), "Reveal logic must not hardcode a 550 target.");
assert(!scoringSource.includes("targetScore === 477"), "Reveal logic must not hardcode a 477 target.");

assert(appSource.includes("setShowResultReveal(Boolean(estimateSimulationScore(finishedSession)))"), "Only eligible estimated simulations may open the reveal.");
assert(resultSource.includes("showScoreReveal && scoreEstimate"), "Result screen must guard the reveal with an eligible estimate.");
assert(modalSource.includes('aria-modal="true"'), "Reveal must be an accessible modal.");
assert(modalSource.includes("Area penghambat utama"), "Reveal must display the primary obstacle.");
assert(modalSource.includes("Lihat Hasil Lengkap"), "Reveal must link to the complete result.");
assert(modalSource.includes("Review Pembahasan"), "Reveal must link to answer review.");
assert(modalSource.includes("Latih Area Prioritas"), "Reveal must link to priority training.");

console.log("Result reveal verification OK");
console.log(`Relative tones: ${[achieved, near, progressing, far, noTarget].map((item) => item.tone).join(", ")}`);
await server.close();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
