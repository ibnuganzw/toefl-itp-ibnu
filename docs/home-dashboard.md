# Home Personal dan Model Dashboard

## Arsitektur Data

Home memakai satu model siap-render:

```text
StoredProgress + MasterQuestionBank -> buildHomeDashboardModel -> HomeDashboardModel -> HomeScreen
```

`HomeScreen` mengatur komposisi dan navigasi zona, tetapi tidak menghitung statistik. Seluruh agregasi berada di
`src/utils/homeDashboard.ts`.

Data Home:

- briefing personal dari sesi aktif, target, estimasi, akurasi, fokus, dan ritme mingguan
- total soal aktif serta progress belajar dari master bank tervalidasi
- fokus perbaikan dari metadata grammar, reading skill, dan listening skill
- rekomendasi dari area dengan akurasi terendah
- pembahasan premium dari soal sumber
- target fleksibel, estimasi yang memenuhi syarat, dan riwayat simulasi

## Boundary Komponen

- `DashboardPersonalHero`: briefing, ilustrasi, prioritas, dan tindakan utama
- `DashboardScoreTargetCard`: target estimasi fleksibel
- `DashboardSummaryCard`: lima ringkasan data belajar
- `DashboardRecommendationPanel`: rekomendasi latihan langsung
- `DashboardSubjectCard`: kategori Listening, Structure & Written, dan Reading
- `DashboardTestSpaceCard`: simulasi lengkap di Ruang Uji
- materi mandiri tidak ditampilkan sampai tersedia sumber materi khusus yang tervalidasi
- `DashboardFocusPanel`: area yang perlu diperbaiki
- `DashboardHistoryPanel`: riwayat simulasi serta diagnostik per bagian
- `DashboardWeeklyTargetCard`: progres target lima sesi mingguan

## Alur

- Top navigation membuka halaman mandiri Beranda, Jelajahi, Koleksi Belajar, Ruang Uji, atau Perkembangan.
- Listening, Structure & Written, serta Reading diluncurkan dari kategori di Jelajahi.
- Simulasi lengkap diluncurkan dari Ruang Uji.
- Sesi aktif dilanjutkan melalui tindakan utama pada briefing personal.

## Verifikasi

```powershell
npm run verify:home-dashboard
npm run qa:design-system
```

QA browser menguji keadaan kosong dan berisi progres, navigasi antarhalaman, target, rekomendasi, antrean review,
simulasi Kustom, Ruang Uji, serta tampilan desktop dan mobile.
