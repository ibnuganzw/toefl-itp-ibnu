import listeningSetsJson from "./imported/listeningSets.json" with { type: "json" };
import { getListeningTranscriptForSet } from "./listeningScripts";
import type { ListeningPart, ListeningSet, ListeningSourceType } from "../types/questionTypes";

export const TOEFL_ITP_LISTENING_QUESTION_COUNT = 50;
export const TOEFL_ITP_LISTENING_TIME_LIMIT_MINUTES = 35;

export const LISTENING_MAIN_AUDIO_PLAY_LIMITS = {
  learning: 3,
  simulation: 2,
} as const;

export const LISTENING_QUESTION_AUDIO_PLAY_LIMITS = {
  learning: 3,
  simulation: 1,
} as const;

export const LISTENING_MAIN_AUDIO_AUTOPLAY_DELAY_MS = 1500;
export const LISTENING_QUESTION_AUDIO_AUTOPLAY_DELAY_MS = 600;

export const LISTENING_PLAY_LIMITS = LISTENING_MAIN_AUDIO_PLAY_LIMITS;

export const LISTENING_PART_LABELS: Record<ListeningPart, string> = {
  A: "Part A",
  B: "Part B",
  C: "Part C",
};

export const LISTENING_SOURCE_TYPE_LABELS: Record<ListeningSourceType, string> = {
  "short-conversation": "Short Conversation",
  "longer-conversation": "Longer Conversation",
  "short-talk": "Short Talk",
};

export const listeningSets: ListeningSet[] = (listeningSetsJson as ListeningSet[]).map((listeningSet) => ({
  ...listeningSet,
  transcript: listeningSet.transcript ?? getListeningTranscriptForSet(listeningSet.id),
}));
