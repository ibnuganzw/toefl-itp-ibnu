from __future__ import annotations

import html
import re
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


SOURCES = [
    {
        "label": "Master spec TXT",
        "path": Path(r"C:\Users\ibnuh\.codex\attachments\ded8faea-fc12-49bd-903c-a294d3fbf8b7\pasted-text.txt"),
        "role": "master-spec",
    },
    {
        "label": "Old HTML app",
        "path": Path(r"C:\Users\ibnuh\Downloads\Test_TOEFL_revisi_FIX_kunci_C.html"),
        "role": "old-html-reference",
    },
    {
        "label": "Structure and Written DOCX",
        "path": Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Structure and Written.docx"),
        "role": "structure-written-source",
    },
    {
        "label": "Reading Comprehension DOCX",
        "path": Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Reading Comprehension.docx"),
        "role": "reading-source",
    },
]


WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def main() -> None:
    print("SOURCE INSPECTION REPORT")
    print("========================")
    for source in SOURCES:
        inspect_source(source)


def inspect_source(source: dict[str, object]) -> None:
    file_path = source["path"]
    assert isinstance(file_path, Path)

    print()
    print(f"Label: {source['label']}")
    print(f"Path: {file_path}")
    print(f"Role: {source['role']}")

    if not file_path.exists():
        print("Status: missing")
        print("Import risks: source file could not be inspected because it was not found.")
        return

    print(f"Filename: {file_path.name}")
    print(f"File type: {file_path.suffix.lower() or '(none)'}")
    print(f"Size: {file_path.stat().st_size} bytes")

    suffix = file_path.suffix.lower()
    if suffix == ".docx":
        inspect_docx(file_path)
    elif suffix in {".html", ".htm"}:
        inspect_html(file_path)
    elif suffix == ".txt":
        inspect_txt(file_path)
    else:
        print("Approximate structure: unsupported file type for this inspection pass.")
        print("Import risks: requires a separate parser.")


def inspect_txt(file_path: Path) -> None:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    print(f"Approximate structure: {len(lines)} non-empty lines, {len(text)} characters.")
    print(f"Phase headings detected: {count(text, r'PHASE\\s+\\d+')}")
    print(f"Question-bank target mentions: {count(text, r'300|180|120|15')}")
    print("Detectable counts: master spec only; not a question bank source.")
    print("Import risks: none for bank content, but the text contains project rules that must be followed.")


def inspect_html(file_path: Path) -> None:
    raw = file_path.read_text(encoding="utf-8", errors="replace")
    plain = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    plain = re.sub(r"\s+", " ", plain)

    print(f"Approximate structure: single HTML file, {len(raw)} characters.")
    print(f"Simulation A mentions: {count(raw, r'Simulation\\s*A|Simulasi\\s*A')}")
    print(f"Simulation B mentions: {count(raw, r'Simulation\\s*B|Simulasi\\s*B')}")
    print(f"Learning/belajar mentions: {count(raw, r'Mode\\s*Belajar|learning|belajar')}")
    print(f"Timer mentions: {count(raw, r'timer')}")
    print(f"Ragu/doubt mentions: {count(raw, r'ragu|doubt')}")
    print(f"Legacy LS/LW/AS/AW/BS/BW ID mentions: {count(raw, r'\\b(?:LS|LW|AS|AW|BS|BW)\\s*[-_]?\\s*\\d+\\b')}")
    print("Detectable counts: behavior/reference file only; not treated as final question-bank source.")
    print("Import risks: fixed Simulation A/B labels must remain metadata/reference only, not final app modes.")
    print(f"Text sample: {plain[:220]}")


def inspect_docx(file_path: Path) -> None:
    paragraphs = extract_docx_paragraphs(file_path)
    text = "\n".join(paragraphs)
    print(f"Approximate structure: {len(paragraphs)} non-empty paragraphs, {len(text)} extracted characters.")

    if "Structure" in file_path.name or "Written" in file_path.name:
        inspect_structure_written(text)
    elif "Reading" in file_path.name:
        inspect_reading(text)
    else:
        print("Detectable counts: DOCX extracted, but no source-specific counter was selected.")
        print("Import risks: requires manual review before import.")


def extract_docx_paragraphs(file_path: Path) -> list[str]:
    with ZipFile(file_path) as archive:
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


def inspect_structure_written(text: str) -> None:
    groups = {prefix: set() for prefix in ["LS", "LW", "AS", "AW", "BS", "BW"]}
    for line in text.splitlines():
        match = re.match(r"^(?:\d+\.\s*)?(LS|LW|AS|AW|BS|BW)(\d+)\b", line.strip(), re.I)
        if match:
            groups[match.group(1).upper()].add(int(match.group(2)))

    for prefix, values in groups.items():
        numbers = sorted(values)
        range_text = f" ({numbers[0]}-{numbers[-1]})" if numbers else ""
        print(f"{prefix} headings: {len(numbers)}{range_text}")

    structure_count = len(groups["LS"]) + len(groups["AS"]) + len(groups["BS"])
    written_count = len(groups["LW"]) + len(groups["AW"]) + len(groups["BW"])
    print(f"Detected Structure count: {structure_count}")
    print(f"Detected Written Expression count: {written_count}")
    print(f"Detected Structure + Written total: {structure_count + written_count}")
    print("Approximate document structure: premium explanation batches with legacy LS/LW/AS/AW/BS/BW item headings.")
    print(
        "Import risks: document includes notes/ranges/audit comments; choices, answer keys, explanations, traps, "
        "and quick notes need field-level validation before active import."
    )


def inspect_reading(text: str) -> None:
    question_groups: dict[str, set[int]] = {}
    passage_headings: list[str] = []

    for line in text.splitlines():
        clean = line.strip()
        if re.match(r"^Passage\s+\d+\b.+", clean, re.I):
            passage_headings.append(clean)

        match = re.match(r"^([A-Z]{2,8}Q)(\d+)\s*[-–—]\s+", clean, re.I)
        if match:
            prefix = match.group(1).upper()
            question_groups.setdefault(prefix, set()).add(int(match.group(2)))

    for prefix, values in sorted(question_groups.items()):
        numbers = sorted(values)
        range_text = f" ({numbers[0]}-{numbers[-1]})" if numbers else ""
        print(f"{prefix} question headings: {len(numbers)}{range_text}")

    total_questions = sum(len(values) for values in question_groups.values())
    print(f"Detected passage headings: {len(passage_headings)}")
    print(f"Detected Reading question total: {total_questions}")
    print("Approximate document structure: Reading passages followed by question/explanation sections.")
    print(
        "Import risks: passage heading formats vary; Reading questions must remain nested under their original "
        "passage; current detectable total does not confirm the full 15 passages / 120 questions target."
    )


def count(text: str, pattern: str) -> int:
    return len(re.findall(pattern, text, re.I))


if __name__ == "__main__":
    main()
