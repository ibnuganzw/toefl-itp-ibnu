# Design System Kecil

## Tujuan

Fondasi ini menyatukan tampilan dan perilaku kontrol utama sebelum setiap layar dirombak mengikuti referensi visual final.
Design system tidak mengubah isi bank soal atau alur sesi.

## Lapisan

- `src/styles/tokens.css`: warna, tipografi, spacing, radius, shadow, ukuran kontrol, dan motion.
- `src/styles/primitives.css`: aturan visual untuk primitive bersama.
- `src/components/ui/AppIcon.tsx`: ikon garis bersama untuk navigasi dan perintah.
- `src/components/ui/Button.tsx`: tombol primary, secondary, ghost, dan warning.
- `src/components/ui/Badge.tsx`: label status.
- `src/components/ui/SegmentedControl.tsx`: pemilih opsi yang saling eksklusif.
- `src/components/ui/Surface.tsx`: surface dasar untuk panel.

`theme.css` masih dipertahankan selama migrasi layar. Urutan import wajib:

1. `tokens.css`
2. `theme.css`
3. `primitives.css`

Urutan ini membuat layout lama tetap bekerja, sementara primitive bersama menjadi sumber visual terakhir untuk kontrol yang sudah dimigrasikan.

## Aturan Pemakaian

- Gunakan `Button` untuk perintah umum; sertakan `AppIcon` melalui prop `icon`.
- Gunakan `Badge` hanya untuk status singkat.
- Gunakan `SegmentedControl` untuk satu pilihan aktif dari beberapa opsi.
- Ikon SVG baru harus ditambahkan ke `AppIcon`, bukan disalin ke layar.
- Token baru harus memakai prefix `--ui-`.
- Jangan menaruh isi atau metadata bank soal di design system.

## Verifikasi

Jalankan:

```powershell
npm run verify:design-system
```

Verifier memastikan file fondasi tersedia, urutan stylesheet benar, dan primitive bersama digunakan oleh shell serta layar utama.

Untuk QA visual dan integrasi desktop/mobile pada aplikasi yang sedang berjalan:

```powershell
npm run qa:design-system
```
