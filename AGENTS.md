# AGENTS.md

This repository is a personal TOEFL ITP / TOEFL Prediction practice app for Ibnu Hakim.

## Core Rules

- Use React + Vite + TypeScript for the app.
- Preserve premium explanations from the final question-bank documents.
- Do not rewrite, shorten, simplify, or creatively change question content.
- Final question-bank documents are the source of truth for question content.
- The old HTML file is only a feature and behavior reference.
- Keep UI labels and app text in Indonesian.
- Keep TOEFL question text and choices in English, following the source documents.
- Preserve raw/internal training scores and diagnostics as the source data for every result.
- Estimated TOEFL ITP simulation scores are allowed only when calculated from a documented, versioned, and validated
  raw-to-scaled conversion table. Always label them as estimates and never as official scores.
- Never apply the total-score formula directly to raw correct-answer counts.
- User score targets and result messages must be flexible and relative to the user's saved target, not hardcoded to
  fixed score bands.
- Keep the veterinary-academic visual identity subtle, serious, and premium.
- Prioritize correctness, maintainability, and data integrity over speed.

## Reconstruction Direction

- The splash screen is a legacy gate and must be removed during reconstruction.
- The final application opens directly into an integrated Home experience.
- The final primary navigation uses a top bar organized by user purpose, not by test section.
- Listening, Structure & Written, and Reading are second-level content categories, not final top-level navigation.
- Simulation lives in a dedicated test space.
- Home should prioritize the user's target, latest eligible estimate, active session, weakest areas, premium
  explanations, and actionable next steps.
- AI integration is deferred until deterministic scoring, target, navigation, progress, and diagnostic foundations are
  complete.

## Bank Architecture

- All active questions must come from one validated master bank.
- Structure and Written Expression questions may be flat question items.
- Reading questions must always stay nested under their original `ReadingPassage`.
- Never globally shuffle Reading questions as independent items.
- Reading passages may be shuffled as units.
- The 8 questions inside a Reading passage may be shuffled only within that same passage.
- Do not attach a Reading question to the wrong passage.
- Do not show a Reading question without its passage.
- Adding future questions should only require adding/importing data, running validation, and rebuilding.

## Legacy Source Handling

- Preserve labels such as LS, LW, AS, AW, BS, and BW only as IDs, legacy IDs, source IDs, or metadata.
- Do not restore old fixed Simulation A / Simulation B as the main app model.
- Final simulation modes should be dynamic: Structure & Written, Reading, Lengkap, and Kustom.

## Validation

- Run `npm run validate:bank` for normal integrity validation.
- Run `npm run validate:bank:strict` before claiming the initial 300-question target is complete.
- Do not claim the bank is complete unless validation confirms the actual active counts.
- If malformed or uncertain items are found, report them and keep them out of the active bank until reviewed.
