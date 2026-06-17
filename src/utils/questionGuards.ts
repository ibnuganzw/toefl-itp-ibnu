import type { BankQuestion, ListeningQuestion, ReadingQuestion } from "../types/questionTypes";

export function isListeningQuestion(question: BankQuestion): question is ListeningQuestion {
  return question.section === "listening";
}

export function isReadingQuestion(question: BankQuestion): question is ReadingQuestion {
  return question.section === "reading";
}
