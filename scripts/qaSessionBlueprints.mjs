import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function main() {
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:5173";
  const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const runDirectory = path.join(os.tmpdir(), `toefl-session-blueprints-qa-${Date.now()}`);
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
    await cdp.send("Emulation.setDeviceMetricsOverride", { deviceScaleFactor: 1, height: 900, mobile: false, width: 1440 });

    await openApp(cdp, appUrl);
    const home = await collectHome(cdp);
    assert(
      home.navLabels === "Beranda,Jelajahi,Koleksi Belajar,Ruang Uji,Perkembangan",
      `Purpose-based top navigation is incomplete. Found: ${home.navLabels}`,
    );
    assert(home.packageControls === 3, "Listening, Structure & Written, and Reading must expose package selectors.");

    await click(cdp, '[data-subject-id="reading"]');
    await delay(700);
    const readingViaSidebar = await collectActiveSession(cdp);
    assert(readingViaSidebar.layout === "reading" && readingViaSidebar.questionButtons === 50, "Reading sidebar launch must open Reading 50.");
    await exitActiveSession(cdp);

    const firstListening = await startListening25(cdp);
    assert(JSON.stringify(firstListening.partCounts) === JSON.stringify({ A: 16, B: 4, C: 5 }), "Listening 25 must be 16 + 4 + 5.");
    assert(firstListening.totalButtons === 25, "Listening 25 must contain exactly 25 question buttons.");
    assert(firstListening.partBRange === "Audio untuk Soal 17-20", "Listening 25 Part B range must be 17-20.");
    assert(firstListening.partCRange === "Audio untuk Soal 21-25", "Listening 25 Part C range must be 21-25.");

    await exitActiveSession(cdp);
    const secondListening = await startListening25(cdp);
    assert(
      firstListening.partAOrder.join(",") !== secondListening.partAOrder.join(","),
      "Listening Part A selection/order must remain randomized between sessions.",
    );

    await exitActiveSession(cdp);
    await launchPackage(cdp, "reading", 25, false);
    await delay(500);
    const reading25 = await collectActiveSession(cdp);
    assert(reading25.layout === "reading", "Reading 25 must open with the fixed passage blueprint.");
    assert(reading25.questionButtons === 25, "Reading 25 must contain exactly 25 questions.");
    assert(JSON.stringify(reading25.mapGroupSizes) === JSON.stringify([9, 8, 8]), "Reading 25 must use passage slots 9 + 8 + 8.");
    await exitActiveSession(cdp);

    await launchPackage(cdp, "reading", 50, false);
    await delay(500);
    const reading = await collectActiveSession(cdp);
    assert(reading.layout === "reading", "Reading 50 must open with the fixed passage blueprint.");
    assert(reading.questionButtons === 50, "Reading 50 must contain exactly 50 questions.");
    assert(reading.sidebarHidden, "The main sidebar must be hidden while Reading is active.");
    const readingExit = await requestExit(cdp);
    assert(readingExit.open, "Reading exit must require a confirmation dialog.");
    assert(readingExit.copy.includes("0 dari 50 soal"), "Reading exit dialog must report current progress.");
    await capture(cdp, path.join(runDirectory, "reading-exit-confirmation.png"));
    await click(cdp, ".exitSessionActions .uiButton:first-child");
    await delay(250);
    assert((await collectActiveSession(cdp)).layout === "reading", "Choosing not to exit must keep the Reading session active.");
    await requestExit(cdp);
    await confirmExit(cdp);
    assert((await text(cdp, ".dashboardNotice")).includes("Progres sesi disimpan"), "Confirmed exit must save Reading progress.");
    await click(cdp, '[data-nav-id="test-space"]');
    await delay(400);
    assert(Boolean(await text(cdp, ".arcane-resume-trial")), "A saved session must be offered in Test Space.");
    await click(cdp, ".arcane-resume-trial .uiButton");
    await delay(700);
    const resumedReading = await collectActiveSession(cdp);
    assert(resumedReading.layout === "reading" && resumedReading.questionButtons === 50, "Saved Reading progress must resume correctly.");
    await exitActiveSession(cdp);

    await launchPackage(cdp, "structure-written", 100, false);
    await delay(500);
    const structureWritten100 = await collectActiveSession(cdp);
    assert(structureWritten100.layout === "single", "Structure & Written 100 must open as a single-question session.");
    assert(structureWritten100.questionButtons === 100, "Structure & Written 100 must contain exactly 100 questions.");
    await exitActiveSession(cdp);

    await launchPackage(cdp, "listening", 100, false);
    await delay(500);
    const listening100 = await collectActiveSession(cdp);
    assert(listening100.layout === "listening", "Listening 100 must open as a Listening session.");
    assert(listening100.questionButtons === 100, "Listening 100 must contain exactly 100 question buttons.");
    await exitActiveSession(cdp);

    await click(cdp, '[data-subject-id="simulation"]');
    await delay(900);
    const simulationViaCard = await collectActiveSession(cdp);
    assert(simulationViaCard.mode === "simulation" && simulationViaCard.questionButtons === 140, "Full simulation Home card must open.");
    await exitActiveSession(cdp);

    await click(cdp, '[data-subject-id="simulation"]');
    await delay(900);
    const simulation = await collectActiveSession(cdp);
    assert(simulation.mode === "simulation", "Full simulation must open.");
    assert(simulation.questionButtons === 140, "Full simulation must contain 140 questions.");
    assert(simulation.sidebarHidden, "The main sidebar must be hidden while Simulation is active.");

    await capture(cdp, path.join(runDirectory, "home-blueprints.png"));
    console.log("Session blueprint browser QA OK");
    console.log(JSON.stringify({ firstListening, home, listening100, reading, reading25, readingExit, readingViaSidebar, resumedReading, secondListening, simulation, simulationViaCard, structureWritten100, screenshots: runDirectory }, null, 2));
    await cdp.close();
  } finally {
    chrome.kill();
  }
}

async function startListening25(cdp) {
  await launchPackage(cdp, "listening", 25, false);
  const partCounts = await evaluate(
    cdp,
    `Object.fromEntries(['A','B','C'].map((part) => [part, document.querySelectorAll('[data-listening-part="' + part + '"]').length]))`,
  );
  const partAOrder = await evaluate(
    cdp,
    `Array.from(document.querySelectorAll('[data-listening-part="A"]')).map((item) => item.getAttribute('data-listening-set-id'))`,
  );
  await click(cdp, '[data-listening-part="B"]');
  await delay(200);
  const partBRange = await text(cdp, ".listeningIdentityMeta strong");
  await click(cdp, '[data-listening-part="C"]');
  await delay(200);
  const partCRange = await text(cdp, ".listeningIdentityMeta strong");
  return {
    partAOrder,
    partBRange,
    partCRange,
    partCounts,
    totalButtons: await evaluate(cdp, "document.querySelectorAll('.mapButton').length"),
  };
}

async function collectActiveSession(cdp) {
  return evaluate(
    cdp,
    `({
      layout: document.querySelector('.sessionDashboardShell')?.getAttribute('data-session-layout') ?? null,
      mapGroupSizes: Array.from(document.querySelectorAll('.mapGroup')).map((group) => group.querySelectorAll('.mapButton').length),
      mode: document.querySelector('.sessionDashboardShell')?.getAttribute('data-session-mode') ?? null,
      questionButtons: document.querySelectorAll('.mapButton').length,
      sidebarHidden: !document.querySelector('.appTopNavigation')
    })`,
  );
}

async function requestExit(cdp) {
  await click(cdp, ".sessionCommandBar .uiButton");
  await delay(250);
  return evaluate(
    cdp,
    `({
      copy: document.querySelector('.exitSessionModal')?.textContent?.trim() ?? '',
      open: Boolean(document.querySelector('.exitSessionModal'))
    })`,
  );
}

async function confirmExit(cdp) {
  await click(cdp, ".exitSessionActions .uiButton:last-child");
  await delay(500);
}

async function exitActiveSession(cdp) {
  const dialog = await requestExit(cdp);
  assert(dialog.open, "Leaving a session must require confirmation.");
  await confirmExit(cdp);
}

async function launchPackage(cdp, subject, count, expectNotice = true) {
  await evaluate(
    cdp,
    `Array.from(document.querySelectorAll('[data-subject-card="${subject}"] .uiSegmented__option')).find((item) => item.textContent?.trim() === "${count}")?.click()`,
  );
  await click(cdp, `[data-subject-id="${subject}"]`);
  await delay(700);
  return expectNotice ? text(cdp, ".dashboardNotice") : "";
}

async function collectHome(cdp) {
  return evaluate(
    cdp,
    `({
      navLabels: Array.from(document.querySelectorAll('.appNavLabel--desktop')).map((item) => item.textContent?.trim()).join(','),
      packageControls: document.querySelectorAll('.dashboardSubjectPackages').length
    })`,
  );
}

async function openApp(cdp, appUrl) {
  await cdp.send("Page.navigate", { url: appUrl });
  await waitForSelector(cdp, ".homeDashboardV2");
}

async function click(cdp, selector) {
  await evaluate(cdp, `document.querySelector(${JSON.stringify(selector)})?.click()`);
}

async function text(cdp, selector) {
  return evaluate(cdp, `document.querySelector(${JSON.stringify(selector)})?.textContent?.trim() ?? ''`);
}

async function capture(cdp, filePath) {
  const result = await cdp.send("Page.captureScreenshot", { captureBeyondViewport: false, format: "png" });
  await fs.writeFile(filePath, Buffer.from(result.data, "base64"));
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { awaitPromise: true, expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
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
  throw new Error(`Timed out waiting for selector: ${selector}`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class CdpSession {
  constructor(socket) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = socket;
    const rejectPending = (message) => {
      for (const request of this.pending.values()) request.reject(new Error(message));
      this.pending.clear();
    };
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
    socket.addEventListener("close", () => rejectPending("Chrome DevTools connection closed unexpectedly."));
    socket.addEventListener("error", () => rejectPending("Chrome DevTools connection failed."));
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
