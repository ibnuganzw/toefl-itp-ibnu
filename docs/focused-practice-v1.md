# Latihan Fokus V1

## Keputusan

Kartu rekomendasi, fokus perbaikan, dan tindakan utama Beranda tidak boleh membuka latihan bagian tes secara
umum. Setiap tindakan tersebut harus membentuk sesi dari soal master bank yang cocok dengan fokus yang
ditampilkan.

## Taksonomi Kanonis

Label sumber yang berbeda dapat mewakili tipe soal yang sama. `focusedPractice.ts` mengelompokkan variasi tersebut
ke keluarga skill kanonis secara deterministik.

Contoh:

- `Subject–Verb Agreement`, `Subject–Verb Agreement with Long Modifier`, dan variasi agreement terkait menjadi
  `Subject–Verb Agreement`
- `Parallelism` dan `Parallel Structure` menjadi `Parallel Structure`
- `Implied Meaning`, `Polite Refusal`, dan variasi inferensi terkait menjadi `Implied Meaning & Inference`
- `vocabulary-in-context` dan variasi figuratifnya menjadi `Vocabulary in Context`

Structure dan Written Expression tetap dipisahkan walaupun keluarga grammar-nya sama.

## Pembentukan Sesi

- jumlah rekomendasi berasal dari sesi fokus yang benar-benar dapat dibentuk, bukan angka dekoratif
- rekomendasi dibatasi maksimal 20 soal
- soal Structure/Written dipilih sebagai item tunggal yang cocok
- soal Reading tetap berada di bawah passage asalnya
- soal Listening tetap membawa set dan audio asalnya, tetapi pertanyaan companion yang tidak cocok tidak dimasukkan;
  sesi review/retry tetap mempertahankan paket Part B/C lengkap
- sesi diberi judul `Latihan Fokus: Bagian · Keluarga Skill`

## Verifikasi

```powershell
npm run verify:focused-practice
npm run qa:design-system
```
