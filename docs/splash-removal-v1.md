# Penghapusan Splash Screen V1

## Keputusan

Aplikasi tidak lagi menggunakan splash screen sebagai gerbang masuk. Saat aplikasi dibuka atau dimuat ulang,
pengguna langsung tiba di Beranda.

## Perubahan Implementasi

- State layar awal di `App.tsx` langsung menggunakan `home`.
- Tipe layar dan cabang render `splash` telah dihapus.
- Komponen `SplashScreen` dan seluruh gaya khusus splash telah dihapus.
- Skrip QA browser tidak lagi menekan tombol masuk sebelum menguji aplikasi.
- Verifikasi batas UI memastikan `App` membuka Beranda dan tidak memulihkan splash gate.

## Batas Tahap

Tahap ini hanya menghapus splash screen. Penggantian sidebar dengan top navigation dan peleburan identitas visual
ke Beranda dikerjakan pada tahap rekonstruksi berikutnya.

Ilustrasi veteriner lama tetap disimpan sebagai aset agar dapat digunakan kembali secara fungsional di Beranda.
