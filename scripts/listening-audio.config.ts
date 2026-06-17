import type { ListeningSpeaker } from "../src/data/listeningScripts.ts";

export type TtsVoice = string | { id: string };

export interface SpeakerVoiceSetting {
  voice: TtsVoice;
}

export interface ListeningAudioGeneratorConfig {
  outputPublicPath: string;
  responseFormat: "mp3";
  speed: number;
  speakers: Record<ListeningSpeaker, SpeakerVoiceSetting>;
}

export const listeningAudioGeneratorConfig: ListeningAudioGeneratorConfig = {
  outputPublicPath: "/audio/listening",
  responseFormat: "mp3",
  speed: 0.95,
  speakers: {
    narrator: {
      voice: "alloy",
    },
    man: {
      voice: "onyx",
    },
    woman: {
      voice: "nova",
    },
    lecturer: {
      voice: "sage",
    },
    speaker: {
      voice: "onyx",
    },
  },
};
