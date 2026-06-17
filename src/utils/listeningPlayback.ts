export function listeningMainAudioKey(listeningSetId: string): string {
  return `main:${listeningSetId}`;
}

export function listeningQuestionAudioKey(questionId: string): string {
  return `question:${questionId}`;
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}
