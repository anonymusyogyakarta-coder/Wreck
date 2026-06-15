const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const axios = require('axios');
const readline = require('readline');
const chalk = require('chalk');

// ══════════════════════════════════════
// BANNER
// ══════════════════════════════════════
function showBanner() {
  console.clear();
  console.log(chalk.red(`
 ██╗    ██╗██████╗ ███████╗ ██████╗██╗  ██╗
 ██║    ██║██╔══██╗██╔════╝██╔════╝██║ ██╔╝
 ██║ █╗ ██║██████╔╝█████╗  ██║     █████╔╝ 
 ██║███╗██║██╔══██╗██╔══╝  ██║     ██╔═██╗ 
 ╚███╔███╔╝██║  ██║███████╗╚██████╗██║  ██╗
  ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝
  `));
  console.log(chalk.cyan('  🔥 Wreck WhatsApp - by anonymusyogyakarta-coder'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────\n'));
}

// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════
const SESSION_DIR = './session';
const GITHUB_REPO = 'anonymusyogyakarta-coder/Wreck';
let sock = null;
let isConnected = false;
let stats = { msg: 0, cmd: 0, startTime: Date.now() };

// ══════════════════════════════════════
// GITHUB SYNC
// ══════════════════════════════════════
async function syncSessionToGithub() {
  try {
    const { execSync } = require('child_process');
    // Cek apakah ada git
    try { execSync('git --version', { stdio: 'ignore' }); } catch { return; }
    // Push session ke github
    execSync('git add session/ && git commit -m "sync: update session" && git push', {
      stdio: 'ignore',
      cwd: process.cwd()
    });
    console.log(chalk.green('  ✅ Session berhasil disync ke GitHub!'));
  } catch (e) {
    // silent fail - tidak wajib
  }
}

async function pullSessionFromGithub() {
  try {
    const { execSync } = require('child_process');
    try { execSync('git --version', { stdio: 'ignore' }); } catch { return; }
    execSync('git pull', { stdio: 'ignore', cwd: process.cwd() });
    console.log(chalk.cyan('  📥 Session dipull dari GitHub!'));
  } catch (e) {
    // silent
  }
}

// ══════════════════════════════════════
// INPUT HELPER
// ══════════════════════════════════════
function askQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans.trim()); }));
}

// ══════════════════════════════════════
// SEND HELPERS
// ══════════════════════════════════════
const sendText  = (jid, text) => sock?.sendMessage(jid, { text });
const sendImage = (jid, buf, cap='') => sock?.sendMessage(jid, { image: buf, caption: cap });
const sendAudio = (jid, buf) => sock?.sendMessage(jid, { audio: buf, mimetype: 'audio/mp4', ptt: false });
const sendVideo = (jid, buf, cap='') => sock?.sendMessage(jid, { video: buf, caption: cap });
const sendSticker = (jid, buf) => sock?.sendMessage(jid, { sticker: buf });

// ══════════════════════════════════════
// FEATURES
// ══════════════════════════════════════

async function handleAI(jid, query) {
  await sendText(jid, '🤖 _Wreck AI sedang berpikir..._');
  try {
    const r = await axios.get(`https://api.siputzx.my.id/api/ai/llama?prompt=${encodeURIComponent(query)}`, { timeout: 15000 });
    const ans = r.data?.data || r.data?.result || r.data?.response;
    if (ans) return await sendText(jid, `🤖 *Wreck AI*\n\n${ans}`);
    throw new Error('empty');
  } catch {
    try {
      const r2 = await axios.get(`https://api.dreamslab.dev/api/llm?q=${encodeURIComponent(query)}&model=gpt4`, { timeout: 15000 });
      const ans2 = r2.data?.result || r2.data?.message;
      if (ans2) return await sendText(jid, `🤖 *Wreck AI*\n\n${ans2}`);
    } catch {}
    await sendText(jid, '❌ Gagal konek ke AI. Coba lagi nanti!');
  }
}

async function handleGenerate(jid, prompt) {
  await sendText(jid, '🎨 _Sedang membuat gambar, tunggu sebentar..._');
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${Date.now()}`;
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    await sendImage(jid, Buffer.from(r.data), `🎨 *${prompt}*`);
  } catch {
    await sendText(jid, '❌ Gagal generate gambar. Coba prompt yang berbeda!');
  }
}

async function handleCuaca(jid, kota) {
  await sendText(jid, `🌤️ _Mengambil data cuaca ${kota}..._`);
  try {
    const r = await axios.get(`https://wttr.in/${encodeURIComponent(kota)}?format=j1`, { timeout: 10000 });
    const w = r.data?.current_condition?.[0];
    const area = r.data?.nearest_area?.[0];
    const nama = area?.areaName?.[0]?.value || kota;
    const negara = area?.country?.[0]?.value || '';
    await sendText(jid,
      `🌤️ *Cuaca ${nama.toUpperCase()}${negara ? ', ' + negara : ''}*\n\n` +
      `🌡️ Suhu: ${w?.temp_C}°C (terasa ${w?.FeelsLikeC}°C)\n` +
      `💧 Kelembaban: ${w?.humidity}%\n` +
      `💨 Kecepatan Angin: ${w?.windspeedKmph} km/h\n` +
      `🌬️ Arah Angin: ${w?.winddir16Point}\n` +
      `☁️ Kondisi: ${w?.weatherDesc?.[0]?.value}\n` +
      `👁️ Visibilitas: ${w?.visibility} km\n` +
      `⛅ Tutupan Awan: ${w?.cloudcover}%\n\n` +
      `_Diperbarui: ${new Date().toLocaleString('id-ID')}_`
    );
  } catch {
    await sendText(jid, `❌ Kota *${kota}* tidak ditemukan!\nContoh: .cuaca Jakarta Indonesia`);
  }
}

async function handleSticker(jid, msg) {
  try {
    const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imgMsg = msg.message?.imageMessage || q?.imageMessage;
    const vidMsg = msg.message?.videoMessage || q?.videoMessage;
    if (!imgMsg && !vidMsg) {
      return await sendText(jid, '❌ Reply foto/video dengan *.s* untuk buat sticker!\nContoh: kirim foto → reply → *.s*');
    }
    await sendText(jid, '🎭 _Membuat sticker..._');
    const mediaMsg = imgMsg
      ? { message: { imageMessage: imgMsg } }
      : { message: { videoMessage: vidMsg } };
    const buf = await sock.downloadMediaMessage(mediaMsg);
    await sendSticker(jid, Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  } catch {
    await sendText(jid, '❌ Gagal buat sticker. Coba kirim ulang foto/video lalu reply .s');
  }
}

async function handleYTMusic(jid, url) {
  if (!url?.includes('youtu')) return sendText(jid, '❌ Format: .ytm [link YouTube]\nContoh: .ytm https://youtu.be/xxxxx');
  await sendText(jid, '🎵 _Mengunduh musik dari YouTube..._');
  try {
    const r = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 30000 });
    const dlUrl = r.data?.data?.url || r.data?.url;
    const title = r.data?.data?.title || r.data?.title || 'Audio';
    if (!dlUrl) throw new Error('no url');
    const audio = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 60000 });
    await sendAudio(jid, Buffer.from(audio.data));
    await sendText(jid, `✅ *${title}*\n_Download selesai!_`);
  } catch {
    await sendText(jid, '❌ Gagal download musik. Cek link YouTube!');
  }
}

async function handleYTVideo(jid, url) {
  if (!url?.includes('youtu')) return sendText(jid, '❌ Format: .ytv [link YouTube]\nContoh: .ytv https://youtu.be/xxxxx');
  await sendText(jid, '▶️ _Mengunduh video dari YouTube..._');
  try {
    const r = await axios.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 30000 });
    const dlUrl = r.data?.data?.url || r.data?.url;
    const title = r.data?.data?.title || r.data?.title || 'Video';
    if (!dlUrl) throw new Error('no url');
    const video = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 120000 });
    await sendVideo(jid, Buffer.from(video.data), `▶️ *${title}*`);
  } catch {
    await sendText(jid, '❌ Gagal download video. Cek link YouTube!');
  }
}

async function handleTikTok(jid, url) {
  if (!url?.includes('tiktok')) return sendText(jid, '❌ Format: .dtt [link TikTok]\nContoh: .dtt https://vm.tiktok.com/xxxxx');
  await sendText(jid, '🎵 _Mengunduh TikTok tanpa watermark..._');
  try {
    const r = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`, { timeout: 30000 });
    const dlUrl = r.data?.data?.play || r.data?.data?.url || r.data?.url;
    if (!dlUrl) throw new Error('no url');
    const video = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 60000 });
    await sendVideo(jid, Buffer.from(video.data), '🎵 TikTok No Watermark');
  } catch {
    await sendText(jid, '❌ Gagal download TikTok. Cek link!');
  }
}

async function handleVideoToSound(jid, msg) {
  try {
    const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const vidMsg = msg.message?.videoMessage || q?.videoMessage;
    if (!vidMsg) return sendText(jid, '❌ Reply video dengan *.vs* untuk konversi ke audio!');
    await sendText(jid, '🎵 _Mengkonversi video ke audio..._');
    const buf = await sock.downloadMediaMessage({ message: { videoMessage: vidMsg } });
    await sendAudio(jid, Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
    await sendText(jid, '✅ Video berhasil dikonversi ke audio!');
  } catch {
    await sendText(jid, '❌ Gagal konversi. Coba lagi!');
  }
}

async function handleInstagram(jid, url) {
  if (!url?.includes('instagram')) return sendText(jid, '❌ Format: .igdw [link Instagram]\nContoh: .igdw https://www.instagram.com/p/xxxxx');
  await sendText(jid, '📸 _Mengunduh dari Instagram..._');
  try {
    const r = await axios.get(`https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`, { timeout: 30000 });
    const items = r.data?.data;
    if (!items?.length) throw new Error('no data');
    for (const item of items.slice(0, 5)) {
      const dlUrl = item.url || item.download_url;
      if (!dlUrl) continue;
      const media = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 60000 });
      const buf = Buffer.from(media.data);
      if (item.type === 'video' || dlUrl.includes('.mp4')) {
        await sendVideo(jid, buf, '📸 Instagram Download');
      } else {
        await sendImage(jid, buf, '📸 Instagram Download');
      }
    }
  } catch {
    await sendText(jid, '❌ Gagal download Instagram. Pastikan akun publik!');
  }
}

async function handleNeko(jid) {
  await sendText(jid, '🐱 _Generating neko girl..._');
  try {
    let imgUrl = null;
    const endpoints = ['https://nekos.life/api/v2/img/neko','https://api.waifu.pics/sfw/neko','https://nekos.best/api/v2/neko'];
    for (const ep of endpoints) {
      try {
        const r = await axios.get(ep, { timeout: 8000 });
        imgUrl = r.data?.url || r.data?.results?.[0]?.url;
        if (imgUrl) break;
      } catch { continue; }
    }
    if (!imgUrl) imgUrl = `https://image.pollinations.ai/prompt/cute%20anime%20neko%20cat%20girl%20kawaii?width=512&height=512&nologo=true&seed=${~~(Math.random()*99999)}`;
    const img = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 20000 });
    await sendImage(jid, Buffer.from(img.data), '🐱 *Neko Girl!*\n_Ketik .neko lagi untuk gambar lain~_');
  } catch {
    await sendText(jid, '❌ Gagal generate neko. Coba lagi!');
  }
}

async function handleMenu(jid, name) {
  await sendText(jid,
    `🔥 *WRECK MENU*\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `Halo, *${name}*! 👋\n\n` +
    `*🤖 AI & Kreatif*\n` +
    `├ *.ai* [pertanyaan] — Chat dengan AI\n` +
    `└ *.generate* [prompt] — Generate gambar AI\n\n` +
    `*🌤️ Informasi*\n` +
    `└ *.cuaca* [kota] — Info cuaca & angin\n\n` +
    `*📥 Downloader*\n` +
    `├ *.ytm* [link] — YouTube → Musik\n` +
    `├ *.ytv* [link] — YouTube → Video\n` +
    `├ *.dtt* [link] — TikTok (no watermark)\n` +
    `└ *.igdw* [link] — Instagram foto/video\n\n` +
    `*🎨 Utilitas*\n` +
    `├ *.s* — Foto/Video → Sticker\n` +
    `├ *.vs* — Video → Audio\n` +
    `└ *.neko* — Generate anime neko girl 🐱\n\n` +
    `*📋 Info*\n` +
    `└ *.menu* — Tampilkan menu ini\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `_Semua perintah bisa dipakai siapa saja!_\n` +
    `_Wreck v1.0 by @anonymusyogyakarta-coder_`
  );
}

// ══════════════════════════════════════
// UPTIME
// ══════════════════════════════════════
function getUptime() {
  const s = ~~((Date.now() - stats.startTime) / 1000);
  const h = ~~(s / 3600), m = ~~((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// ══════════════════════════════════════
// MAIN BOT
// ══════════════════════════════════════
async function startBot() {
  showBanner();

  // Pull session dari GitHub dulu
  await pullSessionFromGithub();

  await fs.ensureDir(SESSION_DIR);
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  // ── Ambil nomor dulu SEBELUM buat socket (jika belum punya session) ──
  let fullPhone = '';
  if (!state.creds.registered) {
    console.log(chalk.yellow('\n  📱 Belum ada session. Login dengan Pairing Code.\n'));
    const cc = await askQuestion(chalk.cyan('  Masukkan kode negara (contoh: 62 untuk Indonesia): '));
    const phone = await askQuestion(chalk.cyan('  Masukkan nomor WA (tanpa 0, contoh: 8xxxxxxxxxx): '));
    // Bersihkan nomor: hapus +, spasi, strip, dan 0 di depan
    fullPhone = (cc.replace(/\D/g, '') + phone.replace(/\D/g, '').replace(/^0/, '')).trim();
    console.log(chalk.yellow(`\n  ⏳ Menyiapkan koneksi untuk +${fullPhone}...\n`));
  }

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    browser: ['Ubuntu', 'Chrome', '22.04'],
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
  });

  // ── Request Pairing Code saat socket connecting ──
  if (fullPhone) {
    sock.ev.on('connection.update', async (update) => {
      if (update.connection === 'connecting' || update.isNewLogin) {
        // Tunggu socket siap lalu minta kode
      }
    });

    // Tunggu socket terbentuk lalu minta pairing code
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      console.log(chalk.yellow('  🔄 Meminta pairing code...\n'));
      const code = await sock.requestPairingCode(fullPhone);
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(chalk.bgRed.white.bold(`\n  ╔══════════════════════════════╗`));
      console.log(chalk.bgRed.white.bold(`  ║  🔥 PAIRING CODE: ${formatted.padEnd(9)}  ║`));
      console.log(chalk.bgRed.white.bold(`  ╚══════════════════════════════╝\n`));
      console.log(chalk.white('  Cara memasukkan kode di WhatsApp:'));
      console.log(chalk.gray('  1. Buka WhatsApp'));
      console.log(chalk.gray('  2. Ketuk ⋮ Menu → Perangkat Tertaut → Tautkan Perangkat'));
      console.log(chalk.gray('  3. Ketuk "Tautkan dengan nomor telepon" (di bawah scanner QR)'));
      console.log(chalk.gray(`  4. Ketik kode: `) + chalk.red.bold(formatted));
      console.log(chalk.gray('  5. Tunggu beberapa detik → bot otomatis konek!\n'));
    } catch (e) {
      console.log(chalk.red('\n  ❌ Gagal dapat pairing code!'));
      console.log(chalk.red('  Penyebab: ' + e.message));
      console.log(chalk.yellow('  💡 Coba solusi:'));
      console.log(chalk.gray('  - Hapus folder session/ lalu jalankan ulang'));
      console.log(chalk.gray('  - Pastikan nomor benar (tanpa + dan tanpa 0 di depan)'));
      console.log(chalk.gray('  - Pastikan koneksi internet stabil\n'));
      await fs.remove(SESSION_DIR);
      process.exit(1);
    }
  }

  // ── Connection Events ──
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      isConnected = true;
      const phone = sock.user?.id?.split(':')[0];
      console.log(chalk.green(`\n  ✅ Wreck terhubung! Nomor: +${phone}`));
      console.log(chalk.cyan(`  🐱 Bot siap menerima perintah!\n`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────'));
      console.log(chalk.gray('  Ketik CTRL+C untuk berhenti\n'));

      // Sync session ke GitHub setelah konek
      await syncSessionToGithub();

      // Auto sync tiap 30 menit
      setInterval(syncSessionToGithub, 30 * 60 * 1000);

      // Status di terminal tiap 5 menit
      setInterval(() => {
        console.log(chalk.gray(`  [${new Date().toLocaleTimeString('id-ID')}] Uptime: ${getUptime()} | Pesan: ${stats.msg} | Perintah: ${stats.cmd}`));
      }, 5 * 60 * 1000);
    }

    if (connection === 'close') {
      isConnected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const reconnect = code !== DisconnectReason.loggedOut;
      console.log(chalk.red(`\n  ⚠️  Koneksi terputus (kode: ${code})`));
      if (reconnect) {
        console.log(chalk.yellow('  🔄 Reconnecting dalam 5 detik...\n'));
        setTimeout(startBot, 5000);
      } else {
        console.log(chalk.red('  ❌ Sesi tidak valid. Hapus folder session/ dan jalankan ulang.\n'));
        await fs.remove(SESSION_DIR);
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', async (creds) => {
    await saveCreds();
  });

  // ── Message Handler ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid) continue;

      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption || '';

      if (!body.startsWith('.')) continue;

      const [rawCmd, ...argArr] = body.trim().split(' ');
      const cmd = rawCmd.toLowerCase();
      const args = argArr.join(' ').trim();
      const senderName = msg.pushName || 'User';

      stats.msg++;
      stats.cmd++;

      const ts = new Date().toLocaleTimeString('id-ID', { hour12: false });
      console.log(chalk.red(`  [${ts}]`) + chalk.white(` ${senderName}: `) + chalk.cyan(body));

      try {
        switch(cmd) {
          case '.ai':
            if (!args) { await sendText(jid, '❌ Format: .ai [pertanyaan]\nContoh: .ai Apa itu AI?'); break; }
            await handleAI(jid, args); break;
          case '.generate':
            if (!args) { await sendText(jid, '❌ Format: .generate [prompt]\nContoh: .generate cute neko cat'); break; }
            await handleGenerate(jid, args); break;
          case '.cuaca':
            if (!args) { await sendText(jid, '❌ Format: .cuaca [kota]\nContoh: .cuaca Jakarta Indonesia'); break; }
            await handleCuaca(jid, args); break;
          case '.s':
            await handleSticker(jid, msg); break;
          case '.ytm':
            await handleYTMusic(jid, args); break;
          case '.ytv':
            await handleYTVideo(jid, args); break;
          case '.dtt':
            await handleTikTok(jid, args); break;
          case '.vs':
            await handleVideoToSound(jid, msg); break;
          case '.igdw':
            await handleInstagram(jid, args); break;
          case '.neko':
            await handleNeko(jid); break;
          case '.menu':
            await handleMenu(jid, senderName); break;
          default: break;
        }
      } catch(e) {
        console.log(chalk.red(`  ❌ Error ${cmd}: ${e.message}`));
        await sendText(jid, `❌ Error: ${e.message}`);
      }
    }
  });
}

// ══════════════════════════════════════
// START
// ══════════════════════════════════════
startBot().catch(e => {
  console.error(chalk.red('Fatal error: ' + e.message));
  process.exit(1);
});
