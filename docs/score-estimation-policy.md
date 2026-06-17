# Kebijakan Target dan Estimasi Skor TOEFL ITP

## Tujuan

Kebijakan ini mengizinkan aplikasi menampilkan estimasi skor simulasi TOEFL ITP secara bertanggung jawab tanpa
mengklaim hasil tersebut sebagai skor resmi.

## Istilah Wajib

| Istilah | Makna |
| --- | --- |
| Skor mentah | Jumlah jawaban benar pada suatu bagian atau sesi. |
| Akurasi | Persentase jawaban benar dari soal yang dijawab. |
| Scaled section estimate | Estimasi nilai bagian yang diperoleh melalui model konversi latihan terdokumentasi. |
| Estimasi skor simulasi TOEFL ITP | Hasil kalkulasi internal dari simulasi lengkap menggunakan tabel konversi yang disetujui. |
| Skor resmi | Skor yang diterbitkan oleh penyelenggara tes resmi. Aplikasi tidak menghasilkan skor resmi. |
| Target skor | Sasaran pribadi yang ditentukan pengguna. |

UI harus memakai label `Estimasi Skor Simulasi TOEFL ITP` atau bentuk ringkas yang tetap memuat kata `Estimasi`.
UI tidak boleh menyebut hasil aplikasi sebagai `Skor Resmi TOEFL`.

## Syarat Estimasi Skor

Estimasi skor hanya boleh diimplementasikan dan ditampilkan jika seluruh syarat berikut terpenuhi:

1. Tersedia model konversi raw-to-section-estimate untuk Listening, Structure & Written, dan Reading.
2. Dasar model dicatat secara eksplisit, termasuk apakah model berasal dari tabel eksternal atau kurva latihan
   internal.
3. Tabel disimpan sebagai data berversi dan dapat diaudit, bukan sebagai rangkaian angka tersembunyi di komponen UI.
4. Pengujian otomatis memverifikasi titik batas, nilai minimum, nilai maksimum, dan contoh kalkulasi.
5. UI menjelaskan bahwa hasil adalah estimasi latihan, bukan hasil resmi.

Jika model memakai kurva latihan internal, UI dan dokumentasi tidak boleh menyebutnya sebagai reproduksi equating
ETS. Jika model konversi belum tersedia atau belum disetujui, aplikasi hanya menampilkan skor mentah, akurasi, dan
diagnostik internal.

## Simulasi yang Memenuhi Syarat

Estimasi skor total hanya dapat dihitung dari simulasi lengkap yang memenuhi komposisi dan aturan waktu yang
ditetapkan oleh konfigurasi simulasi lengkap aplikasi.

Sesi berikut tidak menghasilkan estimasi skor total:

- mode belajar
- latihan singkat
- retry soal salah atau ragu-ragu
- latihan area terlemah
- simulasi bagian tunggal
- simulasi kustom yang tidak memenuhi komposisi lengkap
- simulasi yang tidak memiliki seluruh data bagian yang dibutuhkan

Sesi tersebut tetap menghasilkan skor mentah, akurasi, dan diagnostik.

## Kalkulasi

Urutan kalkulasi wajib:

```text
jumlah benar per bagian
-> lookup tabel estimasi per bagian
-> estimasi bagian Listening + Structure/Written + Reading
-> jumlah estimasi bagian x 10 / 3
-> pembulatan sesuai kebijakan tabel konversi yang disetujui
```

Formula total tidak boleh diterapkan langsung pada jumlah jawaban benar.

Setiap hasil estimasi harus menyimpan:

- versi tabel konversi
- skor mentah setiap bagian
- estimasi nilai setiap bagian
- estimasi skor total
- target yang berlaku saat sesi selesai
- selisih terhadap target
- waktu penyelesaian
- identitas konfigurasi simulasi

## Target Skor Fleksibel

- Target ditentukan pengguna dan dapat diubah.
- Tidak ada target produk yang dipatok permanen ke angka seperti `550`.
- Target baru berlaku untuk perbandingan berikutnya.
- Riwayat simulasi menyimpan snapshot target saat simulasi selesai.
- Jika belum ada target, Beranda meminta pengguna menetapkannya tanpa menghalangi latihan.
- Rentang input target harus mengikuti rentang yang didukung oleh tabel konversi yang disetujui.

## Pesan Relatif terhadap Target

Pesan hasil tidak boleh menggunakan batas hasil absolut sebagai aturan utama.

Gunakan nilai relatif:

```text
gap = targetScore - estimatedScore
achievementRatio = estimatedScore / targetScore
gapRatio = max(gap, 0) / targetScore
```

Kategori pesan dibentuk dari hubungan hasil terhadap target:

- target terlampaui atau tercapai
- sangat dekat dengan target
- masih membutuhkan perbaikan berarti
- masih jauh dari target

Ambang kategori harus menjadi konfigurasi produk yang terdokumentasi dan diuji. Contoh angka dalam percakapan atau
desain tidak boleh berubah menjadi aturan keras tanpa keputusan tersendiri.

Pesan dapat memiliki beberapa gaya nada, termasuk gaya personal atau roasting. Terlepas dari gaya nada, setiap hasil
wajib menampilkan:

- estimasi dan target
- selisih
- area penghambat utama
- satu atau lebih tindakan berikutnya

Implementasi pesan pengungkapan hasil berada di `docs/result-reveal-v1.md`. Pesan ditentukan secara deterministik dari
status perbandingan target dan tidak mengubah angka estimasi.

## Hubungan Target dan Ilustrasi Progres

Jika ilustrasi progres memakai target skor sebagai input:

- sumber progres harus dijelaskan
- ilustrasi tidak boleh menjadi satu-satunya representasi progres
- perubahan target harus mengkalibrasi ilustrasi tanpa mengubah riwayat hasil lama
- kondisi tanpa hasil simulasi harus memiliki tampilan dasar yang valid

## Larangan

- Mengklaim estimasi sebagai skor resmi.
- Menyembunyikan dasar atau batas penggunaan model konversi.
- Menggunakan formula total langsung pada raw score.
- Menampilkan estimasi total untuk sesi yang tidak memenuhi syarat.
- Mengubah angka estimasi menggunakan AI.
- Membiarkan AI menentukan apakah target tercapai.
- Mengganti atau menyembunyikan skor mentah dan diagnostik sumber.

## Status Implementasi

Versi `practice-linear-level1-v1` telah aktif sebagai estimasi latihan internal. Versi ini memakai tabel linear
eksplisit untuk komposisi lengkap 50 Listening, 40 Structure & Written, dan 50 Reading. Model ini bukan tabel equating
ETS dan tidak menghasilkan skor resmi.

Data berversi berada di `src/data/scoreConversionTables.json`. Aturan dan batasnya dijelaskan di
`docs/score-estimation-v1.md` serta diverifikasi oleh `npm run verify:score-estimation`.
