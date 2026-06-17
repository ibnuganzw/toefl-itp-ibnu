import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const LISTENING_PARTS = ["A", "B", "C"];
const LISTENING_SOURCE_BY_PART = {
  A: "short-conversation",
  B: "longer-conversation",
  C: "short-talk",
};

const listeningSets = readJson("src/data/imported/listeningSets.json").filter((set) => set.active);
const sessionEngineSource = readText("src/utils/sessionEngine.ts");
const appSource = readText("src/App.tsx");
const sessionScreenSource = readText("src/components/screens/SessionScreen.tsx");
const questionRendererSource = readText("src/components/session/QuestionRenderer.tsx");
const listeningPanelSource = readText("src/components/listening/ListeningPanel.tsx");
const questionAudioSource = readText("src/components/listening/QuestionAudioPlayer.tsx");
const listeningBankSource = readText("src/data/listeningBank.ts");
const listeningPlaybackSource = readText("src/utils/listeningPlayback.ts");
const sessionBlueprintSource = readText("src/utils/sessionBlueprints.ts");

const notes = [];

validateListeningBank();
validateSessionEngineFlow();
validateActiveSessionRendering();

console.log("Listening flow verification OK");
console.log(`Active Listening sets: ${listeningSets.length}`);
console.log(`Active Listening questions: ${listeningSets.reduce((sum, set) => sum + activeQuestions(set).length, 0)}`);
for (const note of notes) console.log(`Warning: ${note}`);

function validateListeningBank() {
  const setIds = new Set();
  const questionIds = new Set();

  for (const set of listeningSets) {
    assert(set.id?.trim(), "Every active Listening set must have an ID.");
    assert(!setIds.has(set.id), `Duplicate active Listening set ID: ${set.id}`);
    setIds.add(set.id);

    assert(LISTENING_PARTS.includes(set.part), `Listening set ${set.id} has invalid part ${set.part}.`);
    assert(
      set.sourceType === LISTENING_SOURCE_BY_PART[set.part],
      `Listening set ${set.id} has sourceType ${set.sourceType}, expected ${LISTENING_SOURCE_BY_PART[set.part]}.`,
    );
    assert(Number.isFinite(set.sequence) && set.sequence > 0, `Listening set ${set.id} needs a positive sequence.`);
    assert((set.audioUrl || set.audioSrc)?.trim(), `Listening set ${set.id} needs set-level audio metadata.`);
    assert(
      fs.existsSync(publicAudioPath(set.audioUrl || set.audioSrc)),
      `Listening set ${set.id} references a missing main audio file.`,
    );
    assert((set.mainAudioTitle || set.title)?.trim(), `Listening set ${set.id} needs a visible main audio title.`);
    assert(Array.isArray(set.questions), `Listening set ${set.id} must have a questions array.`);

    const questions = activeQuestions(set);
    assert(questions.length > 0, `Listening set ${set.id} must have active questions.`);
    if (set.part === "A") {
      assert(questions.length === 1, `Part A set ${set.id} must contain exactly one active question.`);
    }
    if (set.part !== "A" && questions.length === 1) {
      notes.push(`Part ${set.part} set ${set.id} currently has one active question; future complete Part B/C packets should contain multiple questions.`);
    }

    for (const question of questions) {
      assert(question.section === "listening", `Question ${question.id} must be section listening.`);
      assert(question.listeningSetId === set.id, `Question ${question.id} is attached to the wrong Listening set.`);
      assert(question.listeningPart === set.part, `Question ${question.id} is tagged with the wrong Listening part.`);
      if (question.questionAudioUrl) {
        assert(
          question.questionAudioUrl.startsWith("/audio/listening/") && question.questionAudioUrl.endsWith(".mp3"),
          `Question ${question.id} questionAudioUrl must point to /audio/listening/*.mp3.`,
        );
        assert(
          fs.existsSync(publicAudioPath(question.questionAudioUrl)),
          `Question ${question.id} references a missing question audio file.`,
        );
      }
      assert(!questionIds.has(question.id), `Duplicate active Listening question ID: ${question.id}`);
      questionIds.add(question.id);
    }
  }
}

function validateSessionEngineFlow() {
  const compact = sessionEngineSource.replace(/\s+/g, "");
  assert(
    listeningBankSource.includes("TOEFL_ITP_LISTENING_QUESTION_COUNT = 50") &&
      listeningBankSource.includes("TOEFL_ITP_LISTENING_TIME_LIMIT_MINUTES = 35"),
    "Listening constants must preserve TOEFL ITP 50 questions / 35 minutes.",
  );
  assert(
    listeningBankSource.includes("LISTENING_MAIN_AUDIO_PLAY_LIMITS") &&
      listeningBankSource.includes("simulation: 2") &&
      listeningBankSource.includes("learning: 3"),
    "Main audio playback limits must allow 2 total plays in simulation and 3 total plays in learning.",
  );
  assert(
    listeningBankSource.includes("LISTENING_QUESTION_AUDIO_PLAY_LIMITS") &&
      listeningBankSource.includes("simulation: 1"),
    "Question audio playback limits must keep simulation question audio to one play.",
  );
  assert(
    listeningBankSource.includes("LISTENING_MAIN_AUDIO_AUTOPLAY_DELAY_MS = 1500"),
    "Main audio autoplay must keep a short pre-audio delay before the dialog or lecture starts.",
  );
  assert(sessionEngineSource.includes("createListeningPackageUnits"), "Listening sessions must use fixed package blueprints.");
  assert(
    compact.includes(": [...listeningUnits, ...singleUnits, ...readingUnits]".replace(/\s+/g, "")),
    "Full/custom simulations must keep Listening before Structure/Written before Reading.",
  );
  assert(
    sessionBlueprintSource.includes("partB: [4, 3]") &&
      sessionBlueprintSource.includes("partB: [4, 4]") &&
      sessionBlueprintSource.includes("partC: [5, 4, 4]") &&
      sessionBlueprintSource.includes("partC: [4, 4, 4]"),
    "Listening 50 must preserve the approved Part B/C packet patterns.",
  );
  assert(
    compact.includes("options.expandSharedListeningSets??true") &&
      compact.includes('returnlisteningSet.part==="A"||!expandSharedListeningSets?selectedQuestions:activeQuestions'),
    "Retry/weakest sessions must preserve complete Part B/C packets while focused sessions may select relevant questions inside the source audio set.",
  );
}

function validateActiveSessionRendering() {
  const activeSessionSlice = questionRendererSource.slice(
    questionRendererSource.indexOf("function QuestionRenderer"),
    questionRendererSource.indexOf("function PassagePanel"),
  );
  assert(!activeSessionSlice.includes("transcript"), "Listening transcript must not render during an active session.");
  assert(
    questionRendererSource.includes("playbackKey={listeningMainAudioKey(listeningSet.id)}") ||
      sessionScreenSource.includes("playbackKey={listeningMainAudioKey(activeRef.listeningSet.id)}"),
    "Main Listening playback must be keyed by the Listening set main audio key.",
  );
  assert(
    listeningPanelSource.includes("LISTENING_MAIN_AUDIO_AUTOPLAY_DELAY_MS"),
    "Main Listening playback must use the configured pre-audio delay.",
  );
  assert(
    listeningPanelSource.includes("wasPlayingBeforePauseRef") &&
      questionAudioSource.includes("wasPlayingBeforePauseRef"),
    "Listening audio must resume from the paused position without registering a new play.",
  );
  assert(
    listeningPanelSource.includes("onTimeUpdate") && listeningPlaybackSource.includes("formatAudioTime"),
    "Main audio must expose real playback time and progress.",
  );
  assert(questionRendererSource.includes("QuestionAudioPlayer"), "Listening questions must support separate question audio.");
  assert(
    questionAudioSource.includes('className="questionAudioPlayerHidden"'),
    "Automatic question audio must keep its media element hidden from the active-session interface.",
  );
  assert(
    listeningPanelSource.includes('data-player-status={playerStatus}') &&
      listeningPanelSource.includes("Coba Lagi") &&
      questionAudioSource.includes("needsManualPlayback") &&
      questionAudioSource.includes("Putar Pertanyaan"),
    "Listening audio must expose manual recovery when autoplay is blocked or a file load fails.",
  );
  assert(
    questionRendererSource.includes("listeningQuestionAudioKey(question.id)"),
    "Question audio must use per-question playback keys.",
  );
  assert(
    questionRendererSource.includes("canAutoplay={mainAudioCompleted || !listeningSet}"),
    "Question audio must wait for main audio completion.",
  );
  assert(
    sessionScreenSource.includes("onPlaybackStarted={markMainAudioStarted}") &&
      questionAudioSource.includes("if (!audio || canAutoplay) return"),
    "Replaying main audio must stop question audio and return it to the waiting state.",
  );
  assert(
    questionRendererSource.includes("listeningSharedNotice") &&
      sessionScreenSource.includes("listeningRangeStart") &&
      sessionScreenSource.includes("listeningRangeEnd"),
    "Part B/C must clearly identify questions that share the same main audio.",
  );
  assert(
    appSource.includes("Simulasi Listening membutuhkan") && appSource.includes("Simulasi Lengkap membutuhkan"),
    "Official simulation modes must guard against an incomplete active Listening bank.",
  );
}

function activeQuestions(set) {
  return set.questions.filter((question) => question.active);
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function publicAudioPath(audioUrl) {
  return path.join(root, "public", audioUrl.replace(/^[/\\]+/, "").replaceAll("/", path.sep));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
