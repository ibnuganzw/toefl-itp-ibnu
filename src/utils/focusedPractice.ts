import type { BankQuestion, QuestionSection } from "../types/questionTypes";

export type FocusedPracticeCategory = "grammar" | "readingSkill" | "listeningSkill";

export interface FocusedPracticeTarget {
  category: FocusedPracticeCategory;
  key: string;
  label: string;
  questionLimit: number;
  section: QuestionSection;
}

interface FocusRule {
  key: string;
  label: string;
  patterns: string[];
}

const GRAMMAR_RULES: FocusRule[] = [
  rule("subject-verb-agreement", "Subject–Verb Agreement", [
    "subject verb agreement",
    "agreement with",
    "neither nor agreement",
    "either or agreement",
    "uncountable noun agreement",
  ]),
  rule("noun-clause", "Noun Clause & Embedded Question", ["noun clause", "embedded question"]),
  rule("relative-clause", "Relative Clause", ["relative clause", "relative pronoun", "many of which", "many of whom", "whose"]),
  rule("reduced-clause", "Reduced Clause & Participial Modifier", ["reduced", "participial", "participle"]),
  rule("passive-voice", "Passive Voice", ["passive voice", "past perfect passive"]),
  rule("gerund-preposition", "Gerund after Preposition", ["gerund after preposition", "preposition gerund", "before after v ing"]),
  rule("parallel-structure", "Parallel Structure", ["parallel", "correlative conjunction"]),
  rule("inversion", "Inversion", ["inversion", "inverted"]),
  rule("conditional", "Conditional", ["conditional", "unless clause"]),
  rule("subjunctive", "Mandative Subjunctive", ["subjunctive"]),
  rule("comparison", "Comparative Structure", ["comparative", "comparison", "as as"]),
  rule("causative", "Causative", ["causative", "make object", "let object", "get object"]),
  rule("connector", "Connector & Adverb Clause", ["connector", "although", "despite", "because", "adverb clause"]),
  rule("word-form", "Word Form", ["word form", "adjective vs adverb", "noun vs adjective", "adverb after"]),
  rule("article-count-noun", "Article & Count Noun", ["article", "countable noun", "uncountable noun"]),
  rule("infinitive", "Infinitive", ["infinitive", "in order to", "enough", "too adjective"]),
  rule("modal", "Modal & Base Verb", ["modal"]),
  rule("appositive", "Appositive", ["appositive"]),
  rule("quantifier", "Quantifier", ["quantifier", "one of", "many of"]),
];

const READING_RULES: FocusRule[] = [
  rule("main-idea", "Main Idea", ["main idea"]),
  rule("stated-detail", "Stated Detail", ["stated detail"]),
  rule("vocabulary-in-context", "Vocabulary in Context", ["vocabulary in context"]),
  rule("inference", "Inference", ["inference"]),
  rule("reference", "Reference", ["reference"]),
  rule("negative-fact", "Negative Fact / EXCEPT", ["negative fact", "except"]),
  rule("rhetorical-purpose", "Rhetorical Purpose", ["rhetorical purpose"]),
  rule("author-attitude", "Author's Attitude", ["author s attitude", "author attitude"]),
  rule("author-purpose", "Author's Purpose", ["author s purpose", "author purpose"]),
  rule("sentence-simplification", "Sentence Simplification", ["sentence simplification"]),
];

const LISTENING_RULES: FocusRule[] = [
  rule("implied-meaning", "Implied Meaning & Inference", [
    "implied meaning",
    "implied agreement",
    "implied criticism",
    "implied problem",
    "polite refusal",
    "limited praise",
    "indirect disagreement",
    "inference",
  ]),
  rule("suggestion", "Suggestion & Recommendation", ["suggestion", "recommendation", "advice"]),
  rule("prediction", "Prediction & Next Action", ["prediction", "next action", "probably do", "future action"]),
  rule("purpose", "Purpose & Function", ["purpose", "function"]),
  rule("main-idea", "Main Idea & Topic", ["main idea", "main topic", "topic"]),
  rule("detail", "Detail", ["detail", "stated information"]),
  rule("attitude", "Speaker Attitude & Opinion", ["attitude", "opinion", "feeling"]),
  rule("problem-solution", "Problem & Solution", ["problem", "solution"]),
  rule("agreement", "Agreement & Disagreement", ["agreement", "disagreement"]),
  rule("request", "Request", ["request"]),
  rule("location", "Location", ["location", "where"]),
  rule("organization", "Organization", ["organization", "organized"]),
];

export function createFocusedPracticeTarget(
  question: BankQuestion,
  questionLimit = 20,
): FocusedPracticeTarget {
  const category = categoryForQuestion(question);
  const classification = classifyLabel(category, rawFocusLabel(question));
  return {
    category,
    key: classification.key,
    label: classification.label,
    questionLimit,
    section: question.section,
  };
}

export function matchesFocusedPractice(question: BankQuestion, target: FocusedPracticeTarget): boolean {
  if (question.section !== target.section || categoryForQuestion(question) !== target.category) return false;
  return classifyLabel(target.category, rawFocusLabel(question)).key === target.key;
}

export function rawFocusLabel(question: BankQuestion): string {
  if (question.section === "structure") return question.grammarPattern || question.tags?.[0] || "Structure Umum";
  if (question.section === "written-expression") {
    return question.grammarPattern || question.errorFocus || question.tags?.[0] || "Written Expression Umum";
  }
  if (question.section === "reading") return question.readingSkill || question.questionType || "Reading Skill Umum";
  return question.listeningSkill || `Listening Part ${question.listeningPart}`;
}

function categoryForQuestion(question: BankQuestion): FocusedPracticeCategory {
  if (question.section === "reading") return "readingSkill";
  if (question.section === "listening") return "listeningSkill";
  return "grammar";
}

function classifyLabel(category: FocusedPracticeCategory, value: string): { key: string; label: string } {
  const normalized = normalize(value);
  const rules = category === "grammar" ? GRAMMAR_RULES : category === "readingSkill" ? READING_RULES : LISTENING_RULES;
  const match = rules.find((item) => item.patterns.some((pattern) => normalized.includes(pattern)));
  if (match) return { key: match.key, label: match.label };

  const fallback = normalized.split(" / ")[0]?.trim() || normalized || "umum";
  return { key: fallback.replace(/\s+/g, "-"), label: humanize(fallback) };
}

function rule(key: string, label: string, patterns: string[]): FocusRule {
  return { key, label, patterns: patterns.map(normalize) };
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function humanize(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
