# Keputusan Konsep Rekonstruksi Aplikasi

## Status

Dokumen ini mencatat arah produk yang telah disepakati sebelum rekonstruksi antarmuka dimulai.

Dokumen konsep eksternal `Konsep Aplikasi TOEFL Ibnu Hakim.docx` digunakan sebagai bahan pemikiran, bukan
spesifikasi yang harus diikuti secara harfiah. Keputusan di bawah ini merupakan sintesis dari dokumen tersebut,
pembahasan produk, aturan bank soal, dan kemampuan teknis aplikasi saat ini.

## Tesis Produk

Aplikasi harus terasa sebagai satu ruang belajar personal milik Ibnu Hakim, bukan kumpulan gerbang menuju mode
latihan.

Beranda adalah aplikasi itu sendiri. Ketika aplikasi dibuka, pengguna langsung tiba di Beranda tanpa splash screen,
tombol masuk, atau langkah transaksional lain.

Identitas akademik kedokteran hewan, ilustrasi, target belajar, aktivitas, dan rekomendasi harus menyatu di dalam
pengalaman utama. Keindahan visual memiliki fungsi emosional yang sah selama tidak mengaburkan informasi atau
menghambat penggunaan.

## Keputusan Arsitektur

### 1. Splash Screen Dihapus

- Splash screen yang berdiri sendiri akan dihapus.
- Identitas `Latihan TOEFL ITP Ibnu Hakim` dan ilustrasi veteriner dilebur ke Beranda.
- Aplikasi selalu membuka tujuan utama terakhir yang aman. Secara default, aplikasi membuka Beranda.

### 2. Navigasi Utama Menggunakan Top Bar

- Sidebar bukan arsitektur navigasi final.
- Navigasi utama menggunakan top bar yang terasa seperti navigasi sebuah platform belajar.
- Navigasi utama mengelompokkan ruang berdasarkan tujuan pengguna, bukan berdasarkan bagian tes.
- Top bar dapat disembunyikan selama sesi aktif agar ruang pengerjaan tetap fokus.

Tujuan navigasi tingkat pertama yang diterima:

| Tujuan | Fungsi |
| --- | --- |
| Beranda | Menyintesis kondisi belajar dan tindakan paling relevan saat ini. |
| Jelajahi | Menemukan latihan, materi, passage, dan pembahasan berdasarkan kebutuhan. |
| Koleksi | Menyimpan serta membuka kembali objek belajar pribadi. |
| Ruang Uji | Memulai simulasi dan memasuki kondisi pengerjaan evaluatif. |
| Perkembangan | Meninjau target, hasil simulasi, tren, riwayat, dan diagnostik mendalam. |

Nama label dapat dipoles selama implementasi, tetapi pemisahan fungsi antarruang tidak boleh hilang.

### 3. Bagian Tes Menjadi Taksonomi Tingkat Kedua

`Listening`, `Structure & Written`, dan `Reading` adalah jenis konten atau filter, bukan tujuan navigasi utama.

- Ketiganya terutama ditemukan melalui `Jelajahi`.
- Ketiganya dapat muncul sebagai rekomendasi kontekstual di Beranda, Koleksi, dan Perkembangan.
- `Simulasi` ditempatkan di `Ruang Uji` karena membutuhkan komitmen dan kondisi mental yang berbeda dari latihan.

### 4. Beranda Berpusat pada Tindakan

Setiap blok Beranda harus menjawab setidaknya satu pertanyaan:

- Apa yang sebaiknya dikerjakan sekarang?
- Mengapa hal tersebut perlu dikerjakan?
- Seberapa dekat Ibnu dengan target?
- Apa yang paling menghambat perkembangan?
- Apa langkah berikutnya yang dapat langsung dilakukan?

Susunan konseptual Beranda:

1. Sapaan dan identitas visual terintegrasi.
2. Target skor, estimasi simulasi terakhir atau terbaik, dan jarak menuju target.
3. Satu tindakan utama: melanjutkan sesi atau menjalankan rekomendasi paling relevan.
4. Area terlemah yang membuka latihan spesifik, bukan hanya bagian tes umum.
5. Umpan pembahasan premium dari bank soal sebagai materi bacaan nyata.
6. Aktivitas serta hasil simulasi terbaru.
7. Ilustrasi progres yang berkembang dan tetap tunduk pada keterbacaan.

Ringkasan statistik boleh muncul di Beranda, tetapi analitik lengkap harus berada di `Perkembangan`.

### 5. Target Skor Menjadi Poros Perjalanan

- Target skor ditentukan pengguna dan dapat berubah.
- Beranda membandingkan target dengan estimasi hasil simulasi yang memenuhi syarat.
- Hasil lama menyimpan target yang berlaku saat simulasi tersebut selesai.
- Pesan motivasi atau roasting selalu relatif terhadap target pengguna, bukan terhadap angka batas yang kaku.
- Setiap pesan harus diikuti alasan diagnostik dan tindakan yang dapat langsung dilakukan.

Aturan rinci terdapat di `docs/score-estimation-policy.md`.

### 6. Pengungkapan Hasil Simulasi Memiliki Momen Khusus

Setelah simulasi lengkap selesai, aplikasi menampilkan modal hasil di atas latar yang diredupkan dan diburamkan.
Modal tersebut menampilkan:

- estimasi skor simulasi
- target saat simulasi selesai
- selisih terhadap target
- pesan relatif terhadap pencapaian
- bagian atau area yang paling menghambat
- tindakan langsung menuju analisis atau latihan berikutnya

Layar hasil lengkap tetap tersedia setelah modal ditutup.

### 7. Ilustrasi Progres Diterima

Ilustrasi yang berkembang mengikuti progres diterima sebagai bagian pengalaman produk, bukan dianggap otomatis
sebagai aksesori.

Syaratnya:

- tetap indah ketika belum ada hasil simulasi
- tidak menggantikan angka atau diagnostik
- tidak mengurangi kontras atau keterbacaan
- tidak menghambat performa
- perkembangan visual berasal dari data yang dapat dijelaskan

### 8. AI Ditunda Sampai Fondasi Selesai

AI bukan bagian rekonstruksi awal. Sistem deterministik untuk bank soal, penilaian, estimasi skor, target, diagnostik,
dan navigasi harus selesai terlebih dahulu.

AI kelak dapat membantu menjelaskan, merencanakan, dan mencari. AI tidak boleh menentukan kebenaran jawaban,
mengubah soal sumber, atau menghitung estimasi skor.

## Bahasa dan Nada

- Kontrol, navigasi, dan pesan aplikasi menggunakan Bahasa Indonesia yang alami.
- Teks soal, pilihan, passage, dan terminologi tes dipertahankan sesuai sumber Bahasa Inggris.
- Nuansa veteriner diwujudkan terutama melalui identitas visual, ketelitian, dan struktur.
- Hindari bahasa klinis berlebihan seperti `anomali soal`, `sesi terapi`, atau `eksekusi protokol` untuk aktivitas
  belajar biasa.
- Mode pesan personal dapat menggunakan roasting yang telah disetujui pengguna, tetapi tidak boleh menghilangkan
  informasi diagnostik atau tindakan berikutnya.

## Prinsip Fungsional

- Data nyata lebih diutamakan daripada kartu generik.
- Setiap kartu interaktif harus membuka tindakan yang sesuai dengan klaimnya.
- Rekomendasi area spesifik harus membuka soal area tersebut.
- Reading passage selalu tetap bersama pertanyaannya.
- Pembahasan premium tidak boleh ditulis ulang oleh UI.
- Visual yang indah diperbolehkan; visual yang berpura-pura menjadi data tidak diperbolehkan.

## Urutan Rekonstruksi yang Disepakati

1. Dokumentasikan konsep dan kebijakan estimasi skor.
2. Bangun model target, estimasi skor, riwayat simulasi, dan migrasi penyimpanan.
3. Bangun modal pengungkapan hasil dan pesan relatif terhadap target.
4. Hapus splash screen dan ganti sidebar dengan top navigation.
5. Bangun Beranda baru.
6. Bangun Jelajahi, Koleksi, Ruang Uji, dan Perkembangan.
7. Tambahkan ilustrasi progres dinamis.
8. Integrasikan AI setelah fondasi deterministik stabil.

## Batas Tahap Saat Ini

Dokumen ini menetapkan arah, tetapi belum berarti kode saat ini telah menerapkannya. Dokumen yang menjelaskan
sidebar atau dashboard lama adalah catatan baseline implementasi selama migrasi, bukan desain final.

Tahap penyimpanan riwayat dan diagnostik telah menghasilkan schema `toefl-itp-ibnu-progress-v3` serta snapshot
`session-diagnostic-v1`. Rincian implementasi terdapat di `docs/history-diagnostics-v1.md`.

Modal pengungkapan hasil dan pesan relatif terhadap target telah diterapkan untuk simulasi lengkap yang memenuhi syarat
estimasi. Rincian implementasi terdapat di `docs/result-reveal-v1.md`.

Splash screen telah dihapus. Aplikasi sekarang membuka Beranda secara langsung, termasuk setelah reload. Rincian
implementasi terdapat di `docs/splash-removal-v1.md`.

Sidebar telah diganti dengan top navigation berbasis tujuan dan Home telah dibangun ulang sebagai ruang belajar
personal. Jelajahi, Koleksi Belajar, Ruang Uji, dan Perkembangan sekarang menjadi halaman mandiri yang memakai data
bank, riwayat, target, serta diagnostik nyata. Rincian terdapat di `docs/navigation.md`, `docs/personal-home-v1.md`,
dan `docs/destination-pages-v1.md`.

Ilustrasi progres dinamis telah diterapkan sebagai ruang belajar veteriner yang bertumbuh secara deterministik dari
riwayat, estimasi, target, cakupan soal, ritme mingguan, dan diagnostik. Rincian terdapat di
`docs/progress-illustration-v1.md`.

Rekomendasi latihan, fokus perbaikan, mini lesson, dan tindakan utama Beranda sekarang membentuk sesi fokus nyata
dari master bank memakai keluarga skill kanonis. Rincian terdapat di `docs/focused-practice-v1.md`.
