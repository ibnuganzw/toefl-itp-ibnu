import listeningSetsJson from "./imported/listeningSets.json" with { type: "json" };
import type { ListeningSet } from "../types/questionTypes";

export type ListeningSpeaker = "narrator" | "man" | "woman" | "lecturer" | "speaker";
export type ListeningScriptAudioKind = "main" | "question";

export interface ListeningScriptSegment {
  speaker: ListeningSpeaker;
  text: string;
}

export interface ListeningScript {
  id: string;
  audioKind: ListeningScriptAudioKind;
  listeningSetId: string;
  questionIds: string[];
  audioFileName: string;
  audioUrl: string;
  segments: ListeningScriptSegment[];
}

export const LISTENING_AUDIO_PUBLIC_DIR = "/audio/listening";

export const LISTENING_SPEAKER_LABELS: Record<ListeningSpeaker, string> = {
  narrator: "Narrator",
  man: "Man",
  woman: "Woman",
  lecturer: "Lecturer",
  speaker: "Speaker",
};

const importedListeningSets = listeningSetsJson as ListeningSet[];

export const listeningScripts: ListeningScript[] = importedListeningSets.flatMap((listeningSet) => {
  const activeQuestions = listeningSet.questions.filter((question) => question.active);
  const scripts: ListeningScript[] = [];
  const mainAudioUrl = listeningSet.audioUrl ?? listeningSet.audioSrc;
  const mainSegments = parseTranscriptSegments(listeningSet.transcript);

  if (mainAudioUrl && mainSegments.length) {
    scripts.push({
      id: `${listeningSet.id}-main-audio`,
      audioKind: "main",
      listeningSetId: listeningSet.id,
      questionIds: activeQuestions.map((question) => question.id),
      audioFileName: fileNameFromAudioUrl(mainAudioUrl),
      audioUrl: mainAudioUrl,
      segments: mainSegments,
    });
  }

  for (const question of activeQuestions) {
    if (!question.questionAudioUrl) continue;
    scripts.push({
      id: `${question.id}-question-audio`,
      audioKind: "question",
      listeningSetId: listeningSet.id,
      questionIds: [question.id],
      audioFileName: fileNameFromAudioUrl(question.questionAudioUrl),
      audioUrl: question.questionAudioUrl,
      segments: [
        {
          speaker: "narrator",
          text: question.questionText,
        },
      ],
    });
  }

  return scripts;
});

export function getListeningScriptByQuestionId(
  questionId: string,
  audioKind?: ListeningScriptAudioKind,
): ListeningScript | undefined {
  return listeningScripts.find(
    (script) => script.questionIds.includes(questionId) && (!audioKind || script.audioKind === audioKind),
  );
}

export function getListeningScriptBySetId(listeningSetId: string): ListeningScript | undefined {
  return listeningScripts.find((script) => script.listeningSetId === listeningSetId && script.audioKind === "main");
}

export function getListeningAudioUrlForQuestion(questionId: string): string | undefined {
  return getListeningScriptByQuestionId(questionId)?.audioUrl;
}

export function getListeningQuestionAudioUrlForQuestion(questionId: string): string | undefined {
  return getListeningScriptByQuestionId(questionId, "question")?.audioUrl;
}

export function getListeningTranscriptForSet(listeningSetId: string): string | undefined {
  const script = getListeningScriptBySetId(listeningSetId);
  if (!script) return undefined;
  return script.segments
    .map((segment) => `${LISTENING_SPEAKER_LABELS[segment.speaker]}: ${segment.text}`)
    .join("\n\n");
}

function parseTranscriptSegments(transcript: string | undefined): ListeningScriptSegment[] {
  if (!transcript?.trim()) return [];

  const segments: ListeningScriptSegment[] = [];
  const speakerPattern = /(?:^|\n)(Narrator|Man|Woman|Lecturer|Speaker)(?:\s*\([^)]*\))?:\s*/g;
  const matches = [...transcript.matchAll(speakerPattern)];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const textStart = (match.index ?? 0) + match[0].length;
    const textEnd = nextMatch?.index ?? transcript.length;
    const text = transcript.slice(textStart, textEnd).trim();
    if (!text) continue;

    segments.push({
      speaker: normalizeSpeaker(match[1]),
      text,
    });
  }

  return segments;
}

function normalizeSpeaker(label: string): ListeningSpeaker {
  const normalized = label.toLowerCase();
  if (normalized === "man") return "man";
  if (normalized === "woman") return "woman";
  if (normalized === "narrator") return "narrator";
  if (normalized === "speaker") return "speaker";
  return "lecturer";
}

function fileNameFromAudioUrl(audioUrl: string): string {
  const fileName = audioUrl.split("/").filter(Boolean).at(-1);
  if (!fileName) throw new Error(`Invalid Listening audio URL: ${audioUrl}`);
  return fileName;
}
