import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function main() {
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:5173";
  const chromePath =
    process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const runDirectory = path.join(os.tmpdir(), `toefl-listening-experience-qa-${Date.now()}`);
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

    const audioAudit = await auditListeningAudioMetadata(cdp, appUrl);
    const mobile = await inspectMobile(cdp, appUrl, runDirectory);
    const desktop = await inspectDesktop(cdp, appUrl, runDirectory);
    console.log("Listening experience browser QA OK");
    console.log(JSON.stringify({ audioAudit, desktop, mobile, screenshots: runDirectory }, null, 2));
    await cdp.close();
  } finally {
    chrome.kill();
  }
}

async function auditListeningAudioMetadata(cdp, appUrl) {
  const listeningSets = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "src", "data", "imported", "listeningSets.json"), "utf8"),
  ).filter((set) => set.active);
  const audioUrls = [
    ...new Set(
      listeningSets.flatMap((set) => [
        set.audioUrl || set.audioSrc,
        ...set.questions.filter((question) => question.active).map((question) => question.questionAudioUrl).filter(Boolean),
      ]),
    ),
  ];

  await cdp.send("Page.navigate", { url: appUrl });
  await delay(700);
  const results = await evaluate(
    cdp,
    `(async () => {
      const urls = ${JSON.stringify(audioUrls)};
      const results = [];
      let cursor = 0;
      const inspect = (url) => new Promise((resolve) => {
        const audio = new Audio();
        const finish = (result) => {
          clearTimeout(timeout);
          audio.removeAttribute('src');
          audio.load();
          resolve(result);
        };
        const timeout = setTimeout(() => finish({ url, error: 'metadata timeout' }), 12000);
        audio.preload = 'metadata';
        audio.addEventListener('loadedmetadata', () => finish({ url, duration: audio.duration }), { once: true });
        audio.addEventListener('error', () => finish({ url, error: audio.error?.message || 'audio decode error' }), { once: true });
        audio.src = url;
        audio.load();
      });
      const worker = async () => {
        while (cursor < urls.length) {
          const url = urls[cursor];
          cursor += 1;
          results.push(await inspect(url));
        }
      };
      await Promise.all(Array.from({ length: 12 }, worker));
      return results;
    })()`,
  );
  const failures = results.filter((result) => result.error || !Number.isFinite(result.duration) || result.duration <= 0);
  if (failures.length) {
    throw new Error(`Listening audio metadata/decode audit failed: ${JSON.stringify(failures.slice(0, 10))}`);
  }
  const shortestAudio = [...results]
    .sort((left, right) => left.duration - right.duration)
    .slice(0, 5)
    .map((result) => ({ durationSeconds: result.duration, url: result.url }));
  return {
    checkedAudioUrls: results.length,
    longestDurationSeconds: Math.max(...results.map((result) => result.duration)),
    shortestAudio,
    shortestDurationSeconds: Math.min(...results.map((result) => result.duration)),
  };
}

async function inspectDesktop(cdp, appUrl, runDirectory) {
  await setViewport(cdp, 1366, 768, false);
  await openApp(cdp, appUrl);
  await click(cdp, '[data-subject-id="listening"]');
  await delay(900);

  await openFirstListeningPart(cdp, "A");
  const partA = await collect(cdp);
  assertListeningLayout("learning Part A", partA, { mainMax: "3", questionAudio: false, shared: false });
  const partAPlayback = await assertMainAudioAdvances(cdp, "Listening 3 Part A");
  await capture(cdp, path.join(runDirectory, "desktop-learning-part-a.png"));

  const partBSetId = await openFirstListeningPart(cdp, "B");
  const partB = await collect(cdp);
  assertListeningLayout("learning Part B", partB, { mainMax: "3", questionMax: "3", questionAudio: true, shared: true });
  const partBPlayback = await assertMainAudioAdvances(cdp, "Listening 3 Part B");
  await capture(cdp, path.join(runDirectory, "desktop-learning-part-b.png"));

  await evaluate(cdp, "document.querySelector('[data-audio-kind=\"main\"]').dataset.qaPreserved = 'yes'");
  await evaluate(
    cdp,
    `document.querySelectorAll('[data-listening-set-id="${partBSetId}"]')[1]?.click()`,
  );
  await delay(350);
  const partBNext = await collect(cdp);
  if (partBNext.mainPreserved !== "yes" || partBNext.mainKey !== partB.mainKey || partBNext.questionKey === partB.questionKey) {
    throw new Error("Part B: moving between questions in one packet must preserve the main audio player and change only question audio.");
  }

  await openFirstListeningPart(cdp, "C");
  const partC = await collect(cdp);
  assertListeningLayout("learning Part C", partC, { mainMax: "3", questionMax: "3", questionAudio: true, shared: true });
  const partCPlayback = await assertMainAudioAdvances(cdp, "Listening 3 Part C");
  await capture(cdp, path.join(runDirectory, "desktop-learning-part-c.png"));

  return { partA, partAPlayback, partB, partBNext, partBPlayback, partC, partCPlayback };
}

async function inspectMobile(cdp, appUrl, runDirectory) {
  await setViewport(cdp, 390, 844, true);
  await openApp(cdp, appUrl);
  await click(cdp, '[data-subject-id="listening"]');
  await delay(700);
  await openFirstListeningPart(cdp, "B");
  await evaluate(cdp, "document.querySelector('.choiceButton:last-child')?.scrollIntoView({ block: 'center' })");
  await delay(150);
  const metrics = await collect(cdp);
  if (metrics.pageOverflowX || !metrics.sharedNotice || !metrics.questionAudio || !metrics.questionAudioHidden) {
    throw new Error("Mobile Part B must keep automatic question audio hidden and the shared-audio notice visible without horizontal overflow.");
  }
  if (!metrics.lastChoiceClickable) {
    throw new Error("Mobile Part B: option D is covered and cannot be clicked.");
  }
  await capture(cdp, path.join(runDirectory, "mobile-learning-part-b.png"));
  return metrics;
}

async function openFirstListeningPart(cdp, part) {
  const setId = await evaluate(
    cdp,
    `(
      document.querySelector('[data-listening-part="${part}"][data-listening-set-id^="listening-3-"]') ||
      document.querySelector('[data-listening-part="${part}"]')
    )?.getAttribute('data-listening-set-id') ?? null`,
  );
  if (!setId) throw new Error(`No Part ${part} Listening set is available in the active session.`);
  await click(cdp, `[data-listening-set-id="${setId}"]`);
  await delay(900);
  return setId;
}

async function assertMainAudioAdvances(cdp, label) {
  const before = await evaluate(
    cdp,
    `(() => {
      const audio = document.querySelector('[data-audio-kind="main"] audio');
      return { currentTime: audio?.currentTime ?? 0, paused: audio?.paused ?? true };
    })()`,
  );
  await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression: `document.querySelector('.sessionListeningLead .listeningLeadActions .uiButton')?.click()`,
    returnByValue: true,
    userGesture: true,
  });
  await delay(1300);
  const after = await evaluate(
    cdp,
    `(() => {
      const audio = document.querySelector('[data-audio-kind="main"] audio');
      const panel = document.querySelector('[data-audio-kind="main"]');
      return {
        currentTime: audio?.currentTime ?? 0,
        paused: audio?.paused ?? true,
        playCount: panel?.getAttribute('data-play-count') ?? null,
        status: panel?.getAttribute('data-player-status') ?? null
      };
    })()`,
  );
  if (after.currentTime <= before.currentTime + 0.2 || after.paused || after.status !== "playing") {
    throw new Error(`${label}: main audio did not advance after the play control was activated.`);
  }
  await evaluate(cdp, "document.querySelector('[data-audio-kind=\"main\"] audio')?.pause()");
  return { before, after };
}

function assertListeningLayout(label, metrics, expected) {
  if (metrics.pageOverflowX || metrics.pageOverflowY) throw new Error(`${label}: page overflow detected.`);
  if (metrics.layout !== "listening") throw new Error(`${label}: listening layout marker is missing.`);
  if (metrics.mainMax !== expected.mainMax) throw new Error(`${label}: incorrect main audio play limit.`);
  if (Boolean(metrics.questionAudio) !== expected.questionAudio) throw new Error(`${label}: question audio visibility is incorrect.`);
  if (metrics.questionAudio && !metrics.questionAudioHidden) {
    throw new Error(`${label}: automatic question audio must not occupy visible layout space.`);
  }
  if (Boolean(metrics.sharedNotice) !== expected.shared) throw new Error(`${label}: shared-audio notice visibility is incorrect.`);
  if (expected.questionMax && metrics.questionMax !== expected.questionMax) {
    throw new Error(`${label}: incorrect question audio play limit.`);
  }
  if (!metrics.timeline || metrics.timelineWidth < 120) throw new Error(`${label}: real audio timeline is missing or too narrow.`);
  const questionPanelScrolls = metrics.questionPanelScrollHeight > metrics.questionPanelHeight + 2;
  if (questionPanelScrolls && metrics.questionPanelOverflowY !== "auto") {
    throw new Error(`${label}: an overflowing active question must scroll independently.`);
  }
  if (metrics.choiceActionOverlap) throw new Error(`${label}: doubtful action overlaps the answer choices.`);
  if (!questionPanelScrolls && !metrics.lastChoiceClickable) throw new Error(`${label}: option D is covered and cannot be clicked.`);
}

async function collect(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const main = document.querySelector('[data-audio-kind="main"]');
      const question = document.querySelector('[data-audio-kind="question"]');
      const panel = document.querySelector('.questionPanel');
      const timeline = document.querySelector('.sessionListeningLead .audioTimelineTrack');
      const lastChoice = document.querySelector('.choiceButton:last-child')?.getBoundingClientRect();
      const inlineAction = document.querySelector('.inlineActions')?.getBoundingClientRect();
      return {
        choiceActionOverlap: Boolean(lastChoice && inlineAction && lastChoice.bottom > inlineAction.top),
        lastChoiceClickable: lastChoice
          ? document.elementFromPoint(lastChoice.left + lastChoice.width / 2, lastChoice.top + lastChoice.height / 2)?.closest('.choiceButton') === document.querySelector('.choiceButton:last-child')
          : false,
        layout: document.querySelector('.sessionDashboardShell')?.getAttribute('data-session-layout') ?? null,
        mainKey: main?.getAttribute('data-playback-key') ?? null,
        mainMax: main?.getAttribute('data-max-plays') ?? null,
        mainPreserved: main?.getAttribute('data-qa-preserved') ?? null,
        mode: document.querySelector('.sessionDashboardShell')?.getAttribute('data-session-mode') ?? null,
        pageOverflowX: document.documentElement.scrollWidth > innerWidth + 2,
        pageOverflowY: document.documentElement.scrollHeight > innerHeight + 2,
        questionAudio: Boolean(question),
        questionAudioHidden: question
          ? question.getBoundingClientRect().width <= 1 && question.getBoundingClientRect().height <= 1
          : null,
        questionKey: question?.getAttribute('data-playback-key') ?? null,
        questionMax: question?.getAttribute('data-max-plays') ?? null,
        questionPanelHeight: panel?.clientHeight ?? 0,
        questionPanelOverflowY: panel ? getComputedStyle(panel).overflowY : null,
        questionPanelScrollHeight: panel?.scrollHeight ?? 0,
        sharedNotice: document.querySelector('.listeningSharedNotice')?.textContent?.trim() ?? null,
        timeline: Boolean(timeline),
        timelineWidth: Math.round(timeline?.getBoundingClientRect().width ?? 0)
      };
    })()`,
  );
}

async function openApp(cdp, appUrl) {
  await cdp.send("Page.navigate", { url: appUrl });
  await delay(1200);
}

async function click(cdp, selector) {
  await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)})?.click()`);
}

async function setViewport(cdp, width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { deviceScaleFactor: 1, height, mobile, width });
}

async function capture(cdp, filePath) {
  const result = await cdp.send("Page.captureScreenshot", { captureBeyondViewport: false, format: "png" });
  await fs.writeFile(filePath, Buffer.from(result.data, "base64"));
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { awaitPromise: true, expression, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
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
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
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
