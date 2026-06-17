# Ilustrasi Progres Dinamis V1

## Konsep

Ilustrasi progres adalah ruang belajar veteriner yang bertumbuh dari data nyata. Implementasinya berupa SVG orisinal
di dalam aplikasi, bukan aset eksternal atau gambar dekoratif statis.

Ilustrasi muncul dalam dua bentuk:

- versi ringkas menjadi identitas visual utama Beranda
- versi lengkap di Perkembangan menjelaskan fase, milestone, dan sumber setiap perubahan visual

## Lima Fase

| Fase | Kondisi deterministik |
| --- | --- |
| Ruang Disiapkan | Belum ada sesi selesai. |
| Ritme Tumbuh | Sedikitnya satu sesi selesai, tetapi belum ada estimasi simulasi lengkap. |
| Arah Terukur | Estimasi simulasi lengkap tersedia. |
| Mendekati Target | Estimasi berada pada status relatif `near` terhadap target aktif. |
| Target Tercapai | Estimasi mencapai atau melampaui target aktif. |

Status `progressing` dan `far` tetap berada pada fase Arah Terukur karena arah sudah dapat dibaca, tetapi target belum
dekat.

## Pemetaan Visual

- **Tanaman perjalanan** mengikuti fase perjalanan.
- **Lampu ritme** mengikuti jumlah sesi pada minggu berjalan terhadap target lima sesi.
- **Rak pengetahuan** mengikuti proporsi soal aktif yang pernah dipelajari.
- **Jejak menuju target** mengikuti posisi estimasi dari estimasi minimum yang didukung menuju target aktif.
- **Grafik laptop** memakai diagnostik bagian dari simulasi terbaru.

Perubahan target dapat mengubah jejak dan fase relatif tanpa mengubah hasil simulasi lama.

## Aksesibilitas dan Performa

- SVG memiliki `title`, `desc`, dan label teks yang tetap menjelaskan fase.
- Seluruh informasi visual juga tersedia sebagai milestone serta kartu sinyal.
- Animasi hanya berupa sapaan halus ketika halaman muncul, berhenti sendiri dalam kurang dari lima detik, tidak
  memengaruhi fungsi, dan dimatikan melalui `@media (prefers-reduced-motion: reduce)`.
- Tidak ada gambar atau library eksternal tambahan.

## Riset Visual

Riset internet dipakai sebagai prinsip, bukan sebagai sumber aset yang disalin:

- [Material Design Motion](https://m3.material.io/styles/motion/overview/how-it-works) digunakan sebagai referensi agar
  gerakan membantu orientasi, bukan menjadi tontonan.
- [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion),
  [W3C Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), dan
  [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) digunakan untuk aturan
  reduced motion serta durasi gerak.
- Seluruh ilustrasi meja studi, tanaman, lampu, buku, perangkat klinis, dan jejak dibuat langsung sebagai SVG
  orisinal aplikasi.

## Verifikasi

```powershell
npm run verify:progress-illustration
npm run qa:design-system
```
