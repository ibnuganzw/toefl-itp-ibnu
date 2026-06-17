# Model Estimasi Skor Latihan v1

## Identitas

- Versi: `practice-linear-level1-v1`
- Metode: `internal-linear-practice-estimate`
- Komposisi yang memenuhi syarat: 50 Listening, 40 Structure & Written, dan 50 Reading
- Label UI wajib: `Estimasi Skor Simulasi TOEFL ITP`
- Sumber data: `src/data/scoreConversionTables.json`

## Batas Penggunaan

Model ini adalah kurva linear internal untuk memberi umpan balik latihan yang konsisten. Model tidak mereproduksi
equating per-form milik ETS dan tidak boleh disebut sebagai skor resmi.

Estimasi total hanya muncul untuk simulasi lengkap dengan komposisi tepat 50-40-50. Mode belajar, simulasi per bagian,
retry, latihan singkat, dan simulasi kustom yang tidak memiliki komposisi lengkap tetap menggunakan skor mentah,
akurasi, dan diagnostik.

## Kurva Bagian

Setiap kemungkinan jumlah benar memiliki nilai eksplisit dalam data berversi:

| Bagian | Raw benar | Rentang estimasi bagian |
| --- | ---: | ---: |
| Listening | 0-50 | 31-68 |
| Structure & Written | 0-40 | 31-68 |
| Reading | 0-50 | 31-67 |

Nilai antara titik minimum dan maksimum dibentuk secara linear, dibulatkan ke bilangan bulat terdekat, lalu disimpan
sebagai lookup table eksplisit agar hasil dapat diaudit dan tetap deterministik.

## Formula Total

```text
total = round((estimasi Listening + estimasi Structure/Written + estimasi Reading) x 10 / 3)
```

Formula total tidak pernah diterapkan langsung ke jumlah jawaban benar.

Titik batas yang diverifikasi:

- raw `0 / 0 / 0` menghasilkan estimasi bagian `31 / 31 / 31` dan total `310`
- raw `50 / 40 / 50` menghasilkan estimasi bagian `68 / 68 / 67` dan total `677`
- raw `25 / 20 / 25` menghasilkan estimasi bagian `50 / 50 / 49` dan total `497`

## Target Fleksibel

Target pengguna menerima bilangan bulat dalam rentang `310-677`. Perbandingan memakai hubungan estimasi terhadap
target yang sedang aktif:

```text
gap = target - estimate
gapRatio = max(gap, 0) / target
```

Kategori:

- `achieved`: estimasi mencapai atau melampaui target
- `near`: gap maksimal 8% dari target
- `progressing`: gap maksimal 18% dari target
- `far`: gap lebih besar dari 18% target

Karena kategorinya relatif, estimasi yang sama dapat menghasilkan pesan berbeda untuk target berbeda. Riwayat
menyimpan target dan hasil perbandingan yang berlaku saat simulasi selesai. Ringkasan estimasi terakhir dan terbaik
disimpan terpisah dari daftar riwayat pendek agar tidak hilang setelah banyak sesi latihan biasa.

## Verifikasi

Jalankan:

```bash
npm run verify:score-estimation
npm run typecheck
npm run build
```
