# 🐱 Wreck – WhatsApp AI Bot

Bot WhatsApp serba bisa dengan AI, downloader, cuaca, sticker & banyak lagi! Jalan di Termux, session tersimpan otomatis ke GitHub.

---

## ✨ Fitur

| Perintah | Fungsi |
|---|---|
| `.ai [pertanyaan]` | Chat dengan AI |
| `.generate [prompt]` | Generate gambar AI |
| `.cuaca [kota]` | Info cuaca & kecepatan angin |
| `.s` | Foto/Video → Sticker |
| `.ytm [link]` | YouTube → Musik |
| `.ytv [link]` | YouTube → Video |
| `.vs` | Video → Audio |
| `.dtt [link]` | TikTok tanpa watermark |
| `.igdw [link]` | Download Instagram |
| `.neko` | Generate anime neko girl |
| `.menu` | Tampilkan semua fitur |

---

## 📱 Install & Jalankan di Termux

### Cara 1: Otomatis (Recommended)
```bash
pkg update -y && pkg install nodejs git -y
git clone https://github.com/anonymusyogyakarta-coder/Wreck
cd Wreck
bash start.sh
```

### Cara 2: Manual
```bash
pkg update -y
pkg install nodejs git -y
git clone https://github.com/anonymusyogyakarta-coder/Wreck
cd Wreck
npm install
node index.js
```

---

## 🔑 Login

Saat pertama kali jalan, bot akan minta:
1. **Kode negara** → ketik `62` (Indonesia)
2. **Nomor WA** → ketik nomor tanpa angka 0 di depan

Lalu akan muncul **Pairing Code 8 digit** di terminal.

Cara pakai pairing code di WhatsApp:
1. Buka WhatsApp → ⋮ Menu → **Perangkat Tertaut**
2. Ketuk **Tautkan Perangkat**
3. Ketuk **Tautkan dengan nomor telepon**
4. Masukkan kode 8 digit yang muncul di Termux

---

## 💾 Sync Session ke GitHub

Setelah login, session otomatis tersimpan ke GitHub setiap 30 menit. Jadi kalau Termux restart, tidak perlu login ulang — cukup jalankan lagi!

Untuk sync manual:
```bash
git add session/ && git commit -m "sync session" && git push
```

---

## 💡 Tips

- Aktifkan **Acquire Wakelock** di notifikasi Termux agar bot tetap jalan di background
- Gunakan **tmux** agar bot tetap jalan walau Termux ditutup:
  ```bash
  pkg install tmux -y
  tmux new -s wreck
  bash start.sh
  # Tekan CTRL+B lalu D untuk detach
  ```

---

Made with ❤️ by [@anonymusyogyakarta-coder](https://github.com/anonymusyogyakarta-coder)
