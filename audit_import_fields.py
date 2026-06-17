from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    structure = read_json("src/data/imported/structureQuestions.json")
    written = read_json("src/data/imported/writtenExpressionQuestions.json")
    reading = read_json("src/data/imported/readingPassages.json")

    issues: list[str] = []

    for item in structure:
        require(item, "grammarPattern", issues)
        require(item, "sentenceStructureExplanation", issues)
        require_explanation_fields(item, issues)

    for item in written:
        require(item, "grammarPattern", issues)
        require(item, "errorFocus", issues)
        require(item, "sentenceStructureExplanation", issues)
        require_explanation_fields(item, issues)

    for passage in reading:
        require(passage, "passage", issues)
        if len(passage.get("questions", [])) != 8:
            issues.append(f"{passage.get('id')}: expected 8 questions, found {len(passage.get('questions', []))}")
        for question in passage.get("questions", []):
            if question.get("passageId") != passage.get("id"):
                issues.append(f"{question.get('id')}: passageId mismatch")
            require(question, "questionType", issues)
            require(question, "readingSkill", issues)
            require(question, "evidenceLocation", issues)
            require(question, "keyEvidence", issues)
            require_explanation_fields(question, issues)

    print("IMPORT FIELD AUDIT")
    print("==================")
    print(f"Structure questions: {len(structure)}")
    print(f"Written questions: {len(written)}")
    print(f"Reading passages: {len(reading)}")
    print(f"Reading questions: {sum(len(passage.get('questions', [])) for passage in reading)}")
    print(f"Issues: {len(issues)}")
    for issue in issues[:120]:
        print(f"- {issue}")
    if len(issues) > 120:
        print(f"... {len(issues) - 120} more")
    sys.exit(1 if issues else 0)


def read_json(relative_path: str):
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


def require(item: dict, field: str, issues: list[str]) -> None:
    if not item.get(field):
        issues.append(f"{item.get('id', '(missing id)')}: missing {field}")


def require_explanation_fields(item: dict, issues: list[str]) -> None:
    explanation = item.get("explanation", {})
    if not explanation.get("summary"):
        issues.append(f"{item.get('id')}: missing explanation.summary")
    if not explanation.get("whyCorrect"):
        issues.append(f"{item.get('id')}: missing explanation.whyCorrect")
    option_analysis = explanation.get("optionAnalysis", {})
    for key in ["A", "B", "C", "D"]:
        if not option_analysis.get(key):
            issues.append(f"{item.get('id')}: missing option analysis {key}")
    if not explanation.get("toeflTrap"):
        issues.append(f"{item.get('id')}: missing TOEFL trap")
    if not explanation.get("quickNote"):
        issues.append(f"{item.get('id')}: missing quick note")


if __name__ == "__main__":
    main()
