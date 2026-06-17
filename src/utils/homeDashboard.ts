import {
  getActiveListeningQuestions,
  getActiveReadingQuestions,
  getActiveStructureQuestions,
  getActiveWrittenExpressionQuestions,
} from "../data/questionBank";
import type { StoredProgress } from "../types/appState";
import type {
  DashboardFocusArea,
  DashboardLaunchTarget,
  DashboardRecommendation,
  DashboardSubject,
  DashboardTone,
  HomeDashboardModel,
} from "../types/homeDashboard";
import type { BankQuestion, MasterQuestionBank, QuestionSection } from "../types/questionTypes";
import {
  countFocusedPracticeQuestions,
  formatDuration,
  sectionLabel,
  type StoredUnitRef,
} from "./sessionEngine";
import { compareEstimateToTarget } from "./scoreEstimation";
import {
  createFocusedPracticeTarget,
  type FocusedPracticeTarget,
} from "./focusedPractice";

const WEEKLY_SESSION_TARGET = 5;

interface FocusAggregate {
  id: string;
  label: string;
  section: QuestionSection;
  attempted: number;
  correct: number;
  questions: BankQuestion[];
  focusTarget: FocusedPracticeTarget;
}

export function buildHomeDashboardModel(bank: MasterQuestionBank, progress: StoredProgress): HomeDashboardModel {
  const questions = getActiveDashboardQuestions(bank);
  const totalActiveQuestions = questions.length;
  const activeQuestionIds = new Set(questions.map((question) => question.id));
  const seenQuestions = new Set(progress.seenQuestionIds.filter((id) => activeQuestionIds.has(id)));
  const attemptTotals = questions.reduce(
    (totals, question) => {
      const item = progress.attemptsByQuestion[question.id];
      if (!item) return totals;
      totals.attempts += item.attempts;
      totals.correct += item.correct;
      return totals;
    },
    { attempts: 0, correct: 0 },
  );
  const learningProgress = totalActiveQuestions ? Math.round((seenQuestions.size / totalActiveQuestions) * 100) : 0;
  const accuracy = attemptTotals.attempts ? Math.round((attemptTotals.correct / attemptTotals.attempts) * 100) : 0;
  const weeklyTarget = buildWeeklyTarget(progress);
  const focusAggregates = buildFocusAggregates(questions, progress);
  const focusAreas = buildFocusAreas(focusAggregates);
  const recommendations = buildRecommendations(focusAggregates, bank);
  const latestSession = progress.history[0];
  const estimatedSessions = progress.history.filter((item) => item.scoreEstimate);
  const latestEstimate = progress.latestScoreEstimate ?? estimatedSessions[0]?.scoreEstimate;
  const latestComparison = compareEstimateToTarget(latestEstimate, progress.scoreTarget);
  const activeSession = progress.activeSession
    ? {
        meta: `Posisi ${progress.activeSession.currentIndex + 1}/${countSnapshotQuestions(progress.activeSession.unitRefs)} · ${formatDuration(progress.activeSession.elapsedSeconds)}`,
        title: progress.activeSession.title,
      }
    : undefined;
  const scoreGoal = {
    bestEstimate:
      progress.bestScoreEstimate ??
      (estimatedSessions.length
        ? Math.max(...estimatedSessions.map((item) => item.scoreEstimate?.totalEstimate ?? 0))
        : undefined),
    gap: latestComparison?.gap,
    latestEstimate: latestEstimate?.totalEstimate,
    status: latestComparison?.status,
    targetScore: progress.scoreTarget,
  };

  return {
    personalBrief: buildPersonalBrief({
      activeSession,
      accuracy,
      focusAreas,
      latestComparison,
      recommendations,
      scoreGoal,
      weeklyTarget,
    }),
    testSpace: buildTestSpace(scoreGoal),
    scoreGoal,
    summary: [
      {
        id: "active-questions",
        label: "Total Soal Aktif",
        value: new Intl.NumberFormat("id-ID").format(totalActiveQuestions),
        detail: "Bank latihan tervalidasi",
        tone: "blue",
      },
      {
        id: "learning-progress",
        label: "Progress Belajar",
        value: `${learningProgress}%`,
        detail: `${seenQuestions.size} / ${totalActiveQuestions} soal`,
        progressPercent: learningProgress,
        tone: "green",
      },
      {
        id: "accuracy",
        label: "Akurasi Rata-rata",
        value: `${accuracy}%`,
        detail: `${attemptTotals.correct} benar dari ${attemptTotals.attempts} percobaan`,
        progressPercent: accuracy,
        tone: "amber",
      },
      {
        id: "weekly-target",
        label: "Target Mingguan",
        value: `${weeklyTarget.completedSessions}/${weeklyTarget.targetSessions}`,
        detail: `${weeklyTarget.remainingDays} hari tersisa`,
        progressPercent: weeklyTarget.progressPercent,
        tone: "violet",
      },
      {
        id: "last-session",
        label: "Sesi Terakhir",
        value: latestSession ? `${latestSession.accuracy}%` : "Belum ada",
        detail: latestSession ? latestSession.title : "Mulai latihan pertamamu",
        tone: "neutral",
      },
    ],
    recommendations,
    subjects: buildSubjects(bank),
    focusAreas,
    recentSessions: progress.simulationHistory.slice(0, 3).map((item) => ({
      finishedLabel: formatRelativeDate(item.finishedAt),
      focusLabel: item.diagnosticSnapshot?.weakestAreas[0]?.label,
      id: item.id,
      meta: `${item.correct}/${item.totalQuestions} benar · ${formatDuration(item.durationSeconds)}`,
      resultLabel: item.scoreEstimate ? "Estimasi" : "Akurasi",
      resultValue: item.scoreEstimate ? `${item.scoreEstimate.totalEstimate}` : `${item.accuracy}%`,
      sections: (item.diagnosticSnapshot?.bySection ?? []).map((area) => ({
        accuracy: area.accuracy,
        attempted: area.attempted,
        label: area.label,
        totalQuestions: area.totalQuestions,
        unanswered: area.unanswered,
      })),
      targetLabel: item.scoreTargetComparison
        ? item.scoreTargetComparison.gap <= 0
          ? `Target ${item.scoreTargetComparison.targetScore} tercapai`
          : `${item.scoreTargetComparison.gap} poin menuju target`
        : undefined,
      title: item.title,
    })),
    weeklyTarget,
    activeSession: progress.activeSession
      ? {
          meta: `Posisi ${progress.activeSession.currentIndex + 1}/${countSnapshotQuestions(progress.activeSession.unitRefs)} · ${formatDuration(progress.activeSession.elapsedSeconds)}`,
          title: progress.activeSession.title,
        }
      : undefined,
  };
}

function buildPersonalBrief({
  activeSession,
  accuracy,
  focusAreas,
  latestComparison,
  recommendations,
  scoreGoal,
  weeklyTarget,
}: {
  activeSession: HomeDashboardModel["activeSession"];
  accuracy: number;
  focusAreas: DashboardFocusArea[];
  latestComparison: ReturnType<typeof compareEstimateToTarget>;
  recommendations: DashboardRecommendation[];
  scoreGoal: HomeDashboardModel["scoreGoal"];
  weeklyTarget: HomeDashboardModel["weeklyTarget"];
}): HomeDashboardModel["personalBrief"] {
  const focus = focusAreas[0]?.label ?? recommendations[0]?.focus ?? "latihan dasar";
  const primaryRecommendation = recommendations[0];

  if (activeSession) {
    return {
      eyebrow: "Sesi Menunggumu",
      title: `Lanjutkan ${activeSession.title}`,
      message: "Progresmu sudah aman. Selesaikan sesi ini lebih dulu agar rekomendasi dan diagnostik berikutnya semakin tajam.",
      primaryAction: "resume",
      primaryLabel: "Lanjutkan Sesi",
      targetSummary: scoreGoal.targetScore ? `Target ${scoreGoal.targetScore}` : "Target belum diatur",
      focusSummary: `Fokus berikutnya: ${focus}`,
      rhythmSummary: `${weeklyTarget.completedSessions}/${weeklyTarget.targetSessions} sesi minggu ini`,
    };
  }

  return {
    eyebrow: "Ruang Belajar Personal",
    title:
      latestComparison?.status === "achieved"
        ? "Targetmu tercapai. Sekarang pertahankan konsistensi."
        : latestComparison
          ? `${latestComparison.gap} poin lagi menuju targetmu.`
          : "Bangun arah belajar dari satu latihan yang tepat.",
    message: latestComparison
      ? `Area ${focus} adalah titik paling berguna untuk dilatih berikutnya.`
      : "Mulai dari rekomendasi hari ini, lalu gunakan simulasi lengkap untuk membentuk estimasi dan target yang bermakna.",
    primaryAction: "launch",
    primaryLabel: `Latih ${primaryRecommendation?.title ?? "Area Prioritas"}`,
    primaryTarget: primaryRecommendation?.launchTarget ?? "structure-written",
    primaryFocusTarget: primaryRecommendation?.focusTarget,
    targetSummary: scoreGoal.targetScore ? `Target ${scoreGoal.targetScore}` : "Tetapkan target",
    focusSummary: accuracy ? `Akurasi keseluruhan ${accuracy}%` : `Mulai dari ${focus}`,
    rhythmSummary: `${weeklyTarget.completedSessions}/${weeklyTarget.targetSessions} sesi minggu ini`,
  };
}

function buildTestSpace(scoreGoal: HomeDashboardModel["scoreGoal"]): HomeDashboardModel["testSpace"] {
  const readinessLabel = scoreGoal.latestEstimate
    ? scoreGoal.gap !== undefined && scoreGoal.gap <= 0
      ? "Siap menguji konsistensi"
      : "Siap mengukur progres baru"
    : "Siap membentuk estimasi awal";

  return {
    title: "Simulasi Lengkap TOEFL ITP",
    detail: "Kerjakan Listening, Structure & Written, lalu Reading dalam satu rangkaian untuk memperbarui estimasi dan diagnostik.",
    readinessLabel,
    targetLabel: scoreGoal.targetScore ? `Target aktif ${scoreGoal.targetScore}` : "Target belum diatur",
    lastEstimateLabel: scoreGoal.latestEstimate ? `Estimasi terakhir ${scoreGoal.latestEstimate}` : "Belum ada estimasi",
  };
}

function getActiveDashboardQuestions(bank: MasterQuestionBank): BankQuestion[] {
  return [
    ...getActiveStructureQuestions(bank),
    ...getActiveWrittenExpressionQuestions(bank),
    ...getActiveReadingQuestions(bank),
    ...getActiveListeningQuestions(bank),
  ];
}

function buildFocusAggregates(questions: BankQuestion[], progress: StoredProgress): FocusAggregate[] {
  const aggregates = new Map<string, FocusAggregate>();

  for (const question of questions) {
    const questionProgress = progress.attemptsByQuestion[question.id];
    if (!questionProgress?.attempts) continue;
    const focusTarget = createFocusedPracticeTarget(question);
    const label = focusTarget.label;
    const id = `${question.section}:${focusTarget.key}`;
    const current = aggregates.get(id) ?? {
      id,
      label,
      section: question.section,
      attempted: 0,
      correct: 0,
      questions: [],
      focusTarget,
    };
    current.attempted += questionProgress.attempts;
    current.correct += questionProgress.correct;
    current.questions.push(question);
    aggregates.set(id, current);
  }

  return [...aggregates.values()].sort(
    (left, right) =>
      aggregateAccuracy(left) - aggregateAccuracy(right) ||
      right.attempted - left.attempted ||
      left.label.localeCompare(right.label),
  );
}

function buildFocusAreas(aggregates: FocusAggregate[]): DashboardFocusArea[] {
  return aggregates.slice(0, 4).map((aggregate) => ({
    accuracy: aggregateAccuracy(aggregate),
    attempted: aggregate.attempted,
    id: aggregate.id,
    label: aggregate.label,
    launchTarget: launchTargetForSection(aggregate.section),
    focusTarget: aggregate.focusTarget,
  }));
}

function buildRecommendations(aggregates: FocusAggregate[], bank: MasterQuestionBank): DashboardRecommendation[] {
  const fallbackQuestions: BankQuestion[] = [];
  const fallbackCandidates: Array<BankQuestion | undefined> = [
    getActiveStructureQuestions(bank)[0],
    getActiveListeningQuestions(bank)[0],
    getActiveReadingQuestions(bank)[0],
  ];
  for (const question of fallbackCandidates) {
    if (question) fallbackQuestions.push(question);
  }
  const sources = aggregates.length
    ? aggregates.slice(0, 3)
    : fallbackQuestions.map((question) => {
        const focusTarget = createFocusedPracticeTarget(question);
        return {
          id: `default:${question.id}`,
          label: focusTarget.label,
          section: question.section,
          attempted: 0,
          correct: 0,
          questions: [question],
          focusTarget,
        };
      });

  return sources.map((source, index) => {
    const questionCount = countFocusedPracticeQuestions(bank, source.focusTarget);
    return {
      accuracy: source.attempted ? aggregateAccuracy(source) : undefined,
      detail:
        source.attempted > 0
          ? `${questionCount} soal relevan tersedia untuk memperbaiki area dengan akurasi ${aggregateAccuracy(source)}%.`
          : `${questionCount} soal relevan dipilih dari keluarga skill yang sama.`,
      focus: source.label,
      focusTarget: source.focusTarget,
      id: source.id,
      launchTarget: launchTargetForSection(source.section),
      questionCount,
      title: sectionLabel(source.section),
      tone: toneForSection(source.section, index),
    };
  });
}

function buildSubjects(bank: MasterQuestionBank): DashboardSubject[] {
  return [
    {
      detail: "Dialog, conversation, dan lecture.",
      id: "listening",
      launchTarget: "listening",
      metric: "Paket 25, 50, atau 100 soal",
      packageQuestionCounts: [25, 50, 100],
      title: "Listening",
      tone: "blue",
    },
    {
      detail: "Grammar dan Written Expression.",
      id: "structure-written",
      launchTarget: "structure-written",
      metric: "Paket 25, 50, atau 100 soal",
      packageQuestionCounts: [25, 50, 100],
      title: "Structure & Written",
      tone: "violet",
    },
    {
      detail: "Passage tetap utuh dengan pertanyaannya.",
      id: "reading",
      launchTarget: "reading",
      metric: "Paket 25, 50, atau 100 soal",
      packageQuestionCounts: [25, 50, 100],
      title: "Reading",
      tone: "green",
    },
    {
      detail: "Listening, Structure & Written, lalu Reading.",
      id: "simulation",
      launchTarget: "simulation",
      metric: "140 soal - 115 menit",
      title: "Simulasi Lengkap",
      tone: "amber",
    },
  ];
}

function buildWeeklyTarget(progress: StoredProgress) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const sessions = progress.history.filter((item) => {
    const finishedAt = new Date(item.finishedAt);
    return finishedAt >= weekStart && finishedAt < weekEnd;
  });
  const completedSessions = Math.min(sessions.length, WEEKLY_SESSION_TARGET);
  const remainingDays = Math.max(0, 7 - ((now.getDay() + 6) % 7) - 1);

  return {
    completedSessions,
    progressPercent: Math.round((completedSessions / WEEKLY_SESSION_TARGET) * 100),
    remainingDays,
    sessionLabels: sessions.slice(0, WEEKLY_SESSION_TARGET).map((item) => item.title),
    targetSessions: WEEKLY_SESSION_TARGET,
  };
}

function launchTargetForSection(section: QuestionSection): DashboardLaunchTarget {
  if (section === "structure" || section === "written-expression") return "structure-written";
  if (section === "reading") return "reading";
  return "listening";
}

function toneForSection(section: QuestionSection, index: number): DashboardTone {
  if (section === "listening") return "blue";
  if (section === "reading") return "green";
  if (section === "written-expression") return "amber";
  return index % 2 === 0 ? "violet" : "blue";
}

function aggregateAccuracy(aggregate: FocusAggregate): number {
  return aggregate.attempted ? Math.round((aggregate.correct / aggregate.attempted) * 100) : 0;
}

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sesi lama";
  const differenceDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (differenceDays <= 0) return "Hari ini";
  if (differenceDays === 1) return "Kemarin";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date);
}

function countSnapshotQuestions(unitRefs: StoredUnitRef[]): number {
  return unitRefs.reduce(
    (sum, unit) => sum + (unit.unitType === "single-question" ? 1 : unit.questionIds?.length ?? 0),
    0,
  );
}
