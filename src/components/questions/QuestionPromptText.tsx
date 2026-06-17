import { Fragment } from "react";
import type { BankQuestion } from "../../types/questionTypes";
import { cleanInlineText } from "../../utils/displayText";

const WRITTEN_MARKER_PATTERN = /\[([A-D])\]\s*/g;

export function QuestionPromptText({ question }: { question: BankQuestion }) {
  const questionText = cleanInlineText(question.questionText);

  if (question.section === "reading") {
    return <ReadingTargetPrompt value={questionText} />;
  }

  if (question.section !== "written-expression") {
    return questionText;
  }

  const markers = [...questionText.matchAll(WRITTEN_MARKER_PATTERN)];
  if (!markers.length) return questionText;

  return (
    <>
      {questionText.slice(0, markers[0].index)}
      {markers.map((marker, index) => {
        const segmentStart = (marker.index ?? 0) + marker[0].length;
        const segmentEnd = markers[index + 1]?.index ?? questionText.length;
        const choiceText = cleanInlineText(question.choices[marker[1] as keyof typeof question.choices]);
        const markedEnd = questionText.startsWith(choiceText, segmentStart)
          ? segmentStart + choiceText.length
          : segmentEnd;

        return (
          <Fragment key={`${marker[1]}-${index}`}>
            <span className="writtenMarkedSegment">
              <span className="writtenMarker">[{marker[1]}]</span>
              {questionText.slice(segmentStart, markedEnd)}
            </span>
            {questionText.slice(markedEnd, segmentEnd)}
          </Fragment>
        );
      })}
    </>
  );
}

function ReadingTargetPrompt({ value }: { value: string }) {
  const match = value.match(/\b(?:word|phrase)\s+(["“])([^"”]+)(["”])/i);
  if (!match || match.index === undefined) return value;

  const targetStart = match.index + match[0].indexOf(match[1]);
  const targetEnd = targetStart + match[1].length + match[2].length + match[3].length;

  return (
    <>
      {value.slice(0, targetStart)}
      {match[1]}
      <em className="readingTargetTerm">{match[2]}</em>
      {match[3]}
      {value.slice(targetEnd)}
    </>
  );
}
