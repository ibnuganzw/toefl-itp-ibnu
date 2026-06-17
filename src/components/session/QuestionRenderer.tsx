import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { LISTENING_SOURCE_TYPE_LABELS } from "../../data/listeningBank";
import type { AnswerOptionKey, BankQuestion, ReadingPassage } from "../../types/questionTypes";
import { ANSWER_KEYS, type QuestionRef, type RuntimeSession, sectionLabel } from "../../utils/sessionEngine";
import { cleanInlineText, cleanPassageText } from "../../utils/displayText";
import { isListeningQuestion } from "../../utils/questionGuards";
import { listeningQuestionAudioKey } from "../../utils/listeningPlayback";
import { useBodyScrollLock, useFocusTrap } from "../a11y/ArcaneA11y";
import { ExplanationPanel } from "../questions/ExplanationPanel";
import { QuestionPromptText } from "../questions/QuestionPromptText";
import { QuestionAudioPlayer } from "../listening/QuestionAudioPlayer";
import { AppIcon } from "../ui/AppIcon";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export function QuestionRenderer({
  answer,
  learningMode,
  mainAudioCompleted,
  listeningRangeEnd,
  listeningRangeStart,
  readingPassageNumber,
  questionNumber,
  questionAudioPlayCount,
  refItem,
  sessionMode,
  sessionPaused,
  onRegisterListeningPlay,
  onSelectAnswer,
  onToggleDoubtful,
}: {
  answer: RuntimeSession["answers"][string] | undefined;
  learningMode: boolean;
  mainAudioCompleted: boolean;
  listeningRangeEnd?: number;
  listeningRangeStart?: number;
  readingPassageNumber?: number;
  questionNumber: number;
  questionAudioPlayCount: number;
  refItem: QuestionRef;
  sessionMode: RuntimeSession["mode"];
  sessionPaused: boolean;
  onRegisterListeningPlay: (playbackKey: string) => void;
  onSelectAnswer: (answer: AnswerOptionKey) => void;
  onToggleDoubtful: () => void;
}) {
  const { listeningSet, passage, question } = refItem;
  const isActiveListeningQuestion = isListeningQuestion(question);
  const questionAudioSrc = isActiveListeningQuestion ? question.questionAudioUrl : undefined;
  const questionLayout = passage ? "reading" : listeningSet ? "listening" : "single";
  const promptInLead = questionLayout === "single";
  const usesSharedListeningAudio =
    Boolean(listeningSet) &&
    listeningSet?.part !== "A" &&
    listeningRangeStart !== undefined &&
    listeningRangeEnd !== undefined &&
    listeningRangeEnd > listeningRangeStart;
  const arcaneModeClass = passage
    ? "arcane-reading-mode"
    : listeningSet
      ? "arcane-listening-mode"
      : "arcane-structure-mode";

  return (
    <div
      className={`${passage ? "readingWorkspace" : listeningSet ? "listeningWorkspace" : "singleWorkspace"} ${arcaneModeClass}`}
      data-question-layout={questionLayout}
      data-shared-audio={usesSharedListeningAudio ? "true" : "false"}
    >
      {passage ? (
        <PassagePanel
          passage={passage}
          passageNumber={readingPassageNumber ?? 1}
        />
      ) : null}
      {usesSharedListeningAudio ? (
        <div className="listeningSharedNotice">
          <span className="listeningSharedIcon" aria-hidden="true">
            <AppIcon name="volume" />
          </span>
          <span>
            Satu audio utama digunakan untuk seluruh rangkaian soal ini.
          </span>
          <strong>
            Soal aktif: {questionNumber}
          </strong>
        </div>
      ) : null}
      <article
        className={`questionPanel arcane-question-chamber ${question.section === "structure" || question.section === "written-expression" ? "arcane-syntax-card" : ""}`}
        data-question-section={question.section}
      >
        <div className="questionHeader">
          <div>
            <p className="eyebrow">{promptInLead ? "Pilihan Jawaban" : sectionLabel(question.section)}</p>
            {!promptInLead ? <h2>{`Soal ${questionNumber}`}</h2> : null}
          </div>
          <div className="chipRow">
            {answer?.isDoubtful ? <Badge tone="warning">Ragu-ragu</Badge> : null}
          </div>
        </div>

        {listeningSet ? (
          <p className="muted">
            Audio: <strong>{cleanInlineText(listeningSet.title)}</strong> -{" "}
            {LISTENING_SOURCE_TYPE_LABELS[listeningSet.sourceType]}
          </p>
        ) : null}

        {!promptInLead ? (
          <p className="questionText">
            <QuestionPromptText question={question} />
          </p>
        ) : null}

        {questionAudioSrc ? (
          <QuestionAudioPlayer
            audioSrc={questionAudioSrc}
            canAutoplay={mainAudioCompleted || !listeningSet}
            mode={sessionMode}
            paused={sessionPaused}
            playCount={questionAudioPlayCount}
            playbackKey={listeningQuestionAudioKey(question.id)}
            onRegisterPlay={onRegisterListeningPlay}
          />
        ) : null}

        <div className="choiceList arcane-answer-list" aria-label="Pilihan jawaban">
          {ANSWER_KEYS.map((key) => {
            const isSelected = answer?.selectedAnswer === key;
            const shouldRevealAnswer = learningMode && Boolean(answer?.selectedAnswer);
            const isCorrect = shouldRevealAnswer && question.correctAnswer === key;
            const isWrongSelection = shouldRevealAnswer && isSelected && question.correctAnswer !== key;

            return (
              <button
                className={[
                  "choiceButton",
                  "arcane-answer-option",
                  isSelected ? "isSelected" : "",
                  isCorrect ? "isCorrectChoice" : "",
                  isWrongSelection ? "isWrongChoice" : "",
                ].join(" ")}
                disabled={learningMode && Boolean(answer?.selectedAnswer)}
                key={key}
                type="button"
                onClick={() => onSelectAnswer(key)}
              >
                <span className="arcane-answer-letter">{key}</span>
                <strong className="arcane-answer-text">{cleanInlineText(question.choices[key])}</strong>
              </button>
            );
          })}
        </div>

        <div className="inlineActions">
          <Button className="arcane-mark-button" icon="bookmark" variant="warning" type="button" onClick={onToggleDoubtful}>
            {answer?.isDoubtful ? "Hapus Ragu-ragu" : "Tandai Ragu-ragu"}
          </Button>
        </div>

        {learningMode && answer?.selectedAnswer ? (
          <LearningFeedback answer={answer} question={question} />
        ) : null}
      </article>
    </div>
  );
}

function PassagePanel({
  passage,
  passageNumber,
}: {
  passage: ReadingPassage;
  passageNumber: number;
}) {
  return (
    <article className="passagePanel arcane-manuscript-panel" data-reading-passage-label={`Naskah ${passageNumber}`}>
      <p className="eyebrow">Naskah {passageNumber}</p>
      <h2>{cleanInlineText(passage.title)}</h2>
      <div className="passageText arcane-manuscript-scroll">
        {cleanPassageText(passage.passage).split(/\n{2,}/).map((paragraph, index) => (
          <p key={`${passage.id}-${index}`}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}

function LearningFeedback({
  answer,
  question,
}: {
  answer: RuntimeSession["answers"][string];
  question: BankQuestion;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setIsOpen(false);
  }, [question.id]);

  const drawerRef = useFocusTrap<HTMLElement>(isOpen, () => setIsOpen(false));
  useBodyScrollLock(isOpen);

  return (
    <>
      <div
        className={`learningResultBar arcane-syntax-feedback ${answer.isCorrect ? "correct" : "wrong"}`}
        data-answer-locked="true"
      >
        <span className="learningResultStatus">
          <span className="learningResultIcon" aria-hidden="true">
            <AppIcon name="check" />
          </span>
          <span>
            <strong>{answer.isCorrect ? "Jawaban benar" : "Perlu ditinjau"}</strong>
            <small>
              Jawaban telah dikunci. Pilihanmu: {answer.selectedAnswer}. Kunci: {question.correctAnswer}.
            </small>
          </span>
        </span>
        <Button
          icon="document"
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => setIsOpen(true)}
        >
          Lihat Pembahasan
        </Button>
      </div>

      {isOpen
        ? createPortal(
            <div
              className="explanationDrawerBackdrop arcane-review-overlay"
              data-explanation-open="true"
              onMouseDown={() => setIsOpen(false)}
            >
              <aside
                aria-labelledby={titleId}
                aria-modal="true"
                className="explanationDrawer arcane-grimoire-drawer"
                data-answer-result={answer.isCorrect ? "correct" : "wrong"}
                ref={drawerRef}
                role="dialog"
                tabIndex={-1}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="explanationDrawerHeader arcane-grimoire-header">
                  <div>
                    <p className="eyebrow">Jawaban Terkunci</p>
                    <h2 id={titleId}>Pembahasan Soal</h2>
                    <p>
                      Pilihanmu <strong>{answer.selectedAnswer}</strong>
                      <span aria-hidden="true"> / </span>
                      Kunci <strong>{question.correctAnswer}</strong>
                    </p>
                  </div>
                  <Button
                    autoFocus
                    icon="arrow-right"
                    iconPosition="end"
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setIsOpen(false)}
                  >
                    Tutup
                  </Button>
                </header>
                <div className="explanationDrawerBody arcane-grimoire-body">
                  <ExplanationPanel question={question} />
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
