# Modal Pengungkapan Hasil v1

## Tujuan

Simulasi lengkap yang menghasilkan `Estimasi Skor Simulasi TOEFL ITP` memiliki momen pengungkapan khusus sebelum
pengguna membaca layar hasil lengkap. Modal ini meredupkan dan memburamkan latar agar hasil, hubungan terhadap target,
serta tindakan berikutnya terbaca jelas.

## Kapan Modal Muncul

Modal hanya muncul setelah sesi yang memenuhi syarat estimasi skor:

- simulasi lengkap 50 Listening, 40 Structure & Written, dan 50 Reading
- simulasi kustom dengan komposisi lengkap yang sama

Modal tidak muncul untuk mode belajar, retry, latihan area terlemah, simulasi per bagian, atau simulasi kustom parsial.

## Pesan Relatif

Pesan memakai hasil `compareEstimateToTarget` dan tidak memakai batas skor absolut:

- `achieved`: estimasi mencapai atau melampaui target
- `near`: jarak maksimal 8% dari target
- `progressing`: jarak maksimal 18% dari target
- `far`: jarak lebih besar dari 18% target
- `no-target`: pengguna belum menetapkan target

Angka seperti `477` atau `550` bukan aturan pesan. Estimasi yang sama dapat menghasilkan pesan berbeda ketika target
pengguna berbeda.

## Isi Wajib

- estimasi total dan per bagian
- target serta selisih relatif, jika tersedia
- pengungkapan bahwa hasil bukan skor resmi
- area penghambat utama dari diagnostik sesi
- langkah berikutnya yang menyebut area tersebut
- tindakan menuju hasil lengkap, review pembahasan, dan latihan area prioritas

## Interaksi

- tombol `Lihat Hasil Lengkap` menutup modal dan mempertahankan layar hasil
- tombol `Review Pembahasan` membuka review sesi
- tombol `Latih Area Prioritas` membuka latihan area terlemah jika data tersedia
- klik pada backdrop atau tombol `Esc` menutup modal
- modal tidak muncul kembali ketika pengguna kembali dari review ke hasil

## Verifikasi

```bash
npm run verify:result-reveal
npm run typecheck
npm run build
```
