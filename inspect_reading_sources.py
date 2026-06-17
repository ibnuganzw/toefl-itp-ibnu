from __future__ import annotations

import html
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


SOURCES = [
    Path(r"C:\Users\ibnuh\.codex\attachments\ded8faea-fc12-49bd-903c-a294d3fbf8b7\pasted-text.txt"),
    Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Reading Comprehension.docx"),
    Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Structure and Written.docx"),
    Path(r"C:\Users\ibnuh\Downloads\Test_TOEFL_revisi_FIX_kunci_C.html"),
]


WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
QUESTION_ID_RE = re.compile(r"\b([A-Z]{1,10}Q)\s*[-_–—]?\s*(\d+)\b", re.I)
QUESTION_HEADING_RE = re.compile(r"^(?:\d+\.\s*)?([A-Z]{1,10}Q)\s*[-_–—]?\s*(\d+)\s*[-–—:]\s*(.+)", re.I)
PASSAGE_HEADING_RE = re.compile(r"^(?:Reading\s+)?Passage\s+(\d+)\b(.+)?", re.I)
NASKAH_HEADING_RE = re.compile(r"^Naskah\s+(\d+)\s*[-–—]\s+(.+)", re.I)
ANSWER_RE = re.compile(r"\b(?:Jawaban benar|Correct answer|Answer)\s*:?\s*([A-D])(?:\.|\b)", re.I)
READING_SET_HINT_RE = re.compile(
    r"(satire|public reasoning|reasoning|argument|misinformation|rhetoric|critical thinking|"
    r"animal|veterinary|good news|malaria|rewilding|renewable|antibiotics|biosecurity|zoonotic)",
    re.I,
)


@dataclass
class SourceReport:
    path: Path
    exists: bool
    file_type: str
    paragraph_count: int = 0
    char_count: int = 0
    passage_headings: list[str] | None = None
    question_headings: list[str] | None = None
    id_ranges: dict[str, list[int]] | None = None
    answer_markers: int = 0
    reading_hint_lines: list[str] | None = None
    parse_error: str | None = None


def main() -> None:
    reports = [inspect_source(path) for path in SOURCES]
    print_report(reports)


def inspect_source(path: Path) -> SourceReport:
    report = SourceReport(
        path=path,
        exists=path.exists(),
        file_type=path.suffix.lower() or "(none)",
        passage_headings=[],
        question_headings=[],
        id_ranges={},
        reading_hint_lines=[],
    )
    if not report.exists:
        return report

    try:
        if path.suffix.lower() == ".docx":
            lines = extract_docx_paragraphs(path)
            text = "\n".join(lines)
        elif path.suffix.lower() in {".html", ".htm"}:
            raw = path.read_text(encoding="utf-8", errors="replace")
            text = html.unescape(re.sub(r"<[^>]+>", "\n", raw))
            lines = [line.strip() for line in text.splitlines() if line.strip()]
        else:
            text = path.read_text(encoding="utf-8", errors="replace")
            lines = [line.strip() for line in text.splitlines() if line.strip()]
    except Exception as exc:  # noqa: BLE001 - inspection report should keep exact parser failure.
        report.parse_error = f"{type(exc).__name__}: {exc}"
        return report

    report.paragraph_count = len(lines)
    report.char_count = len(text)
    report.passage_headings = find_passage_headings(lines)
    report.question_headings = find_question_headings(lines)
    report.id_ranges = find_id_ranges(text)
    report.answer_markers = len(ANSWER_RE.findall(text))
    report.reading_hint_lines = find_reading_hint_lines(lines)
    return report


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
        text = "".join(parts).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def find_passage_headings(lines: list[str]) -> list[str]:
    headings: list[str] = []
    for line in lines:
        clean = normalize_space(line)
        if PASSAGE_HEADING_RE.match(clean):
            headings.append(clean)
        elif NASKAH_HEADING_RE.match(clean):
            headings.append(clean)
        elif re.match(r"^\d+\s+Passage\s+", clean, re.I):
            headings.append(clean)
        elif re.match(r"^[A-Z][A-Za-z ,'\-:]+\(?(?:[A-Z]{2,10}Q\d+\s*[-–—]\s*[A-Z]{0,10}Q?\d+)\)?", clean):
            headings.append(clean)
    return unique_keep_order(headings)


def find_question_headings(lines: list[str]) -> list[str]:
    headings: list[str] = []
    for line in lines:
        clean = normalize_space(line)
        if QUESTION_HEADING_RE.match(clean):
            headings.append(clean)
        elif re.match(r"^(?:Question|Soal)\s+\d+\b", clean, re.I):
            headings.append(clean)
    return unique_keep_order(headings)


def find_id_ranges(text: str) -> dict[str, list[int]]:
    ranges: dict[str, set[int]] = defaultdict(set)
    for match in QUESTION_ID_RE.finditer(text):
        ranges[match.group(1).upper()].add(int(match.group(2)))
    return {prefix: sorted(values) for prefix, values in sorted(ranges.items())}


def find_reading_hint_lines(lines: list[str]) -> list[str]:
    hints: list[str] = []
    for line in lines:
        clean = normalize_space(line)
        if READING_SET_HINT_RE.search(clean):
            hints.append(clean)
    return unique_keep_order(hints[:80])


def unique_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        unique.append(item)
    return unique


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def format_range(numbers: list[int]) -> str:
    if not numbers:
        return "0"
    missing = [number for number in range(numbers[0], numbers[-1] + 1) if number not in set(numbers)]
    missing_text = f", missing {missing}" if missing else ""
    return f"{len(numbers)} ({numbers[0]}-{numbers[-1]}{missing_text})"


def print_report(reports: list[SourceReport]) -> None:
    print("READING SOURCE MISMATCH INSPECTION")
    print("==================================")
    for report in reports:
        print()
        print(f"File: {report.path}")
        print(f"Detected filename: {report.path.name}")
        print(f"File type: {report.file_type}")
        print(f"Exists: {report.exists}")
        if not report.exists:
            print("Status: missing")
            continue
        if report.parse_error:
            print(f"Status: unparseable: {report.parse_error}")
            continue
        print(f"Approximate structure: {report.paragraph_count} text blocks, {report.char_count} characters")
        print(f"Passage-like headings detected: {len(report.passage_headings or [])}")
        for heading in (report.passage_headings or [])[:30]:
            print(f"  - {heading[:220]}")
        print("Question ID ranges detected:")
        if report.id_ranges:
            for prefix, numbers in report.id_ranges.items():
                print(f"  - {prefix}: {format_range(numbers)}")
        else:
            print("  - none")
        print(f"Question-heading-like lines detected: {len(report.question_headings or [])}")
        for heading in (report.question_headings or [])[:30]:
            print(f"  - {heading[:220]}")
        print(f"Answer markers detected: {report.answer_markers}")
        print("Reading/public reasoning hint lines:")
        for hint in (report.reading_hint_lines or [])[:20]:
            print(f"  - {hint[:220]}")

    reading_doc_reports = [report for report in reports if report.path.name.lower().endswith(".docx")]
    all_reading_ids: dict[str, set[int]] = defaultdict(set)
    all_passage_headings: list[str] = []
    unparseable = []
    missing = []
    for report in reports:
        if not report.exists:
            missing.append(str(report.path))
        if report.parse_error:
            unparseable.append(f"{report.path}: {report.parse_error}")
        for prefix, numbers in (report.id_ranges or {}).items():
            if prefix.endswith("Q"):
                all_reading_ids[prefix].update(numbers)
        all_passage_headings.extend(report.passage_headings or [])

    print()
    print("SUMMARY")
    print("=======")
    print("All Reading question ID ranges detected across inspected files:")
    total = 0
    for prefix, values in sorted(all_reading_ids.items()):
        numbers = sorted(values)
        total += len(numbers)
        print(f"  - {prefix}: {format_range(numbers)}")
    print(f"Total unique question IDs with *Q prefix: {total}")
    raw_unique_headings = unique_keep_order(all_passage_headings)
    canonical_units = unique_keep_order([canonical_reading_unit_heading(item) for item in raw_unique_headings])
    print(f"Total raw unique passage-like headings across inspected files: {len(raw_unique_headings)}")
    print(f"Total de-duplicated Reading passage/naskah units: {len(canonical_units)}")
    for unit in canonical_units:
        print(f"  - {unit}")
    print(f"Full 15 passages / 120 Reading questions accounted for: {'YES' if total >= 120 and len(canonical_units) >= 15 else 'NO'}")
    if missing:
        print("Missing files:")
        for item in missing:
            print(f"  - {item}")
    if unparseable:
        print("Unparseable files:")
        for item in unparseable:
            print(f"  - {item}")
    if reading_doc_reports:
        print("DOCX files inspected for Reading candidates:")
        for report in reading_doc_reports:
            print(f"  - {report.path.name}")


def canonical_reading_unit_heading(text: str) -> str:
    value = normalize_space(text)
    value = re.sub(r"^(Passage|Naskah)\s+\d+\s*[-–—]\s*", "", value, flags=re.I)
    value = re.sub(r"\([A-Z]{1,10}Q\d+\s*[-–—]\s*[A-Z]{0,10}Q?\d+\)", "", value, flags=re.I)
    return normalize_space(value)


if __name__ == "__main__":
    main()
