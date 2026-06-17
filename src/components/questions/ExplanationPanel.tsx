import type { ReactNode } from "react";
import type {
  BankQuestion,
  ExplanationFields,
  SingleQuestion,
  WrittenExpressionQuestion,
} from "../../types/questionTypes";
import { ANSWER_KEYS } from "../../utils/sessionEngine";
import { cleanDisplayText } from "../../utils/displayText";
import { isListeningQuestion, isReadingQuestion } from "../../utils/questionGuards";

export function ExplanationPanel({
  compact = false,
  question,
}: {
  compact?: boolean;
  question: BankQuestion;
}) {
  const explanation = question.explanation;

  return (
    <section className="explanationPanel arcane-grimoire-stack">
      <h3>Pembahasan</h3>
      {question.section === "written-expression" ? (
        <WrittenCorrectionSummary question={question as WrittenExpressionQuestion} />
      ) : null}
      <ExplanationBlock label={summaryLabel(question)} value={explanation.summary} />
      <ExplanationBlock
        label={question.section === "structure" || question.section === "written-expression" ? "Cara membaca kalimat" : "Alur penalaran"}
        value={explanation.reasoning}
      />
      {!compact ? <QuestionSpecificExplanation question={question} /> : null}
      {question.section !== "structure" && question.section !== "written-expression" ? (
        <ExplanationBlock label="Mengapa kunci benar" value={explanation.whyCorrect} />
      ) : null}
      <OptionAnalysis explanation={explanation} label={optionAnalysisLabel(question)} />
      <ExplanationBlock label="Jebakan TOEFL" value={explanation.toeflTrap} />
      <ExplanationBlock label="Catatan cepat" value={explanation.quickNote} />
    </section>
  );
}

function WrittenCorrectionSummary({ question }: { question: WrittenExpressionQuestion }) {
  if (!question.incorrectPart && !question.correction && !question.correctedSentence) return null;

  return (
    <div className="writtenCorrectionSummary">
      <strong>Koreksi utama</strong>
      <dl>
        {question.incorrectPart ? (
          <div>
            <dt>Bagian salah</dt>
            <dd><InlineText value={question.incorrectPart} /></dd>
          </div>
        ) : null}
        {question.correction ? (
          <div>
            <dt>Perbaikan</dt>
            <dd><InlineText value={question.correction} /></dd>
          </div>
        ) : null}
        {question.correctedSentence ? (
          <div className="writtenCorrectionSentence">
            <dt>Kalimat benar</dt>
            <dd><InlineText value={question.correctedSentence} /></dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function summaryLabel(question: BankQuestion) {
  if (question.section === "listening") return "Inti skill";
  if (question.section === "reading") return "Inti pemahaman";
  return "Inti pola";
}

function optionAnalysisLabel(question: BankQuestion) {
  if (question.section === "written-expression") return "Analisis bagian A-D";
  if (question.section === "structure") return "Analisis pilihan";
  return "Analisis opsi";
}

function QuestionSpecificExplanation({ question }: { question: BankQuestion }) {
  if (isReadingQuestion(question)) {
    return (
      <>
        <ExplanationBlock label="Lokasi bukti" value={question.evidenceLocation} />
        <ExplanationBlock label="Bukti kunci" value={question.keyEvidence} />
        <ExplanationBlock label="Parafrase bukti" value={question.paraphrasedEvidence} />
      </>
    );
  }

  if (isListeningQuestion(question)) {
    return (
      <>
        <ExplanationBlock label="Fokus listening" value={question.listeningSkill} />
        <ExplanationBlock label="Petunjuk dengar" value={question.cue} />
      </>
    );
  }

  const single = question as SingleQuestion;
  return <ExplanationBlock label="Struktur kalimat" value={single.sentenceStructureExplanation} />;
}

function ExplanationBlock({ label, value }: { label: string; value?: string }) {
  const displayValue = cleanDisplayText(value);
  if (!displayValue) return null;
  return (
    <div className={`explanationBlock ${label === "Jebakan TOEFL" ? "arcane-toefl-trap" : ""}`}>
      <strong>{label}</strong>
      <FormattedText value={displayValue} />
    </div>
  );
}

function OptionAnalysis({ explanation, label }: { explanation: ExplanationFields; label: string }) {
  if (!explanation.optionAnalysis) return null;

  return (
    <div className="optionAnalysis arcane-option-analysis-list">
      <strong>{label}</strong>
      {ANSWER_KEYS.map((key) => {
        const displayValue = cleanDisplayText(explanation.optionAnalysis?.[key]);
        return displayValue ? (
          <div className="analysisRow arcane-option-analysis-card" key={key}>
            <span className="arcane-option-analysis-letter">{key}</span>
            <FormattedText value={displayValue} />
          </div>
        ) : null;
      })}
    </div>
  );
}

function FormattedText({ value }: { value: string }) {
  const displayValue = cleanDisplayText(value);

  return (
    <div className="formattedExplanationText">
      {displayValue.split(/\n{2,}/).map((block, index) => (
        <FormattedBlock block={block} index={index} key={`${block.slice(0, 18)}-${index}`} />
      ))}
    </div>
  );
}

function FormattedBlock({ block, index }: { block: string; index: number }) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);

  if (lines.length && lines.every((line) => /^-\s+/.test(line))) {
    return (
      <ul>
        {lines.map((line, lineIndex) => (
          <li key={`${index}-${lineIndex}`}><InlineText value={line.replace(/^-\s+/, "")} /></li>
        ))}
      </ul>
    );
  }

  if (lines.length && lines.every((line) => /^\d+[.)]\s+/.test(line))) {
    return (
      <ol>
        {lines.map((line, lineIndex) => (
          <li key={`${index}-${lineIndex}`}><InlineText value={line.replace(/^\d+[.)]\s+/, "")} /></li>
        ))}
      </ol>
    );
  }

  if (block.startsWith("> ")) {
    return <div className="explanationExample"><InlineText value={block.replace(/^>\s*/, "")} /></div>;
  }

  return (
    <p>
      {lines.map((line, lineIndex) => (
        <span key={`${index}-${lineIndex}`}>
          {lineIndex ? <br /> : null}
          <InlineText value={line} />
        </span>
      ))}
    </p>
  );
}

const GRAMMAR_TERM_PATTERN =
  /\b(subject-verb agreement|prepositional phrase|reduced (?:active|passive|adjective|relative) clause|relative clause|adjective clause|adverb clause|noun phrase|noun clause|infinitive phrase|gerund phrase|parallel structure|passive voice|active voice|present perfect|past perfect|simple present|simple past|finite verb|base verb|past participle|embedded question|head subject|countable noun|uncountable noun|singular verb|plural verb|question word)\b/gi;

function InlineText({ value }: { value: string }) {
  const tokens = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|“[^”]+”|"[^"]+")/g).filter(Boolean);

  return (
    <>
      {tokens.map((token, index) => {
        if (token.startsWith("**") && token.endsWith("**")) {
          return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith("*") && token.endsWith("*")) {
          return <em key={`${token}-${index}`}>{token.slice(1, -1)}</em>;
        }
        if (token.startsWith("`") && token.endsWith("`")) {
          return <code key={`${token}-${index}`}>{token.slice(1, -1)}</code>;
        }
        if ((token.startsWith("“") && token.endsWith("”")) || (token.startsWith('"') && token.endsWith('"'))) {
          const content = token.slice(1, -1);
          if (content.trim().split(/\s+/).length >= 2) {
            return <span key={`${token}-${index}`}>{token[0]}<em>{content}</em>{token.at(-1)}</span>;
          }
        }
        return <AutoItalicTerms key={`${token}-${index}`} value={token} />;
      })}
    </>
  );
}

function AutoItalicTerms({ value }: { value: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(GRAMMAR_TERM_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(value.slice(lastIndex, index));
    parts.push(<em key={`${match[0]}-${index}`}>{match[0]}</em>);
    lastIndex = index + match[0].length;
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));

  return <>{parts}</>;
}
