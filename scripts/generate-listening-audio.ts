import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listeningAudioGeneratorConfig } from "./listening-audio.config.ts";
import {
  LISTENING_AUDIO_PUBLIC_DIR,
  type ListeningScript,
  type ListeningScriptAudioKind,
  type ListeningScriptSegment,
  type ListeningSpeaker,
  listeningScripts,
} from "../src/data/listeningScripts.ts";

interface CliOptions {
  force: boolean;
  onlyQuestionIds: Set<string>;
  validateOnly: boolean;
}

interface ListeningSetMetadata {
  id: string;
  audioSrc?: string;
  audioUrl?: string;
  questions?: Array<{ id: string; active: boolean; questionAudioUrl?: string }>;
}

const OPENAI_SPEECH_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");
const publicRoot = path.join(projectRoot, "public");
const outputDir = publicPathToFilePath(listeningAudioGeneratorConfig.outputPublicPath);

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const targetScripts = selectTargetScripts(options);

  validateGeneratorConfig();
  validateListeningScripts(targetScripts);

  if (options.validateOnly) {
    printValidationSummary(targetScripts);
    return;
  }

  loadEnvFile(path.join(projectRoot, ".env"));
  const model = readRequiredTtsModel();
  const apiKey = readRequiredApiKey();

  await fs.mkdir(outputDir, { recursive: true });
  const scriptsToGenerate = targetScripts.filter((script) => shouldGenerate(script, options.force));

  if (scriptsToGenerate.some((script) => script.segments.length > 1)) {
    const ffmpegAvailable = await commandExists("ffmpeg", ["-version"]);
    if (!ffmpegAvailable) {
      throw new Error(
        "FFmpeg is required to combine multi-speaker Listening segments into one MP3 per Listening set. Install FFmpeg and make sure `ffmpeg` is available on PATH, then rerun `npm run generate:audio`.",
      );
    }
  }

  if (!scriptsToGenerate.length) {
    console.log("All target Listening audio files already exist. Use --force to regenerate them.");
    return;
  }

  for (const script of scriptsToGenerate) {
    await generateScriptAudio({ apiKey, model, script });
  }

  console.log(`Generated ${scriptsToGenerate.length} Listening audio file(s) in ${relativeToRoot(outputDir)}.`);
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    force: false,
    onlyQuestionIds: new Set<string>(),
    validateOnly: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--validate-only") {
      options.validateOnly = true;
      continue;
    }
    if (arg === "--only") {
      const value = args[index + 1];
      if (!value) throw new Error("Missing question ID after --only.");
      options.onlyQuestionIds.add(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--only=")) {
      options.onlyQuestionIds.add(arg.slice("--only=".length));
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function selectTargetScripts(options: CliOptions): ListeningScript[] {
  if (!options.onlyQuestionIds.size) return listeningScripts;

  const targetScripts = listeningScripts.filter((script) =>
    script.questionIds.some((questionId) => options.onlyQuestionIds.has(questionId)),
  );
  const matchedQuestionIds = new Set(targetScripts.flatMap((script) => script.questionIds));
  const missingQuestionIds = [...options.onlyQuestionIds].filter((questionId) => !matchedQuestionIds.has(questionId));

  if (missingQuestionIds.length) {
    throw new Error(`No Listening script metadata found for question ID(s): ${missingQuestionIds.join(", ")}`);
  }

  return targetScripts;
}

function validateGeneratorConfig() {
  if (listeningAudioGeneratorConfig.outputPublicPath !== LISTENING_AUDIO_PUBLIC_DIR) {
    throw new Error(
      `Generator output path ${listeningAudioGeneratorConfig.outputPublicPath} must match Listening metadata path ${LISTENING_AUDIO_PUBLIC_DIR}.`,
    );
  }
  if (listeningAudioGeneratorConfig.responseFormat !== "mp3") {
    throw new Error("Listening audio generator only supports MP3 output.");
  }
  if (!Number.isFinite(listeningAudioGeneratorConfig.speed) || listeningAudioGeneratorConfig.speed <= 0) {
    throw new Error("Listening audio generator speed must be a positive number.");
  }

  const requiredSpeakers: ListeningSpeaker[] = ["narrator", "man", "woman", "lecturer", "speaker"];
  const missingSpeakers = requiredSpeakers.filter((speaker) => !listeningAudioGeneratorConfig.speakers[speaker]?.voice);
  if (missingSpeakers.length) {
    throw new Error(`Listening voice config is missing speaker voice(s): ${missingSpeakers.join(", ")}`);
  }
}

function validateListeningScripts(scripts: ListeningScript[]) {
  if (!scripts.length) {
    throw new Error("No Listening scripts are configured for audio generation.");
  }

  const questionAudioKeys = new Set<string>();
  const duplicateQuestionAudioKeys = new Set<string>();
  const audioFileNames = new Set<string>();
  const duplicateAudioFileNames = new Set<string>();
  const audioKinds: ListeningScriptAudioKind[] = ["main", "question"];

  for (const script of scripts) {
    if (!script.id.trim()) throw new Error("A Listening script is missing an ID.");
    if (!audioKinds.includes(script.audioKind)) {
      throw new Error(`Listening script ${script.id} has invalid audioKind: ${script.audioKind}.`);
    }
    if (!script.listeningSetId.trim()) throw new Error(`Listening script ${script.id} is missing listeningSetId.`);
    if (!script.questionIds.length) throw new Error(`Listening script ${script.id} must link at least one question ID.`);
    if (script.audioKind === "question" && script.questionIds.length !== 1) {
      throw new Error(`Question audio script ${script.id} must link exactly one question ID.`);
    }
    if (!script.audioFileName.endsWith(".mp3")) {
      throw new Error(`Listening script ${script.id} must use an .mp3 audioFileName.`);
    }
    if (script.audioUrl !== `${LISTENING_AUDIO_PUBLIC_DIR}/${script.audioFileName}`) {
      throw new Error(
        `Listening script ${script.id} audioUrl must be ${LISTENING_AUDIO_PUBLIC_DIR}/${script.audioFileName}.`,
      );
    }
    if (!script.segments.length) throw new Error(`Listening script ${script.id} must contain at least one segment.`);

    if (audioFileNames.has(script.audioFileName)) duplicateAudioFileNames.add(script.audioFileName);
    audioFileNames.add(script.audioFileName);

    for (const questionId of script.questionIds) {
      const questionAudioKey = `${script.audioKind}:${questionId}`;
      if (questionAudioKeys.has(questionAudioKey)) duplicateQuestionAudioKeys.add(questionAudioKey);
      questionAudioKeys.add(questionAudioKey);
    }

    script.segments.forEach((segment, index) => {
      if (!listeningAudioGeneratorConfig.speakers[segment.speaker]) {
        throw new Error(`Listening script ${script.id} segment ${index + 1} uses an unknown speaker: ${segment.speaker}`);
      }
      if (!segment.text.trim()) {
        throw new Error(`Listening script ${script.id} segment ${index + 1} has empty text.`);
      }
    });
  }

  if (duplicateQuestionAudioKeys.size) {
    throw new Error(`Duplicate Listening question audio mapping(s): ${[...duplicateQuestionAudioKeys].join(", ")}`);
  }
  if (duplicateAudioFileNames.size) {
    throw new Error(`Duplicate Listening audio file name(s): ${[...duplicateAudioFileNames].join(", ")}`);
  }

  validateScriptsAgainstListeningBank(scripts);
}

function validateScriptsAgainstListeningBank(scripts: ListeningScript[]) {
  const listeningSets = readListeningSetMetadata();
  const setsById = new Map(listeningSets.map((listeningSet) => [listeningSet.id, listeningSet]));

  for (const script of scripts) {
    const listeningSet = setsById.get(script.listeningSetId);
    if (!listeningSet) {
      throw new Error(`Listening script ${script.id} references missing listeningSetId ${script.listeningSetId}.`);
    }

    const activeQuestions = (listeningSet.questions ?? []).filter((question) => question.active);
    const questionsById = new Map(activeQuestions.map((question) => [question.id, question]));
    const questionIds = new Set(activeQuestions.map((question) => question.id));
    const missingQuestionIds = script.questionIds.filter((questionId) => !questionIds.has(questionId));
    if (missingQuestionIds.length) {
      throw new Error(
        `Listening script ${script.id} references question ID(s) not active in ${script.listeningSetId}: ${missingQuestionIds.join(", ")}`,
      );
    }

    if (script.audioKind === "main") {
      if (script.audioUrl !== listeningSet.audioUrl && script.audioUrl !== listeningSet.audioSrc) {
        throw new Error(`Main audio script ${script.id} audioUrl does not match Listening set ${script.listeningSetId}.`);
      }
      continue;
    }

    const questionId = script.questionIds[0];
    const question = questionsById.get(questionId);
    if (script.audioUrl !== question?.questionAudioUrl) {
      throw new Error(`Question audio script ${script.id} audioUrl does not match questionAudioUrl for ${questionId}.`);
    }
  }
}

function readListeningSetMetadata(): ListeningSetMetadata[] {
  return JSON.parse(readFileSync(path.join(projectRoot, "src/data/imported/listeningSets.json"), "utf8"));
}

function printValidationSummary(scripts: ListeningScript[]) {
  console.log(`Listening audio metadata OK: ${scripts.length} script(s).`);
  scripts.forEach((script) => {
    console.log(
      `- ${script.audioKind}: ${script.questionIds.join(", ")} -> ${script.audioUrl} (${script.segments.length} segment(s))`,
    );
  });
}

function loadEnvFile(envPath: string) {
  if (!existsSync(envPath)) return;

  const fileContents = readFileSync(envPath, "utf8");
  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = unquoteEnvValue(line.slice(equalsIndex + 1).trim());
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value: string): string {
  if (value.length >= 2) {
    const first = value.at(0);
    const last = value.at(-1);
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function readRequiredTtsModel(): string {
  const model = process.env.OPENAI_TTS_MODEL?.trim();
  if (!model) {
    throw new Error(
      "OPENAI_TTS_MODEL is required. Add it to .env and set it according to the currently supported OpenAI Text-to-Speech model name in the official OpenAI API documentation. This project intentionally does not hardcode a TTS model name.",
    );
  }
  return model;
}

function readRequiredApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required. Add your OpenAI API key to .env before running the audio generator.");
  }
  return apiKey;
}

function shouldGenerate(script: ListeningScript, force: boolean): boolean {
  return force || !existsSync(outputPathForScript(script));
}

async function generateScriptAudio({
  apiKey,
  model,
  script,
}: {
  apiKey: string;
  model: string;
  script: ListeningScript;
}) {
  const outputPath = outputPathForScript(script);
  assertInsideDirectory(outputPath, outputDir);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  console.log(`Generating ${script.audioKind} ${script.questionIds.join(", ")} -> ${relativeToRoot(outputPath)}`);

  if (script.segments.length === 1) {
    await generateSegmentAudio({ apiKey, model, segment: script.segments[0], outputPath });
    return;
  }

  const tempDir = path.join(outputDir, `.tmp-${safeFileName(script.id)}-${Date.now()}`);
  assertInsideDirectory(tempDir, outputDir);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const segmentPaths: string[] = [];
    for (let index = 0; index < script.segments.length; index += 1) {
      const segment = script.segments[index];
      const segmentPath = path.join(
        tempDir,
        `${String(index + 1).padStart(2, "0")}-${segment.speaker}.mp3`,
      );
      await generateSegmentAudio({ apiKey, model, segment, outputPath: segmentPath });
      segmentPaths.push(segmentPath);
    }

    await concatenateMp3Files(segmentPaths, outputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function generateSegmentAudio({
  apiKey,
  model,
  segment,
  outputPath,
}: {
  apiKey: string;
  model: string;
  segment: ListeningScriptSegment;
  outputPath: string;
}) {
  const speakerSetting = listeningAudioGeneratorConfig.speakers[segment.speaker];
  const response = await fetch(OPENAI_SPEECH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: normalizeTtsInput(segment.text),
      voice: speakerSetting.voice,
      response_format: listeningAudioGeneratorConfig.responseFormat,
      speed: listeningAudioGeneratorConfig.speed,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI TTS request failed for ${segment.speaker} (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  const audioBytes = Buffer.from(await response.arrayBuffer());
  if (!audioBytes.length) {
    throw new Error(`OpenAI TTS returned an empty audio file for ${segment.speaker}.`);
  }

  await fs.writeFile(outputPath, audioBytes);
}

function normalizeTtsInput(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function concatenateMp3Files(segmentPaths: string[], outputPath: string) {
  const listPath = path.join(path.dirname(segmentPaths[0]), "segments.txt");
  const listContents = segmentPaths.map((segmentPath) => `file '${escapeFfmpegConcatPath(segmentPath)}'`).join("\n");
  await fs.writeFile(listPath, `${listContents}\n`, "utf8");

  await runCommand("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
}

function outputPathForScript(script: ListeningScript): string {
  const outputPath = path.join(outputDir, script.audioFileName);
  assertInsideDirectory(outputPath, outputDir);
  return outputPath;
}

function publicPathToFilePath(publicPath: string): string {
  if (!publicPath.startsWith("/")) {
    throw new Error(`Public path must start with "/": ${publicPath}`);
  }
  const relativeParts = publicPath.split("/").filter(Boolean);
  const filePath = path.join(publicRoot, ...relativeParts);
  assertInsideDirectory(filePath, publicRoot);
  return filePath;
}

function assertInsideDirectory(filePath: string, directoryPath: string) {
  const resolvedFile = path.resolve(filePath);
  const resolvedDirectory = path.resolve(directoryPath);
  const relative = path.relative(resolvedDirectory, resolvedFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside ${resolvedDirectory}: ${resolvedFile}`);
  }
}

function escapeFfmpegConcatPath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function relativeToRoot(filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function commandExists(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}: ${stderr.trim()}`));
    });
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
