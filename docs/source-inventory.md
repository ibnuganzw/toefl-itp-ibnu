# Source Inventory

Inventory date: 2026-06-02.

## Repository

- Workspace: `C:\Users\ibnuh\Documents\TOEFL ITP Ibnu`
- Initial state: no project files detected in the workspace before this scaffold.
- Created structure: React + Vite + TypeScript foundation with separated `src/data`, `src/types`, `src/utils`, and `scripts`.

## Old HTML App

- File: `C:\Users\ibnuh\Downloads\Test_TOEFL_revisi_FIX_kunci_C.html`
- Size: 332254 bytes.
- Role: feature and behavior reference only.
- Detected behavior indicators:
  - Simulation A mentions: 43
  - Simulation B mentions: 43
  - Learning/belajar mentions: 110
  - Timer mentions: 55
  - Ragu/doubt mentions: 6
  - Keyboard handler indicators: 1
- Import risk: the old fixed Simulation A/B model must not become the final app model. Legacy labels may be kept only as metadata.

## Structure and Written Source

- File: `C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Structure and Written.docx`
- Size: 214571 bytes.
- Preliminary DOCX paragraph extraction: 5047 non-empty paragraphs.
- Detected heading counts:
  - LS: 40
  - LW: 60
  - AS: 15
  - AW: 25
  - BS: 15
  - BW: 25
- Detected Structure count: 70 (`LS` + `AS` + `BS`)
- Detected Written count: 110 (`LW` + `AW` + `BW`)
- Detected Structure + Written total: 180
- Import risks:
  - The document contains instructional notes, ranges, and audit comments that mention IDs outside item headings.
  - Field extraction for choices, answers, explanations, traps, and quick notes still needs review before active import.
  - AS/AW/BS/BW labels must be preserved as legacy metadata, not as fixed simulation packages.

## Reading Source

- File: `C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Reading Comprehension.docx`
- Size: 207095 bytes.
- Preliminary DOCX paragraph extraction: 3044 non-empty paragraphs.
- Detected Reading groups:
  - Good News from the World: GNRQ1-GNRQ40, 5 passages.
  - Veterinary Medicine Passages: VRQ1-VRQ40, 5 passages.
  - Public reasoning / satire-style naskah set: RQ1-RQ40, 5 naskah.
- Detected passage/naskah units:
  - Passage 1 - Learning Through Play in Places Where Childhood Was Interrupted
  - Passage 2 - Malaria Vaccines and Layered Prevention
  - Passage 3 - A Teabag-Like Approach to Clean Water
  - Passage 4 - Renewable Energy as Ordinary Infrastructure
  - Passage 5 - Rewilding and the Conditions for Ecological Recovery
  - Passage 1 - When Pet Antibiotics Become a Public Health Issue
  - Passage 2 - Withdrawal Periods in Food-Producing Animals
  - Passage 3 - Biosecurity on Small Poultry Farms
  - Passage 4 - Animal Welfare as a Practical Science for Farmers
  - Passage 5 - Zoonotic Diseases in Ordinary Household and Farm Routines
  - Naskah 1 - The Village That Did Not Use Dollars
  - Naskah 2 - The Five-Thousand Currency Prophecy
  - Naskah 3 - The President Who Cheered for the Previous Leader
  - Naskah 4 - The Ministry That Asked for a Mountain
  - Naskah 5 - The Victory That Needed a Footnote
- Detected identifiable Reading question IDs: 120
- Expected initial target from master spec: 15 passages and 120 Reading questions.
- Current preliminary status: source-level scan accounts for the full 15 passage/naskah units and 120 Reading question IDs.
- Import risks:
  - Passage headings use mixed dash/range formatting.
  - The third Reading set uses `Naskah` headings and `RQ` IDs, so import logic must not rely only on `GNRQ`/`VRQ` or `Passage` headings.
  - The VRQ section includes both table-of-contents passage headings and body passage headings, so passage detection must de-duplicate headings before import.
  - Reading questions must remain nested under the original passage.
  - Full passage text, evidence locations, option analyses, TOEFL traps, and quick notes still require validated extraction.
  - Source-level counts are accounted for, but no Reading item has been promoted into the active bank yet.

## Active Bank Status

- Active Structure questions: 70
- Active Written Expression questions: 110
- Active Structure + Written questions: 180
- Active Reading passages: 15
- Active Reading questions: 120
- Total active questions: 300

Phase 4 import has promoted the validated DOCX-derived items into the active bank. `validate:bank` and strict validation confirm the initial target counts at the data-integrity level.
