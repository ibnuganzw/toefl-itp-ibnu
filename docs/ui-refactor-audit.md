# Audit UI Refactor

> Status: catatan historis dari refactor UI sebelumnya. Detail splash screen, sidebar, tujuan navigasi, dan bentuk Home
> di dokumen ini menjelaskan milestone lama dan telah digantikan sebagai arah produk oleh
> `docs/reconstruction-concept.md`.

## Langkah 1: Selesai Setelah Re-check

`src/App.tsx` sekarang bertanggung jawab pada orchestration aplikasi:

- state layar, sesi, progres, dan konfigurasi
- pembuatan, penyimpanan, pemulihan, dan penyelesaian sesi
- shortcut global dan perpindahan layar
- penghubung data bank ke layar

Komponen UI lama telah dipisahkan berdasarkan boundary:

- `src/components/dashboard/DashboardShell.tsx`
- `src/components/screens/SplashScreen.tsx`
- `src/components/screens/HomeScreen.tsx`
- `src/components/screens/SessionScreen.tsx`
- `src/components/screens/ResultScreen.tsx`
- `src/components/screens/ReviewScreen.tsx`
- `src/components/session/QuestionRenderer.tsx`
- `src/components/session/QuestionMap.tsx`
- `src/components/session/ShortcutsModal.tsx`
- `src/components/listening/ListeningPanel.tsx`
- `src/components/listening/QuestionAudioPlayer.tsx`
- `src/components/questions/ExplanationPanel.tsx`
- `src/components/common/Metric.tsx`
- `src/components/home/DashboardActionCard.tsx`
- `src/components/forms/NumberField.tsx`

Tipe dan helper bersama telah dipisahkan:

- `src/types/appState.ts`
- `src/types/dashboardTypes.ts`
- `src/utils/displayText.ts`
- `src/utils/listeningPlayback.ts`
- `src/utils/questionGuards.ts`

Hasil re-check:

- `App.tsx` hanya mengatur state, flow sesi, persistence, shortcut global, dan perpindahan layar.
- `SessionScreen.tsx` hanya menyusun layar sesi dan tidak lagi mendefinisikan renderer soal, audio player, map, atau modal shortcut.
- `HomeScreen.tsx` tidak lagi mendefinisikan kartu aksi dan number field.
- coupling `document.querySelector` dari kartu Simulasi Kustom ke form telah diganti dengan React ref.
- `scripts/verifyUiBoundaries.mjs` menjaga boundary ini secara otomatis.

## Keputusan Langkah 2

Status: **GO**

Langkah 2 baru boleh dimulai setelah Langkah 1 lolos:

- `npm run verify:ui-boundaries`
- `npm run typecheck`
- `npm run validate:bank:strict`
- `npm run verify:listening-flow`
- `npm run build`
- QA visual dan interaksi Beranda, fokus form Simulasi Kustom, serta Listening

## Langkah 2: Selesai

Design system kecil telah dibuat dan dipakai pada kontrol bersama:

- token visual terpusat di `src/styles/tokens.css`
- primitive visual terpusat di `src/styles/primitives.css`
- ikon, tombol, badge, segmented control, dan surface bersama di `src/components/ui`
- shell tidak lagi menyimpan SVG navigasi duplikat
- tombol perintah sesi, audio, hasil, review, splash, dan kontrol utama Home memakai primitive bersama
- responsive Home dan command bar sesi telah diverifikasi pada desktop dan mobile

Pagar otomatis:

- `npm run verify:design-system`
- `npm run qa:design-system`

Status Langkah 2: **SELESAI**

## Sisa Untuk Redesign Layar

`src/styles/theme.css` masih merupakan lapisan layout warisan selama migrasi. Bentuk akhir Home, daftar soal, panel audio,
area pertanyaan, dan susunan simulasi akan dikerjakan pada tahap redesign layar berikutnya dengan design system ini
sebagai fondasi. Pemisahan Mode Belajar dan Simulasi di Home juga masih dipertahankan sementara sampai alur navigasi
baru diterapkan.

## Langkah 3: Sidebar dan Navigasi Baru

Status: **SELESAI**

- sidebar dipisahkan dari `DashboardShell`
- item navigasi dipisahkan menjadi komponen bersama
- tujuan tetap: H, L, SW, R, M, dan S
- active state memakai `aria-current="page"` dan hanya satu item aktif
- ikon, label aksesibel, dan tooltip desktop tersedia
- desktop memakai navigation rail sticky 96px
- mobile memakai navigation bar sticky enam kolom tanpa scroll horizontal
- seluruh tujuan telah diuji pada desktop dan mobile

Detail arsitektur tersedia di `docs/navigation.md`.

## Langkah 4: Beranda Dashboard

Status: **SELESAI**

- model data Beranda terpusat di `buildHomeDashboardModel`
- lima summary cards memakai data lokal nyata
- rekomendasi latihan dibentuk dari area lemah
- Mini Lesson berbasis potongan pembahasan soal telah dihapus karena tidak memiliki konteks sebagai materi mandiri
- Fokus Perbaikan, Riwayat Terakhir, dan Target Mingguan tersedia
- kartu bagian membuka Listening, Structure & Written, Reading, dan Mixed secara langsung
- mode tab Belajar/Simulasi dan form Home lama telah dihapus
- scope belajar gabungan Structure & Written telah ditambahkan
- keadaan kosong dan berisi progres telah diuji pada desktop dan mobile

Detail arsitektur tersedia di `docs/home-dashboard.md`.
