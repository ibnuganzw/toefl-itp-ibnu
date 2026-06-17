import { useCallback, useEffect, useRef, useState } from "react";
import {
  LISTENING_MAIN_AUDIO_AUTOPLAY_DELAY_MS,
  LISTENING_MAIN_AUDIO_PLAY_LIMITS,
  LISTENING_PART_LABELS,
  LISTENING_SOURCE_TYPE_LABELS,
} from "../../data/listeningBank";
import type { ListeningSet } from "../../types/questionTypes";
import { cleanInlineText } from "../../utils/displayText";
import { formatAudioTime } from "../../utils/listeningPlayback";
import type { RuntimeSession } from "../../utils/sessionEngine";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

type PlayerStatus = "idle" | "playing" | "ended" | "blocked" | "limit" | "paused" | "error";

export function ListeningPanel({
  audioSrc,
  listeningSet,
  mode,
  paused,
  playCount,
  playbackKey,
  questionRangeEnd,
  questionRangeStart,
  onPlaybackEnded,
  onPlaybackStarted,
  onRegisterPlay,
}: {
  audioSrc: string;
  listeningSet: ListeningSet;
  mode: RuntimeSession["mode"];
  paused: boolean;
  playCount: number;
  playbackKey: string;
  questionRangeEnd?: number;
  questionRangeStart?: number;
  onPlaybackEnded: (playbackKey: string) => void;
  onPlaybackStarted: (playbackKey: string) => void;
  onRegisterPlay: (playbackKey: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playCountRef = useRef(playCount);
  const pausedRef = useRef(paused);
  const startPlaybackRef = useRef<(source: "auto" | "manual") => Promise<void>>(async () => undefined);
  const startingRef = useRef(false);
  const wasPlayingBeforePauseRef = useRef(false);
  const needsInitialAutoplayRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("idle");
  const maxPlays = LISTENING_MAIN_AUDIO_PLAY_LIMITS[mode];
  const remainingPlays = Math.max(0, maxPlays - playCount);
  const mainAudioTitle = cleanInlineText(listeningSet.mainAudioTitle ?? listeningSet.title);
  const rangeLabel =
    questionRangeStart && questionRangeEnd && questionRangeEnd > questionRangeStart
      ? `Audio untuk Soal ${questionRangeStart}-${questionRangeEnd}`
      : questionRangeStart
        ? `Audio untuk Soal ${questionRangeStart}`
        : "";
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    playCountRef.current = playCount;
    if (playCount >= maxPlays && audioRef.current?.paused && playerStatus !== "ended") {
      setPlayerStatus("limit");
    }
  }, [maxPlays, playCount, playerStatus]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const startPlayback = useCallback(
    async (source: "auto" | "manual") => {
      const audio = audioRef.current;
      if (!audio || pausedRef.current || startingRef.current) {
        if (pausedRef.current && source === "auto") needsInitialAutoplayRef.current = true;
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
        setCurrentTime(0);
        await audio.play();
        onPlaybackStarted(playbackKey);
        onRegisterPlay(playbackKey);
        setPlayerStatus("playing");
        needsInitialAutoplayRef.current = false;
      } catch (error) {
        const autoplayBlocked = error instanceof DOMException && error.name === "NotAllowedError";
        setPlayerStatus(autoplayBlocked ? "blocked" : "error");
      } finally {
        startingRef.current = false;
      }
    },
    [maxPlays, onPlaybackStarted, onRegisterPlay, playbackKey],
  );

  useEffect(() => {
    startPlaybackRef.current = startPlayback;
  }, [startPlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(0);
    setPlayerStatus(pausedRef.current ? "paused" : "idle");
    wasPlayingBeforePauseRef.current = false;
    needsInitialAutoplayRef.current = pausedRef.current;

    const timer = window.setTimeout(() => {
      void startPlaybackRef.current("auto");
    }, LISTENING_MAIN_AUDIO_AUTOPLAY_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      audio.pause();
    };
  }, [audioSrc, playbackKey]);

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
      return;
    }

    if (needsInitialAutoplayRef.current) {
      needsInitialAutoplayRef.current = false;
      const timer = window.setTimeout(() => {
        void startPlaybackRef.current("auto");
      }, LISTENING_MAIN_AUDIO_AUTOPLAY_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
  }, [paused]);

  const statusText =
    playerStatus === "playing"
      ? "Memutar audio utama"
      : playerStatus === "blocked"
        ? "Autoplay diblokir browser. Klik Putar Audio."
        : playerStatus === "limit"
          ? "Batas putaran sudah habis"
          : playerStatus === "paused"
            ? "Pemutaran dijeda"
            : playerStatus === "error"
              ? "Audio gagal dimuat. Klik Coba Lagi."
              : playerStatus === "ended"
                ? "Audio utama selesai"
                : `Mulai otomatis dalam ${String(LISTENING_MAIN_AUDIO_AUTOPLAY_DELAY_MS / 1000).replace(".", ",")} detik`;

  return (
    <article
      className="listeningPanel sessionListeningLead arcane-echo-panel"
      data-audio-kind="main"
      data-max-plays={maxPlays}
      data-play-count={playCount}
      data-playback-key={playbackKey}
      data-player-status={playerStatus}
    >
      <div className="listeningIdentity">
        <div className="questionHeader">
          <div>
            <p className="eyebrow">Listening {LISTENING_PART_LABELS[listeningSet.part]}</p>
            <h2>{mainAudioTitle}</h2>
          </div>
        </div>
        <p className="listeningContext">
          {LISTENING_SOURCE_TYPE_LABELS[listeningSet.sourceType]}
          {listeningSet.mainAudioContext ? ` - ${cleanInlineText(listeningSet.mainAudioContext)}` : ""}
        </p>
        <div className="listeningIdentityMeta">
          {rangeLabel ? <strong>{rangeLabel}</strong> : null}
        </div>
      </div>

      <div className="listeningPlayback arcane-audio-control">
        <span className={`audioSoundIcon ${playerStatus === "playing" ? "isPlaying" : ""}`} aria-hidden="true">
          <AppIcon name="volume" />
        </span>
        <div className="audioTimeline arcane-audio-body">
          <div className="audioTimelineHeader">
            <strong>{statusText}</strong>
            <span>
              {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
            </span>
          </div>
          <div className="audioTimelineTrack arcane-audio-progress" aria-label={`Progres audio ${Math.round(progress)} persen`}>
            <span style={{ inlineSize: `${progress}%` }} />
          </div>
          <small>Audio tidak dapat digeser selama sesi.</small>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        src={audioSrc}
        onCanPlay={() => {
          if (playerStatus === "error") setPlayerStatus("idle");
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={(event) => {
          setCurrentTime(event.currentTarget.duration || duration);
          onPlaybackEnded(playbackKey);
          setPlayerStatus(playCountRef.current >= maxPlays ? "limit" : "ended");
        }}
        onError={() => setPlayerStatus("error")}
        onPlaying={() => setPlayerStatus("playing")}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      />

      <div className="listeningLeadActions">
        <div className="audioPlayCount" aria-label={`Putaran ${playCount} dari ${maxPlays}`}>
          <strong>
            {playCount}/{maxPlays}
          </strong>
          <span>Putaran</span>
        </div>
        <Button
          icon={playCount > 0 ? "rotate" : "play"}
          variant="secondary"
          disabled={paused || playerStatus === "playing" || remainingPlays <= 0}
          type="button"
          onClick={() => void startPlayback("manual")}
        >
          {playerStatus === "error" ? "Coba Lagi" : playCount > 0 ? "Putar Ulang" : "Putar Audio"}
        </Button>
      </div>
    </article>
  );
}
