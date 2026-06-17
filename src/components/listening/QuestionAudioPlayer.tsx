import { useCallback, useEffect, useRef, useState } from "react";
import {
  LISTENING_QUESTION_AUDIO_AUTOPLAY_DELAY_MS,
  LISTENING_QUESTION_AUDIO_PLAY_LIMITS,
} from "../../data/listeningBank";
import type { RuntimeSession } from "../../utils/sessionEngine";
import { Button } from "../ui/Button";

type PlayerStatus = "waiting" | "idle" | "playing" | "ended" | "blocked" | "limit" | "paused" | "error";

export function QuestionAudioPlayer({
  audioSrc,
  canAutoplay,
  mode,
  paused,
  playCount,
  playbackKey,
  onRegisterPlay,
}: {
  audioSrc: string;
  canAutoplay: boolean;
  mode: RuntimeSession["mode"];
  paused: boolean;
  playCount: number;
  playbackKey: string;
  onRegisterPlay: (playbackKey: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playCountRef = useRef(playCount);
  const pausedRef = useRef(paused);
  const canAutoplayRef = useRef(canAutoplay);
  const startPlaybackRef = useRef<(source: "auto" | "manual") => Promise<void>>(async () => undefined);
  const startingRef = useRef(false);
  const wasPlayingBeforePauseRef = useRef(false);
  const pendingAutoplayRef = useRef(false);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("waiting");
  const maxPlays = LISTENING_QUESTION_AUDIO_PLAY_LIMITS[mode];

  useEffect(() => {
    playCountRef.current = playCount;
    if (playCount >= maxPlays && audioRef.current?.paused && playerStatus !== "ended") {
      setPlayerStatus("limit");
    }
  }, [maxPlays, playCount, playerStatus]);

  useEffect(() => {
    pausedRef.current = paused;
    canAutoplayRef.current = canAutoplay;
  }, [canAutoplay, paused]);

  const startPlayback = useCallback(
    async (source: "auto" | "manual") => {
      const audio = audioRef.current;
      if (!audio || pausedRef.current || startingRef.current || !canAutoplayRef.current) {
        pendingAutoplayRef.current = true;
        return;
      }

      if (playCountRef.current >= maxPlays) {
        setPlayerStatus("limit");
        return;
      }

      startingRef.current = true;
      try {
        audio.pause();
        audio.currentTime = 0;
        if (source === "manual" && (audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) {
          audio.load();
        }
        await audio.play();
        onRegisterPlay(playbackKey);
        setPlayerStatus("playing");
        pendingAutoplayRef.current = false;
      } catch (error) {
        const autoplayBlocked = error instanceof DOMException && error.name === "NotAllowedError";
        setPlayerStatus(autoplayBlocked ? "blocked" : "error");
      } finally {
        startingRef.current = false;
      }
    },
    [maxPlays, onRegisterPlay, playbackKey],
  );

  useEffect(() => {
    startPlaybackRef.current = startPlayback;
  }, [startPlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.pause();
    audio.currentTime = 0;
    setPlayerStatus(pausedRef.current ? "paused" : canAutoplayRef.current ? "idle" : "waiting");
    wasPlayingBeforePauseRef.current = false;
    pendingAutoplayRef.current = true;

    const timer = window.setTimeout(() => {
      void startPlaybackRef.current("auto");
    }, LISTENING_QUESTION_AUDIO_AUTOPLAY_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      audio.pause();
    };
  }, [audioSrc, playbackKey]);

  useEffect(() => {
    if (!canAutoplay || paused || !pendingAutoplayRef.current) return undefined;
    const timer = window.setTimeout(() => {
      void startPlaybackRef.current("auto");
    }, LISTENING_QUESTION_AUDIO_AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [canAutoplay, paused]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || canAutoplay) return;
    audio.pause();
    audio.currentTime = 0;
    pendingAutoplayRef.current = true;
    setPlayerStatus(paused ? "paused" : "waiting");
  }, [canAutoplay, paused]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (paused) {
      wasPlayingBeforePauseRef.current = !audio.paused;
      audio.pause();
      setPlayerStatus("paused");
      return;
    }

    if (wasPlayingBeforePauseRef.current) {
      wasPlayingBeforePauseRef.current = false;
      void audio
        .play()
        .then(() => setPlayerStatus("playing"))
        .catch(() => setPlayerStatus("blocked"));
    }
  }, [paused]);

  const needsManualPlayback = playerStatus === "blocked" || playerStatus === "error";

  return (
    <>
      <span
        className="questionAudioPlayerHidden"
        aria-hidden="true"
        data-audio-kind="question"
        data-max-plays={maxPlays}
        data-play-count={playCount}
        data-playback-key={playbackKey}
        data-player-status={playerStatus}
      >
        <audio
          ref={audioRef}
          preload="metadata"
          playsInline
          src={audioSrc}
          onEnded={() => setPlayerStatus(playCountRef.current >= maxPlays ? "limit" : "ended")}
          onError={() => setPlayerStatus("error")}
          onPlaying={() => setPlayerStatus("playing")}
        />
      </span>
      {needsManualPlayback ? (
        <div className="questionAudioPanel" role="status">
          <div>
            <strong>{playerStatus === "error" ? "Audio pertanyaan gagal dimuat." : "Autoplay pertanyaan diblokir browser."}</strong>
            <p className="muted">Gunakan tombol ini agar pertanyaan Listening tetap dapat didengar.</p>
          </div>
          <div className="questionAudioActions">
            <span>
              {playCount}/{maxPlays} putaran
            </span>
            <Button
              icon="play"
              variant="secondary"
              disabled={paused || playCount >= maxPlays}
              type="button"
              onClick={() => void startPlayback("manual")}
            >
              {playerStatus === "error" ? "Coba Lagi" : "Putar Pertanyaan"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
