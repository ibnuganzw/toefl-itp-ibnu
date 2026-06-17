import readingPassagesJson from "./imported/readingPassages.json";
import structureQuestionsJson from "./imported/structureQuestions.json";
import writtenExpressionQuestionsJson from "./imported/writtenExpressionQuestions.json";
import { listeningSets } from "./listeningBank";
import type {
  ListeningSet,
  MasterQuestionBank,
  ReadingPassage,
  StructureQuestion,
  WrittenExpressionQuestion,
} from "../types/questionTypes";

export const questionBank: MasterQuestionBank = {
  version: "0.1.0",
  structureQuestions: structureQuestionsJson as StructureQuestion[],
  writtenExpressionQuestions: writtenExpressionQuestionsJson as WrittenExpressionQuestion[],
  readingPassages: readingPassagesJson as ReadingPassage[],
  listeningSets,
};

export function getActiveStructureQuestions(bank: MasterQuestionBank = questionBank) {
  return bank.structureQuestions.filter((question) => question.active);
}

export function getActiveWrittenExpressionQuestions(bank: MasterQuestionBank = questionBank) {
  return bank.writtenExpressionQuestions.filter((question) => question.active);
}

export function getActiveReadingPassages(bank: MasterQuestionBank = questionBank) {
  return bank.readingPassages.filter((passage) => passage.active);
}

export function getActiveReadingQuestions(bank: MasterQuestionBank = questionBank) {
  return getActiveReadingPassages(bank).flatMap((passage) =>
    passage.questions.filter((question) => question.active),
  );
}

export function getActiveListeningSets(bank: MasterQuestionBank = questionBank) {
  return bank.listeningSets.filter((set) => set.active);
}

export function getActiveListeningQuestions(bank: MasterQuestionBank = questionBank) {
  return getActiveListeningSets(bank).flatMap((set) =>
    set.questions.filter((question) => question.active),
  );
}

export function getActiveListeningSetById(id: string, bank: MasterQuestionBank = questionBank): ListeningSet | undefined {
  return getActiveListeningSets(bank).find((set) => set.id === id);
}
