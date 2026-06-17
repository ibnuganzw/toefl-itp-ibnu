# Halaman Tujuan V1

## Tujuan

Tahap 8 memisahkan empat tujuan utama dari Beranda menjadi halaman mandiri. Top navigation sekarang berpindah layar,
bukan menggulir ke zona Beranda. Beranda tetap menjadi briefing personal dan pratinjau tindakan paling relevan.

## Jelajahi

`Jelajahi` adalah katalog latihan dan titik penemuan konten.

- rekomendasi dibentuk dari diagnostik serta riwayat nyata
- Listening, Structure & Written, dan Reading tetap menjadi kategori tingkat kedua
- setiap kategori membuka paket belajar 25, 50, atau 100 soal
- inventaris menampilkan jumlah aktif langsung dari master bank tervalidasi
- Reading selalu diluncurkan sebagai unit passage yang tetap memiliki pertanyaannya

## Koleksi Belajar

`Koleksi Belajar` adalah ruang kembali ke objek yang perlu dipahami.

- antrean jawaban salah dibentuk dari `wrongQuestionIds` pada snapshot diagnostik
- antrean soal ragu-ragu dibentuk dari `doubtfulQuestionIds`
- soal yang sama hanya muncul sekali dalam antrean
- sesi review memakai master bank aktif sehingga kepemilikan Reading dan Listening tetap aman
- materi mandiri belum ditampilkan karena repo belum memiliki sumber materi terpisah yang tervalidasi
- pembahasan soal tetap tersedia hanya di konteks soal dan review asalnya

## Ruang Uji

`Ruang Uji` memisahkan kondisi evaluatif dari latihan biasa.

- mode standar: Structure & Written, Reading, dan Lengkap
- mode Kustom dapat mengatur komposisi serta waktu
- Listening dan Reading Kustom hanya menerima paket 0, 25, atau 50 agar struktur audio dan passage tetap valid
- paket Reading 25 memakai tiga passage utuh dengan blueprint `9 + 8 + 8`, sehingga jumlah aktualnya tepat 25 soal
- Structure dan Written menerima 0-50 soal dalam kelipatan 5
- estimasi skor hanya muncul untuk komposisi lengkap yang memenuhi kebijakan estimasi

## Perkembangan

`Perkembangan` menggabungkan angka dengan konteks.

- target skor fleksibel
- ringkasan progres dan target mingguan
- tren hasil simulasi
- diagnostik terbaru, area terlemah, serta area terkuat
- riwayat simulasi dengan snapshot per bagian

## Arsitektur Data

```text
StoredProgress + MasterQuestionBank
  -> buildDestinationPagesModel
  -> DestinationPagesModel
  -> Explore / Collection / Progress
```

Ruang Uji memakai konfigurasi sesi deterministik dari `sessionEngine`. Semua tindakan belajar dan review tetap
membuat sesi dari master bank aktif.

## Verifikasi

```powershell
npm run verify:destination-pages
npm run qa:design-system
```
