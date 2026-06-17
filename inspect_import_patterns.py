from __future__ import annotations

import re
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET


SW_DOCX = Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Structure and Written.docx")
READING_DOCX = Path(r"C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Reading Comprehension.docx")
WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    sw = extract_docx_paragraphs(SW_DOCX)
    reading = extract_docx_paragraphs(READING_DOCX)
    print("STRUCTURE/WRITTEN SAMPLE BLOCKS")
    print("===============================")
    for target in ["LS1", "LW1", "AS1", "AW1", "BS1", "BW1"]:
        print_block(sw, target, r"^(?:\d+\.\s*)?(LS|LW|AS|AW|BS|BW)(\d+)\b")
    print()
    print("READING SAMPLE BLOCKS")
    print("=====================")
    for target in ["GNRQ1", "VRQ1", "RQ1"]:
        print_block(reading, target, r"^([A-Z]{1,10}Q)(\d+)\b")


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
        text = re.sub(r"\s+", " ", "".join(parts)).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def print_block(paragraphs: list[str], target: str, heading_pattern: str) -> None:
    heading_re = re.compile(heading_pattern, re.I)
    starts = []
    for index, paragraph in enumerate(paragraphs):
        match = heading_re.match(paragraph)
        if match:
            current = f"{match.group(1).upper()}{match.group(2)}"
            starts.append((index, current))
    for index, current in starts:
        if current != target:
            continue
        next_index = next((candidate for candidate, _ in starts if candidate > index), len(paragraphs))
        print()
        print(f"-- {target} at {index}, length {next_index - index} paragraphs --")
        for paragraph in paragraphs[index : min(next_index, index + 45)]:
            print(paragraph)
        return
    print(f"Missing target {target}")


if __name__ == "__main__":
    main()
