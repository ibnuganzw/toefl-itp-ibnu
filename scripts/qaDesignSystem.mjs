import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const expectedActiveQuestionCount = await countActiveQuestions();

async function countActiveQuestions() {
  const readJson = async (relativePath) =>
    JSON.parse(await fs.readFile(path.join(process.cwd(), relativePath), "utf8"));
  const [structure, written, readingPassages, listeningSets] = await Promise.all([
    readJson("src/data/imported/structureQuestions.json"),
    readJson("src/data/imported/writtenExpressionQuestions.json"),
    readJson("src/data/imported/readingPassages.json"),
    readJson("src/data/imported/listeningSets.json"),
  ]);
  return (
    structure.filter((question) => question.active).length +
    written.filter((question) => question.active).length +
    readingPassages
      .filter((passage) => passage.active)
      .reduce((sum, passage) => sum + passage.questions.filter((question) => question.active).length, 0) +
    listeningSets
      .filter((set) => set.active)
      .reduce((sum, set) => sum + set.questions.filter((question) => question.active).length, 0)
  );
}

async function main() {
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:5173";
  const chromePath =
    process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const runDirectory = process.env.QA_OUTPUT_DIR
    ? path.resolve(process.env.QA_OUTPUT_DIR)
    : path.join(os.tmpdir(), `toefl-design-system-qa-${Date.now()}`);
  const profileDirectory = path.join(os.tmpdir(), `toefl-design-system-qa-profile-${Date.now()}`);

  await fs.mkdir(runDirectory, { recursive: true });
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

    const desktop = await inspectViewport(cdp, appUrl, runDirectory, "desktop", 1440, 1000);
    const compactDesktop = await inspectViewport(cdp, appUrl, runDirectory, "compact-desktop", 1280, 900);
    const mobile = await inspectViewport(cdp, appUrl, runDirectory, "mobile", 390, 844);

    console.log("Design-system browser QA OK");
    console.log(JSON.stringify({ compactDesktop, desktop, mobile, screenshots: runDirectory }, null, 2));
    await cdp.close();
  } finally {
    chrome.kill();
  }
}

async function inspectViewport(cdp, appUrl, runDirectory, label, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height,
    mobile: label === "mobile",
    width,
  });
  await cdp.send("Page.navigate", { url: appUrl });
  await waitForSelector(cdp, ".homeDashboardV2");
  await resetDashboardProgress(cdp, appUrl);
  await waitForSelector(cdp, ".homeDashboardV2");

  const home = await collectMetrics(cdp);
  await capture(cdp, path.join(runDirectory, `${label}-home.png`));
  const navigationScroll = await inspectNavigationScroll(cdp);
  await seedDashboardProgress(cdp, appUrl);
  await evaluate(cdp, "document.querySelector('.dashboardHistoryItem summary')?.click()");
  await delay(150);
  const populatedHome = await collectMetrics(cdp);
  await capture(cdp, path.join(runDirectory, `${label}-home-populated.png`));
  if (label === "compact-desktop") {
    await evaluate(cdp, "document.querySelector('.arcane-progress-compass')?.scrollIntoView({ block: 'start', behavior: 'instant' })");
    await delay(150);
    await capture(cdp, path.join(runDirectory, `${label}-home-compass.png`));
    await evaluate(cdp, "scrollTo({ top: 0, behavior: 'instant' })");
  }
  const heroExplore = await testHeroExplore(cdp);
  const focusedRecommendation = await testFocusedRecommendation(cdp);
  const purposeNavigation = await testPurposeNavigation(cdp, runDirectory, label);
  const destinationActions = await testDestinationActions(cdp);
  const dashboardLaunch = await testDashboardLaunch(cdp);
  const resultReveal = await testScoreReveal(cdp, runDirectory, label);

  await evaluate(
    cdp,
    "document.querySelector('[data-subject-id=\"listening\"]')?.click()",
  );
  await delay(1000);

  const session = await collectMetrics(cdp);
  await capture(cdp, path.join(runDirectory, `${label}-listening.png`));

  if (home.primitiveButtons < 1 || home.navIcons !== 5 || home.navItems !== 5 || home.personalHeroes !== 1) {
    throw new Error(`${label}: shared primitives are missing on Home.`);
  }
  if (home.progressIllustrations !== 0 || home.progressStage !== null) {
    throw new Error(`${label}: immersive Home hero must not restore the old progress illustration.`);
  }
  if (
    home.summaryCards !== 5 ||
    home.recommendationItems < 3 ||
    home.subjectCards !== 3 ||
    home.learningZones !== 4 ||
    home.collectionPanels !== 1 ||
    home.testSpaceCards !== 1 ||
    home.scoreTargetCards !== 1 ||
    home.activeQuestionValue !== new Intl.NumberFormat("id-ID").format(expectedActiveQuestionCount)
  ) {
    throw new Error(`${label}: Home dashboard foundation is incomplete.`);
  }
  if (
    populatedHome.focusItems < 1 ||
    populatedHome.historyItems !== 2 ||
    populatedHome.historyDiagnosticRows < 1 ||
    populatedHome.accuracyValue !== "50%" ||
    populatedHome.scoreTargetValue !== "550" ||
    populatedHome.weeklyTargetValue !== "2/5"
  ) {
    throw new Error(`${label}: Home dashboard does not reflect stored progress correctly.`);
  }
  if (home.navLabels !== "Beranda,Jelajahi,Koleksi Belajar,Ruang Uji,Perkembangan" || home.segmentedControls !== 3) {
    throw new Error(`${label}: purpose-based top navigation is incomplete.`);
  }
  if (session.primitiveButtons < 4 || session.buttonIcons < 4) {
    throw new Error(`${label}: shared command controls are missing in Listening.`);
  }
  if (home.activeNav !== "home" || session.activeNav !== null || session.navItems !== 0) {
    throw new Error(`${label}: navigation must be hidden while a session is active.`);
  }
  if (home.overflowX || session.overflowX) {
    throw new Error(`${label}: horizontal page overflow detected.`);
  }
  if (label === "desktop" && (home.navigationPosition !== "relative" || home.navigationWidth !== width)) {
    throw new Error("desktop: top navigation dimensions or static scroll behavior are incorrect.");
  }
  if (!navigationScroll.leavesViewport) {
    throw new Error(`${label}: top navigation must stay at the top of the document instead of following page scroll.`);
  }
  if (
    label === "compact-desktop" &&
    (!home.homeDesktopComposition.heroCentered ||
      home.homeDesktopComposition.summaryRows !== 1 ||
      !home.homeDesktopComposition.targetSingleRow)
  ) {
    throw new Error(`compact desktop: Home composition regressed. Received: ${JSON.stringify(home.homeDesktopComposition)}`);
  }
  if (label === "mobile" && home.navigationWidth !== width) {
    throw new Error("mobile: top navigation must fit the viewport.");
  }

  return { dashboardLaunch, destinationActions, focusedRecommendation, heroExplore, home, navigationScroll, populatedHome, purposeNavigation, resultReveal, session };
}

async function testHeroExplore(cdp) {
  await evaluate(cdp, "document.querySelector('.personalLearningHeroActions .uiButton:first-child')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"explore\"]");
  const state = await evaluate(
    cdp,
    `({
      active: document.querySelector('.appNavItem[aria-current="page"]')?.getAttribute('data-nav-id') ?? null,
      screen: document.querySelector('.dashboardViewport')?.getAttribute('data-screen') ?? null,
      sessions: document.querySelectorAll('.sessionDashboardShell').length
    })`,
  );
  if (state.active !== "explore" || state.screen !== "explore" || state.sessions !== 0) {
    throw new Error(`Home hero explore action must navigate to Jelajahi without launching practice. Received: ${JSON.stringify(state)}`);
  }
  await evaluate(cdp, "document.querySelector('[data-nav-id=\"home\"]')?.click()");
  await waitForSelector(cdp, ".homeDashboardV2");
  return state;
}

async function inspectNavigationScroll(cdp) {
  const before = await evaluate(
    cdp,
    `(() => {
      scrollTo({ top: 0, behavior: 'instant' });
      const navigation = document.querySelector('.appTopNavigation');
      return navigation ? Math.round(navigation.getBoundingClientRect().top) : null;
    })()`,
  );
  await evaluate(cdp, "scrollTo({ top: 520, behavior: 'instant' })");
  await delay(120);
  const after = await evaluate(
    cdp,
    `(() => {
      const navigation = document.querySelector('.appTopNavigation');
      return navigation ? Math.round(navigation.getBoundingClientRect().bottom) : null;
    })()`,
  );
  await evaluate(cdp, "scrollTo({ top: 0, behavior: 'instant' })");
  return { afterBottom: after, beforeTop: before, leavesViewport: before === 0 && after !== null && after < 0 };
}

async function resetDashboardProgress(cdp, appUrl) {
  await evaluate(
    cdp,
    `
      localStorage.removeItem('toefl-itp-ibnu-progress-v1');
      localStorage.removeItem('toefl-itp-ibnu-progress-v2');
      localStorage.removeItem('toefl-itp-ibnu-progress-v3');
    `,
  );
  await cdp.send("Page.navigate", { url: appUrl });
}

async function testPurposeNavigation(cdp, runDirectory, label) {
  const destinations = [
    { heroActionButtons: 2, id: "explore", marker: ".destinationSubjectGrid", minimumMarkerCount: 1 },
    { heroActionButtons: 1, id: "collection", marker: ".reviewQueueCard", minimumMarkerCount: 2 },
    { heroActionButtons: 2, id: "test-space", marker: ".simulationModeCard", minimumMarkerCount: 1 },
    { heroActionButtons: 0, id: "progress", marker: ".progressIllustrationPanel", minimumMarkerCount: 1 },
  ];
  const results = [];
  for (const destination of destinations) {
    await evaluate(cdp, `document.querySelector('[data-nav-id="${destination.id}"]')?.click()`);
    await waitForSelector(cdp, `.dashboardViewport[data-screen="${destination.id}"]`);
    const state = await evaluate(
      cdp,
      `(() => {
        return {
          active: document.querySelector('.appNavItem[aria-current="page"]')?.getAttribute('data-nav-id') ?? null,
          destinationPages: document.querySelectorAll('.destinationPage').length,
          heroes: document.querySelectorAll('.destinationPageHero').length,
          heroActionButtons: document.querySelectorAll('.destinationPageHeroCopy > div .arcane-btn').length,
          markerCount: document.querySelectorAll(${JSON.stringify(destination.marker)}).length,
          overflowX: document.documentElement.scrollWidth > innerWidth + 2,
          screen: document.querySelector('.dashboardViewport')?.getAttribute('data-screen') ?? null
        };
      })()`,
    );
    if (
      state.active !== destination.id ||
      state.screen !== destination.id ||
      state.destinationPages !== 1 ||
      state.heroes !== 1 ||
      state.heroActionButtons !== destination.heroActionButtons ||
      state.markerCount < destination.minimumMarkerCount ||
      state.overflowX
    ) {
      throw new Error(`${label}: destination ${destination.id} is incomplete. Received: ${JSON.stringify(state)}`);
    }
    await capture(cdp, path.join(runDirectory, `${label}-${destination.id}.png`));
    const literalCards = destination.id === "explore" || destination.id === "collection" || destination.id === "test-space"
      ? await inspectLiteralCards(cdp, runDirectory, label, destination.id)
      : undefined;
    const customBuilder = destination.id === "test-space"
      ? await inspectCustomBuilder(cdp, runDirectory, label)
      : undefined;
    results.push({ destination: destination.id, ...state, customBuilder, literalCards });
  }
  await evaluate(cdp, "document.querySelector('[data-nav-id=\"home\"]')?.click()");
  await waitForSelector(cdp, ".homeDashboardV2");
  return results;
}

async function inspectLiteralCards(cdp, runDirectory, label, destination) {
  const configs = {
    collection: {
      anchor: "#antrian-review",
      cardSelector: ".arcane-review-queue-card",
      expectedCards: 2,
      footerSelector: ".arcane-review-footer",
      subtitleSelector: ".arcane-review-subtitle",
      topSelector: ".arcane-review-top",
    },
    explore: {
      anchor: "#katalog-latihan",
      cardSelector: ".destinationSubjectGrid .arcane-discipline-card",
      expectedCards: 3,
      footerSelector: ".arcane-discipline-footer",
      subtitleSelector: ".arcane-discipline-subtitle",
      topSelector: ".arcane-discipline-top",
    },
    "test-space": {
      anchor: "#mode-simulasi",
      cardSelector: ".arcane-trial-mode-card",
      expectedCards: 1,
      footerSelector: ".arcane-trial-mode-footer",
      subtitleSelector: ".arcane-trial-mode-subtitle",
      topSelector: ".arcane-trial-mode-top",
    },
  };
  const config = configs[destination];
  await evaluate(
    cdp,
    `document.querySelector(${JSON.stringify(config.anchor)})?.scrollIntoView({ block: 'start', behavior: 'instant' })`,
  );
  await delay(180);
  const state = await evaluate(
    cdp,
    `(() => {
      const cards = [...document.querySelectorAll(${JSON.stringify(config.cardSelector)})];
      return {
        cardCount: cards.length,
        cardsFit: cards.every((card) => {
          const bounds = card.getBoundingClientRect();
          return bounds.left >= -2 && bounds.right <= innerWidth + 2;
        }),
        footerCount: document.querySelectorAll(${JSON.stringify(config.footerSelector)}).length,
        overflowX: document.documentElement.scrollWidth > innerWidth + 2,
        subtitleCount: document.querySelectorAll(${JSON.stringify(config.subtitleSelector)}).length,
        topCount: document.querySelectorAll(${JSON.stringify(config.topSelector)}).length
      };
    })()`,
  );
  if (
    state.cardCount !== config.expectedCards ||
    state.footerCount !== config.expectedCards ||
    state.subtitleCount !== config.expectedCards ||
    state.topCount !== config.expectedCards ||
    !state.cardsFit ||
    state.overflowX
  ) {
    throw new Error(`${label}: literal cards for ${destination} are incomplete. Received: ${JSON.stringify(state)}`);
  }
  await capture(cdp, path.join(runDirectory, `${label}-${destination}-literal-cards.png`));
  return state;
}

async function inspectCustomBuilder(cdp, runDirectory, label) {
  await evaluate(
    cdp,
    `document.querySelector('.customSimulationPanel')?.scrollIntoView({ block: 'start', behavior: 'instant' })`,
  );
  await delay(250);
  const state = await evaluate(
    cdp,
    `(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        return {
          bottom: Math.round(bounds.bottom),
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          top: Math.round(bounds.top),
          width: Math.round(bounds.width)
        };
      };
      const panel = rect('.arcane-builder-panel');
      const summary = rect('.arcane-builder-summary');
      return {
        builderPanels: document.querySelectorAll('.arcane-builder-panel').length,
        builderSeals: document.querySelectorAll('.arcane-builder-seal').length,
        builderSummaries: document.querySelectorAll('.arcane-builder-summary').length,
        overflowX: document.documentElement.scrollWidth > innerWidth + 2,
        panel,
        panelFits: Boolean(panel && panel.left >= -2 && panel.right <= innerWidth + 2),
        sectionChoices: document.querySelectorAll('.arcane-section-choice').length,
        sectionChoiceCopies: document.querySelectorAll('.arcane-section-choice-copy').length,
        steppers: document.querySelectorAll('.arcane-stepper').length,
        submitButtons: document.querySelectorAll('.arcane-builder-actions button[type="submit"]').length,
        summary,
        summaryFits: Boolean(summary && summary.left >= -2 && summary.right <= innerWidth + 2),
        summaryRows: document.querySelectorAll('.arcane-summary-row').length,
        width: innerWidth
      };
    })()`,
  );
  const sideBySide = Boolean(state.panel && state.summary && Math.abs(state.panel.top - state.summary.top) <= 4);
  const stacked = Boolean(state.panel && state.summary && state.summary.top > state.panel.bottom);
  if (
    state.builderPanels !== 1 ||
    state.builderSeals !== 1 ||
    state.builderSummaries !== 1 ||
    state.sectionChoices !== 4 ||
    state.sectionChoiceCopies !== 4 ||
    state.steppers !== 3 ||
    state.submitButtons !== 1 ||
    state.summaryRows !== 4 ||
    !state.panelFits ||
    !state.summaryFits ||
    state.overflowX
  ) {
    throw new Error(`${label}: Custom Trial Builder is incomplete. Received: ${JSON.stringify(state)}`);
  }
  if (label === "desktop" && !sideBySide) {
    throw new Error(`desktop: Custom Trial Builder must keep its panel and summary side by side. Received: ${JSON.stringify(state)}`);
  }
  if (label === "mobile" && !stacked) {
    throw new Error(`mobile: Custom Trial Builder must stack its panel and summary. Received: ${JSON.stringify(state)}`);
  }
  await capture(cdp, path.join(runDirectory, `${label}-custom-trial-builder.png`));
  await evaluate(
    cdp,
    `document.querySelector('.arcane-builder-summary')?.scrollIntoView({ block: 'center', behavior: 'instant' })`,
  );
  await delay(150);
  await capture(cdp, path.join(runDirectory, `${label}-custom-trial-summary.png`));
  return { ...state, sideBySide, stacked };
}

async function testDestinationActions(cdp) {
  await evaluate(cdp, "document.querySelector('[data-nav-id=\"collection\"]')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"collection\"]");
  await evaluate(cdp, "document.querySelector('.reviewQueueCard--wrong .uiButton')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"session\"]");
  const review = await evaluate(
    cdp,
    `({
      mode: document.querySelector('.sessionDashboardShell')?.getAttribute('data-session-mode') ?? null,
      questionButtons: document.querySelectorAll('.mapButton').length,
      title: document.querySelector('.dashboardTitle h1')?.textContent?.trim() ?? null
    })`,
  );
  if (review.mode !== "learning" || review.questionButtons < 1 || review.title !== "Review Jawaban Salah") {
    throw new Error(`Collection review queue did not launch correctly. Received: ${JSON.stringify(review)}`);
  }
  await exitActiveSession(cdp);
  await waitForSelector(cdp, ".homeDashboardV2");

  await evaluate(cdp, "document.querySelector('[data-nav-id=\"test-space\"]')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"test-space\"]");
  await evaluate(cdp, "document.querySelector('[data-simulation-mode=\"full\"]')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"session\"]");
  const fullSimulation = await evaluate(
    cdp,
    `({
      mode: document.querySelector('.sessionDashboardShell')?.getAttribute('data-session-mode') ?? null,
      questionButtons: document.querySelectorAll('.mapButton').length,
      title: document.querySelector('.dashboardTitle h1')?.textContent?.trim() ?? null
    })`,
  );
  if (
    fullSimulation.mode !== "simulation" ||
    fullSimulation.questionButtons !== 140 ||
    fullSimulation.title !== "Simulasi Lengkap"
  ) {
    throw new Error(`Complete simulation did not launch correctly. Received: ${JSON.stringify(fullSimulation)}`);
  }
  await exitActiveSession(cdp);
  await waitForSelector(cdp, ".homeDashboardV2");

  await evaluate(cdp, "document.querySelector('[data-nav-id=\"test-space\"]')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"test-space\"]");
  await evaluate(cdp, "document.querySelector('.customSimulationPanel form')?.requestSubmit()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"session\"]");
  const customSimulation = await evaluate(
    cdp,
    `({
      mode: document.querySelector('.sessionDashboardShell')?.getAttribute('data-session-mode') ?? null,
      questionButtons: document.querySelectorAll('.mapButton').length,
      title: document.querySelector('.dashboardTitle h1')?.textContent?.trim() ?? null
    })`,
  );
  if (
    customSimulation.mode !== "simulation" ||
    customSimulation.questionButtons !== 90 ||
    customSimulation.title !== "Simulasi Kustom"
  ) {
    throw new Error(`Custom simulation did not launch correctly. Received: ${JSON.stringify(customSimulation)}`);
  }
  await exitActiveSession(cdp);
  await waitForSelector(cdp, ".homeDashboardV2");
  return { customSimulation, fullSimulation, review };
}

async function testFocusedRecommendation(cdp) {
  const recommendation = await evaluate(
    cdp,
    `(() => {
      const item = document.querySelector('.dashboardRecommendationItem');
      return {
        category: item?.getAttribute('data-focus-category') ?? null,
        key: item?.getAttribute('data-focus-key') ?? null,
        shownCount: Number(item?.querySelector('.recommendationMeta strong')?.textContent?.match(/\\d+/)?.[0] ?? 0)
      };
    })()`,
  );
  await evaluate(cdp, "document.querySelector('.dashboardRecommendationItem')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"session\"]");
  const session = await evaluate(
    cdp,
    `({
      mode: document.querySelector('.sessionDashboardShell')?.getAttribute('data-session-mode') ?? null,
      questionButtons: document.querySelectorAll('.mapButton').length,
      title: document.querySelector('.dashboardTitle h1')?.textContent?.trim() ?? null
    })`,
  );
  if (
    !recommendation.category ||
    !recommendation.key ||
    session.mode !== "learning" ||
    !session.title?.startsWith("Latihan Fokus:") ||
    session.questionButtons !== recommendation.shownCount ||
    session.questionButtons >= 50
  ) {
    throw new Error(`Focused recommendation did not launch a real focused session. Received: ${JSON.stringify({ recommendation, session })}`);
  }
  await exitActiveSession(cdp);
  await waitForSelector(cdp, ".homeDashboardV2");
  await evaluate(cdp, "document.querySelector('.personalSessionReset')?.click()");
  await delay(200);
  return { ...recommendation, ...session };
}

async function collectMetrics(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const navigation = document.querySelector('.appNavigation');
      const topNavigation = document.querySelector('.appTopNavigation');
      const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
      const heroCopy = rect('.personalLearningHeroCopy');
      const targetChildren = [
        rect('.dashboardScoreTargetIntro'),
        rect('.dashboardScoreTargetStats'),
        rect('.dashboardScoreTargetForm')
      ].filter(Boolean);
      const targetTops = targetChildren.map((item) => Math.round(item.top));
      const summaryTops = [...document.querySelectorAll('.dashboardSummaryCard')]
        .map((item) => Math.round(item.getBoundingClientRect().top));
      return ({
      buttonIcons: document.querySelectorAll('.uiButton .uiIcon').length,
      height: innerHeight,
      homeDesktopComposition: {
        heroCentered: Boolean(heroCopy && Math.abs((heroCopy.left + heroCopy.right) / 2 - innerWidth / 2) <= 16),
        summaryRows: new Set(summaryTops).size,
        targetSingleRow: targetTops.length === 3 && Math.max(...targetTops) - Math.min(...targetTops) <= 40
      },
      navIcons: document.querySelectorAll('.appNavigation .uiIcon').length,
      activeNav: document.querySelector('.appNavItem[aria-current=\"page\"]')?.getAttribute('data-nav-id') ?? null,
      activeQuestionValue: document.querySelector('[data-summary-id="active-questions"] .dashboardSummaryCopy strong')?.textContent?.trim() ?? null,
      accuracyValue: document.querySelector('[data-summary-id="accuracy"] .dashboardSummaryCopy strong')?.textContent?.trim() ?? null,
      focusItems: document.querySelectorAll('.dashboardFocusList button').length,
      historyItems: document.querySelectorAll('.dashboardHistoryItem').length,
      historyDiagnosticRows: document.querySelectorAll('.dashboardHistoryItem[open] .dashboardHistoryDetails > div').length,
      collectionPanels: document.querySelectorAll('.homeCollectionGrid > .homeDashboardPanel').length,
      learningZones: document.querySelectorAll('.homeLearningZone').length,
      navItems: document.querySelectorAll('.appNavItem').length,
      navLabels: Array.from(document.querySelectorAll('.appNavLabel--desktop')).map((item) => item.textContent?.trim()).join(','),
      overflowX: document.documentElement.scrollWidth > innerWidth + 2,
      primitiveButtons: document.querySelectorAll('.uiButton').length,
      personalHeroes: document.querySelectorAll('.personalLearningHero').length,
      progressIllustrations: document.querySelectorAll('.progressIllustration').length,
      progressStage: document.querySelector('.progressIllustration')?.getAttribute('data-progress-stage') ?? null,
      progressSignals: document.querySelectorAll('.progressSignal').length,
      recommendationItems: document.querySelectorAll('.dashboardRecommendationItem').length,
      segmentedControls: document.querySelectorAll('.uiSegmented').length,
      scoreTargetCards: document.querySelectorAll('.dashboardScoreTarget').length,
      scoreTargetValue: document.querySelector('.dashboardScoreTargetStats > div:first-child strong')?.textContent?.trim() ?? null,
      subjectCards: document.querySelectorAll('.dashboardSubjectCard').length,
      testSpaceCards: document.querySelectorAll('.dashboardTestSpaceCard').length,
      summaryCards: document.querySelectorAll('.dashboardSummaryCard').length,
      weeklyTargetValue: document.querySelector('[data-summary-id="weekly-target"] .dashboardSummaryCopy strong')?.textContent?.trim() ?? null,
      surfaces: document.querySelectorAll('.uiSurface').length,
      navigationPosition: topNavigation ? getComputedStyle(topNavigation).position : null,
      navigationWidth: Math.round(topNavigation?.getBoundingClientRect().width ?? 0),
      width: innerWidth
      });
    })()`,
  );
}

async function seedDashboardProgress(cdp, appUrl) {
  await evaluate(
    cdp,
    `(() => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);
      const sectionDiagnostic = {
        key: 'structure',
        label: 'Structure',
        category: 'section',
        totalQuestions: 40,
        attempted: 40,
        correct: 20,
        incorrect: 20,
        unanswered: 0,
        doubtful: 2,
        accuracy: 50,
        completionRate: 100
      };
      const diagnosticSnapshot = {
        version: 'session-diagnostic-v1',
        generatedAt: now.toISOString(),
        response: { totalQuestions: 40, attempted: 40, correct: 20, incorrect: 20, unanswered: 0, doubtful: 2, accuracy: 50, completionRate: 100 },
        pace: { durationSeconds: 1500, averageSecondsPerAttempt: 38 },
        outcomes: { wrongQuestionIds: ['LS1', 'GNRQ1'], doubtfulQuestionIds: ['LS2'], unansweredQuestionIds: [] },
        bySection: [sectionDiagnostic],
        byGrammarPattern: [],
        byReadingSkill: [],
        byListeningSkill: [],
        weakestAreas: [sectionDiagnostic],
        strongestAreas: [sectionDiagnostic]
      };
      const scoreEstimate = {
        conversionVersion: 'practice-linear-level1-v1',
        method: 'internal-linear-practice-estimate',
        label: 'Estimasi Skor Simulasi TOEFL ITP',
        totalEstimate: 510,
        rawTotalCorrect: 70,
        rawTotalQuestions: 140,
        calculatedAt: now.toISOString(),
        sections: {
          listening: { rawCorrect: 25, rawQuestionCount: 50, scaledEstimate: 50 },
          structureWritten: { rawCorrect: 20, rawQuestionCount: 40, scaledEstimate: 50 },
          reading: { rawCorrect: 25, rawQuestionCount: 50, scaledEstimate: 53 }
        }
      };
      localStorage.removeItem('toefl-itp-ibnu-progress-v1');
      localStorage.removeItem('toefl-itp-ibnu-progress-v3');
      localStorage.setItem('toefl-itp-ibnu-progress-v2', JSON.stringify({
        seenQuestionIds: ['LS1', 'LS2', 'GNRQ1'],
        scoreTarget: 550,
        attemptsByQuestion: {
          LS1: { attempts: 5, correct: 2, doubtful: 1, lastAnsweredAt: now.toISOString() },
          LS2: { attempts: 4, correct: 3, doubtful: 0, lastAnsweredAt: now.toISOString() },
          GNRQ1: { attempts: 3, correct: 1, doubtful: 0, lastAnsweredAt: now.toISOString() }
        },
        history: [
          { id: 'qa-session-1', title: 'Simulasi Lengkap', sessionKind: 'simulation-full', finishedAt: now.toISOString(), totalQuestions: 140, attempted: 140, correct: 70, accuracy: 50, durationSeconds: 6900, diagnosticSnapshot, scoreEstimate, scoreTargetAtCompletion: 550 },
          { id: 'qa-session-2', title: 'Simulasi Reading', sessionKind: 'simulation-reading', finishedAt: yesterday.toISOString(), totalQuestions: 50, attempted: 50, correct: 25, accuracy: 50, durationSeconds: 2400 }
        ]
      }));
    })()`,
  );
  await cdp.send("Page.navigate", { url: appUrl });
  await waitForSelector(cdp, ".homeDashboardV2");
}

async function testDashboardLaunch(cdp) {
  await evaluate(cdp, "document.querySelector('[data-subject-id=\"structure-written\"]')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"session\"]");
  const state = await evaluate(
    cdp,
    `({
      bodyText: document.body.innerText.slice(0, 240),
      screen: document.querySelector('.dashboardViewport')?.getAttribute('data-screen') ?? null,
      sidebarHidden: !document.querySelector('.appTopNavigation'),
      title: document.querySelector('.dashboardTitle h1')?.textContent ?? ''
    })`,
  );
  if (state.title !== "Mode Belajar: Structure & Written") {
    throw new Error(`Home Structure & Written card must open the combined learning scope. Received: ${JSON.stringify(state)}`);
  }
  if (!state.sidebarHidden) throw new Error("The main sidebar must be hidden during a learning session.");
  await evaluate(cdp, "document.querySelector('.sessionCommandBar .uiButton:last-child')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"result\"]");
  const result = await evaluate(
    cdp,
    `({
      diagnosticPanels: document.querySelectorAll('.diagnosticPanel').length,
      metricCards: document.querySelectorAll('.resultMetricGrid .metric').length,
      priorityVisible: Array.from(document.querySelectorAll('.diagnosticPanel h2')).some((item) => item.textContent === 'Area Prioritas')
    })`,
  );
  if (result.diagnosticPanels < 2 || result.metricCards !== 7 || !result.priorityVisible) {
    throw new Error(`Enriched result diagnostics are incomplete. Received: ${JSON.stringify(result)}`);
  }
  await evaluate(cdp, "document.querySelector('.resultCommandBar .uiButton:last-child')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"progress\"]");
  await evaluate(cdp, "document.querySelector('[data-nav-id=\"home\"]')?.click()");
  await waitForSelector(cdp, ".homeDashboardV2");
  return { ...state, result };
}

async function testScoreReveal(cdp, runDirectory, label) {
  await evaluate(cdp, "document.querySelector('[data-subject-id=\"simulation\"]')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"session\"]");
  await evaluate(cdp, "document.querySelector('.sessionCommandBar .uiButton:last-child')?.click()");
  await waitForSelector(cdp, ".scoreRevealModal");
  await capture(cdp, path.join(runDirectory, `${label}-result-reveal.png`));

  const state = await evaluate(
    cdp,
    `(() => {
      const backdrop = document.querySelector('.scoreRevealBackdrop');
      return {
        actionButtons: document.querySelectorAll('.scoreRevealActions .uiButton').length,
        estimate: document.querySelector('.scoreRevealCopy > strong')?.textContent?.trim() ?? null,
        isFar: document.querySelector('.scoreRevealModal')?.classList.contains('scoreRevealModal--far') ?? false,
        modal: document.querySelector('.scoreRevealModal')?.getAttribute('aria-modal') ?? null,
        backdropFilter: backdrop ? getComputedStyle(backdrop).backdropFilter : null
      };
    })()`,
  );
  if (state.modal !== "true" || state.estimate !== "310" || !state.isFar || state.actionButtons < 2 || state.backdropFilter === "none") {
    throw new Error(`Result reveal modal is incomplete. Received: ${JSON.stringify(state)}`);
  }

  await evaluate(cdp, "document.querySelector('.scoreRevealActions .uiButton:first-child')?.click()");
  await waitForSelectorGone(cdp, ".scoreRevealModal");
  await evaluate(cdp, "document.querySelector('.resultCommandBar .uiButton:last-child')?.click()");
  await waitForSelector(cdp, ".dashboardViewport[data-screen=\"progress\"]");
  await evaluate(cdp, "document.querySelector('[data-nav-id=\"home\"]')?.click()");
  await waitForSelector(cdp, ".homeDashboardV2");
  return state;
}

async function exitActiveSession(cdp) {
  await evaluate(cdp, "document.querySelector('.sessionCommandBar .uiButton')?.click()");
  await delay(200);
  await evaluate(cdp, "document.querySelector('.exitSessionActions .uiButton:last-child')?.click()");
  await delay(650);
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
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

async function waitForSelector(cdp, selector, timeoutMilliseconds = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (await evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await delay(100);
  }
  const recentEvents = cdp.events
    .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Runtime.consoleAPICalled" || event.method === "Log.entryAdded")
    .slice(-8);
  throw new Error(`Timed out waiting for selector: ${selector}. Events: ${JSON.stringify(recentEvents)}`);
}

async function waitForSelectorGone(cdp, selector, timeoutMilliseconds = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (!(await evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`))) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for selector to disappear: ${selector}`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class CdpSession {
  constructor(socket) {
    this.events = [];
    this.nextId = 1;
    this.pending = new Map();
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
