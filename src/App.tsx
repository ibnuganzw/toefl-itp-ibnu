import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { questionBank } from "./data/questionBank";
import { TOEFL_ITP_LISTENING_QUESTION_COUNT } from "./data/listeningBank";
import type { AnswerOptionKey } from "./types/questionTypes";
import {
  DEFAULT_SIMULATION_CONFIGS,
  type DiagnosticArea,
  type LearningScope,
  type RuntimeSession,
  type SessionBlueprint,
  computeDiagnostic,
  createAnswerRecord,
  createFocusedLearningSession,
  createLearningSession,
  createListeningSession,
  createRetrySession,
  createRuntimeSession,
  createSimulationSession,
  createStoredSnapshot,
  flattenSessionQuestions,
  formatDuration,
  questionIdsForDiagnosticArea,
  restoreSessionFromSnapshot,
  toggleDoubtfulRecord,
} from "./utils/sessionEngine";
import { validateQuestionBank } from "./utils/validation";
import { DashboardShell } from "./components/dashboard/DashboardShell";
import { CollectionScreen } from "./components/screens/CollectionScreen";
import { ExploreScreen } from "./components/screens/ExploreScreen";
import { HomeScreen } from "./components/screens/HomeScreen";
import { ProgressScreen } from "./components/screens/ProgressScreen";
import { ResultScreen } from "./components/screens/ResultScreen";
import { ReviewScreen } from "./components/screens/ReviewScreen";
import { SessionScreen } from "./components/screens/SessionScreen";
import { TestSpaceScreen } from "./components/screens/TestSpaceScreen";
import type { StoredHistoryItem, StoredProgress } from "./types/appState";
import type { DashboardNav, DashboardScreen, ShellStat } from "./types/dashboardTypes";
import type { SimulationConfig } from "./types/questionTypes";
import { buildDestinationPagesModel } from "./utils/destinationPages";
import { buildHomeDashboardModel } from "./utils/homeDashboard";
import { buildProgressIllustrationModel } from "./utils/progressIllustration";
import type { FocusedPracticeTarget } from "./utils/focusedPractice";
import {
  isSessionBlueprintUnavailableError,
  type FixedPackageQuestionCount,
} from "./utils/sessionBlueprints";
import { compareEstimateToTarget, estimateSimulationScore, normalizeScoreTarget } from "./utils/scoreEstimation";
import { loadProgress, saveProgress } from "./utils/progressStorage";
import {
  createDiagnosticSnapshot,
  MAX_STORED_HISTORY_ITEMS,
  MAX_STORED_SIMULATION_HISTORY_ITEMS,
} from "./utils/historyDiagnostics";

type Screen = DashboardScreen;

function App() {
  const validationReport = useMemo(
    () => validateQuestionBank(questionBank, { strictInitialTarget: true }),
    [],
  );
  const [screen, setScreen] = useState<Screen>("home");
  const [dashboardHistory, setDashboardHistory] = useState<DashboardNav[]>([]);
  const [sessionReturnScreen, setSessionReturnScreen] = useState<DashboardNav>("home");
  const [progress, setProgress] = useState<StoredProgress>(() => loadProgress());
  const [session, setSession] = useState<RuntimeSession | null>(null);
  const [completedSession, setCompletedSession] = useState<RuntimeSession | null>(null);
  const [notice, setNotice] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [showResultReveal, setShowResultReveal] = useState(false);
  const homeDashboard = useMemo(() => buildHomeDashboardModel(questionBank, progress), [progress]);
  const destinationPages = useMemo(() => buildDestinationPagesModel(questionBank, progress), [progress]);
  const progressIllustration = useMemo(() => buildProgressIllustrationModel(questionBank, progress), [progress]);

  const navigateTo = useCallback((destination: DashboardNav = "home") => {
    setNotice("");
    setShowResultReveal(false);
    if (isDashboardNav(screen) && screen !== destination) {
      setDashboardHistory((history) => [...history, screen].slice(-8));
    }
    setScreen(destination);
  }, [screen]);

  const sessionRefs = useMemo(
    () => (session ? flattenSessionQuestions(session.units) : []),
    [session],
  );
  const completedRefs = useMemo(
    () => (completedSession ? flattenSessionQuestions(completedSession.units) : []),
    [completedSession],
  );

  const startBlueprint = useCallback((blueprint: SessionBlueprint) => {
    const runtime = createRuntimeSession(blueprint);
    const refs = flattenSessionQuestions(runtime.units);

    if (!refs.length) {
      setNotice("Sesi tidak dapat dibuat karena tidak ada soal aktif yang cocok.");
      return;
    }

    setSession(runtime);
    setSessionReturnScreen(returnTargetForScreen(screen, completedSession, sessionReturnScreen));
    setCompletedSession(null);
    setShowShortcuts(false);
    setShowExitConfirmation(false);
    setShowResultReveal(false);
    setNotice("");
    setScreen("session");
  }, [completedSession, screen, sessionReturnScreen]);

  const handleBlueprintError = useCallback((error: unknown) => {
    if (!isSessionBlueprintUnavailableError(error)) throw error;
    setNotice(error.message);
  }, []);

  const finishSession = useCallback(
    (reason: "manual" | "time" = "manual") => {
      if (!session) return;

      const finishedSession: RuntimeSession = {
        ...session,
        paused: false,
        finishedAt: new Date().toISOString(),
        finishReason: reason,
      };

      setCompletedSession(finishedSession);
      setSession(null);
      setShowShortcuts(false);
      setShowExitConfirmation(false);
      setShowResultReveal(Boolean(estimateSimulationScore(finishedSession)));
      setScreen("result");
      setProgress((current) => updateProgressAfterFinish(current, finishedSession));
    },
    [session],
  );

  const selectAnswer = useCallback((answer: AnswerOptionKey) => {
    setSession((current) => {
      if (!current || current.paused) return current;
      const refs = flattenSessionQuestions(current.units);
      const ref = refs[current.currentIndex];
      if (!ref) return current;
      if (current.mode === "learning" && current.answers[ref.question.id]?.selectedAnswer) return current;

      return {
        ...current,
        answers: {
          ...current.answers,
          [ref.question.id]: createAnswerRecord(
            ref,
            answer,
            current.answers[ref.question.id],
            current.elapsedSeconds,
          ),
        },
      };
    });
  }, []);

  const toggleDoubtful = useCallback(() => {
    setSession((current) => {
      if (!current || current.paused) return current;
      const refs = flattenSessionQuestions(current.units);
      const ref = refs[current.currentIndex];
      if (!ref) return current;

      return {
        ...current,
        answers: {
          ...current.answers,
          [ref.question.id]: toggleDoubtfulRecord(
            ref,
            current.answers[ref.question.id],
            current.elapsedSeconds,
          ),
        },
      };
    });
  }, []);

  const togglePause = useCallback(() => {
    setSession((current) => (current ? { ...current, paused: !current.paused } : current));
  }, []);

  const goToQuestion = useCallback((index: number) => {
    setSession((current) => {
      if (!current || current.paused) return current;
      const refs = flattenSessionQuestions(current.units);
      return {
        ...current,
        currentIndex: Math.min(Math.max(index, 0), refs.length - 1),
      };
    });
  }, []);

  const goPrevious = useCallback(() => {
    setSession((current) => {
      if (!current || current.paused) return current;
      return { ...current, currentIndex: Math.max(0, current.currentIndex - 1) };
    });
  }, []);

  const goNext = useCallback(() => {
    if (!session || session.paused) return;
    if (session.currentIndex >= sessionRefs.length - 1) {
      finishSession("manual");
      return;
    }
    setSession((current) =>
      current ? { ...current, currentIndex: Math.min(sessionRefs.length - 1, current.currentIndex + 1) } : current,
    );
  }, [finishSession, session, sessionRefs.length]);

  const startLearning = useCallback(
    (scope: LearningScope, questionCount: FixedPackageQuestionCount = 50) => {
      try {
        startBlueprint(
          createLearningSession(questionBank, scope, {
            maxQuestions: questionCount,
            shuffleUnits: true,
          }),
        );
      } catch (error) {
        handleBlueprintError(error);
      }
    },
    [handleBlueprintError, startBlueprint],
  );

  const startFocusedPractice = useCallback(
    (target: FocusedPracticeTarget) => {
      try {
        startBlueprint(createFocusedLearningSession(questionBank, target));
      } catch (error) {
        handleBlueprintError(error);
      }
    },
    [handleBlueprintError, startBlueprint],
  );

  const startSimulation = useCallback(
    (mode: "structure-written" | "reading" | "full") => {
      if (mode === "full" && validationReport.summary.listeningQuestionCount < TOEFL_ITP_LISTENING_QUESTION_COUNT) {
        setNotice(
          `Simulasi Lengkap membutuhkan ${TOEFL_ITP_LISTENING_QUESTION_COUNT} soal Listening aktif. Saat ini baru ${validationReport.summary.listeningQuestionCount}.`,
        );
        return;
      }

      try {
        startBlueprint(createSimulationSession(questionBank, mode, DEFAULT_SIMULATION_CONFIGS[mode]));
      } catch (error) {
        handleBlueprintError(error);
      }
    },
    [handleBlueprintError, startBlueprint, validationReport.summary.listeningQuestionCount],
  );

  const startCustomSimulation = useCallback(
    (config: Partial<SimulationConfig>) => {
      try {
        startBlueprint(createSimulationSession(questionBank, "custom", config));
      } catch (error) {
        handleBlueprintError(error);
      }
    },
    [handleBlueprintError, startBlueprint],
  );

  const startListening = useCallback(
    (mode: "learning" | "simulation", questionCount: FixedPackageQuestionCount = 50) => {
      if (mode === "simulation" && validationReport.summary.listeningQuestionCount < TOEFL_ITP_LISTENING_QUESTION_COUNT) {
        setNotice(
          `Simulasi Listening membutuhkan ${TOEFL_ITP_LISTENING_QUESTION_COUNT} soal aktif dalam Part A, Part B, dan Part C. Saat ini baru ${validationReport.summary.listeningQuestionCount}.`,
        );
        return;
      }

      try {
        startBlueprint(createListeningSession(questionBank, mode, questionCount));
      } catch (error) {
        handleBlueprintError(error);
      }
    },
    [handleBlueprintError, startBlueprint, validationReport.summary.listeningQuestionCount],
  );

  const registerListeningPlay = useCallback((playbackKey: string) => {
    setSession((current) => {
      if (!current || current.paused) return current;
      const currentCount = current.listeningPlayCounts?.[playbackKey] ?? 0;

      return {
        ...current,
        listeningPlayCounts: {
          ...current.listeningPlayCounts,
          [playbackKey]: currentCount + 1,
        },
      };
    });
  }, []);

  const resumeStoredSession = useCallback(() => {
    if (!progress.activeSession) return;
    const restored = restoreSessionFromSnapshot(questionBank, progress.activeSession);
    if (!restored) {
      setNotice("Sesi tersimpan tidak dapat dipulihkan dari data soal saat ini.");
      setProgress((current) => ({ ...current, activeSession: undefined }));
      return;
    }
    setSession(restored);
    setSessionReturnScreen(returnTargetForScreen(screen, completedSession, sessionReturnScreen));
    setCompletedSession(null);
    setNotice("");
    setScreen("session");
  }, [completedSession, progress.activeSession, screen, sessionReturnScreen]);

  const clearStoredSession = useCallback(() => {
    setProgress((current) => ({ ...current, activeSession: undefined }));
    setNotice("Sesi sebelumnya dihapus. Silakan mulai sesi baru.");
  }, []);

  const updateScoreTarget = useCallback((value: number | undefined) => {
    const scoreTarget = normalizeScoreTarget(value);
    setProgress((current) => ({ ...current, scoreTarget }));
    setNotice(
      scoreTarget === undefined
        ? "Target estimasi skor dihapus."
        : `Target estimasi skor diperbarui menjadi ${scoreTarget}.`,
    );
  }, []);

  const exitSessionToHome = useCallback(() => {
    if (!session) return;
    const snapshot = createStoredSnapshot(session);
    const answeredCount = flattenSessionQuestions(session.units).filter(
      (ref) => session.answers[ref.question.id]?.selectedAnswer,
    ).length;
    const nextNotice = `Progres sesi disimpan setelah ${answeredCount} soal terjawab. Kamu dapat melanjutkannya dari Beranda.`;

    setProgress((current) => {
      const nextProgress = { ...current, activeSession: snapshot };
      saveProgress(nextProgress);
      return nextProgress;
    });
    setSession(null);
    setShowShortcuts(false);
    setShowExitConfirmation(false);
    setNotice(nextNotice);
    setScreen(sessionReturnScreen);
  }, [session, sessionReturnScreen]);

  const closeCurrentScreen = useCallback(() => {
    setNotice("");
    setShowResultReveal(false);

    if (screen === "home") return;
    if (screen === "review") {
      setScreen("result");
      return;
    }

    if (screen === "session") {
      setShowExitConfirmation(true);
      return;
    }

    const target = dashboardHistory.at(-1) ?? "home";
    setDashboardHistory((history) => history.slice(0, -1));
    setScreen(target);
  }, [dashboardHistory, screen]);

  const startRetry = useCallback(
    (kind: "wrong" | "doubtful") => {
      if (!completedSession) return;
      const ids = completedRefs
        .filter((ref) => {
          const answer = completedSession.answers[ref.question.id];
          if (kind === "wrong") return Boolean(answer?.selectedAnswer) && !answer?.isCorrect;
          return Boolean(answer?.isDoubtful);
        })
        .map((ref) => ref.question.id);

      const uniqueIds = unique(ids);
      if (!uniqueIds.length) {
        setNotice(
          kind === "wrong"
            ? "Tidak ada jawaban salah untuk diulang."
            : "Tidak ada soal ragu-ragu untuk diulang.",
        );
        return;
      }

      startBlueprint(
        createRetrySession(
          questionBank,
          uniqueIds,
          kind === "wrong" ? "Ulangi Jawaban Salah" : "Ulangi Soal Ragu-ragu",
          kind === "wrong" ? "retry-wrong" : "retry-doubtful",
        ),
      );
    },
    [completedRefs, completedSession, startBlueprint],
  );

  const startWeakestTraining = useCallback(
    (area: DiagnosticArea | undefined) => {
      if (!area) {
        setNotice("Belum ada area terlemah yang bisa dilatih.");
        return;
      }
      const ids = questionIdsForDiagnosticArea(questionBank, area);
      if (!ids.length) {
        setNotice("Area terlemah tidak memiliki soal yang cocok.");
        return;
      }
      startBlueprint(createRetrySession(questionBank, ids, "Latihan Area Terlemah", "train-weakest"));
    },
    [startBlueprint],
  );

  const startReviewQueue = useCallback(
    (questionIds: string[], title: string, kind: "wrong" | "doubtful") => {
      if (!questionIds.length) {
        setNotice("Antrian review ini masih kosong.");
        return;
      }
      startBlueprint(
        createRetrySession(
          questionBank,
          questionIds,
          title,
          kind === "wrong" ? "retry-wrong" : "retry-doubtful",
        ),
      );
    },
    [startBlueprint],
  );

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
  }, [completedSession?.id, screen, session?.id]);

  // Lock the question screens (session & review) to the desktop layout on
  // small devices by forcing a desktop-width viewport — the browser scales it
  // to fit, like Chrome's "Request desktop site". The mobile layout for these
  // exam screens is cramped, so a scaled desktop view reads far better.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const RESPONSIVE = "width=device-width, initial-scale=1.0, viewport-fit=cover";
    const DESKTOP = "width=1024, viewport-fit=cover";
    const isQuestionScreen = screen === "session" || screen === "review";
    const isSmallDevice = window.screen.width < 961;
    meta.setAttribute("content", isQuestionScreen && isSmallDevice ? DESKTOP : RESPONSIVE);
    return () => {
      meta.setAttribute("content", RESPONSIVE);
    };
  }, [screen]);

  useLayoutEffect(() => {
    if (!session || screen !== "session") return;
    const activeSession = createStoredSnapshot(session);
    setProgress((current) => {
      const nextProgress = {
        ...current,
        activeSession,
      };
      saveProgress(nextProgress);
      return nextProgress;
    });
  }, [screen, session]);

  useEffect(() => {
    if (!session || screen !== "session" || session.paused || session.finishedAt) return;
    const timer = window.setInterval(() => {
      setSession((current) => {
        if (!current || current.paused) return current;
        const remainingSeconds =
          current.remainingSeconds === undefined
            ? undefined
            : Math.max(0, current.remainingSeconds - 1);
        return {
          ...current,
          elapsedSeconds: current.elapsedSeconds + 1,
          remainingSeconds,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [screen, session?.finishedAt, session?.id, session?.paused]);

  useEffect(() => {
    if (!session || screen !== "session") return;
    const confirmBrowserExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmBrowserExit);
    return () => window.removeEventListener("beforeunload", confirmBrowserExit);
  }, [screen, session]);

  useEffect(() => {
    if (session && screen === "session" && session.remainingSeconds === 0) {
      finishSession("time");
    }
  }, [finishSession, screen, session]);

  const renderShell = (
    activeScreen: DashboardScreen,
    title: string,
    subtitle: string,
    content: ReactNode,
    options?: {
      activeNav?: DashboardNav;
      canClose?: boolean;
      hideNavigation?: boolean;
      stats?: ShellStat[];
    },
  ) => (
    <DashboardShell
      activeNav={options?.activeNav ?? "home"}
      activeScreen={activeScreen}
      hideNavigation={options?.hideNavigation}
      canClose={options?.canClose ?? activeScreen !== "home"}
      stats={options?.stats ?? []}
      subtitle={subtitle}
      title={title}
      onClose={closeCurrentScreen}
      onNavigate={navigateTo}
    >
      {content}
    </DashboardShell>
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcut(event.target)) return;

      if (event.key === "Escape") {
        if (showResultReveal) {
          setShowResultReveal(false);
          event.preventDefault();
          return;
        }
        if (showExitConfirmation) {
          setShowExitConfirmation(false);
          event.preventDefault();
          return;
        }
        if (showShortcuts) {
          setShowShortcuts(false);
          event.preventDefault();
          return;
        }
        if (session?.paused) {
          togglePause();
          event.preventDefault();
        }
        return;
      }

      if (showShortcuts || showExitConfirmation || showResultReveal) return;

      if (screen !== "session" || !session) return;

      const upperKey = event.key.toUpperCase();
      if (upperKey === "P") {
        togglePause();
        event.preventDefault();
        return;
      }

      if (session.paused) return;

      const keyAnswer = answerFromShortcut(event.key);
      if (keyAnswer) {
        selectAnswer(keyAnswer);
        event.preventDefault();
        return;
      }

      if (upperKey === "R") {
        toggleDoubtful();
        event.preventDefault();
        return;
      }

      if (event.key === "Enter") {
        if (event.shiftKey) goPrevious();
        else goNext();
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowRight") {
        goNext();
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowLeft") {
        goPrevious();
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    goNext,
    goPrevious,
    screen,
    selectAnswer,
    session,
    showExitConfirmation,
    showResultReveal,
    showShortcuts,
    toggleDoubtful,
    togglePause,
  ]);

  if (screen === "session" && session) {
    const answeredCount = sessionRefs.filter((ref) => session.answers[ref.question.id]?.selectedAnswer).length;
    const doubtfulCount = sessionRefs.filter((ref) => session.answers[ref.question.id]?.isDoubtful).length;
    return renderShell(
      "session",
      session.title,
      session.mode === "simulation" ? "Mode simulasi aktif" : "Mode belajar aktif",
      <SessionScreen
        session={session}
        refs={sessionRefs}
        showShortcuts={showShortcuts}
        showExitConfirmation={showExitConfirmation}
        onCloseShortcuts={() => setShowShortcuts(false)}
        onCancelExit={() => setShowExitConfirmation(false)}
        onConfirmExit={exitSessionToHome}
        onFinish={() => finishSession("manual")}
        onGoHome={() => setShowExitConfirmation(true)}
        onGoNext={goNext}
        onGoPrevious={goPrevious}
        onJump={goToQuestion}
        onRegisterListeningPlay={registerListeningPlay}
        onSelectAnswer={selectAnswer}
        onShowShortcuts={() => setShowShortcuts(true)}
        onToggleDoubtful={toggleDoubtful}
        onTogglePause={togglePause}
      />
      ,
      {
        activeNav: dashboardNavForSession(session),
        hideNavigation: true,
        stats: [
          { label: "Dijawab", value: `${answeredCount}/${sessionRefs.length}` },
          { label: "Ditandai", value: doubtfulCount },
          {
            label: session.remainingSeconds === undefined ? "Durasi" : "Waktu",
            value: formatDuration(session.remainingSeconds ?? session.elapsedSeconds),
          },
        ],
      },
    );
  }

  if (screen === "result" && completedSession) {
    const diagnostic = computeDiagnostic(completedSession);
    const scoreEstimate = estimateSimulationScore(completedSession);
    const scoreTargetComparison = compareEstimateToTarget(scoreEstimate, progress.scoreTarget);
    return renderShell(
      "result",
      "Hasil Sesi",
      completedSession.title,
      <ResultScreen
        diagnostic={diagnostic}
        notice={notice}
        scoreEstimate={scoreEstimate}
        scoreTargetComparison={scoreTargetComparison}
        showScoreReveal={showResultReveal}
        session={completedSession}
        onCloseScoreReveal={() => setShowResultReveal(false)}
        onGoHome={() => {
          navigateTo("progress");
        }}
        onReview={() => {
          setNotice("");
          setShowResultReveal(false);
          setScreen("review");
        }}
        onRetryDoubtful={() => startRetry("doubtful")}
        onRetryWrong={() => startRetry("wrong")}
        onTrainWeakest={() => {
          setShowResultReveal(false);
          startWeakestTraining(diagnostic.weakestAreas[0]);
        }}
      />
      ,
      {
        activeNav: dashboardNavForSession(completedSession),
        stats: [
          { label: "Akurasi", value: `${diagnostic.accuracy}%` },
          { label: "Dijawab", value: `${diagnostic.totalAttempted}/${diagnostic.totalQuestions}` },
          { label: "Durasi", value: formatDuration(completedSession.elapsedSeconds) },
        ],
      },
    );
  }

  if (screen === "review" && completedSession) {
    return renderShell(
      "review",
      "Review Jawaban",
      completedSession.title,
      <ReviewScreen
        refs={completedRefs}
        session={completedSession}
        onBackToResult={() => setScreen("result")}
        onGoHome={() => navigateTo("collection")}
      />
      ,
      {
        activeNav: "collection",
        stats: [
          { label: "Review", value: completedRefs.length },
          { label: "Mode", value: completedSession.mode === "simulation" ? "Simulasi" : "Belajar" },
          { label: "Durasi", value: formatDuration(completedSession.elapsedSeconds) },
        ],
      },
    );
  }

  if (screen === "explore") {
    return renderShell(
      "explore",
      "Jelajahi",
      "Temukan latihan berdasarkan kebutuhanmu.",
      <ExploreScreen
        dashboard={homeDashboard}
        notice={notice}
        onStartLearning={startLearning}
        onStartFocusedPractice={startFocusedPractice}
        onStartListening={startListening}
      />,
      { activeNav: "explore" },
    );
  }

  if (screen === "collection") {
    return renderShell(
      "collection",
      "Koleksi Belajar",
      "Review dan pembahasan yang layak dibuka kembali.",
      <CollectionScreen
        dashboard={homeDashboard}
        model={destinationPages}
        notice={notice}
        onReviewQueue={startReviewQueue}
        onStartFocusedPractice={startFocusedPractice}
      />,
      { activeNav: "collection" },
    );
  }

  if (screen === "test-space") {
    return renderShell(
      "test-space",
      "Ruang Uji",
      "Pilih simulasi dan ukur progresmu.",
      <TestSpaceScreen
        dashboard={homeDashboard}
        notice={notice}
        onResumeSession={resumeStoredSession}
        onStartCustomSimulation={startCustomSimulation}
        onStartSimulation={() => startSimulation("full")}
      />,
      { activeNav: "test-space" },
    );
  }

  if (screen === "progress") {
    return renderShell(
      "progress",
      "Perkembangan",
      "Target, tren, dan diagnostik belajar.",
      <ProgressScreen
        dashboard={homeDashboard}
        illustration={progressIllustration}
        model={destinationPages}
        notice={notice}
        onUpdateScoreTarget={updateScoreTarget}
      />,
      { activeNav: "progress" },
    );
  }

  return renderShell(
    "home",
    "Beranda",
    "Workspace belajar dan rekomendasi latihan yang dipersonalisasi untukmu.",
    <HomeScreen
      dashboard={homeDashboard}
      notice={notice}
      onClearStoredSession={clearStoredSession}
      onExplore={() => navigateTo("explore")}
      onStartLearning={startLearning}
      onStartFocusedPractice={startFocusedPractice}
      onStartListening={startListening}
      onStartSimulation={startSimulation}
      onUpdateScoreTarget={updateScoreTarget}
    />
    ,
    {
      activeNav: "home",
    },
  );
}

function dashboardNavForSession(runtimeSession: RuntimeSession): DashboardNav {
  if (runtimeSession.kind === "simulation-full" || runtimeSession.kind === "simulation-custom") {
    return "test-space";
  }

  return runtimeSession.mode === "simulation" ? "test-space" : "explore";
}

function isDashboardNav(value: DashboardScreen): value is DashboardNav {
  return value === "home" || value === "explore" || value === "collection" || value === "test-space" || value === "progress";
}

function returnTargetForScreen(
  currentScreen: DashboardScreen,
  completedSession: RuntimeSession | null,
  fallback: DashboardNav,
): DashboardNav {
  if (isDashboardNav(currentScreen)) return currentScreen;
  if (completedSession) return dashboardNavForSession(completedSession);
  return fallback;
}

function updateProgressAfterFinish(progress: StoredProgress, session: RuntimeSession): StoredProgress {
  const refs = flattenSessionQuestions(session.units);
  const seen = new Set(progress.seenQuestionIds);
  const attemptsByQuestion = { ...progress.attemptsByQuestion };

  for (const ref of refs) {
    seen.add(ref.question.id);
    const answer = session.answers[ref.question.id];
    if (!answer?.selectedAnswer) continue;

    const current = attemptsByQuestion[ref.question.id] ?? { attempts: 0, correct: 0, doubtful: 0 };
    attemptsByQuestion[ref.question.id] = {
      attempts: current.attempts + 1,
      correct: current.correct + (answer.isCorrect ? 1 : 0),
      doubtful: current.doubtful + (answer.isDoubtful ? 1 : 0),
      lastAnsweredAt: answer.answeredAt,
    };
  }

  const diagnostic = computeDiagnostic(session);
  const diagnosticSnapshot = createDiagnosticSnapshot(session, diagnostic);
  const scoreEstimate = estimateSimulationScore(session);
  const scoreTargetComparison = compareEstimateToTarget(scoreEstimate, progress.scoreTarget);
  const historyItem: StoredHistoryItem = {
    id: session.id,
    title: session.title,
    finishedAt: session.finishedAt ?? new Date().toISOString(),
    totalQuestions: diagnostic.totalQuestions,
    attempted: diagnostic.totalAttempted,
    correct: diagnostic.totalCorrect,
    accuracy: diagnostic.accuracy,
    durationSeconds: session.elapsedSeconds,
    sessionKind: session.kind,
    simulationConfig: session.mode === "simulation" ? session.config : undefined,
    diagnosticSnapshot,
    scoreEstimate,
    scoreTargetAtCompletion: scoreEstimate ? progress.scoreTarget : undefined,
    scoreTargetComparison,
  };

  return {
    seenQuestionIds: [...seen],
    attemptsByQuestion,
    history: [historyItem, ...progress.history].slice(0, MAX_STORED_HISTORY_ITEMS),
    simulationHistory:
      session.mode === "simulation"
        ? [historyItem, ...progress.simulationHistory].slice(0, MAX_STORED_SIMULATION_HISTORY_ITEMS)
        : progress.simulationHistory,
    activeSession: undefined,
    scoreTarget: progress.scoreTarget,
    latestScoreEstimate: scoreEstimate ?? progress.latestScoreEstimate,
    bestScoreEstimate: scoreEstimate
      ? Math.max(progress.bestScoreEstimate ?? scoreEstimate.totalEstimate, scoreEstimate.totalEstimate)
      : progress.bestScoreEstimate,
  };
}

function answerFromShortcut(key: string): AnswerOptionKey | null {
  const normalized = key.toUpperCase();
  if (normalized === "1" || normalized === "A") return "A";
  if (normalized === "2" || normalized === "B") return "B";
  if (normalized === "3" || normalized === "C") return "C";
  if (normalized === "4" || normalized === "D") return "D";
  return null;
}

function shouldIgnoreShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}


function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export default App;
