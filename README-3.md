<div align="center">

```
 ██╗    ██╗██████╗ ███████╗ ██████╗██╗  ██╗
 ██║    ██║██╔══██╗██╔════╝██╔════╝██║ ██╔╝
 ██║ █╗ ██║██████╔╝█████╗  ██║     █████╔╝ 
 ██║███╗██║██╔══██╗██╔══╝  ██║     ██╔═██╗ 
 ╚███╔███╔╝██║  ██║███████╗╚██████╗██║  ██╗
  ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝
```

# 🔥 WRECK BOT — WhatsApp AI Bot

> **Bot WhatsApp serba bisa • AI Powered • Jalan di Termux • Gratis untuk semua!**

[![Version](https://img.shields.io/badge/Version-1.0.0-red?style=for-the-badge)](.)
[![Node](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](.)
[![Platform](https://img.shields.io/badge/Termux-Android-black?style=for-the-badge&logo=android)](.)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](.)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](.)
[![Stars](https://img.shields.io/github/stars/anonymusyogyakarta-coder/Wreck?style=for-the-badge&color=gold)](.)

</div>

---

## ✨ Kenapa Wreck Bot?

```
🚀 Jalan langsung di HP (Termux) — tidak butuh VPS atau server
💾 Session tersimpan otomatis ke GitHub — tidak perlu login ulang
🤖 AI Chat Bahasa Indonesia — tidak perlu API key berbayar
📥 Downloader lengkap — YouTube, TikTok, Instagram pakai yt-dlp lokal
🎯 Stabil & cepat — tidak bergantung pada API pihak ketiga yang sering mati
```

---

## 📋 Daftar Lengkap Perintah (27 Command!)

### 📥 Media Downloader
| Command | Fungsi | Contoh |
|---|---|---|
| `.ytm <link>` | Download lagu YouTube → MP3 | `.ytm https://youtu.be/xxx` |
| `.ytv <link>` | Download video YouTube → MP4 | `.ytv https://youtu.be/xxx` |
| `.dtt <link>` | Download TikTok tanpa watermark | `.dtt https://vt.tiktok.com/xxx` |
| `.igdw <link>` | Download foto/video Instagram | `.igdw https://instagram.com/p/xxx` |
| `.vs` | Reply video → konversi ke audio | Reply video lalu ketik `.vs` |

### 🤖 AI & Kreatif
| Command | Fungsi | Contoh |
|---|---|---|
| `.ai <teks>` | Chat AI pintar Bahasa Indonesia | `.ai Apa itu blackhole?` |
| `.generate <prompt>` | Buat gambar dari teks (AI Flux) | `.generate kucing lucu di angkasa` |
| `.translate <lang>\|<teks>` | Terjemah ke 100+ bahasa | `.translate en\|Halo apa kabar` |
| `.tts <teks>` | Teks jadi pesan suara | `.tts Halo selamat datang!` |

### 🌐 Informasi
| Command | Fungsi | Contoh |
|---|---|---|
| `.cuaca <kota>` | Cuaca & angin real-time | `.cuaca Yogyakarta` |
| `.forecast <kota>` | Prakiraan cuaca 3 hari | `.forecast Jakarta` |
| `.wiki <kata>` | Cari info dari Wikipedia | `.wiki Gunung Merapi` |
| `.lirik <lagu>` | Cari lirik lagu | `.lirik Apatis Hindia` |

### 🎮 Fun & Games
| Command | Fungsi | Contoh |
|---|---|---|
| `.neko` | Generate anime neko girl random 🐱 | `.neko` |
| `.waifu` | Generate anime waifu random 🌸 | `.waifu` |
| `.quote` | Kata motivasi random | `.quote` |
| `.random <min>-<max>` | Generate angka random | `.random 1-100` |
| `.flip` | Lempar koin (heads/tails) | `.flip` |
| `.dice <sisi>` | Lempar dadu | `.dice 20` |
| `.color` | Generate warna random + kode HEX | `.color` |

### 🔧 Tools
| Command | Fungsi | Contoh |
|---|---|---|
| `.calc <expr>` | Kalkulator (support x, ^, %) | `.calc 25 x 4 + 100` |
| `.suhu <nilai><satuan>` | Konversi suhu C/F/K | `.suhu 100c` |
| `.bmi <berat> <tinggi>` | Hitung Body Mass Index | `.bmi 65 170` |
| `.s` | Foto/Video → Sticker WA | Kirim foto + caption `.s` |
| `.sticker <url>` | URL gambar → Sticker | `.sticker https://i.imgur.com/xxx.jpg` |

### 📊 Bot Info
| Command | Fungsi |
|---|---|
| `.ping` | Cek kecepatan respon bot |
| `.runtime` | Status server, RAM, uptime |
| `.info` | Informasi tentang Wreck Bot |
| `.menu` | Tampilkan semua perintah |

---

## 📱 Install di Termux (5 Menit!)

### Step 1 — Download Termux
> ⚠️ Download dari **F-Droid** bukan Play Store!

🔗 **https://f-droid.org/packages/com.termux/**

---

### Step 2 — Install & Jalankan Bot

Copy-paste semua perintah berikut ke Termux:

```bash
# Update & install tools
pkg update -y && pkg install nodejs git yt-dlp ffmpeg -y

# Clone Wreck Bot
git clone https://github.com/anonymusyogyakarta-coder/Wreck
cd Wreck

# Install dependencies
npm install

# Jalankan!
node index.js
```

---

### Step 3 — Login Pairing Code

```
╔══════════════════════════════╗
║  🔥 PAIRING CODE: XXXX-XXXX  ║
╚══════════════════════════════╝

Cara masukkan ke WhatsApp:
1. Buka WhatsApp
2. Ketuk ⋮ → Perangkat Tertaut → Tautkan Perangkat
3. Ketuk "Tautkan dengan nomor telepon"
4. Masukkan 8 digit kode → Bot online! ✅
```

---

### Step 4 — Setup Sync ke GitHub (Optional tapi Recommended)

```bash
# Set token GitHub agar session tersimpan otomatis
git remote set-url origin https://USERNAME:TOKEN@github.com/anonymusyogyakarta-coder/Wreck.git
```

> Buat token: GitHub → Settings → Developer settings → Personal access tokens → Generate

---

## 💡 Tips & Trik

### Agar bot tetap jalan walau Termux ditutup:
```bash
pkg install tmux -y
tmux new -s wreck
node index.js
# Tekan CTRL+B lalu D untuk detach
# Kembali: tmux attach -t wreck
```

### Update bot:
```bash
cd Wreck && git pull && node index.js
```

### Reset session (jika error):
```bash
rm -rf session/ && node index.js
```

---

## 🗂️ Struktur Project

```
Wreck/
├── 📄 index.js       → Kode utama bot (semua fitur)
├── 📄 package.json   → Dependencies
├── 📄 start.sh       → Script auto-install
├── 📄 README.md      → Dokumentasi
├── 📁 session/       → Data session WA (auto)
└── 📁 node_modules/  → Library (auto)
```

---

## ⚙️ Tech Stack

| Tech | Fungsi |
|---|---|
| **Node.js v18+** | Runtime |
| **@whiskeysockets/baileys** | WhatsApp Web API |
| **yt-dlp** | Download YouTube/TikTok/Instagram |
| **ffmpeg** | Konversi audio/video |
| **Pollinations AI** | AI Chat & Image Generation |
| **wttr.in** | Data cuaca real-time |
| **Google TTS** | Text to Speech |

---

## ❓ FAQ

**Bot tidak bisa download?**
```bash
pkg install yt-dlp -y && yt-dlp --update
```

**Pairing code gagal?**
> Pastikan nomor benar: tanpa `0` di depan, tanpa `+`, tanpa kode negara

**Bot mati sendiri?**
> Pakai `tmux` agar jalan di background

**Sticker error?**
> Kirim foto (bukan file/dokumen) dengan caption `.s`

**Kalkulator tidak bisa `*`?**
> Pakai `x` sebagai pengganti: `.calc 10 x 5`

---

<div align="center">

---

**Dibuat dengan 🔥 oleh [anonymusyogyakarta-coder](https://github.com/anonymusyogyakarta-coder)**

⭐ **Kalau bermanfaat, kasih Star ya!** ⭐

[![GitHub stars](https://img.shields.io/github/stars/anonymusyogyakarta-coder/Wreck?style=social)](https://github.com/anonymusyogyakarta-coder/Wreck)
[![GitHub forks](https://img.shields.io/github/forks/anonymusyogyakarta-coder/Wreck?style=social)](https://github.com/anonymusyogyakarta-coder/Wreck/fork)

</div>
