export function cleanDisplayText(value?: string): string {
  if (!value?.trim()) return "";
  return stripLeadingAnswerJudgment(normalizeDisplayArtifacts(value))
    .replace(
      /(?:^|\n{2,})(?:Evaluasi (?:Batch|Singkat|Akhir)|Penutup Batch|Catatan untuk Integrasi|Revisi Premium)[\s\S]*$/i,
      "",
    )
    .replace(
      /(?:^|\n{2,})(?:TOEFL Reading Comprehension|Batch \d+|Format: Naskah|Daftar Naskah|Isi Dokumen|Veterinary Medicine Passages)[\s\S]*$/i,
      "",
    )
    .trim();
}

function stripLeadingAnswerJudgment(value: string): string {
  return value
    .split(/\n{2,}/)
    .map(stripParagraphJudgments)
    .join("\n\n");
}

const LEADING_JUDGMENT_PATTERNS = [
  /^\s*(?:[A-D]\s*[.)]\s*)?(?:opsi\s+ini\s+)?(?:tidak\s+)?(?:benar|salah)(?:\s+sebagai\s+jawaban\s+except)?(?:(?:\s+karena\s+)|\s*(?:[.!,:;]|[-\u2013\u2014])+\s*)/i,
  /^\s*(?:[A-D]\s*[.)]\s*)?[^.!?\n]{1,140}?\s*[-\u2013\u2014]+\s*(?:tidak\s+)?(?:benar|salah)(?:\s+sebagai\s+jawaban\s+except)?(?:(?:\s+karena\s+)|\s*(?:[.!,:;]|[-\u2013\u2014])+\s*)/i,
  /^\s*(?:[A-D]\s*[.)]\s*)?[^,.!?;:\n]{1,100}?\s+(?:tidak\s+)?(?:benar|salah)(?:\s+sebagai\s+jawaban\s+except)?\s+karena\s+/i,
];

function stripParagraphJudgments(paragraph: string): string {
  let cleaned = paragraph.trimStart();
  let previous = "";

  while (cleaned !== previous) {
    previous = cleaned;
    for (const pattern of LEADING_JUDGMENT_PATTERNS) {
      cleaned = cleaned.replace(pattern, "").trimStart();
    }
  }

  return restoreSentenceCase(cleaned);
}

function restoreSentenceCase(value: string): string {
  if (!value) return value;
  const firstLetterIndex = value.search(/[A-Za-z\u00C0-\u00FF]/);
  if (firstLetterIndex < 0) return value;
  return `${value.slice(0, firstLetterIndex)}${value[firstLetterIndex].toUpperCase()}${value.slice(
    firstLetterIndex + 1,
  )}`;
}

export function cleanInlineText(value: string): string {
  return normalizeDisplayArtifacts(value).trim();
}

export function cleanPassageText(value: string): string {
  let displayValue = normalizeDisplayArtifacts(value).trim();
  const naskahMatch = displayValue.match(/(?:^|\n{2,})Naskah\s*\n{2,}/i);

  if (naskahMatch?.index !== undefined) {
    displayValue = displayValue.slice(naskahMatch.index + naskahMatch[0].length);
  }

  return displayValue
    .replace(
      /^(?:(?:Subtopik singkat|Topik|Kategori|Category|Topic|Format|Passage|Naskah)\s*:?[^\n]*\n{1,2})+/i,
      "",
    )
    .replace(/\n{2,}(?:Soal dan Pembahasan|Questions? and Explanations?)[\s\S]*$/i, "")
    .trim();
}

function normalizeDisplayArtifacts(value: string): string {
  return value
    .replace(/\u00c2\u00b7/g, " - ")
    .replace(/\u00c2/g, "")
    .replace(/\u00e2\u20ac[\u009c\u009d\u0152\u0153]/g, '"')
    .replace(/\u00e2\u20ac[\u02dc\u2122]/g, "'")
    .replace(/\u00e2\u20ac[\u201c\u201d]/g, "-")
    .replace(/\u00e2\u20ac\u00a6/g, "...")
    .replace(/\u00e2\u2020\u2019/g, "->");
}
