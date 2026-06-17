# Riwayat Simulasi dan Diagnostik v1

## Tujuan

Riwayat tidak hanya menyimpan judul, akurasi, dan durasi. Setiap sesi baru menyimpan snapshot diagnostik mandiri agar
hasil lama tetap dapat dijelaskan walaupun target pengguna, bank soal, atau logika rekomendasi berubah.

## Penyimpanan

- Schema local storage: `toefl-itp-ibnu-progress-v3`
- Riwayat aktivitas umum: maksimal 30 sesi
- Riwayat simulasi khusus: maksimal 20 simulasi
- Snapshot diagnostik: `session-diagnostic-v1`
- Schema `v1` dan `v2` dimigrasikan otomatis

Riwayat simulasi mencakup simulasi lengkap maupun simulasi per bagian. Hanya simulasi lengkap yang memenuhi syarat
50-40-50 yang memperoleh estimasi skor total.

## Isi Snapshot Diagnostik

Setiap sesi baru menyimpan:

- ringkasan total soal, terjawab, benar, salah, kosong, dan ragu-ragu
- akurasi dan completion rate
- durasi serta rata-rata detik per jawaban
- ID soal salah, ragu-ragu, dan kosong
- diagnostik per bagian
- diagnostik pola grammar
- diagnostik skill Reading
- diagnostik skill Listening
- lima area terlemah dan lima area terkuat

Setiap area diagnostik menyimpan total soal, jumlah terjawab, benar, salah, kosong, ragu-ragu, akurasi, dan completion
rate. Akurasi dihitung dari soal yang dijawab; completion rate dihitung dari seluruh soal pada area tersebut.

## Ketahanan Data

- Snapshot tidak menyimpan ulang teks soal atau pembahasan premium.
- ID outcome disimpan agar kelak dapat membuka latihan ulang dari riwayat.
- Snapshot lama yang tidak lengkap tetap dapat ditampilkan sebagai riwayat dasar.
- Snapshot dengan struktur tidak valid dibuang saat normalisasi storage.
- Riwayat simulasi khusus tidak tenggelam ketika pengguna menyelesaikan banyak sesi belajar.

## Tampilan

Beranda menampilkan tiga simulasi terbaru. Setiap item dapat dibuka untuk melihat diagnostik per bagian, estimasi atau
akurasi, hubungan terhadap target, dan area prioritas.

Layar hasil sesi menampilkan:

- ringkasan respons lengkap
- diagnostik per bagian
- area prioritas
- kekuatan utama

Analitik lintas banyak sesi tetap direncanakan untuk halaman `Perkembangan`.

## Verifikasi

```bash
npm run verify:history-diagnostics
npm run verify:home-dashboard
npm run typecheck
npm run build
```
