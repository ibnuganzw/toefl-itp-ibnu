import { useCallback, useEffect, useState } from "react";
import type { AnswerOptionKey } from "../../types/questionTypes";
import { type QuestionRef, type RuntimeSession, formatDuration, sectionLabel } from "../../utils/sessionEngine";
import { isListeningQuestion } from "../../utils/questionGuards";
import { listeningMainAudioKey, listeningQuestionAudioKey } from "../../utils/listeningPlayback";
import { Metric } from "../common/Metric";
import { ListeningPanel } from "../listening/ListeningPanel";
import { QuestionPromptText } from "../questions/QuestionPromptText";
import { ExitSessionModal } from "../session/ExitSessionModal";
import { QuestionRenderer } from "../session/QuestionRenderer";
import { QuestionMap } from "../session/QuestionMap";
import { ShortcutsModal } from "../session/ShortcutsModal";
import { Button } from "../ui/Button";

export function SessionScreen({
  refs,
  session,
  showExitConfirmation,
  showShortcuts,
  onCancelExit,
  onCloseShortcuts,
  onConfirmExit,
  onFinish,
  onGoHome,
  onGoNext,
  onGoPrevious,
  onJump,
  onRegisterListeningPlay,
  onSelectAnswer,
  onShowShortcuts,
  onToggleDoubtful,
  onTogglePause,
}: {
  refs: QuestionRef[];
  session: RuntimeSession;
  showExitConfirmation: boolean;
  showShortcuts: boolean;
  onCancelExit: () => void;
  onCloseShortcuts: () => void;
  onConfirmExit: () => void;
  onFinish: () => void;
  onGoHome: () => void;
  onGoNext: () => void;
  onGoPrevious: () => void;
  onJump: (index: number) => void;
  onRegisterListeningPlay: (listeningSetId: string) => void;
  onSelectAnswer: (answer: AnswerOptionKey) => void;
  onShowShortcuts: () => void;
  onToggleDoubtful: () => void;
  onTogglePause: () => void;
}) {
  const activeRef = refs[session.currentIndex];
  const activeAnswer = activeRef ? session.answers[activeRef.question.id] : undefined;
  const answeredCount = refs.filter((ref) => session.answers[ref.question.id]?.selectedAnswer).length;
  const doubtfulCount = refs.filter((ref) => session.answers[ref.question.id]?.isDoubtful).length;
  const [completedMainAudioKeys, setCompletedMainAudioKeys] = useState<Record<string, boolean>>({});
  const listeningMainPlaybackKey = activeRef?.listeningSet
    ? listeningMainAudioKey(activeRef.listeningSet.id)
    : undefined;
  const listeningQuestionPlaybackKey = activeRef && isListeningQuestion(activeRef.question)
    ? listeningQuestionAudioKey(activeRef.question.id)
    : undefined;
  const legacyMainAudioPlayCount = activeRef?.listeningSet
    ? (session.listeningPlayCounts?.[activeRef.listeningSet.id] ?? 0)
    : 0;
  const listeningMainAudioPlayCount = listeningMainPlaybackKey
    ? (session.listeningPlayCounts?.[listeningMainPlaybackKey] ?? legacyMainAudioPlayCount)
    : 0;
  const listeningQuestionAudioPlayCount = listeningQuestionPlaybackKey
    ? (session.listeningPlayCounts?.[listeningQuestionPlaybackKey] ?? 0)
    : 0;
  const mainAudioCompleted = listeningMainPlaybackKey ? Boolean(completedMainAudioKeys[listeningMainPlaybackKey]) : false;
  const progressPercent = refs.length ? Math.round((answeredCount / refs.length) * 100) : 0;
  const activeSectionLabel = activeRef ? sectionLabel(activeRef.question.section) : session.title;
  const activeQuestionNumber = activeRef ? activeRef.sectionIndex + 1 : session.currentIndex + 1;
  const activeSectionQuestionCount = activeRef?.sectionQuestionCount ?? refs.length;
  const sessionLayout = activeRef?.passage ? "reading" : activeRef?.listeningSet ? "listening" : "single";
  const activeListeningSetRefs = activeRef?.listeningSet
    ? refs.filter((ref) => ref.listeningSet?.id === activeRef.listeningSet?.id)
    : [];
  const listeningRangeStart = activeListeningSetRefs[0] ? activeListeningSetRefs[0].sectionIndex + 1 : undefined;
  const listeningRangeEnd = activeListeningSetRefs.at(-1)
    ? activeListeningSetRefs.at(-1)!.sectionIndex + 1
    : undefined;
  const activeReadingPassageNumber = activeRef?.passage
    ? session.units
        .slice(0, activeRef.unitIndex + 1)
        .filter((unit) => unit.unitType === "reading-passage").length
    : undefined;

  useEffect(() => {
    setCompletedMainAudioKeys({});
  }, [session.id]);

  const markMainAudioCompleted = useCallback((playbackKey: string) => {
    setCompletedMainAudioKeys((current) => ({ ...current, [playbackKey]: true }));
  }, []);

  const markMainAudioStarted = useCallback((playbackKey: string) => {
    setCompletedMainAudioKeys((current) => ({ ...current, [playbackKey]: false }));
  }, []);

  return (
    <main
      className="sessionShell sessionDashboardShell arcane-learning-shell"
      data-session-layout={sessionLayout}
      data-session-mode={session.mode}
    >
      <header className="sessionTopbar sessionWorkspaceHeader arcane-exam-topbar">
        <div className="sessionTitleBlock">
          <p className="eyebrow">{session.mode === "learning" ? "Mode Belajar" : "Mode Simulasi"}</p>
          <h1>{activeSectionLabel}</h1>
          <p className="muted">{session.subtitle}</p>
        </div>
        <div className="sessionProgressPanel" aria-label="Status sesi">
          <div className="sessionProgressSummary">
            <span>Progress</span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="sessionProgressTrack" aria-hidden="true">
            <span style={{ inlineSize: `${progressPercent}%` }} />
          </div>
          <div className="sessionStatusGrid">
            <Metric label="Terjawab" value={`${answeredCount}/${refs.length}`} />
            <Metric label="Ragu" value={doubtfulCount} />
            <Metric
              label={session.remainingSeconds === undefined ? "Durasi" : "Sisa waktu"}
              value={formatDuration(session.remainingSeconds ?? session.elapsedSeconds)}
            />
          </div>
        </div>
      </header>

      {sessionLayout === "single" && activeRef ? (
        <section className="sessionQuestionLead arcane-question-chamber" aria-label={`Soal ${activeQuestionNumber}`}>
          <div>
            <p className="eyebrow">{sectionLabel(activeRef.question.section)}</p>
            <h2>
              <QuestionPromptText question={activeRef.question} />
            </h2>
          </div>
          <span>Soal {activeQuestionNumber}</span>
        </section>
      ) : null}

      {activeRef?.listeningSet ? (
        <ListeningPanel
          audioSrc={activeRef.listeningSet.audioUrl ?? activeRef.listeningSet.audioSrc}
          listeningSet={activeRef.listeningSet}
          mode={session.mode}
          paused={session.paused}
          playCount={listeningMainAudioPlayCount}
          playbackKey={listeningMainAudioKey(activeRef.listeningSet.id)}
          questionRangeEnd={listeningRangeEnd}
          questionRangeStart={listeningRangeStart}
          onPlaybackEnded={markMainAudioCompleted}
          onPlaybackStarted={markMainAudioStarted}
          onRegisterPlay={onRegisterListeningPlay}
        />
      ) : null}

      <div className="sessionActions sessionCommandBar arcane-exam-actions">
        <Button icon="home" variant="ghost" type="button" onClick={onGoHome}>
          Beranda
        </Button>
        <Button icon="list" variant="secondary" type="button" onClick={onShowShortcuts}>
          Shortcut
        </Button>
        <Button icon={session.paused ? "play" : "pause"} variant="warning" type="button" onClick={onTogglePause}>
          {session.paused ? "Lanjutkan" : "Jeda"}
        </Button>
        <Button icon="check" variant="primary" type="button" onClick={onFinish}>
          Selesai
        </Button>
      </div>

      <section className="sessionLayout arcane-learning-grid">
        <QuestionMap refs={refs} session={session} onJump={onJump} />
        <section className={`questionWorkspace arcane-question-area ${session.paused ? "isPaused" : ""}`}>
          {activeRef ? (
            <QuestionRenderer
              answer={activeAnswer}
              key={activeRef.key}
              learningMode={session.mode === "learning"}
              mainAudioCompleted={mainAudioCompleted}
              questionNumber={activeQuestionNumber}
              questionAudioPlayCount={listeningQuestionAudioPlayCount}
              listeningRangeEnd={listeningRangeEnd}
              listeningRangeStart={listeningRangeStart}
              readingPassageNumber={activeReadingPassageNumber}
              refItem={activeRef}
              sessionMode={session.mode}
              sessionPaused={session.paused}
              onRegisterListeningPlay={onRegisterListeningPlay}
              onSelectAnswer={onSelectAnswer}
              onToggleDoubtful={onToggleDoubtful}
            />
          ) : null}
          {session.paused ? (
            <div className="pauseOverlay arcane-pause-overlay" role="status">
              <strong>Sesi dijeda</strong>
              <span>Pertanyaan dan naskah disamarkan sampai timer dilanjutkan.</span>
              <Button icon="play" variant="primary" type="button" onClick={onTogglePause}>
                Lanjutkan
              </Button>
            </div>
          ) : null}
        </section>
      </section>

      <nav className="bottomNav sessionBottomBar arcane-bottom-nav" aria-label="Navigasi soal">
        <Button icon="arrow-left" variant="secondary" disabled={session.currentIndex === 0} type="button" onClick={onGoPrevious}>
          Sebelumnya
        </Button>
        <span>
          Soal {activeQuestionNumber} dari {activeSectionQuestionCount}
        </span>
        <Button icon={session.currentIndex >= refs.length - 1 ? "check" : "arrow-right"} iconPosition="end" variant="primary" type="button" onClick={onGoNext}>
          {session.currentIndex >= refs.length - 1 ? "Selesai" : "Berikutnya"}
        </Button>
      </nav>

      {showShortcuts ? <ShortcutsModal onClose={onCloseShortcuts} /> : null}
      {showExitConfirmation ? (
        <ExitSessionModal
          answeredCount={answeredCount}
          totalQuestions={refs.length}
          onCancel={onCancelExit}
          onConfirm={onConfirmExit}
        />
      ) : null}
    </main>
  );
}
