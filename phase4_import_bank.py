from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parent
SW_DOCX = Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Structure and Written.docx")
READING_DOCX = Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Reading Comprehension.docx")

OUT_STRUCTURE = ROOT / "src" / "data" / "imported" / "structureQuestions.json"
OUT_WRITTEN = ROOT / "src" / "data" / "imported" / "writtenExpressionQuestions.json"
OUT_READING = ROOT / "src" / "data" / "imported" / "readingPassages.json"
OUT_REPORT = ROOT / "src" / "data" / "imported" / "importReport.json"
OUT_IMPORT_AUDIT = ROOT / "docs" / "phase4-import-report.json"

WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
ANSWER_KEYS = ["A", "B", "C", "D"]

SW_HEADING_RE = re.compile(r"^(?:\d+\.\s*)?(LS|LW|AS|AW|BS|BW)(\d+)\s+[-–—]\s+(.+)$", re.I)
READING_Q_HEADING_RE = re.compile(r"^([A-Z]{1,10}Q)(\d+)\s+[-–—]\s+(.+)$", re.I)
ANSWER_RE = re.compile(r"Jawaban benar\s*:?\s*([A-D])", re.I)
CHOICE_START_RE = re.compile(r"^([A-D])\.\s*(.*)$", re.S)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    sw_paragraphs = extract_docx_paragraphs(SW_DOCX)
    reading_paragraphs = extract_docx_paragraphs(READING_DOCX)

    structure_questions, written_questions, sw_uncertain = import_structure_written(sw_paragraphs)
    reading_passages, reading_uncertain = import_reading(reading_paragraphs)

    write_json(OUT_STRUCTURE, structure_questions)
    write_json(OUT_WRITTEN, written_questions)
    write_json(OUT_READING, reading_passages)

    report = build_import_report(
        structure_questions=structure_questions,
        written_questions=written_questions,
        reading_passages=reading_passages,
        uncertain_items=sw_uncertain + reading_uncertain,
    )
    write_json(OUT_REPORT, report)
    write_json(OUT_IMPORT_AUDIT, report)

    print("PHASE 4 IMPORT COMPLETE")
    print("=======================")
    print(f"Structure active/imported: {count_active(structure_questions)} / {len(structure_questions)}")
    print(f"Written active/imported: {count_active(written_questions)} / {len(written_questions)}")
    print(f"Reading passages active/imported: {count_active(reading_passages)} / {len(reading_passages)}")
    print(f"Reading questions active/imported: {sum(count_active(p['questions']) for p in reading_passages)} / {sum(len(p['questions']) for p in reading_passages)}")
    print(f"Uncertain or inactive items: {len(report['uncertainItems'])}")
    if report["uncertainItems"]:
        for item in report["uncertainItems"][:40]:
            print(f"- {item}")


def extract_docx_paragraphs(path: Path) -> list[str]:
    with ZipFile(path) as archive:
        document_xml = archive.read("word/document.xml")
    root = ET.fromstring(document_xml)
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", WORD_NS):
        parts: list[str] = []
        for node in paragraph.iter():
            if node.tag == f"{{{WORD_NS['w']}}}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{{{WORD_NS['w']}}}tab":
                parts.append("\t")
        text = normalize("".join(parts))
        if text:
            paragraphs.append(text)
    return paragraphs


def import_structure_written(paragraphs: list[str]) -> tuple[list[dict], list[dict], list[str]]:
    heading_indices = []
    for index, paragraph in enumerate(paragraphs):
        match = SW_HEADING_RE.match(paragraph)
        if match:
            legacy_id = f"{match.group(1).upper()}{match.group(2)}"
            heading_indices.append((index, legacy_id, match.group(1).upper(), match.group(3).strip()))

    structure: list[dict] = []
    written: list[dict] = []
    uncertain: list[str] = []

    for position, (start, legacy_id, prefix, title) in enumerate(heading_indices):
        end = heading_indices[position + 1][0] if position + 1 < len(heading_indices) else len(paragraphs)
        block = paragraphs[start:end]
        section = "structure" if prefix in {"LS", "AS", "BS"} else "written-expression"
        question, issues = parse_structure_written_block(block, legacy_id, prefix, title, section)
        if issues:
            question["active"] = False
            uncertain.append(f"{legacy_id}: {', '.join(issues)}")
        if section == "structure":
            structure.append(question)
        else:
            written.append(question)

    return structure, written, uncertain


def parse_structure_written_block(
    block: list[str],
    legacy_id: str,
    prefix: str,
    title: str,
    section: str,
) -> tuple[dict, list[str]]:
    question_text = extract_question_text(block)
    correct_answer = extract_correct_answer(block)
    choices = extract_choices(block, question_text, section)
    explanation_parts = extract_explanation_parts(block)
    option_analysis = extract_option_analysis(block)
    issues = completeness_issues(
        legacy_id,
        question_text=question_text,
        choices=choices,
        correct_answer=correct_answer,
        explanation_parts=explanation_parts,
    )

    question = {
        "id": legacy_id,
        "sourceId": f"structure-written-docx:{legacy_id}",
        "legacyId": legacy_id,
        "section": section,
        "active": not issues,
        "difficulty": "unknown",
        "questionText": question_text,
        "choices": choices,
        "correctAnswer": correct_answer or "",
        "explanation": {
            "summary": explanation_parts["summary"],
            "whyCorrect": option_analysis.get(correct_answer or "", explanation_parts["why_correct"]),
            "optionAnalysis": option_analysis,
            "toeflTrap": explanation_parts["trap"],
            "quickNote": explanation_parts["quick_note"],
            "sourceNotes": join_nonempty(block),
        },
        "tags": [prefix.lower()],
    }
    if section == "structure":
        question["grammarPattern"] = title
        question["sentenceStructureExplanation"] = explanation_parts["structure"]
    else:
        question["grammarPattern"] = title
        question["errorFocus"] = title
        question["sentenceStructureExplanation"] = explanation_parts["structure"]
    return question, issues


def import_reading(paragraphs: list[str]) -> tuple[list[dict], list[str]]:
    passage_starts = find_reading_passage_starts(paragraphs)
    passages: list[dict] = []
    uncertain: list[str] = []

    for position, passage_start in enumerate(passage_starts):
        end = passage_starts[position + 1]["index"] if position + 1 < len(passage_starts) else len(paragraphs)
        block = paragraphs[passage_start["index"] : end]
        passage, issues = parse_reading_passage_block(block, passage_start)
        if issues:
            passage["active"] = False
            uncertain.append(f"{passage['id']}: {', '.join(issues)}")
        passages.append(passage)

    return passages, uncertain


def find_reading_passage_starts(paragraphs: list[str]) -> list[dict]:
    starts: list[dict] = []
    for index, paragraph in enumerate(paragraphs):
        next_text = paragraphs[index + 1] if index + 1 < len(paragraphs) else ""

        gnr = re.match(r"^Passage\s+(\d+)\s+-\s+(.+)$", paragraph)
        if gnr:
            starts.append(
                {
                    "index": index,
                    "id": f"reading-gnrq-p{gnr.group(1)}",
                    "sourceId": f"GNRQ{(int(gnr.group(1)) - 1) * 8 + 1}-GNRQ{int(gnr.group(1)) * 8}",
                    "title": gnr.group(2).strip(),
                    "category": "Good News from the World",
                    "expectedPrefix": "GNRQ",
                }
            )
            continue

        vrq = re.match(r"^Passage\s+(\d+)\s+[—–-]\s+(.+)$", paragraph)
        if vrq and "VRQ" not in paragraph and not re.match(r"^Passage\s+\d+\s+-\s+", paragraph):
            if not next_text.startswith("Passage "):
                starts.append(
                    {
                        "index": index,
                        "id": f"reading-vrq-p{vrq.group(1)}",
                        "sourceId": f"VRQ{(int(vrq.group(1)) - 1) * 8 + 1}-VRQ{int(vrq.group(1)) * 8}",
                        "title": vrq.group(2).strip(),
                        "category": "Veterinary Medicine Passages",
                        "expectedPrefix": "VRQ",
                    }
                )
            continue

        rq = re.match(r"^Naskah\s+(\d+)\s+[—–-]\s+(.+)$", paragraph)
        if rq and not next_text.startswith("Naskah "):
            starts.append(
                {
                    "index": index,
                    "id": f"reading-rq-p{rq.group(1)}",
                    "sourceId": f"RQ{(int(rq.group(1)) - 1) * 8 + 1}-RQ{int(rq.group(1)) * 8}",
                    "title": rq.group(2).strip(),
                    "category": "Public Reasoning / Satire",
                    "expectedPrefix": "RQ",
                }
            )
    return starts


def parse_reading_passage_block(block: list[str], metadata: dict) -> tuple[dict, list[str]]:
    q_positions = [
        (index, match.group(1).upper(), int(match.group(2)), match.group(3).strip())
        for index, paragraph in enumerate(block)
        if (match := READING_Q_HEADING_RE.match(paragraph))
    ]
    passage_text_lines = []
    first_q_index = q_positions[0][0] if q_positions else len(block)
    for paragraph in block[1:first_q_index]:
        if paragraph.startswith("Soal Naskah"):
            continue
        passage_text_lines.append(paragraph)

    questions: list[dict] = []
    uncertain: list[str] = []
    for position, (start, prefix, number, q_type) in enumerate(q_positions):
        end = q_positions[position + 1][0] if position + 1 < len(q_positions) else len(block)
        q_block = block[start:end]
        question_id = f"{prefix}{number}"
        question, issues = parse_reading_question_block(
            q_block,
            question_id=question_id,
            passage_id=metadata["id"],
            question_type=q_type,
            expected_prefix=metadata["expectedPrefix"],
        )
        if issues:
            question["active"] = False
            uncertain.append(f"{question_id}: {', '.join(issues)}")
        questions.append(question)

    passage_issues = []
    if len(questions) != 8:
        passage_issues.append(f"expected 8 questions, found {len(questions)}")
    if not join_nonempty(passage_text_lines):
        passage_issues.append("missing passage text")
    if any(not question["active"] for question in questions):
        passage_issues.append("one or more nested questions are inactive/uncertain")

    passage = {
        "id": metadata["id"],
        "sourceId": metadata["sourceId"],
        "title": metadata["title"],
        "category": metadata["category"],
        "topic": metadata["category"],
        "passage": join_nonempty(passage_text_lines),
        "active": not passage_issues,
        "questions": questions,
    }
    return passage, passage_issues + uncertain


def parse_reading_question_block(
    block: list[str],
    question_id: str,
    passage_id: str,
    question_type: str,
    expected_prefix: str,
) -> tuple[dict, list[str]]:
    question_text = extract_question_text(block)
    choices = extract_choices(block, question_text, "reading")
    correct_answer = extract_correct_answer(block)
    explanation_parts = extract_explanation_parts(block)
    option_analysis = extract_option_analysis(block)
    evidence_location = extract_label_value(block, "Lokasi bukti")
    key_evidence = extract_after_heading(block, ["Bukti kunci / Parafrase bukti"], ["Inti pemahaman", "Analisis opsi"])
    source_prefix = re.match(r"^([A-Z]+Q)", question_id)
    issues = completeness_issues(
        question_id,
        question_text=question_text,
        choices=choices,
        correct_answer=correct_answer,
        explanation_parts=explanation_parts,
    )
    if source_prefix and source_prefix.group(1) != expected_prefix:
        issues.append(f"question prefix {source_prefix.group(1)} did not match expected {expected_prefix}")

    question = {
        "id": question_id,
        "sourceId": f"reading-docx:{question_id}",
        "legacyId": question_id,
        "section": "reading",
        "passageId": passage_id,
        "active": not issues,
        "difficulty": "unknown",
        "questionType": extract_label_value(block, "Tipe soal") or question_type,
        "readingSkill": slugify(extract_label_value(block, "Tipe soal") or question_type),
        "evidenceLocation": evidence_location,
        "keyEvidence": key_evidence,
        "paraphrasedEvidence": key_evidence,
        "questionText": question_text,
        "choices": choices,
        "correctAnswer": correct_answer or "",
        "explanation": {
            "summary": explanation_parts["summary"],
            "whyCorrect": option_analysis.get(correct_answer or "", explanation_parts["why_correct"]),
            "optionAnalysis": option_analysis,
            "toeflTrap": explanation_parts["trap"],
            "quickNote": explanation_parts["quick_note"],
            "sourceNotes": join_nonempty(block),
        },
        "tags": [expected_prefix.lower(), slugify(question_type)],
    }
    return question, issues


def extract_question_text(block: list[str]) -> str:
    values: list[str] = []
    for index, paragraph in enumerate(block):
        if paragraph == "Soal":
            for follow in block[index + 1 :]:
                if follow == "Pilihan" or follow.startswith("Pilihan") or follow.startswith("Jawaban benar"):
                    break
                values.append(follow)
            break
        if paragraph.startswith("Soal"):
            rest = paragraph[len("Soal") :].strip()
            if rest:
                values.append(rest)
                break
    return join_nonempty(values)


def extract_choices(block: list[str], question_text: str, section: str) -> dict[str, str]:
    if section == "written-expression":
        from_markers = extract_written_marked_choices(question_text)
        if all(from_markers.get(key) for key in ANSWER_KEYS):
            return from_markers

    choice_lines: list[str] = []
    in_choices = False
    for paragraph in block:
        if paragraph == "Pilihan":
            in_choices = True
            continue
        if paragraph.startswith("Pilihan"):
            in_choices = True
            rest = paragraph[len("Pilihan") :].strip()
            if rest:
                choice_lines.append(rest)
            continue
        if in_choices:
            if paragraph.startswith("Jawaban benar"):
                break
            choice_lines.append(paragraph)

    choices = parse_choice_lines(choice_lines)
    if section == "written-expression" and not all(choices.get(key) for key in ANSWER_KEYS):
        return extract_written_marked_choices(question_text)
    return choices


def parse_choice_lines(lines: list[str]) -> dict[str, str]:
    choices = {key: "" for key in ANSWER_KEYS}
    if not lines:
        return choices

    current_key = None
    for line in lines:
        segments = split_combined_choices(line)
        if segments:
            for key, value in segments:
                choices[key] = append_text(choices[key], value)
                current_key = key
            continue

        match = CHOICE_START_RE.match(line)
        if match:
            current_key = match.group(1)
            choices[current_key] = append_text(choices[current_key], match.group(2))
        elif current_key:
            choices[current_key] = append_text(choices[current_key], line)
    return {key: normalize(value) for key, value in choices.items()}


def split_combined_choices(text: str) -> list[tuple[str, str]]:
    normalized = normalize(text)
    matches = list(re.finditer(r"([A-D])\.\s*", normalized))
    if len(matches) < 2:
        return []
    segments: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        key = match.group(1)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        segments.append((key, normalized[start:end].strip()))
    keys = [key for key, _ in segments]
    return segments if keys == ANSWER_KEYS else []


def extract_written_marked_choices(question_text: str) -> dict[str, str]:
    choices = {key: "" for key in ANSWER_KEYS}
    matches = list(re.finditer(r"\[([A-D])\]", question_text))
    for index, match in enumerate(matches):
        key = match.group(1)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(question_text)
        choices[key] = normalize(question_text[start:end].strip())
    return choices


def extract_correct_answer(block: list[str]) -> str | None:
    for index, paragraph in enumerate(block):
        if "Jawaban benar" not in paragraph:
            continue
        match = ANSWER_RE.search(paragraph)
        if match:
            return match.group(1).upper()
        for follow in block[index + 1 : index + 3]:
            stripped = follow.strip()
            if stripped and stripped[0].upper() in ANSWER_KEYS:
                return stripped[0].upper()
    return None


def extract_explanation_parts(block: list[str]) -> dict[str, str]:
    summary = extract_after_heading(block, ["Inti pola", "Inti pemahaman"], ["Struktur kalimat", "Analisis opsi", "Analisis bagian A–D", "Analisis bagian A-D", "Jebakan TOEFL", "Catatan cepat"])
    structure = extract_after_heading(block, ["Struktur kalimat"], ["Analisis opsi", "Analisis bagian A–D", "Analisis bagian A-D", "Jebakan TOEFL", "Catatan cepat"])
    trap = extract_after_heading(block, ["Jebakan TOEFL"], ["Catatan cepat"])
    quick_note = extract_after_heading(block, ["Catatan cepat"], [])
    why_correct = summary or structure or trap or quick_note
    return {
        "summary": summary or why_correct,
        "structure": structure,
        "trap": trap,
        "quick_note": quick_note,
        "why_correct": why_correct,
    }


def extract_after_heading(block: list[str], headings: list[str], stop_headings: list[str]) -> str:
    start = None
    values: list[str] = []
    for index, paragraph in enumerate(block):
        matched_heading = matching_heading(paragraph, headings)
        if matched_heading:
            start = index + 1
            remainder = paragraph[len(matched_heading) :].lstrip(": -–—").strip()
            if remainder:
                values.append(remainder)
            break
        for heading in headings:
            if paragraph.startswith(f"{heading}:"):
                return paragraph.split(":", 1)[1].strip()
    if start is None:
        return ""

    for paragraph in block[start:]:
        if matching_heading(paragraph, stop_headings):
            break
        values.append(paragraph)
    return join_nonempty(values)


def extract_label_value(block: list[str], label: str) -> str:
    normalized_label = normalize_heading(label)
    for index, paragraph in enumerate(block):
        normalized = normalize_heading(paragraph)
        if normalized == normalized_label:
            return block[index + 1] if index + 1 < len(block) else ""
        if paragraph.startswith(f"{label}:"):
            return paragraph.split(":", 1)[1].strip()
    return ""


def extract_option_analysis(block: list[str]) -> dict[str, str]:
    start = None
    for index, paragraph in enumerate(block):
        if matching_heading(paragraph, ["Analisis opsi", "Analisis bagian A-D", "Analisis bagian A–D"]):
            start = index + 1
            break
    if start is None:
        return {}

    analysis = {key: "" for key in ANSWER_KEYS}
    current_key = None
    for paragraph in block[start:]:
        if matching_heading(paragraph, ["Jebakan TOEFL", "Catatan cepat"]):
            break
        match = CHOICE_START_RE.match(paragraph)
        if match:
            current_key = match.group(1)
            analysis[current_key] = append_text(analysis[current_key], match.group(2))
        elif current_key:
            analysis[current_key] = append_text(analysis[current_key], paragraph)
    return {key: normalize(value) for key, value in analysis.items() if normalize(value)}


def completeness_issues(
    item_id: str,
    question_text: str,
    choices: dict[str, str],
    correct_answer: str | None,
    explanation_parts: dict[str, str],
) -> list[str]:
    issues: list[str] = []
    if not question_text:
        issues.append("missing question text")
    missing_choices = [key for key in ANSWER_KEYS if not choices.get(key)]
    if missing_choices:
        issues.append(f"missing choices {','.join(missing_choices)}")
    if correct_answer not in ANSWER_KEYS:
        issues.append("missing or invalid correct answer")
    if not explanation_parts["summary"]:
        issues.append("missing explanation summary")
    if not explanation_parts["why_correct"]:
        issues.append("missing why-correct explanation")
    return issues


def build_import_report(
    structure_questions: list[dict],
    written_questions: list[dict],
    reading_passages: list[dict],
    uncertain_items: list[str],
) -> dict:
    active_reading_questions = sum(count_active(passage["questions"]) for passage in reading_passages)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "complete" if not uncertain_items else "partial",
        "sources": [
            {
                "label": "Old single-file HTML app",
                "path": r"C:\Users\ibnuh\Downloads\Test_TOEFL_revisi_FIX_kunci_C.html",
                "role": "old-html-reference",
                "parsedSafely": True,
                "notes": [
                    "Feature and behavior reference only.",
                    "Legacy Simulation A/B labels were not used as final app modes.",
                ],
            },
            {
                "label": "Final Structure and Written Expression document",
                "path": str(SW_DOCX),
                "role": "structure-written-source",
                "parsedSafely": not any(item.startswith(("LS", "LW", "AS", "AW", "BS", "BW")) for item in uncertain_items),
                "detectedCount": len(structure_questions) + len(written_questions),
                "notes": [
                    "Imported from DOCX paragraph blocks using legacy item headings.",
                    "AS/AW/BS/BW labels preserved as metadata/IDs, not fixed simulations.",
                ],
            },
            {
                "label": "Reading Comprehension document",
                "path": str(READING_DOCX),
                "role": "reading-source",
                "parsedSafely": not any(item.startswith("reading-") or re.match(r"^[A-Z]+Q\d+", item) for item in uncertain_items),
                "detectedCount": active_reading_questions,
                "notes": [
                    "Imported GNRQ1-GNRQ40, VRQ1-VRQ40, and RQ1-RQ40.",
                    "Reading questions remain nested under their original passage/naskah unit.",
                    "The RQ set uses Naskah headings.",
                ],
            },
        ],
        "importedStructureCount": count_active(structure_questions),
        "importedWrittenCount": count_active(written_questions),
        "importedReadingPassageCount": count_active(reading_passages),
        "importedReadingQuestionCount": active_reading_questions,
        "uncertainItems": uncertain_items,
        "rejectedItems": [],
        "notes": [
            "Question content was extracted from final DOCX source files.",
            "No source DOCX/HTML/TXT files were modified.",
            "Run validate:bank and validate:bank:strict after import.",
        ],
    }


def count_active(items: list[dict]) -> int:
    return sum(1 for item in items if item.get("active"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_heading(text: str) -> str:
    return normalize(text).lower().replace("–", "-")


def matching_heading(paragraph: str, headings: list[str]) -> str | None:
    normalized_paragraph = normalize_heading(paragraph)
    for heading in headings:
        normalized_heading = normalize_heading(heading)
        if normalized_paragraph == normalized_heading or normalized_paragraph.startswith(normalized_heading):
            return paragraph[: len(heading)]
    return None


def join_nonempty(values: list[str]) -> str:
    return "\n\n".join(normalize(value) for value in values if normalize(value))


def append_text(existing: str, value: str) -> str:
    return normalize(f"{existing} {value}" if existing else value)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"


if __name__ == "__main__":
    main()
