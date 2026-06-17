from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


READING_DOCX = Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Reading Comprehension.docx")
WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

ANSWER_RE = re.compile(r"\b(?:Jawaban benar|Correct answer|Answer)\s*:?\s*([A-D])(?:\.|\b)", re.I)
Q_ID_HEADING_RE = re.compile(r"^([A-Z]{1,10}Q)(\d+)\s*[-–—]\s+(.+)", re.I)
PASSAGE_RE = re.compile(r"^Passage\s+(\d+)\b(.+)?", re.I)
KEYWORDS_RE = re.compile(r"satire|public reasoning|public|reasoning|misinformation|argument|rhetoric", re.I)


def main() -> None:
    paragraphs = extract_docx_paragraphs(READING_DOCX)
    print("READING DOCX DEEP INSPECTION")
    print("============================")
    print(f"Path: {READING_DOCX}")
    print(f"Paragraphs: {len(paragraphs)}")
    print()
    print_final_compilation_lines(paragraphs)
    print()
    print_passage_headings(paragraphs)
    print()
    print_question_id_headings(paragraphs)
    print()
    print_answer_distribution(paragraphs)
    print()
    print_keyword_hits(paragraphs)
    print()
    print_no_id_answer_contexts(paragraphs)


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


def print_final_compilation_lines(paragraphs: list[str]) -> None:
    print("Compilation/title lines:")
    for index, text in enumerate(paragraphs):
        if re.search(r"Final Compilation|Questions|Passages|TOEFL Reading|Reading Comprehension", text, re.I):
            if len(text) < 240:
                print(f"  [{index}] {text}")


def print_passage_headings(paragraphs: list[str]) -> None:
    print("Passage heading candidates:")
    candidates: list[tuple[int, str]] = []
    for index, text in enumerate(paragraphs):
        if PASSAGE_RE.match(text):
            candidates.append((index, text))
    for index, text in candidates:
        print(f"  [{index}] {text}")
    print(f"Total passage heading candidates: {len(candidates)}")
    unique_titles = unique_canonical_passage_titles(text for _, text in candidates)
    print(f"Unique canonical passage titles: {len(unique_titles)}")
    for title in unique_titles:
        print(f"  - {title}")


def print_question_id_headings(paragraphs: list[str]) -> None:
    print("Question ID heading ranges:")
    groups: dict[str, set[int]] = defaultdict(set)
    for text in paragraphs:
        match = Q_ID_HEADING_RE.match(text)
        if match:
            groups[match.group(1).upper()].add(int(match.group(2)))
    for prefix, values in sorted(groups.items()):
        numbers = sorted(values)
        print(f"  - {prefix}: {len(numbers)} ({numbers[0]}-{numbers[-1]})")
    if not groups:
        print("  - none")


def print_answer_distribution(paragraphs: list[str]) -> None:
    current_passage = "(none)"
    current_q_prefix = "(no explicit q id)"
    current_q_id = None
    by_prefix: Counter[str] = Counter()
    by_passage: Counter[str] = Counter()
    answer_total = 0

    for text in paragraphs:
        passage_match = PASSAGE_RE.match(text)
        if passage_match:
            current_passage = canonical_passage_title(text)
            current_q_prefix = "(no explicit q id)"
            current_q_id = None

        q_match = Q_ID_HEADING_RE.match(text)
        if q_match:
            current_q_prefix = q_match.group(1).upper()
            current_q_id = f"{current_q_prefix}{q_match.group(2)}"

        if ANSWER_RE.search(text):
            answer_total += 1
            by_prefix[current_q_prefix] += 1
            by_passage[current_passage] += 1

    print("Answer marker distribution:")
    print(f"  Total answer markers: {answer_total}")
    print("  By current question-ID prefix:")
    for key, value in by_prefix.items():
        print(f"    - {key}: {value}")
    print("  By nearest passage heading:")
    for key, value in by_passage.items():
        print(f"    - {key}: {value}")


def print_keyword_hits(paragraphs: list[str]) -> None:
    print("Satire/public reasoning keyword hits:")
    hits = [(index, text) for index, text in enumerate(paragraphs) if KEYWORDS_RE.search(text)]
    print(f"  Total hits: {len(hits)}")
    for index, text in hits[:80]:
        print(f"  [{index}] {text[:240]}")


def print_no_id_answer_contexts(paragraphs: list[str]) -> None:
    print("Answer markers without an active explicit question ID context:")
    current_q_id = None
    contexts: list[tuple[int, list[str]]] = []
    for index, text in enumerate(paragraphs):
        if PASSAGE_RE.match(text):
            current_q_id = None
        q_match = Q_ID_HEADING_RE.match(text)
        if q_match:
            current_q_id = f"{q_match.group(1).upper()}{q_match.group(2)}"
        if ANSWER_RE.search(text) and current_q_id is None:
            start = max(0, index - 4)
            end = min(len(paragraphs), index + 3)
            contexts.append((index, paragraphs[start:end]))
    print(f"  Count: {len(contexts)}")
    for answer_index, context in contexts[:20]:
        print(f"  -- answer paragraph index {answer_index} --")
        for line in context:
            print(f"     {line[:220]}")


def unique_canonical_passage_titles(headings: list[str] | tuple[str, ...] | object) -> list[str]:
    seen: set[str] = set()
    values: list[str] = []
    for heading in headings:
        title = canonical_passage_title(str(heading))
        if title not in seen:
            seen.add(title)
            values.append(title)
    return values


def canonical_passage_title(heading: str) -> str:
    value = re.sub(r"^Passage\s+\d+\s*[-–—]?\s*", "", heading, flags=re.I)
    value = re.sub(r"\([A-Z]{2,10}Q\d+\s*[-–—]\s*[A-Z]{0,10}Q?\d+\)", "", value, flags=re.I)
    return normalize(value)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


if __name__ == "__main__":
    main()
