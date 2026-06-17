# Top Navigation Berbasis Tujuan

## Struktur

Navigasi utama menggunakan top bar sticky dengan lima tujuan pengguna:

| Tujuan | Fungsi saat ini |
| --- | --- |
| Beranda | Membuka briefing personal dan tindakan paling relevan. |
| Jelajahi | Membuka halaman rekomendasi, kategori latihan, dan inventaris bank. |
| Koleksi Belajar | Membuka halaman antrean review, pembahasan premium, dan fokus belajar. |
| Ruang Uji | Membuka halaman mode simulasi standar serta Kustom. |
| Perkembangan | Membuka halaman target, tren, riwayat, dan diagnostik mendalam. |

Listening, Structure & Written, dan Reading bukan lagi tujuan navigasi utama. Ketiganya menjadi kategori di
`Jelajahi`. Simulasi lengkap berada di `Ruang Uji`.

## Komponen

- `src/components/dashboard/DashboardTopNavigation.tsx`: konfigurasi tujuan dan brand.
- `src/components/dashboard/DashboardNavItem.tsx`: item navigasi dan active state.
- `src/components/dashboard/DashboardShell.tsx`: menyusun top navigation dan konten.
- `src/styles/navigation.css`: perilaku sticky serta layout desktop/mobile.

## Perilaku

- Top navigation disembunyikan selama sesi aktif agar ruang pengerjaan tetap fokus.
- Setiap tujuan top navigation membuka halaman mandiri dengan active state yang sesuai.
- Kelima tujuan tetap terlihat pada ponsel menggunakan label ringkas.
- Hanya satu tujuan memiliki `aria-current="page"`.
- Bagian tes diluncurkan melalui kartu kategori, bukan top navigation.

## Verifikasi

`npm run qa:design-system` memeriksa lima tujuan, active state, isi fungsional setiap halaman, sticky top bar,
responsivitas desktop/mobile, serta ketiadaan overflow horizontal.
