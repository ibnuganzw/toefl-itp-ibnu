import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DESKTOP_WIDTH = 1919;
const DESKTOP_HEIGHT = 857;
const COMPACT_DESKTOP_WIDTH = 1024;
const PART_B_SET_ID = "listening-b-conversation-31-34";

async function main() {
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:5173";
  const chromePath =
    process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const runDirectory = path.join(os.tmpdir(), `toefl-session-workspace-qa-${Date.now()}`);
  const profileDirectory = path.join(runDirectory, "profile");

  await fs.mkdir(profileDirectory, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-default-browser-check",
      "--no-first-run",
      "--remote-allow-origins=*",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  try {
    const port = await waitForDebugPort(profileDirectory);
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    const pageTarget = targets.find((target) => target.type === "page");
    if (!pageTarget?.webSocketDebuggerUrl) throw new Error("Chrome page target is unavailable.");

    const cdp = await CdpSession.connect(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    const desktop = await inspectDesktop(cdp, appUrl, runDirectory);
    const compactDesktop = await inspectCompactDesktop(cdp, appUrl, runDirectory);
    const writtenOptionBoundaries = await inspectWrittenOptionBoundaries(cdp, appUrl, runDirectory);
    const longQuestionLocalScroll = await inspectLongQuestionLocalScroll(cdp, appUrl, runDirectory);
    const correctAnswerContrast = await inspectCorrectAnswerContrast(cdp, appUrl, runDirectory);
    const mobile = await inspectMobile(cdp, appUrl, runDirectory);

    console.log("Session workspace browser QA OK");
    console.log(
      JSON.stringify(
        {
          desktop,
          compactDesktop,
          writtenOptionBoundaries,
          longQuestionLocalScroll,
          correctAnswerContrast,
          mobile,
          screenshots: runDirectory,
        },
        null,
        2,
      ),
    );
    await cdp.close();
  } finally {
    chrome.kill();
  }
}

async function inspectCompactDesktop(cdp, appUrl, runDirectory) {
  await setViewport(cdp, COMPACT_DESKTOP_WIDTH, DESKTOP_HEIGHT, false);
  await openApp(cdp, appUrl);
  await evaluate(cdp, `document.querySelector('[data-subject-id="structure-written"]')?.click()`);
  await delay(900);

  const metrics = await collectSessionMetrics(cdp);
  metrics.browserErrors = cdp.runtimeErrors();
  assertDesktopPanelOrder("compact structure-written", metrics);
  await capture(cdp, path.join(runDirectory, "compact-desktop-structure-written.png"));

  return metrics;
}

async function inspectDesktop(cdp, appUrl, runDirectory) {
  await setViewport(cdp, DESKTOP_WIDTH, DESKTOP_HEIGHT, false);
  await openApp(cdp, appUrl);

  const results = {};
  for (const navId of ["listening", "structure-written"]) {
    await evaluate(cdp, `document.querySelector('[data-subject-id="${navId}"]')?.click()`);
    await delay(900);
    if (navId === "listening") {
      await evaluate(cdp, `document.querySelector('[data-listening-set-id="${PART_B_SET_ID}"]')?.click()`);
      await delay(350);
    } else {
      await openFirstWrittenQuestion(cdp);
    }
    results[navId] = await collectSessionMetrics(cdp);
    results[navId].browserErrors = cdp.runtimeErrors();
    assertDesktopSession(navId, results[navId]);
    if (navId === "structure-written" && results[navId].writtenMarkerCount !== 4) {
      throw new Error("structure-written: Written question must show four highlighted A-D segments.");
    }
    await capture(cdp, path.join(runDirectory, `desktop-${navId}.png`));

    await evaluate(cdp, "document.querySelector('.choiceButton')?.click()");
    await delay(250);
    if (navId === "listening") {
      await evaluate(
        cdp,
        `(() => {
          const panel = document.querySelector('.listeningWorkspace .questionPanel');
          if (!panel) return;
          panel.style.height = '220px';
          panel.style.maxHeight = '220px';
          panel.scrollTo({ top: panel.scrollHeight });
        })()`,
      );
      await delay(120);
    }
    results[`${navId}-answered`] = await collectSessionMetrics(cdp);
    assertDesktopSession(`${navId}-answered`, results[`${navId}-answered`]);
    if (navId === "listening") {
      assertListeningQuestionControlsReachable(results[`${navId}-answered`]);
    }
    await evaluate(cdp, "document.querySelector('.learningResultBar .uiButton')?.click()");
    await delay(220);
    results[`${navId}-explanation`] = await collectSessionMetrics(cdp);
    assertExplanationDrawer(navId, results[`${navId}-explanation`]);
    if (navId === "structure-written" && results[`${navId}-explanation`].whyCorrectVisible) {
      throw new Error('structure-written: SW explanation must not repeat the "Mengapa kunci benar" block.');
    }
    if (
      navId === "structure-written" &&
      (!results[`${navId}-explanation`].writtenCorrectionVisible ||
        results[`${navId}-explanation`].formattedExplanationItalicCount < 1 ||
        results[`${navId}-explanation`].formattedExplanationListCount < 1)
    ) {
      throw new Error("structure-written: premium Written explanation formatting is incomplete.");
    }
    await capture(cdp, path.join(runDirectory, `desktop-${navId}-explanation.png`));
    await evaluate(cdp, "document.querySelector('.explanationDrawerHeader .uiButton')?.click()");
    await delay(150);
    await evaluate(cdp, "document.querySelectorAll('.choiceButton')[1]?.click()");
    await delay(150);
    results[`${navId}-locked`] = await collectSessionMetrics(cdp);
    if (
      results[`${navId}-locked`].selectedChoice !== results[`${navId}-answered`].selectedChoice ||
      results[`${navId}-locked`].disabledChoices !== 4
    ) {
      throw new Error(`${navId}: learning answer changed after its first selection.`);
    }

    await evaluate(cdp, "document.querySelector('.sessionCommandBar .uiButton')?.click()");
    await delay(180);
    results[`${navId}-exit-dialog`] = await collectSessionMetrics(cdp);
    if (!results[`${navId}-exit-dialog`].exitDialogOpen) {
      throw new Error(`${navId}: leaving an active session did not require confirmation.`);
    }
    await evaluate(cdp, "document.querySelector('.exitSessionActions .uiButton:last-child')?.click()");
    await delay(500);
  }

  return results;
}

async function inspectWrittenOptionBoundaries(cdp, appUrl, runDirectory) {
  await setViewport(cdp, DESKTOP_WIDTH, DESKTOP_HEIGHT, false);
  await openApp(cdp, appUrl);
  await evaluate(
    cdp,
    `localStorage.setItem("toefl-itp-ibnu-progress-v3", JSON.stringify({
      seenQuestionIds: [],
      attemptsByQuestion: {},
      history: [],
      simulationHistory: [],
      activeSession: {
        id: "qa-written-option-boundaries",
        title: "QA Written Part 2/3",
        subtitle: "Memastikan kotak opsi mengikuti teks bold sumber.",
        mode: "learning",
        kind: "retry-wrong",
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        currentIndex: 0,
        answers: {},
        elapsedSeconds: 0,
        unitRefs: [
          { unitType: "single-question", id: "PSW2-W15" },
          { unitType: "single-question", id: "PSW3-W1" }
        ]
      }
    }))`,
  );
  await openApp(cdp, appUrl);
  await evaluate(cdp, `document.querySelector('[data-nav-id="test-space"]')?.click()`);
  await delay(250);
  await evaluate(cdp, `document.querySelector('.arcane-resume-trial .uiButton')?.click()`);
  await delay(350);

  const part2 = await collectSessionMetrics(cdp);
  assertWrittenOptionBoundaries("written Part 2 option boundaries", part2);
  await capture(cdp, path.join(runDirectory, "desktop-written-part-2-option-boundaries.png"));

  await evaluate(cdp, `document.querySelectorAll('.mapButton')[1]?.click()`);
  await delay(150);
  const part3 = await collectSessionMetrics(cdp);
  assertWrittenOptionBoundaries("written Part 3 option boundaries", part3);
  await capture(cdp, path.join(runDirectory, "desktop-written-part-3-option-boundaries.png"));

  await setViewport(cdp, 390, 844, true);
  await evaluate(cdp, `document.querySelectorAll('.mapButton')[0]?.click()`);
  await delay(150);
  const mobilePart2 = await collectSessionMetrics(cdp);
  assertWrittenOptionBoundaries("mobile written Part 2 option boundaries", mobilePart2);
  await capture(cdp, path.join(runDirectory, "mobile-written-part-2-option-boundaries.png"));

  await evaluate(cdp, `localStorage.removeItem("toefl-itp-ibnu-progress-v3")`);
  return { part2, part3, mobilePart2 };
}

function assertWrittenOptionBoundaries(label, metrics) {
  const highlightedOptions = metrics.writtenMarkedTexts.map((value) => value.replace(/^\[[A-D]\]\s*/, ""));
  if (
    metrics.writtenMarkerCount !== 4 ||
    highlightedOptions.length !== metrics.writtenChoiceTexts.length ||
    highlightedOptions.some((value, index) => value !== metrics.writtenChoiceTexts[index])
  ) {
    throw new Error(
      `${label}: highlighted text must exactly match the source-bold choices. ` +
        `Highlighted: ${highlightedOptions.join(" | ")}. Choices: ${metrics.writtenChoiceTexts.join(" | ")}.`,
    );
  }
  if (metrics.writtenMarkerVerticalGap !== null && metrics.writtenMarkerVerticalGap < 2) {
    throw new Error(
      `${label}: highlighted boxes on adjacent lines are touching or overlapping ` +
        `(vertical gap: ${metrics.writtenMarkerVerticalGap}px).`,
    );
  }
}

async function inspectLongQuestionLocalScroll(cdp, appUrl, runDirectory) {
  const cases = [
    {
      id: "written",
      unitRefs: [{ unitType: "single-question", id: "PSW2-W36" }],
    },
    {
      id: "reading",
      unitRefs: [{ unitType: "reading-passage", id: "reading-vrq-p1", questionIds: ["VRQ8"] }],
    },
    {
      id: "listening",
      unitRefs: [{ unitType: "listening-set", id: "listening-2-c-talk-47-50", questionIds: ["listening-q100"] }],
    },
  ];
  const results = {};

  for (const testCase of cases) {
    await setViewport(cdp, DESKTOP_WIDTH, DESKTOP_HEIGHT, false);
    await openApp(cdp, appUrl);
    await evaluate(
      cdp,
      `localStorage.setItem("toefl-itp-ibnu-progress-v3", JSON.stringify({
        seenQuestionIds: [],
        attemptsByQuestion: {},
        history: [],
        simulationHistory: [],
        activeSession: {
          id: "qa-long-${testCase.id}",
          title: "QA Soal Panjang ${testCase.id}",
          subtitle: "Memastikan pilihan dan tombol pembahasan tetap dapat dijangkau.",
          mode: "learning",
          kind: "retry-wrong",
          startedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          currentIndex: 0,
          answers: {},
          elapsedSeconds: 0,
          unitRefs: ${JSON.stringify(testCase.unitRefs)}
        }
      }))`,
    );
    await openApp(cdp, appUrl);
    await evaluate(cdp, `document.querySelector('[data-nav-id="test-space"]')?.click()`);
    await delay(250);
    await evaluate(cdp, `document.querySelector('.arcane-resume-trial .uiButton')?.click()`);
    await delay(350);

    const initial = await collectSessionMetrics(cdp);
    if (initial.questionPanel?.overflowY !== "auto") {
      throw new Error(`${testCase.id}: question panel must provide local scrolling.`);
    }
    if (testCase.id === "reading") {
      await capture(cdp, path.join(runDirectory, "desktop-reading-reference.png"));
    }

    await evaluate(cdp, "document.querySelector('.choiceButton')?.click()");
    await delay(180);
    await evaluate(
      cdp,
      `(() => {
        const panel = document.querySelector('.questionPanel');
        if (!panel) return;
        panel.style.height = '230px';
        panel.style.maxHeight = '230px';
        panel.scrollTo({ top: panel.scrollHeight });
      })()`,
    );
    await delay(120);
    const answered = await collectSessionMetrics(cdp);
    assertQuestionControlsReachable(`${testCase.id} answered`, answered);
    await capture(cdp, path.join(runDirectory, `desktop-long-${testCase.id}-scrolled.png`));

    await evaluate(cdp, "document.querySelector('.learningResultBar .uiButton')?.click()");
    await delay(180);
    const explanation = await collectSessionMetrics(cdp);
    assertExplanationDrawer(testCase.id, explanation);
    if (explanation.explanationDrawerBody?.overflowY !== "auto") {
      throw new Error(`${testCase.id}: explanation drawer body must scroll independently.`);
    }
    await capture(cdp, path.join(runDirectory, `desktop-long-${testCase.id}-explanation.png`));
    results[testCase.id] = { initial, answered, explanation };
  }

  await evaluate(cdp, `localStorage.removeItem("toefl-itp-ibnu-progress-v3")`);
  return results;
}

async function inspectCorrectAnswerContrast(cdp, appUrl, runDirectory) {
  await setViewport(cdp, DESKTOP_WIDTH, DESKTOP_HEIGHT, false);
  await openApp(cdp, appUrl);
  await evaluate(
    cdp,
    `localStorage.setItem("toefl-itp-ibnu-progress-v3", JSON.stringify({
      seenQuestionIds: [],
      attemptsByQuestion: {},
      history: [],
      simulationHistory: [],
      activeSession: {
        id: "qa-correct-answer-contrast",
        title: "QA Kontras Jawaban Benar",
        subtitle: "Memastikan status dan pembahasan jawaban benar tetap terbaca.",
        mode: "learning",
        kind: "retry-wrong",
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        currentIndex: 0,
        answers: {},
        elapsedSeconds: 0,
        unitRefs: [{ unitType: "single-question", id: "PSW2-W36" }]
      }
    }))`,
  );
  await openApp(cdp, appUrl);
  await evaluate(cdp, `document.querySelector('[data-nav-id="test-space"]')?.click()`);
  await delay(250);
  await evaluate(cdp, `document.querySelector('.arcane-resume-trial .uiButton')?.click()`);
  await delay(350);
  await evaluate(
    cdp,
    `[...document.querySelectorAll('.choiceButton')].find((button) => button.querySelector('.arcane-answer-letter')?.textContent?.trim() === 'D')?.click()`,
  );
  await delay(180);

  const answered = await collectSessionMetrics(cdp);
  if (!answered.correctFeedbackVisible) {
    throw new Error("correct answer contrast: correct feedback state did not render.");
  }
  if (
    answered.correctFeedbackTitleContrast < 7 ||
    answered.correctFeedbackCopyContrast < 7
  ) {
    throw new Error(
      `correct answer contrast: feedback text contrast is too low ` +
        `(title ${answered.correctFeedbackTitleContrast}, copy ${answered.correctFeedbackCopyContrast}).`,
    );
  }
  await capture(cdp, path.join(runDirectory, "desktop-correct-answer-feedback.png"));

  await evaluate(cdp, "document.querySelector('.learningResultBar .uiButton')?.click()");
  await delay(180);
  const explanation = await collectSessionMetrics(cdp);
  if (explanation.explanationAnswerResult !== "correct") {
    throw new Error("correct answer contrast: explanation drawer is missing its correct-result theme.");
  }
  if (
    explanation.correctExplanationBodyContrast < 7 ||
    explanation.correctExplanationAccentContrast < 6
  ) {
    throw new Error(
      `correct answer contrast: explanation contrast is too low ` +
        `(body ${explanation.correctExplanationBodyContrast}, accent ${explanation.correctExplanationAccentContrast}).`,
    );
  }
  await capture(cdp, path.join(runDirectory, "desktop-correct-answer-explanation.png"));
  await evaluate(cdp, `localStorage.removeItem("toefl-itp-ibnu-progress-v3")`);

  return { answered, explanation };
}

async function inspectMobile(cdp, appUrl, runDirectory) {
  await setViewport(cdp, 390, 844, true);
  await openApp(cdp, appUrl);
  await evaluate(cdp, "document.querySelector('[data-subject-id=\"listening\"]')?.click()");
  await delay(900);
  const results = { initial: await collectSessionMetrics(cdp) };
  results.initial.browserErrors = cdp.runtimeErrors();
  await capture(cdp, path.join(runDirectory, "mobile-listening.png"));

  if (results.initial.pageOverflowX) throw new Error("mobile listening: horizontal page overflow detected.");
  if (results.initial.layout !== "listening") throw new Error("mobile listening: listening layout marker is missing.");
  if (results.initial.mapGroupsOverflowY !== "auto") {
    throw new Error("mobile listening: Daftar Soal must keep its independent scroll behavior.");
  }

  await evaluate(cdp, "document.querySelector('.choiceButton')?.click()");
  await delay(200);
  await evaluate(cdp, "document.querySelector('.learningResultBar .uiButton')?.click()");
  await delay(220);
  results.explanation = await collectSessionMetrics(cdp);
  assertMobileExplanation(results.explanation);
  await capture(cdp, path.join(runDirectory, "mobile-listening-explanation.png"));

  await openApp(cdp, appUrl);
  await evaluate(cdp, "document.querySelector('[data-subject-id=\"structure-written\"]')?.click()");
  await delay(900);
  await openFirstWrittenQuestion(cdp);
  await evaluate(cdp, "document.querySelector('.choiceButton')?.click()");
  await delay(200);
  await evaluate(cdp, "document.querySelector('.learningResultBar .uiButton')?.click()");
  await delay(220);
  results.writtenExplanation = await collectSessionMetrics(cdp);
  assertMobileExplanation(results.writtenExplanation);
  if (
    !results.writtenExplanation.writtenCorrectionVisible ||
    results.writtenExplanation.formattedExplanationItalicCount < 1 ||
    results.writtenExplanation.formattedExplanationListCount < 1
  ) {
    throw new Error("mobile structure-written: premium Written explanation formatting is incomplete.");
  }
  await capture(cdp, path.join(runDirectory, "mobile-structure-written-explanation.png"));

  return results;
}

async function openApp(cdp, appUrl) {
  await cdp.send("Page.navigate", { url: appUrl });
  await delay(1200);
}

async function collectSessionMetrics(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        return {
          bottom: Math.round(bounds.bottom),
          height: Math.round(bounds.height),
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          top: Math.round(bounds.top),
          width: Math.round(bounds.width)
        };
      };
      const overflow = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        return {
          clientHeight: Math.round(element.clientHeight),
          overflowY: getComputedStyle(element).overflowY,
          scrollHeight: Math.round(element.scrollHeight)
        };
      };
      const session = document.querySelector('.sessionDashboardShell');
      const mapGroups = document.querySelector('.mapGroups');
      const explanationBackdrop = document.querySelector('.explanationDrawerBackdrop');
      const parseColor = (value) => {
        const match = value?.match(/[\\d.]+/g);
        return match ? match.slice(0, 3).map(Number) : null;
      };
      const luminance = (rgb) => {
        if (!rgb) return null;
        const channels = rgb.map((value) => {
          const normalized = value / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const contrastAgainst = (selector, background) => {
        const element = document.querySelector(selector);
        const foregroundLuminance = element ? luminance(parseColor(getComputedStyle(element).color)) : null;
        const backgroundLuminance = luminance(parseColor(background));
        if (foregroundLuminance === null || backgroundLuminance === null) return null;
        return Math.round(((Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)) * 100) / 100;
      };
      return {
        bodyText: document.body.innerText.slice(0, 500),
        contentOverflow: overflow('.dashboardContent'),
        contextRangeText: document.querySelector('.contextRangeBadge')?.textContent?.trim() ?? null,
        documentHeight: document.documentElement.scrollHeight,
        height: innerHeight,
        layout: session?.getAttribute('data-session-layout') ?? null,
        mapGroupCount: document.querySelectorAll('.mapGroup').length,
        mapGroups: overflow('.mapGroups'),
        mapGroupsOverflowY: mapGroups ? getComputedStyle(mapGroups).overflowY : null,
        whyCorrectVisible: [...document.querySelectorAll('.explanationBlock > strong')]
          .some((label) => label.textContent?.trim() === 'Mengapa kunci benar'),
        writtenCorrectionVisible: Boolean(document.querySelector('.writtenCorrectionSummary')),
        formattedExplanationItalicCount: document.querySelectorAll('.explanationDrawer em').length,
        formattedExplanationListCount: document.querySelectorAll('.explanationDrawer ul, .explanationDrawer ol').length,
        pageOverflowX: document.documentElement.scrollWidth > innerWidth + 2,
        pageOverflowY: document.documentElement.scrollHeight > innerHeight + 2,
        passageText: overflow('.passageText'),
        passageLabel: document.querySelector('.passagePanel')?.getAttribute('data-reading-passage-label') ?? null,
        passageMetaCount: document.querySelectorAll('.passagePanel .passageMeta').length,
        passageVisibleText: document.querySelector('.passageText')?.textContent?.trim().slice(0, 220) ?? null,
        questionMap: overflow('.questionMap'),
        questionMapRect: rect('.questionMap'),
        questionWorkspaceRect: rect('.questionWorkspace'),
        questionPanel: overflow('.questionPanel'),
        questionPanelRect: rect('.questionPanel'),
        inlineActionsRect: rect('.inlineActions'),
        learningResultBarRect: rect('.learningResultBar'),
        correctFeedbackVisible: Boolean(document.querySelector('.learningResultBar.correct')),
        correctFeedbackTitleContrast: contrastAgainst(
          '.learningResultBar.correct .learningResultStatus strong',
          'rgb(17, 24, 39)'
        ),
        correctFeedbackCopyContrast: contrastAgainst(
          '.learningResultBar.correct .learningResultStatus small',
          'rgb(17, 24, 39)'
        ),
        selectedChoice: document.querySelector('.choiceButton.isSelected > span')?.textContent?.trim() ?? null,
        disabledChoices: document.querySelectorAll('.choiceButton:disabled').length,
        explanationBackdropFilter: explanationBackdrop ? getComputedStyle(explanationBackdrop).backdropFilter : null,
        explanationDrawerOpen: Boolean(document.querySelector('[data-explanation-open="true"]')),
        explanationAnswerResult: document.querySelector('.explanationDrawer')?.getAttribute('data-answer-result') ?? null,
        explanationDrawerRect: rect('.explanationDrawer'),
        explanationDrawerBody: overflow('.explanationDrawerBody'),
        correctExplanationBodyContrast: contrastAgainst(
          '.explanationDrawer[data-answer-result="correct"] .arcane-grimoire-stack p',
          'rgb(17, 24, 39)'
        ),
        correctExplanationAccentContrast: contrastAgainst(
          '.explanationDrawer[data-answer-result="correct"] .arcane-grimoire-stack .explanationBlock > strong',
          'rgb(17, 24, 39)'
        ),
        exitDialogOpen: Boolean(document.querySelector('.exitSessionModal')),
        sidebarHidden: !document.querySelector('.appTopNavigation'),
        sessionOverflow: overflow('.sessionDashboardShell'),
        sessionRect: rect('.sessionDashboardShell'),
        bottomBarRect: rect('.sessionBottomBar'),
        width: innerWidth,
        writtenMarkerCount: document.querySelectorAll('.writtenMarkedSegment').length,
        writtenMarkedTexts: [...document.querySelectorAll('.writtenMarkedSegment')]
          .map((element) => element.textContent?.trim() ?? ''),
        writtenMarkerVerticalGap: (() => {
          const rects = [...document.querySelectorAll('.writtenMarkedSegment')]
            .flatMap((element) => [...element.getClientRects()])
            .map((bounds) => ({ bottom: bounds.bottom, top: bounds.top }))
            .sort((left, right) => left.top - right.top);
          const lineBounds = [];
          for (const bounds of rects) {
            const line = lineBounds.find((candidate) => Math.abs(candidate.top - bounds.top) < 2);
            if (line) {
              line.bottom = Math.max(line.bottom, bounds.bottom);
              line.top = Math.min(line.top, bounds.top);
            } else {
              lineBounds.push({ ...bounds });
            }
          }
          if (lineBounds.length < 2) return null;
          return Math.round(Math.min(...lineBounds.slice(1).map((line, index) => line.top - lineBounds[index].bottom)));
        })(),
        writtenChoiceTexts: [...document.querySelectorAll('.choiceButton .arcane-answer-text')]
          .map((element) => element.textContent?.trim() ?? ''),
        answerTextFontWeight: getComputedStyle(document.querySelector('.arcane-answer-text') ?? document.body).fontWeight,
        sessionFontFamily: getComputedStyle(document.querySelector('.sessionDashboardShell') ?? document.body).fontFamily
      };
    })()`,
  );
}

async function openFirstWrittenQuestion(cdp) {
  const buttonCount = await evaluate(cdp, "document.querySelectorAll('.mapButton').length");

  for (let index = 0; index < buttonCount; index += 1) {
    await evaluate(cdp, `document.querySelectorAll('.mapButton')[${index}]?.click()`);
    await delay(60);
    const markerCount = await evaluate(cdp, "document.querySelectorAll('.writtenMarkedSegment').length");
    if (markerCount === 4) return;
  }

  throw new Error("structure-written: no Written Expression question was available for marker QA.");
}

function assertExplanationDrawer(label, metrics) {
  if (!metrics.explanationDrawerOpen || !metrics.explanationDrawerRect) {
    throw new Error(`${label}: explanation drawer did not open.`);
  }
  const drawerRatio = metrics.explanationDrawerRect.width / metrics.width;
  if (drawerRatio < 0.45 || drawerRatio > 0.7) {
    throw new Error(`${label}: explanation drawer must cover roughly half the desktop viewport.`);
  }
  if (!metrics.explanationBackdropFilter || metrics.explanationBackdropFilter === "none") {
    throw new Error(`${label}: the visible question area is not softly blurred behind the explanation drawer.`);
  }
  if (metrics.disabledChoices !== 4) {
    throw new Error(`${label}: opening the explanation drawer must keep the selected answer locked.`);
  }
}

function assertMobileExplanation(metrics) {
  if (!metrics.explanationDrawerOpen || !metrics.explanationDrawerRect) {
    throw new Error("mobile listening: explanation drawer did not open.");
  }
  if (Math.abs(metrics.explanationDrawerRect.width - metrics.width) > 2) {
    throw new Error("mobile listening: explanation drawer must use the full mobile width.");
  }
  if (metrics.pageOverflowX) {
    throw new Error("mobile listening: explanation drawer caused horizontal overflow.");
  }
  if (metrics.disabledChoices !== 4) {
    throw new Error("mobile listening: the selected answer must stay locked behind the explanation drawer.");
  }
}

function assertDesktopSession(label, metrics) {
  if (!metrics.contentOverflow || !metrics.sessionOverflow || !metrics.questionMap || !metrics.questionPanel) {
    throw new Error(
      `${label}: session workspace did not render. Visible text: ${metrics.bodyText}. Browser errors: ${metrics.browserErrors?.join(" | ")}`,
    );
  }
  if (metrics.width !== DESKTOP_WIDTH || metrics.height !== DESKTOP_HEIGHT) {
    throw new Error(`${label}: desktop viewport was not applied.`);
  }
  if (!metrics.sidebarHidden) {
    throw new Error(`${label}: the main sidebar must be hidden while a session is active.`);
  }
  if (metrics.pageOverflowX || metrics.pageOverflowY) {
    throw new Error(`${label}: page overflow detected at desktop 100%.`);
  }
  if (metrics.contentOverflow.scrollHeight > metrics.contentOverflow.clientHeight + 2) {
    throw new Error(`${label}: dashboard content is scrolling instead of its internal regions.`);
  }
  if (metrics.sessionOverflow.scrollHeight > metrics.sessionOverflow.clientHeight + 2) {
    throw new Error(`${label}: session shell exceeds the viewport workspace.`);
  }
  if (metrics.questionMap.scrollHeight > metrics.questionMap.clientHeight + 2) {
    throw new Error(`${label}: Daftar Soal container itself is scrolling.`);
  }
  if (metrics.mapGroupsOverflowY !== "auto") {
    throw new Error(`${label}: only the Daftar Soal list must scroll independently.`);
  }
  if (metrics.questionPanelRect.bottom > DESKTOP_HEIGHT + 1 || metrics.bottomBarRect.bottom > DESKTOP_HEIGHT + 1) {
    throw new Error(`${label}: active question or bottom navigation is outside the viewport.`);
  }
  if (metrics.questionPanel.overflowY !== "auto") {
    throw new Error(`${label}: active question panel must scroll independently.`);
  }
  if (metrics.layout === "reading" && metrics.passageText?.overflowY !== "auto") {
    throw new Error(`${label}: Reading passage must scroll independently.`);
  }
  if (metrics.layout === "reading" && !metrics.passageLabel?.startsWith("Naskah ")) {
    throw new Error(`${label}: Reading passage must expose its Naskah number.`);
  }
  if (
    metrics.layout === "reading" &&
    (metrics.passageMetaCount !== 0 ||
      /^(?:Naskah|Subtopik singkat|Topik|Kategori|Category|Topic|Format|Passage)\b/i.test(metrics.passageVisibleText ?? "") ||
      /Soal dan Pembahasan/i.test(metrics.passageVisibleText ?? ""))
  ) {
    throw new Error(`${label}: Reading passage still exposes source tags or metadata.`);
  }
  if (!metrics.sessionFontFamily?.match(/Inter|IBM Plex Sans|Arial/i)) {
    throw new Error(`${label}: session typography is not using the refined academic font stack.`);
  }
  if (Number(metrics.answerTextFontWeight) > 600) {
    throw new Error(`${label}: answer text is still too heavy for the academic session design.`);
  }
  if (label === "listening" && metrics.mapGroupCount !== 3) {
    throw new Error("listening: Daftar Soal must be compacted into Part A, Part B, and Part C.");
  }
  assertDesktopPanelOrder(label, metrics);
}

function assertDesktopPanelOrder(label, metrics) {
  if (!metrics.questionMapRect || !metrics.questionWorkspaceRect) {
    throw new Error(`${label}: Daftar Soal or active question workspace is missing.`);
  }
  if (metrics.questionMapRect.right > metrics.questionWorkspaceRect.left + 2) {
    throw new Error(`${label}: Daftar Soal must remain to the left of the active question workspace.`);
  }
  if (Math.abs(metrics.questionMapRect.top - metrics.questionWorkspaceRect.top) > 2) {
    throw new Error(`${label}: Daftar Soal and active question workspace must align at the top.`);
  }
  if (Math.abs(metrics.questionMapRect.bottom - metrics.questionWorkspaceRect.bottom) > 2) {
    throw new Error(`${label}: Daftar Soal and active question workspace must align at the bottom.`);
  }
}

function assertListeningQuestionControlsReachable(metrics) {
  assertQuestionControlsReachable("listening answered", metrics);
}

function assertQuestionControlsReachable(label, metrics) {
  if (!metrics.questionPanelRect || !metrics.inlineActionsRect || !metrics.learningResultBarRect) {
    throw new Error(`${label}: doubtful and explanation controls must render.`);
  }
  if (metrics.questionPanel.scrollHeight <= metrics.questionPanel.clientHeight + 2) {
    throw new Error(`${label}: a constrained question must use its local scroll region.`);
  }
  const panelTop = metrics.questionPanelRect.top - 1;
  const panelBottom = metrics.questionPanelRect.bottom + 1;
  if (
    metrics.inlineActionsRect.top < panelTop ||
    metrics.inlineActionsRect.bottom > panelBottom ||
    metrics.learningResultBarRect.top < panelTop ||
    metrics.learningResultBarRect.bottom > panelBottom
  ) {
    throw new Error(`${label}: local question scroll must reveal doubtful and explanation controls.`);
  }
}

async function setViewport(cdp, width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height,
    mobile,
    width,
  });
}

async function capture(cdp, filePath) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
  });
  await fs.writeFile(filePath, Buffer.from(result.data, "base64"));
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        JSON.stringify(result.exceptionDetails),
    );
  }
  return result.result.value;
}

async function waitForDebugPort(profilePath) {
  const activePortPath = path.join(profilePath, "DevToolsActivePort");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const [port] = (await fs.readFile(activePortPath, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {
      await delay(100);
    }
  }
  throw new Error("Timed out while starting headless Chrome.");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class CdpSession {
  constructor(socket) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        this.events.push(message);
        return;
      }
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolve(new CdpSession(socket)), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
  }

  close() {
    this.socket.close();
  }

  runtimeErrors() {
    return this.events
      .filter(
        (event) =>
          event.method === "Runtime.exceptionThrown" ||
          event.method === "Log.entryAdded" ||
          (event.method === "Runtime.consoleAPICalled" && event.params?.type === "error"),
      )
      .map((event) => JSON.stringify(event.params))
      .slice(-8);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

await main();
