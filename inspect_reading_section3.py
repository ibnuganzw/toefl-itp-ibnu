from __future__ import annotations

import re
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


READING_DOCX = Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Reading Comprehension.docx")
WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
ANSWER_RE = re.compile(r"\b(?:Jawaban benar|Correct answer|Answer)\s*:?\s*([A-D])(?:\.|\b)", re.I)
CHOICE_RE = re.compile(r"^[A-D]\.\s+")
TITLE_RE = re.compile(r"^[A-Z][A-Za-z0-9 ,:'’\-–—]+$")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    paragraphs = extract_docx_paragraphs(READING_DOCX)
    start = find_section_start(paragraphs)
    if start is None:
        print("Third Reading section start not found.")
        return

    section = paragraphs[start:]
    print("READING SECTION 3 INSPECTION")
    print("============================")
    print(f"Source: {READING_DOCX}")
    print(f"Section start index: {start}")
    print(f"Section paragraph count: {len(section)}")
    print(f"Answer markers in section: {sum(1 for line in section if ANSWER_RE.search(line))}")
    print()
    print("First 120 section paragraphs:")
    for offset, line in enumerate(section[:120]):
        print(f"[{start + offset}] {line[:260]}")
    print()
    print("Detected title/question structure:")
    print_structure(section, start)


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


def find_section_start(paragraphs: list[str]) -> int | None:
    for index, line in enumerate(paragraphs):
        if line == "TOEFL Reading Comprehension — Naskah dan Soal Final":
            return index
    return None


def print_structure(section: list[str], absolute_start: int) -> None:
    blocks: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    answer_count = 0
    question_count = 0

    for offset, line in enumerate(section):
        absolute_index = absolute_start + offset
        if is_likely_title(line, offset):
            if current:
                blocks.append(current)
            current = {"title": line, "index": absolute_index, "answers": 0, "questions": 0}
            continue

        if current is None:
            continue

        if line.endswith("?"):
            current["questions"] = int(current["questions"]) + 1
            question_count += 1
        if ANSWER_RE.search(line):
            current["answers"] = int(current["answers"]) + 1
            answer_count += 1

    if current:
        blocks.append(current)

    for block in blocks:
        print(
            f"  - [{block['index']}] {block['title']} | "
            f"question-like lines: {block['questions']} | answer markers: {block['answers']}"
        )
    print(f"Total title blocks: {len(blocks)}")
    print(f"Total question-like lines in title blocks: {question_count}")
    print(f"Total answer markers in title blocks: {answer_count}")


def is_likely_title(line: str, offset: int) -> bool:
    if offset == 0:
        return False
    if len(line) < 12 or len(line) > 100:
        return False
    if line.endswith("?") or ANSWER_RE.search(line) or CHOICE_RE.match(line):
        return False
    if line.startswith(("A.", "B.", "C.", "D.", "Jawaban", "Tipe soal", "Lokasi bukti")):
        return False
    if re.match(r"^(Bukti|Analisis|Jebakan|Catatan|Quick)", line, re.I):
        return False
    return bool(TITLE_RE.match(line))


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


if __name__ == "__main__":
    main()
