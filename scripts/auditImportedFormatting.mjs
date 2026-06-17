import fs from "node:fs";

const files = [
  "src/data/imported/structureQuestions.json",
  "src/data/imported/writtenExpressionQuestions.json",
  "src/data/imported/readingPassages.json",
];

const text = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const patterns = {
  literalBackref: /\$1/g,
  joinedBenar: /benar[A-Z][A-Za-zÀ-ÖØ-öø-ÿ]+/g,
  joinedSalah: /salah[A-Z][A-Za-zÀ-ÖØ-öø-ÿ]+/g,
  repeatedTOEFL: /TOEFLTOEFL/g,
  labelJoin: /(Inti pola|Struktur kalimat|Jebakan TOEFL|Catatan cepat)[A-Z]/g,
};

let total = 0;
for (const [name, pattern] of Object.entries(patterns)) {
  const matches = text.match(pattern) || [];
  total += matches.length;
  console.log(`${name}: ${matches.length}${matches.length ? ` ${matches.slice(0, 10).join("|")}` : ""}`);
}

process.exitCode = total === 0 ? 0 : 1;
