from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
FILES = [
    ROOT / "src" / "data" / "imported" / "writtenExpressionQuestions.json",
    ROOT / "src" / "data" / "imported" / "structureQuestions.json",
    ROOT / "src" / "data" / "imported" / "readingPassages.json",
]


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    for path in FILES:
        data = json.loads(path.read_text(encoding="utf-8"))
        print()
        print(path.name)
        print("=" * len(path.name))
        if "readingPassages" in path.name:
            for passage in data:
                for question in passage["questions"]:
                    if not question["active"]:
                        print_item(question)
        else:
            for item in data:
                if not item["active"]:
                    print_item(item)


def print_item(item: dict) -> None:
    print(f"\n{item['id']} active={item['active']}")
    print(f"Question: {item['questionText']}")
    print(f"Choices: {item['choices']}")
    print(f"Answer: {item['correctAnswer']}")
    print(f"Summary present: {bool(item['explanation'].get('summary'))}")


if __name__ == "__main__":
    main()
