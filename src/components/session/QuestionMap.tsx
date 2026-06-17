import { LISTENING_PART_LABELS } from "../../data/listeningBank";
import { type QuestionRef, type RuntimeSession, sectionLabel } from "../../utils/sessionEngine";

const LISTENING_MAP_LABELS = {
  A: "Part A - Short Conversations",
  B: "Part B - Longer Conversations",
  C: "Part C - Short Talks / Lectures",
} as const;

export function QuestionMap({
  refs,
  session,
  onJump,
}: {
  refs: QuestionRef[];
  session: RuntimeSession;
  onJump: (index: number) => void;
}) {
  const groups = createQuestionMapGroups(session, refs);

  return (
    <aside className="questionMap arcane-question-map" aria-label="Daftar soal">
      <div className="mapHeader arcane-question-map-header">
        <strong>Daftar Soal</strong>
        <span>{refs.length} soal</span>
      </div>
      <div className="mapGroups">
        {groups.map((group) => (
          <div className="mapGroup" key={group.id}>
            <span className="mapGroupTitle">{group.label}</span>
            <div className="mapButtons arcane-question-map-grid">
              {group.refs.map((ref) => {
                const answer = session.answers[ref.question.id];
                return (
                  <button
                    className={[
                      "mapButton",
                      "arcane-question-tile",
                      ref.globalIndex === session.currentIndex ? "current" : "",
                      answer?.selectedAnswer ? "answered" : "",
                      session.mode === "learning" && answer?.selectedAnswer && answer.isCorrect ? "correct" : "",
                      session.mode === "learning" && answer?.selectedAnswer && !answer.isCorrect ? "wrong" : "",
                      answer?.isDoubtful ? "doubtful" : "",
                    ].join(" ")}
                    data-listening-part={ref.listeningSet?.part}
                    data-listening-set-id={ref.listeningSet?.id}
                    data-question-number={ref.sectionIndex + 1}
                    key={ref.key}
                    type="button"
                    onClick={() => onJump(ref.globalIndex)}
                    title={`Soal ${ref.sectionIndex + 1}`}
                  >
                    {ref.sectionIndex + 1}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function createQuestionMapGroups(session: RuntimeSession, refs: QuestionRef[]) {
  let readingNumber = 0;
  let singleGroupNumber = 0;
  let pendingSingleRefs: QuestionRef[] = [];
  const groups: { id: string; label: string; refs: QuestionRef[] }[] = [];
  const listeningGroups = new Map<string, { id: string; label: string; refs: QuestionRef[] }>();

  const flushSingleGroup = () => {
    if (!pendingSingleRefs.length) return;
    singleGroupNumber += 1;
    const hasStructure = pendingSingleRefs.some((ref) => ref.question.section === "structure");
    const hasWritten = pendingSingleRefs.some((ref) => ref.question.section === "written-expression");
    groups.push({
      id: `single-questions-${singleGroupNumber}`,
      label:
        hasStructure && hasWritten
          ? "Structure & Written"
          : sectionLabel(pendingSingleRefs[0].question.section),
      refs: pendingSingleRefs,
    });
    pendingSingleRefs = [];
  };

  session.units.forEach((unit, unitIndex) => {
    if (unit.unitType === "single-question") {
      pendingSingleRefs.push(...refs.filter((ref) => ref.unitIndex === unitIndex));
      return;
    }

    flushSingleGroup();

    if (unit.unitType === "listening-set") {
      const part = unit.listeningSet.part;
      const existingGroup = listeningGroups.get(part);
      if (existingGroup) {
        existingGroup.refs.push(...refs.filter((ref) => ref.unitIndex === unitIndex));
        return;
      }

      const group = {
        id: `listening-part-${part}`,
        label: LISTENING_MAP_LABELS[part] ?? LISTENING_PART_LABELS[part],
        refs: refs.filter((ref) => ref.unitIndex === unitIndex),
      };
      listeningGroups.set(part, group);
      groups.push(group);
      return;
    }

    readingNumber += 1;
    groups.push({
      id: unit.id,
      label: `Naskah ${readingNumber}`,
      refs: refs.filter((ref) => ref.unitIndex === unitIndex),
    });
  });

  flushSingleGroup();

  return groups;
}
