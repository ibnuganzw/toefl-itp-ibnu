import { LISTENING_PART_LABELS, LISTENING_SOURCE_TYPE_LABELS } from "../../data/listeningBank";
import type { AnswerOptionKey, BankQuestion, ListeningSet, ReadingPassage } from "../../types/questionTypes";
import { ANSWER_KEYS, type QuestionRef, type RuntimeSession, sectionLabel } from "../../utils/sessionEngine";
import { cleanDisplayText, cleanInlineText, cleanPassageText } from "../../utils/displayText";
import { ExplanationPanel } from "../questions/ExplanationPanel";
import { QuestionPromptText } from "../questions/QuestionPromptText";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export function ReviewScreen({
  refs,
  session,
  onBackToResult,
  onGoHome,
}: {
  refs: QuestionRef[];
  session: RuntimeSession;
  onBackToResult: () => void;
  onGoHome: () => void;
}) {
  const groups = session.units.map((unit, unitIndex) => ({
    unit,
    refs: refs.filter((ref) => ref.unitIndex === unitIndex),
  }));

  return (
    <main className="appShell reviewShell arcane-result-page">
      <header className="reviewHeader arcane-result-hero">
        <div>
          <p className="eyebrow">Review</p>
          <h1>Pembahasan Lengkap</h1>
          <p className="muted">{session.title}</p>
        </div>
        <div className="sessionActions">
          <Button icon="arrow-left" variant="secondary" type="button" onClick={onBackToResult}>
            Kembali ke Hasil
          </Button>
          <Button icon="home" variant="ghost" type="button" onClick={onGoHome}>
            Beranda
          </Button>
        </div>
      </header>

      <section className="reviewList arcane-review-list">
        {groups.map((group) =>
          group.unit.unitType === "reading-passage" ? (
            <div className="reviewPassageGroup" key={group.unit.id}>
              <ReviewPassageContext passage={group.unit.passage} />
              <div className="reviewPassageQuestions">
                {group.refs.map((ref) => (
                  <ReviewQuestionCard
                    answer={session.answers[ref.question.id]}
                    key={ref.key}
                    questionNumber={ref.sectionIndex + 1}
                    refItem={ref}
                  />
                ))}
              </div>
            </div>
          ) : group.unit.unitType === "listening-set" ? (
            <div className="reviewPassageGroup" key={group.unit.id}>
              <ReviewListeningContext listeningSet={group.unit.listeningSet} />
              <div className="reviewPassageQuestions">
                {group.refs.map((ref) => (
                  <ReviewQuestionCard
                    answer={session.answers[ref.question.id]}
                    key={ref.key}
                    questionNumber={ref.sectionIndex + 1}
                    refItem={ref}
                  />
                ))}
              </div>
            </div>
          ) : (
            group.refs.map((ref) => (
              <ReviewQuestionCard
                answer={session.answers[ref.question.id]}
                key={ref.key}
                questionNumber={ref.sectionIndex + 1}
                refItem={ref}
              />
            ))
          ),
        )}
      </section>
    </main>
  );
}

function ReviewQuestionCard({
  answer,
  questionNumber,
  refItem,
}: {
  answer: RuntimeSession["answers"][string] | undefined;
  questionNumber: number;
  refItem: QuestionRef;
}) {
  return (
    <article className="reviewCard arcane-review-state-card">
      <div className="questionHeader">
        <div>
          <p className="eyebrow">Soal {questionNumber}</p>
          <h2>Soal {questionNumber}</h2>
        </div>
        <div className="chipRow">
          <Badge>{sectionLabel(refItem.question.section)}</Badge>
          {answer?.isDoubtful ? <Badge tone="warning">Ragu-ragu</Badge> : null}
          <Badge tone={answer?.isCorrect ? "success" : "danger"}>
            {answer?.isCorrect ? "Benar" : "Tidak benar / kosong"}
          </Badge>
        </div>
      </div>
      {refItem.passage ? (
        <p className="muted">
          Naskah: <strong>{cleanInlineText(refItem.passage.title)}</strong>
        </p>
      ) : null}
      {refItem.listeningSet ? (
        <p className="muted">
          Audio: <strong>{cleanInlineText(refItem.listeningSet.title)}</strong> -{" "}
          {LISTENING_SOURCE_TYPE_LABELS[refItem.listeningSet.sourceType]}
        </p>
      ) : null}
      <p className="questionText">
        <QuestionPromptText question={refItem.question} />
      </p>
      <ChoiceReview question={refItem.question} selected={answer?.selectedAnswer} />
      <ExplanationPanel question={refItem.question} />
    </article>
  );
}

function ReviewListeningContext({ listeningSet }: { listeningSet: ListeningSet }) {
  return (
    <details className="reviewPassageContext arcane-manuscript-panel" open>
      <summary>
        <span>Konteks audio</span>
        <strong>{cleanInlineText(listeningSet.title)}</strong>
        <em>
          {LISTENING_PART_LABELS[listeningSet.part]} - {LISTENING_SOURCE_TYPE_LABELS[listeningSet.sourceType]}
        </em>
      </summary>
      <div className="passageText reviewPassageText arcane-manuscript-scroll">
        {cleanDisplayText(listeningSet.transcript).split(/\n{2,}/).map((paragraph, index) => (
          <p key={`${listeningSet.id}-transcript-${index}`}>{paragraph}</p>
        ))}
      </div>
    </details>
  );
}

function ReviewPassageContext({ passage }: { passage: ReadingPassage }) {
  return (
    <details className="reviewPassageContext arcane-manuscript-panel" open>
      <summary>
        <span>Konteks naskah</span>
        <strong>{cleanInlineText(passage.title)}</strong>
        <em>{cleanInlineText(passage.category)}</em>
      </summary>
      <div className="passageText reviewPassageText arcane-manuscript-scroll">
        {cleanPassageText(passage.passage).split(/\n{2,}/).map((paragraph, index) => (
          <p key={`${passage.id}-review-${index}`}>{paragraph}</p>
        ))}
      </div>
    </details>
  );
}

function ChoiceReview({
  question,
  selected,
}: {
  question: BankQuestion;
  selected?: AnswerOptionKey;
}) {
  return (
    <div className="choiceList reviewChoices arcane-answer-list">
      {ANSWER_KEYS.map((key) => (
        <div
          className={[
            "choiceButton",
            "arcane-answer-option",
            selected === key ? "isSelected" : "",
            question.correctAnswer === key ? "isCorrectChoice" : "",
          ].join(" ")}
          key={key}
        >
          <span className="arcane-answer-letter">{key}</span>
          <strong className="arcane-answer-text">{cleanInlineText(question.choices[key])}</strong>
        </div>
      ))}
    </div>
  );
}
