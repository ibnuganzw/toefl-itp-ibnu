# TOEFL ITP Ibnu Hakim

Personal TOEFL ITP / TOEFL Prediction practice app for Ibnu Hakim. The project is being reconstructed as one
integrated personal learning space with a validated master question bank, dynamic learning/simulation modes, Reading
passage-unit architecture, internal diagnostics, flexible score targets, and responsibly labeled simulation-score
estimates.

The app uses a validated DOCX-derived master bank with active learning, simulation, progress, diagnostics, and section-specific session workspaces.

## Tech Stack

- React
- Vite
- TypeScript
- Plain JSON imported data files
- Plain Node validation scripts
- `mammoth` for future DOCX text extraction after `npm install`

## Setup

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## Deployment

Deploy from GitHub so future bank updates can be committed, pushed, and rebuilt automatically by Vercel or Netlify.

- Build command: `npm run build`
- Output directory: `dist`
- First free web URL: `https://ibnuganzw.github.io/toefl-itp-ibnu/`
- Alternative free platform URL later: `toefl-itp-ibnu.vercel.app`
- Custom domain can be attached later from the deployment platform dashboard

See `docs/deployment.md`.

## Scripts

- `npm run dev` - start the Vite development server.
- `npm run build` - run TypeScript build checks and create a production build.
- `npm run preview` - preview the production build.
- `npm run typecheck` - run TypeScript without emitting files.
- `npm run validate:bank` - validate integrity of all currently available active questions.
- `npm run validate:bank:strict` - validate the initial release target: 180 Structure/Written questions, 120 Reading questions, and 15 Reading passages. Listening is reported separately.
- `npm run verify:listening-flow` - verify Listening Part A/B/C packet flow, full simulation section order, and active-session transcript hiding.
- `npm run verify:score-estimation` - verify versioned conversion data, eligible composition, total-score boundaries, disclosure, and flexible target behavior.
- `npm run verify:history-diagnostics` - verify diagnostic snapshots, response outcomes, pace, simulation-history retention, and enriched result surfaces.
- `npm run verify:result-reveal` - verify relative target messages, eligible-simulation gating, modal disclosure, and actionable result links.
- `npm run verify:destination-pages` - verify dedicated Explore, Collection, Test Space, and Progress foundations.
- `npm run verify:progress-illustration` - verify deterministic dynamic-progress stages, signals, SVG layers, and reduced motion.
- `npm run verify:focused-practice` - verify canonical skill families, real recommendation counts, and focused session integrity.
- `npm run generate:audio` - generate local TOEFL Listening MP3 files from `src/data/listeningScripts.ts` using the OpenAI Text-to-Speech API.
- `npm run inspect:sources` - inspect the old HTML and DOCX source files.
- `npm run import:structure-written` - detect Structure/Written headings from the DOCX source.
- `npm run import:reading` - detect Reading passage/question headings from the DOCX source.
- `npm run import:additional-banks` - idempotently import the reviewed additional Listening and Reading packages and copy their Listening audio.

## Data Structure

The current bank files live in:

- `src/data/imported/structureQuestions.json`
- `src/data/imported/writtenExpressionQuestions.json`
- `src/data/imported/readingPassages.json`
- `src/data/imported/listeningSets.json`
- `src/data/questionBank.ts`
- `src/data/listeningBank.ts`
- `src/data/listeningScripts.ts`

Data templates live in:

- `src/data/templates/structureQuestion.template.json`
- `src/data/templates/writtenExpressionQuestion.template.json`
- `src/data/templates/readingPassage.template.json`

Strict TypeScript types live in `src/types/questionTypes.ts`. Validation logic lives in `src/utils/validation.ts` and the runnable Node validator is `scripts/validateBank.mjs`.

Reading data must stay passage-based:

```ts
{
  id: "reading-passage-id",
  title: "Passage title",
  category: "Reading Comprehension",
  passage: "Full passage text",
  active: true,
  questions: [
    {
      id: "reading-question-id",
      section: "reading",
      passageId: "reading-passage-id",
      active: true
    }
  ]
}
```

Listening data must stay packet-based:

```ts
{
  id: "listening-set-id",
  part: "A" | "B" | "C",
  sourceType: "short-conversation" | "longer-conversation" | "short-talk",
  sequence: 1,
  mainAudioTitle: "Conversation or lecture title",
  mainAudioContext: "Short context shown before the main audio starts",
  audioUrl: "/audio/listening/listening-set-id.mp3",
  active: true,
  questions: [
    {
      id: "listening-question-id",
      section: "listening",
      listeningSetId: "listening-set-id",
      listeningPart: "A",
      questionAudioUrl: "/audio/listening/listening-question-id-question.mp3",
      active: true
    }
  ]
}
```

Part A sets should contain one short conversation and one question. Part B and Part C sets are audio parents for multiple related questions, so do not split their questions into standalone single-question units.

## Listening Audio Generation

Listening audio is generated locally for development and then served by React as static MP3 files. The React frontend must not call the OpenAI API.

Create a `.env` file in the project root:

```powershell
Copy-Item .env.example .env
```

Set your OpenAI API key:

```env
OPENAI_API_KEY=your_api_key_here
```

Set the TTS model from the current official OpenAI Text-to-Speech documentation:

```env
OPENAI_TTS_MODEL=check_the_current_OpenAI_TTS_model_name_in_the_official_docs
```

The generator intentionally does not hardcode a TTS model name. If `OPENAI_TTS_MODEL` is missing, it stops with an error telling you to set the currently supported OpenAI Text-to-Speech model from the official docs.

Listening script metadata lives in `src/data/listeningScripts.ts`. Each item has:

- `audioKind`, either `main` for the packet conversation/lecture or `question` for one question prompt.
- `listeningSetId` linking the generated audio to one Listening packet.
- `questionIds` linking that audio to one or more Listening question IDs.
- `segments` with speaker roles such as `narrator`, `man`, `woman`, and `lecturer`.
- `audioUrl` pointing to the static file path used by the React app.

Main audio must match the Listening set `audioUrl`/`audioSrc`. Question audio must match the related question `questionAudioUrl`.

Voice mapping is centralized in `scripts/listening-audio.config.ts`. Update narrator/man/woman/lecturer voices there, not throughout the app.

Generate audio:

```bash
npm run generate:audio
```

Useful options:

```bash
npm run generate:audio -- --force
npm run generate:audio -- --only listening-question-id
node --experimental-strip-types scripts/generate-listening-audio.ts --validate-only
```

Generated MP3 files are saved to:

```text
public/audio/listening/
```

Vite serves files in `public/` directly, so the app references them with URLs such as:

```ts
"/audio/listening/listening-set-id.mp3";
"/audio/listening/listening-question-id-question.mp3";
```

Main audio URLs are stored on the Listening set metadata. Question audio URLs are stored on the related Listening question metadata. During playback, React reads the saved MP3 from `public/audio/listening/`; it never sends the script text or API key to the browser.

For multi-speaker items, the generator creates each segment with the configured speaker voice and combines the segment MP3s into one set-level MP3. Install FFmpeg and make sure `ffmpeg` is available on `PATH` before generating multi-segment audio.

Safety notes:

- Audio is AI-generated for practice and disclosed in the Listening UI.
- Do not use or clone ETS voices.
- Do not use copyrighted TOEFL audio.
- Use only original TOEFL-style Listening scripts.

## Adding Questions

Add Structure questions to `src/data/imported/structureQuestions.json`, following `src/data/templates/structureQuestion.template.json`.

Add Written Expression questions to `src/data/imported/writtenExpressionQuestions.json`, following `src/data/templates/writtenExpressionQuestion.template.json`.

Add Reading passages to `src/data/imported/readingPassages.json`, following `src/data/templates/readingPassage.template.json`, with their Reading questions nested inside the correct passage object.

Keep newly imported or uncertain items as `"active": false` until their text, choices, answer key, explanation, and metadata have been reviewed. Only validated active items count in the app and validator.

After adding or importing data:

```bash
npm run validate:bank
npm run verify:listening-flow
npm run validate:bank:strict
npm run build
```

Normal validation checks integrity for all available active questions regardless of total count. Strict validation checks whether the initial 300-question target is complete.

## Import Workflow

The old HTML app at `C:\Users\ibnuh\Downloads\Test_TOEFL_revisi_FIX_kunci_C.html` is a behavior reference only.

The DOCX files are the question-content source of truth:

- `C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Structure and Written.docx`
- `C:\Users\ibnuh\Downloads\Soal TOEFL ITP\Reading Comprehension.docx`
- `C:\Users\ibnuh\Downloads\Audio Listening 2\TOEFL ITP Listening Comprehension Part 2 (1).docx`
- `C:\Users\ibnuh\Downloads\Reading\Revisi_Final_Reading_Comprehension_TOEFL_Style_Revised_Options_Explanations_clean.docx`
- `C:\Users\ibnuh\Downloads\TOEFL ITP Reading Comprehension 8 Soal Part 2.docx`
- `C:\Users\ibnuh\Downloads\TOEFL ITP Reading Comprehension 9 Soal Part 2.docx`

Use the import scripts to detect headings and create review reports before promoting data into the active JSON files. Do not promote uncertain items into the active bank. Preserve answer keys, choices, explanations, option analyses, TOEFL traps, quick notes, and source metadata.

Import the two additional Reading Part 2 documents with:

```bash
npm run import:additional-reading-part-2
```

## Validation Rules

The validator checks:

- active counts by section
- duplicate question IDs
- duplicate Reading passage IDs
- section mismatches between a data file and question `section`
- missing IDs
- choices A-D
- valid answer keys A-D
- required explanation fields
- Reading passage text
- exactly 8 or 9 active questions per active Reading passage
- Reading question `passageId` matches its parent passage
- Reading questions are not attached to multiple passages
- Listening set IDs and active Listening question IDs
- Listening `part`, `sourceType`, `sequence`, and audio metadata
- Part A has exactly one active question per audio set
- Listening question `listeningSetId` and `listeningPart` match the parent set
- Listening questions are not attached to multiple audio sets

## Keyboard Shortcuts

Planned quiz shortcuts:

- During quiz: `1`/`2`/`3`/`4` or `A`/`B`/`C`/`D` select answers.
- `Enter` next, `Shift+Enter` previous.
- `ArrowRight` next, `ArrowLeft` previous.
- `R` toggles ragu-ragu.
- `P` pauses or resumes timer.
- `Esc` closes modal or overlay.

Shortcuts must not fire while typing in inputs or while a paused simulation would expose content unfairly.

## Scoring

Raw score, percentage, section accuracy, and internal diagnostics remain the source data for every result.

The app displays an `Estimasi Skor Simulasi TOEFL ITP` only for an eligible complete 50-40-50 simulation. Version
`practice-linear-level1-v1` uses a documented, versioned, and validated internal linear practice curve. The total-score
formula is applied to estimated section values, never directly to raw correct-answer counts.

Estimated results must never be described as official TOEFL scores. Partial simulations and learning sessions continue
to show raw/internal results only. The current model does not reproduce ETS form equating.

The user's target score is flexible. Result messages compare the eligible estimate with the target saved at the time of
the simulation; they must not depend on hardcoded absolute score bands.

See:

- `docs/score-estimation-policy.md`
- `docs/score-estimation-v1.md`
- `docs/result-reveal-v1.md`
- `docs/splash-removal-v1.md`
- `docs/navigation.md`
- `docs/personal-home-v1.md`
- `docs/destination-pages-v1.md`
- `docs/progress-illustration-v1.md`
- `docs/reconstruction-concept.md`

## Reconstruction Direction

The app now opens directly into a personal Home with purpose-based top navigation. Explore, Collection, Test Space,
and Progress are dedicated functional pages. Test sections remain second-level categories, while simulations live in
the dedicated Test Space.

The accepted direction is:

- open directly into an integrated Home without a splash gate
- keep each top-navigation destination functionally distinct and backed by real local data
- keep Listening, Structure & Written, and Reading as second-level categories
- place simulations in a dedicated test space
- organize Home around the user's target, next action, active session, diagnostics, premium explanations, and recent
  progress
- add AI only after the deterministic reconstruction is stable

## Progress Storage

Local storage keeps active-session progress, a 30-item activity history, a dedicated 20-item simulation history,
versioned diagnostic snapshots, seen questions, and diagnostic attempts. Schema `v3` automatically migrates supported
`v1` and `v2` data.

See `docs/history-diagnostics-v1.md`.

## Current Status

The validated active bank currently contains:

- Structure: 160 active questions
- Written Expression: 215 active questions
- Structure + Written: 375 active questions
- Reading: 47 active passage/naskah units and 394 nested active questions
- Listening: 140 active audio sets and 200 nested active questions
- Total active questions: 969
