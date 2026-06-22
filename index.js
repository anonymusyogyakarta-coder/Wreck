const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  getContentType,
} = require('@whiskeysockets/baileys');
const pino    = require('pino');
const fs      = require('fs-extra');
const axios   = require('axios');
const rl      = require('readline');
const chalk   = require('chalk');
const { exec, execSync } = require('child_process');
const path    = require('path');
const os      = require('os');

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
  ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝`));
  console.log(chalk.cyan('  🔥 Wreck WhatsApp Bot - by anonymusyogyakarta-coder'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────\n'));
}

// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════
const SESSION_DIR = './session';
const TMP_DIR     = path.join(os.tmpdir(), 'wreck_tmp');
const TERMUX_BIN  = '/data/data/com.termux/files/usr/bin';
const TERMUX_ENV  = {
  ...process.env,
  PATH: `${TERMUX_BIN}:${process.env.PATH || '/usr/bin:/bin'}`,
  HOME: process.env.HOME || '/data/data/com.termux/files/home',
  TMPDIR: process.env.TMPDIR || '/data/data/com.termux/files/usr/tmp',
};
let sock = null;
let stats = { msg: 0, cmd: 0, startTime: Date.now() };
const ownerName = 'ZEXR03';

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
function ask(q) {
  const r = rl.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => r.question(q, a => { r.close(); res(a.trim()); }));
}

function runCmd(cmd, timeout = 180000) {
  return new Promise((res, rej) => {
    exec(cmd, { timeout, maxBuffer: 300 * 1024 * 1024, env: TERMUX_ENV }, (e, out, err) => {
      if (e) rej(new Error(err || e.message));
      else res(out.trim());
    });
  });
}

function toolPath(tool) {
  const p = `${TERMUX_BIN}/${tool}`;
  if (fs.existsSync(p)) return p;
  try { return execSync(`which ${tool}`, { env: TERMUX_ENV, encoding: 'utf8' }).trim(); } catch {}
  return null;
}

function getUptime() {
  const s = ~~((Date.now() - stats.startTime) / 1000);
  const h = ~~(s / 3600), m = ~~((s % 3600) / 60), sec = s % 60;
  return `${h} Jam, ${m} Menit, ${sec} Detik`;
}

function getUptimeFmt() {
  const s = ~~((Date.now() - stats.startTime) / 1000);
  return `${String(~~(s/3600)).padStart(2,'0')}:${String(~~((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function nowID() {
  return new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });
}

// Send helpers
const sendText    = (jid, text, opts={}) => sock?.sendMessage(jid, { text, ...opts });
const sendImage   = (jid, buf, cap='')   => sock?.sendMessage(jid, { image: buf, caption: cap });
const sendAudio   = (jid, buf)           => sock?.sendMessage(jid, { audio: buf, mimetype: 'audio/mp4', ptt: false });
const sendVideo   = (jid, buf, cap='')   => sock?.sendMessage(jid, { video: buf, caption: cap });
const sendSticker = (jid, buf)           => sock?.sendMessage(jid, { sticker: buf });

// Get quoted message
function getQuoted(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}
function getBody(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption || ''
  );
}

// ══════════════════════════════════════
// GITHUB SYNC
// ══════════════════════════════════════
async function syncGithub() {
  try {
    execSync('git add session/ && git commit -m "sync" --allow-empty && git push', { stdio:'ignore', cwd:process.cwd() });
    console.log(chalk.green('  ✅ Session synced ke GitHub!'));
  } catch {}
}
async function pullGithub() {
  try { execSync('git pull', { stdio:'ignore', cwd:process.cwd() }); console.log(chalk.cyan('  📥 Pull dari GitHub!')); } catch {}
}

// ══════════════════════════════════════
// FEATURES
// ══════════════════════════════════════

// .ai - Wreck AI (Bahasa Indonesia)
async function handleAI(jid, query) {
  await sendText(jid, '🤖 _Wreck AI sedang berpikir..._');
  try {
    const prompt = `Kamu adalah Wreck AI, asisten AI yang pintar dan selalu menjawab dalam Bahasa Indonesia yang jelas dan mudah dipahami. Jawab pertanyaan berikut: ${query}`;
    const r = await axios.get(
      `https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
      { timeout: 40000, responseType: 'text', headers: { 'Accept': 'text/plain', 'User-Agent': 'Mozilla/5.0' } }
    );
    const ans = typeof r.data === 'string' ? r.data.trim() : null;
    if (ans && ans.length > 3) return await sendText(jid, `🤖 *Wreck AI*\n\n${ans}\n\n_Powered by Wreck Bot_`);
    throw new Error('empty');
  } catch {
    try {
      const r2 = await axios.post('https://text.pollinations.ai/', {
        messages: [
          { role: 'system', content: 'Kamu adalah Wreck AI. Selalu jawab dalam Bahasa Indonesia yang baik dan benar.' },
          { role: 'user', content: query }
        ],
        model: 'openai', seed: ~~(Math.random()*9999)
      }, { timeout: 40000, responseType: 'text' });
      const ans2 = typeof r2.data === 'string' ? r2.data.trim() : null;
      if (ans2 && ans2.length > 3) return await sendText(jid, `🤖 *Wreck AI*\n\n${ans2}\n\n_Powered by Wreck Bot_`);
    } catch {}
    await sendText(jid, '❌ Wreck AI sedang tidak tersedia. Coba lagi nanti!');
  }
}

// .generate - AI Image
async function handleGenerate(jid, prompt) {
  await sendText(jid, '🎨 _Sedang membuat gambar, tunggu ya..._');
  try {
    const seed = ~~(Math.random()*999999);
    const enc  = encodeURIComponent(prompt);
    const url  = `https://image.pollinations.ai/prompt/${enc}?width=768&height=768&nologo=true&seed=${seed}&model=flux`;
    const r    = await axios.get(url, { responseType:'arraybuffer', timeout:90000, headers:{'User-Agent':'Mozilla/5.0'} });
    if (r.data?.byteLength > 500) return await sendImage(jid, Buffer.from(r.data), `🎨 *${prompt}*\n_Generated by Wreck AI_`);
    throw new Error('empty');
  } catch {
    try {
      const r2 = await axios.get(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${Date.now()}`, { responseType:'arraybuffer', timeout:90000 });
      await sendImage(jid, Buffer.from(r2.data), `🎨 *${prompt}*`);
    } catch { await sendText(jid, '❌ Gagal generate gambar. Coba prompt berbeda!'); }
  }
}

// .cuaca
async function handleCuaca(jid, kota) {
  await sendText(jid, `🌤️ _Mengambil data cuaca ${kota}..._`);
  try {
    const r = await axios.get(
      `https://wttr.in/${encodeURIComponent(kota)}?format=j1`,
      { timeout: 15000, headers: { 'User-Agent': 'curl/7.68.0', 'Accept': 'application/json' } }
    );
    const w    = r.data?.current_condition?.[0];
    const area = r.data?.nearest_area?.[0];
    const negara = area?.country?.[0]?.value || '';
    // Pakai nama kota dari input user, bukan dari API
    const namaKota = kota.toUpperCase();
    const kondisi  = w?.weatherDesc?.[0]?.value || '-';
    await sendText(jid,
      `╔══════════════════╗\n` +
      `║  🌤️ INFO CUACA   ║\n` +
      `╚══════════════════╝\n\n` +
      `📍 *Lokasi:* ${namaKota}${negara ? ', ' + negara : ''}\n` +
      `🌡️ *Suhu:* ${w?.temp_C}°C (terasa ${w?.FeelsLikeC}°C)\n` +
      `💧 *Kelembaban:* ${w?.humidity}%\n` +
      `💨 *Kec. Angin:* ${w?.windspeedKmph} km/h\n` +
      `🌬️ *Arah Angin:* ${w?.winddir16Point}\n` +
      `☁️ *Kondisi:* ${kondisi}\n` +
      `👁️ *Visibilitas:* ${w?.visibility} km\n` +
      `⛅ *Tutupan Awan:* ${w?.cloudcover}%\n` +
      `🌧️ *Curah Hujan:* ${w?.precipMM} mm\n` +
      `\n🕐 ${nowID()}\n` +
      `_Wreck Weather System_`
    );
  } catch { await sendText(jid, `❌ Kota *${kota}* tidak ditemukan!\nContoh: *.cuaca Yogyakarta*`); }
}

// .s - Sticker (Optimal: support kirim langsung + reply + caption .s)
async function handleSticker(jid, msg) {
  try {
    const q = getQuoted(msg);

    // Cari media dari berbagai sumber
    const imgMsg = msg.message?.imageMessage || q?.imageMessage || null;
    const vidMsg = msg.message?.videoMessage || q?.videoMessage || null;
    const stickerMsg = msg.message?.stickerMessage || q?.stickerMessage || null;

    // Panduan jika tidak ada media
    if (!imgMsg && !vidMsg && !stickerMsg) {
      return sendText(jid,
        '🎭 *CARA BUAT STICKER*\n\n' +
        '📌 *Metode 1 (Foto/Video langsung):*\n' +
        'Kirim foto/video dengan caption *.s*\n\n' +
        '📌 *Metode 2 (Reply):*\n' +
        '1. Kirim foto atau video\n' +
        '2. Tekan & tahan pesan tersebut\n' +
        '3. Ketuk *Balas* lalu ketik *.s*\n\n' +
        '📌 *Metode 3 (URL):*\n' +
        'Ketik *.sticker* [url gambar]'
      );
    }

    await sendText(jid, '🎭 _Membuat sticker, tunggu sebentar..._');

    let buf = null;
    if (imgMsg) {
      buf = await sock.downloadMediaMessage({ message: { imageMessage: imgMsg } });
    } else if (vidMsg) {
      buf = await sock.downloadMediaMessage({ message: { videoMessage: vidMsg } });
    } else if (stickerMsg) {
      buf = await sock.downloadMediaMessage({ message: { stickerMessage: stickerMsg } });
    }

    if (!buf) throw new Error('Tidak bisa download media');
    const finalBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (finalBuf.length < 100) throw new Error('Media terlalu kecil atau rusak');

    await sendSticker(jid, finalBuf);
  } catch (e) {
    await sendText(jid, '❌ Gagal buat sticker!\n_' + e.message + '_\n\nTips: Pastikan kirim *foto* (bukan dokumen)');
  }
}

// Download helper yt-dlp
async function ytdlp(url, opts = {}) {
  await fs.ensureDir(TMP_DIR);
  const bin  = toolPath('yt-dlp') || 'yt-dlp';
  const base = path.join(TMP_DIR, `wreck_${Date.now()}`);
  let cmd;
  if (opts.audio) {
    cmd = `"${bin}" -x --audio-format m4a --audio-quality 0 --no-playlist --no-warnings -o "${base}.m4a" "${url}"`;
  } else {
    cmd = `"${bin}" -f "best[filesize<50M][ext=mp4]/best[ext=mp4]/best" --no-playlist --no-warnings -o "${base}.%(ext)s" "${url}"`;
  }
  await runCmd(cmd, 240000);
  const files = (await fs.readdir(TMP_DIR)).filter(f => f.includes(path.basename(base))).map(f => path.join(TMP_DIR, f));
  if (!files.length) throw new Error('File tidak ada setelah download');
  return files[0];
}

async function cleanFile(f) { try { if (f) await fs.remove(f); } catch {} }

// .ytm - YouTube Musik
async function handleYTMusic(jid, url) {
  if (!url?.match(/youtu/)) return sendText(jid, '❌ Format: *.ytm* [link YouTube]');
  const bin = toolPath('yt-dlp');
  if (!bin) return sendText(jid, '❌ yt-dlp belum terinstall!\nKetik: *pkg install yt-dlp -y*');
  await sendText(jid, '🎵 _Mengunduh musik dari YouTube..._');
  let f = null;
  try {
    f = await ytdlp(url, { audio: true });
    await sendAudio(jid, await fs.readFile(f));
    await sendText(jid, '✅ *Download musik selesai!*\n_Powered by Wreck Downloader_');
  } catch (e) { await sendText(jid, '❌ Gagal download musik: ' + e.message.split('\n')[0]); }
  finally { await cleanFile(f); }
}

// .ytv - YouTube Video
async function handleYTVideo(jid, url) {
  if (!url?.match(/youtu/)) return sendText(jid, '❌ Format: *.ytv* [link YouTube]');
  const bin = toolPath('yt-dlp');
  if (!bin) return sendText(jid, '❌ yt-dlp belum terinstall!\nKetik: *pkg install yt-dlp -y*');
  await sendText(jid, '▶️ _Mengunduh video YouTube..._');
  let f = null;
  try {
    f = await ytdlp(url, { audio: false });
    await sendVideo(jid, await fs.readFile(f), '▶️ *YouTube Video*\n_Powered by Wreck Downloader_');
  } catch (e) { await sendText(jid, '❌ Gagal download video: ' + e.message.split('\n')[0]); }
  finally { await cleanFile(f); }
}

// .dtt - TikTok No Watermark
async function handleTikTok(jid, url) {
  if (!url?.match(/tiktok|vm\.tik|vt\.tik/)) return sendText(jid, '❌ Format: *.dtt* [link TikTok]');
  const bin = toolPath('yt-dlp');
  if (!bin) return sendText(jid, '❌ yt-dlp belum terinstall!\nKetik: *pkg install yt-dlp -y*');
  await sendText(jid, '🎵 _Mengunduh TikTok tanpa watermark..._');
  await fs.ensureDir(TMP_DIR);
  const out = path.join(TMP_DIR, `wreck_tt_${Date.now()}.mp4`);
  let f = null;
  try {
    // Metode 1: yt-dlp dengan format terbaik
    const cmd = `"${bin}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 --no-playlist --no-warnings -o "${out}" "${url}"`;
    await runCmd(cmd, 180000);
    f = out;
    if (await fs.pathExists(f)) {
      await sendVideo(jid, await fs.readFile(f), '🎵 *TikTok No Watermark*\n_Powered by Wreck Downloader_');
    } else throw new Error('File tidak ada');
  } catch {
    // Metode 2: format sederhana
    try {
      const out2 = path.join(TMP_DIR, `wreck_tt2_${Date.now()}.mp4`);
      const cmd2 = `"${bin}" --no-playlist -o "${out2}" "${url}"`;
      await runCmd(cmd2, 180000);
      if (await fs.pathExists(out2)) {
        await sendVideo(jid, await fs.readFile(out2), '🎵 *TikTok Download*\n_Powered by Wreck Downloader_');
        await cleanFile(out2);
        return;
      }
    } catch (e2) { await sendText(jid, '❌ Gagal download TikTok: ' + e2.message.split('\n')[0]); }
  } finally { await cleanFile(f); }
}

// .vs - Video ke Audio
async function handleVS(jid, msg) {
  try {
    const q      = getQuoted(msg);
    const vidMsg = msg.message?.videoMessage || q?.videoMessage;
    if (!vidMsg) return sendText(jid, '❌ Cara pakai:\n1. Kirim video\n2. Reply video dengan *.vs*');
    await sendText(jid, '🎵 _Mengkonversi video ke audio..._');
    const buf = await sock.downloadMediaMessage({ message: { videoMessage: vidMsg } });
    const vidBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    await fs.ensureDir(TMP_DIR);
    const vid = path.join(TMP_DIR, `wreck_vs_${Date.now()}.mp4`);
    const aud = vid.replace('.mp4', '.m4a');
    await fs.writeFile(vid, vidBuf);
    const ffmpeg = toolPath('ffmpeg');
    if (ffmpeg) {
      await runCmd(`"${ffmpeg}" -i "${vid}" -vn -acodec copy "${aud}" -y`, 60000);
      if (await fs.pathExists(aud)) { await sendAudio(jid, await fs.readFile(aud)); await cleanFile(aud); }
      else { await sendAudio(jid, vidBuf); }
    } else { await sendAudio(jid, vidBuf); }
    await cleanFile(vid);
    await sendText(jid, '✅ Berhasil konversi ke audio!');
  } catch (e) { await sendText(jid, '❌ Gagal konversi: ' + e.message); }
}

// .igdw - Instagram
async function handleIG(jid, url) {
  if (!url?.match(/instagram|instagr\.am/)) return sendText(jid, '❌ Format: *.igdw* [link Instagram]');
  const bin = toolPath('yt-dlp');
  if (!bin) return sendText(jid, '❌ yt-dlp belum terinstall!\nKetik: *pkg install yt-dlp -y*');
  await sendText(jid, '📸 _Mengunduh dari Instagram..._');
  await fs.ensureDir(TMP_DIR);
  const base = path.join(TMP_DIR, `wreck_ig_${Date.now()}`);
  try {
    const cmd = `"${bin}" --no-playlist --no-warnings -o "${base}.%(ext)s" "${url}"`;
    await runCmd(cmd, 180000);
    const files = (await fs.readdir(TMP_DIR)).filter(f => f.includes(path.basename(base))).map(f => path.join(TMP_DIR, f));
    if (!files.length) throw new Error('Tidak ada file terdownload');
    for (const f of files) {
      const buf = await fs.readFile(f);
      const isVid = f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.webm');
      if (isVid) await sendVideo(jid, buf, '📸 *Instagram Download*\n_Powered by Wreck_');
      else await sendImage(jid, buf, '📸 *Instagram Download*\n_Powered by Wreck_');
      await cleanFile(f);
    }
  } catch (e) { await sendText(jid, '❌ Gagal download IG: ' + e.message.split('\n')[0]); }
}

// .neko
async function handleNeko(jid) {
  await sendText(jid, '🐱 _Generating neko girl..._');
  try {
    let imgUrl = null;
    for (const ep of ['https://nekos.life/api/v2/img/neko','https://api.waifu.pics/sfw/neko','https://nekos.best/api/v2/neko']) {
      try { const r = await axios.get(ep, {timeout:10000}); imgUrl = r.data?.url || r.data?.results?.[0]?.url; if (imgUrl) break; } catch {}
    }
    if (!imgUrl) imgUrl = `https://image.pollinations.ai/prompt/cute%20anime%20neko%20cat%20girl%20kawaii?width=512&height=512&nologo=true&seed=${~~(Math.random()*99999)}`;
    const img = await axios.get(imgUrl, { responseType:'arraybuffer', timeout:30000 });
    await sendImage(jid, Buffer.from(img.data), '🐱 *Neko Girl!*\n_Ketik .neko lagi untuk gambar berbeda~_');
  } catch { await sendText(jid, '❌ Gagal generate neko. Coba lagi!'); }
}

// .waifu
async function handleWaifu(jid) {
  await sendText(jid, '🌸 _Generating waifu..._');
  try {
    let imgUrl = null;
    for (const ep of ['https://api.waifu.pics/sfw/waifu','https://nekos.life/api/v2/img/waifu']) {
      try { const r = await axios.get(ep, {timeout:10000}); imgUrl = r.data?.url; if (imgUrl) break; } catch {}
    }
    if (!imgUrl) imgUrl = `https://image.pollinations.ai/prompt/beautiful%20anime%20waifu%20girl%20high%20quality?width=512&height=512&nologo=true&seed=${~~(Math.random()*99999)}`;
    const img = await axios.get(imgUrl, { responseType:'arraybuffer', timeout:30000 });
    await sendImage(jid, Buffer.from(img.data), '🌸 *Waifu!*\n_Ketik .waifu lagi untuk gambar lain~_');
  } catch { await sendText(jid, '❌ Gagal generate waifu. Coba lagi!'); }
}

// .quote - motivasi
async function handleQuote(jid) {
  try {
    const r = await axios.get('https://api.quotable.io/random', { timeout: 10000 });
    const { content, author } = r.data;
    await sendText(jid,
      `💬 *QUOTE OF THE DAY*\n\n` +
      `_"${content}"_\n\n` +
      `— *${author}*\n\n` +
      `_Powered by Wreck Bot_`
    );
  } catch {
    const quotes = [
      { q: 'Hidup adalah tentang membuat dampak, bukan membuat penghasilan.', a: 'Kevin Kruse' },
      { q: 'Jangan hitung harinya, buatlah hari itu berarti.', a: 'Muhammad Ali' },
      { q: 'Kamu tidak harus hebat untuk memulai, tapi kamu harus mulai untuk menjadi hebat.', a: 'Zig Ziglar' },
      { q: 'Keberhasilan bukan final, kegagalan bukan fatal: yang penting adalah keberanian untuk terus maju.', a: 'Winston Churchill' },
      { q: 'Orang yang tidak pernah membuat kesalahan adalah orang yang tidak pernah mencoba hal baru.', a: 'Albert Einstein' },
    ];
    const q = quotes[~~(Math.random() * quotes.length)];
    await sendText(jid, `💬 *QUOTE*\n\n_"${q.q}"_\n\n— *${q.a}*\n\n_Powered by Wreck Bot_`);
  }
}

// .calc - kalkulator
async function handleCalc(jid, expr) {
  try {
    if (!expr) return sendText(jid, '❌ Format: *.calc* [ekspresi]\nContoh: .calc 10 * 5 + 3');
    // Sanitasi ekspresi — hanya izinkan angka dan operator
    const safe = expr.replace(/[^0-9+\-*/.() %^]/g, '');
    if (!safe) return sendText(jid, '❌ Ekspresi tidak valid!');
    const result = eval(safe); // safe karena sudah disanitasi
    await sendText(jid, `🧮 *KALKULATOR*\n\n📝 ${expr}\n\n✅ *Hasil: ${result}*\n\n_Powered by Wreck Bot_`);
  } catch { await sendText(jid, '❌ Ekspresi matematika tidak valid!\nContoh: .calc 10 * 5 + 3'); }
}

// .ping
async function handlePing(jid) {
  const start = Date.now();
  const m = await sendText(jid, '🏓 _Pong!_');
  const delay = Date.now() - start;
  await sendText(jid,
    `🏓 *PONG!*\n\n` +
    `⚡ *Delay:* ${delay}ms\n` +
    `🕐 *Waktu:* ${nowID()}\n` +
    `🔥 *Status:* Bot Online\n` +
    `⏱️ *Uptime:* ${getUptime()}\n\n` +
    `_Wreck Bot System_`
  );
}

// .runtime
async function handleRuntime(jid) {
  await sendText(jid,
    `⏱️ *SERVER RUNTIME*\n\n` +
    `🕐 *Uptime:* ${getUptime()}\n` +
    `📨 *Pesan Masuk:* ${stats.msg}\n` +
    `⚡ *Perintah:* ${stats.cmd}\n` +
    `💾 *Memory:* ${~~(process.memoryUsage().heapUsed/1024/1024)} MB\n` +
    `🖥️ *Platform:* ${os.platform()} ${os.arch()}\n` +
    `📦 *Node.js:* ${process.version}\n` +
    `🤖 *yt-dlp:* ${toolPath('yt-dlp') ? '✅ Tersedia' : '❌ Tidak ada'}\n` +
    `🎬 *FFmpeg:* ${toolPath('ffmpeg') ? '✅ Tersedia' : '❌ Tidak ada'}\n\n` +
    `_Wreck Bot System_`
  );
}

// .sticker2 - pakai URL
async function handleStickerURL(jid, url) {
  if (!url) return sendText(jid, '❌ Format: *.sticker* [url gambar]\nContoh: .sticker https://i.imgur.com/xxx.jpg');
  try {
    await sendText(jid, '🎭 _Membuat sticker dari URL..._');
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    await sendSticker(jid, Buffer.from(r.data));
  } catch { await sendText(jid, '❌ Gagal buat sticker dari URL!'); }
}

// .translate
async function handleTranslate(jid, args) {
  try {
    const parts = args.split('|');
    if (parts.length < 2) return sendText(jid, '❌ Format: *.translate* [bahasa]|[teks]\nContoh: .translate en|Halo apa kabar');
    const lang = parts[0].trim();
    const text = parts.slice(1).join('|').trim();
    if (!text) return sendText(jid, '❌ Teks tidak boleh kosong!');
    await sendText(jid, '🌐 _Menerjemahkan..._');
    const prompt = `Terjemahkan teks berikut ke bahasa ${lang}, hanya berikan hasil terjemahan saja tanpa penjelasan: "${text}"`;
    const r = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { timeout: 30000, responseType: 'text' });
    const result = typeof r.data === 'string' ? r.data.trim() : null;
    if (result) {
      await sendText(jid, `🌐 *TRANSLATE*\n\n📝 *Original:*\n${text}\n\n✅ *Hasil (${lang}):*\n${result}\n\n_Powered by Wreck AI_`);
    } else throw new Error('empty');
  } catch { await sendText(jid, '❌ Gagal translate. Coba lagi!'); }
}

// .wiki - wikipedia
async function handleWiki(jid, query) {
  if (!query) return sendText(jid, '❌ Format: *.wiki* [kata kunci]\nContoh: .wiki Indonesia');
  try {
    await sendText(jid, `🔍 _Mencari "${query}" di Wikipedia..._`);
    const r = await axios.get(
      `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
      { timeout: 15000 }
    );
    const d = r.data;
    await sendText(jid,
      `📚 *WIKIPEDIA*\n\n` +
      `📌 *${d.title}*\n\n` +
      `${d.extract?.slice(0, 700) || 'Tidak ada deskripsi'}${d.extract?.length > 700 ? '...' : ''}\n\n` +
      `🔗 ${d.content_urls?.desktop?.page || ''}\n\n` +
      `_Powered by Wreck Bot_`
    );
  } catch { await sendText(jid, `❌ Tidak menemukan artikel untuk *${query}*`); }
}

// .info - info bot
async function handleInfo(jid) {
  await sendText(jid,
    `╔══════════════════╗\n` +
    `║   🔥 WRECK BOT   ║\n` +
    `╚══════════════════╝\n\n` +
    `🤖 *Nama:* Wreck Bot\n` +
    `📦 *Versi:* v1.0.0\n` +
    `👤 *Owner:* ${ownerName}\n` +
    `🌐 *Platform:* WhatsApp\n` +
    `⚡ *Library:* Baileys\n` +
    `📅 *Dibuat:* 2026\n` +
    `🔗 *GitHub:* github.com/anonymusyogyakarta-coder/Wreck\n\n` +
    `_Bot serba bisa dengan AI & Downloader_`
  );
}

// .tts - text to speech pakai Google TTS
async function handleTTS(jid, text) {
  if (!text) return sendText(jid, '❌ Format: *.tts* [teks]\nContoh: .tts Halo selamat datang di Wreck Bot');
  try {
    await sendText(jid, '🔊 _Membuat suara..._');
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(text.slice(0,200))}`;
    const r   = await axios.get(url, { responseType:'arraybuffer', timeout:20000, headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'} });
    await sock.sendMessage(jid, { audio: Buffer.from(r.data), mimetype: 'audio/mpeg', ptt: true });
  } catch { await sendText(jid, '❌ Gagal buat TTS. Coba lagi!'); }
}

// .lirik - cari lirik lagu
async function handleLirik(jid, query) {
  if (!query) return sendText(jid, '❌ Format: *.lirik* [judul lagu]\nContoh: .lirik Apatis Hindia');
  try {
    await sendText(jid, `🎵 _Mencari lirik "${query}"..._`);
    const r = await axios.get(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`, { timeout: 15000 });
    const song = r.data?.data?.[0];
    if (!song) throw new Error('not found');
    const r2 = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`, { timeout: 15000 });
    const lyric = r2.data?.lyrics?.slice(0, 3000) || '';
    await sendText(jid,
      `🎵 *${song.title}*\n` +
      `👤 ${song.artist.name}\n\n` +
      `${lyric}${lyric.length >= 3000 ? '\n\n_...lirik terpotong_' : ''}\n\n` +
      `_Powered by Wreck Bot_`
    );
  } catch { await sendText(jid, `❌ Lirik untuk *${query}* tidak ditemukan!`); }
}

// .menu
async function handleMenu(jid, name) {
  const uptime = getUptime();
  const now    = nowID();
  await sendText(jid,
    `╔═══════════════════════════╗\n` +
    `║     WRECK BOT  v1.0    ║\n` +
    `╚═══════════════════════════╝\n` +
    `👤 *Owner :* ${ZEXR03}\n` +
    `⏱️ *Uptime:* ${uptime}\n` +
    `📨 *Pesan :* ${stats.msg} masuk\n` +
    `🕐 *Waktu :* ${now}\n` +
    `🌐 *Akses :* Semua Pengguna (Publik)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

    `📥 *[ MEDIA DOWNLOADER ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🎵 *.ytm* <link>\n` +
    `│    Download lagu dari YouTube jadi file MP3\n` +
    `│    Contoh: .ytm https://youtu.be/xxx\n` +
    `│\n` +
    `│ 🎬 *.ytv* <link>\n` +
    `│    Download video dari YouTube (MP4)\n` +
    `│    Contoh: .ytv https://youtu.be/xxx\n` +
    `│\n` +
    `│ 🎵 *.dtt* <link>\n` +
    `│    Download video TikTok tanpa watermark\n` +
    `│    Contoh: .dtt https://vm.tiktok.com/xxx\n` +
    `│\n` +
    `│ 📸 *.igdw* <link>\n` +
    `│    Download foto/video dari Instagram\n` +
    `│    Contoh: .igdw https://instagram.com/p/xxx\n` +
    `│\n` +
    `│ 🔊 *.vs* [reply video]\n` +
    `│    Ubah video menjadi file audio/suara\n` +
    `│    Cara: Reply video lalu ketik .vs\n` +
    `└─────────────────────────\n\n` +

    `🤖 *[ AI & KREATIF ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🧠 *.ai* <pertanyaan>\n` +
    `│    Tanya apa saja ke Wreck AI (Bahasa Indonesia)\n` +
    `│    Contoh: .ai Apa itu blackhole?\n` +
    `│\n` +
    `│ 🎨 *.generate* <deskripsi>\n` +
    `│    Buat gambar dari teks menggunakan AI\n` +
    `│    Contoh: .generate kucing lucu di angkasa\n` +
    `│\n` +
    `│ 🌐 *.translate* <bahasa>|<teks>\n` +
    `│    Terjemahkan teks ke bahasa lain\n` +
    `│    Contoh: .translate en|Halo apa kabar\n` +
    `│\n` +
    `│ 🔊 *.tts* <teks>\n` +
    `│    Ubah teks menjadi suara (Text to Speech)\n` +
    `│    Contoh: .tts Selamat datang di Wreck Bot\n` +
    `└─────────────────────────\n\n` +

    `🌤️ *[ INFORMASI ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🌤️ *.cuaca* <nama kota>\n` +
    `│    Cek cuaca, suhu & kecepatan angin suatu kota\n` +
    `│    Contoh: .cuaca Yogyakarta\n` +
    `│\n` +
    `│ 📚 *.wiki* <kata kunci>\n` +
    `│    Cari informasi dari Wikipedia Indonesia\n` +
    `│    Contoh: .wiki Gunung Merapi\n` +
    `│\n` +
    `│ 🎵 *.lirik* <judul lagu>\n` +
    `│    Cari lirik lagu apa saja\n` +
    `│    Contoh: .lirik Apatis Hindia\n` +
    `└─────────────────────────\n\n` +

    `🎮 *[ FUN & TOOLS ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🐱 *.neko*\n` +
    `│    Kirim gambar anime neko girl random\n` +
    `│\n` +
    `│ 🌸 *.waifu*\n` +
    `│    Kirim gambar anime waifu random\n` +
    `│\n` +
    `│ 💬 *.quote*\n` +
    `│    Kirim kata-kata motivasi random\n` +
    `│\n` +
    `│ 🧮 *.calc* <ekspresi>\n` +
    `│    Hitung matematika (+ - * / %)\n` +
    `│    Contoh: .calc 25 * 4 + 100\n` +
    `│\n` +
    `│ 🎭 *.s* [kirim/reply foto atau video]\n` +
    `│    Ubah foto atau video menjadi sticker WA\n` +
    `│    Cara 1: Kirim foto dengan caption .s\n` +
    `│    Cara 2: Reply foto/video lalu ketik .s\n` +
    `│\n` +
    `│ 🖼️ *.sticker* <url gambar>\n` +
    `│    Ubah gambar dari internet jadi sticker\n` +
    `│    Contoh: .sticker https://i.imgur.com/xxx.jpg\n` +
    `└─────────────────────────\n\n` +

    `📊 *[ BOT INFO ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🏓 *.ping* — Cek kecepatan respon bot\n` +
    `│ 📡 *.runtime* — Lihat status & info server\n` +
    `│ ℹ️  *.info* — Tentang Wreck Bot\n` +
    `│ 📋 *.menu* — Tampilkan daftar perintah ini\n` +
    `└─────────────────────────\n\n` +

    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 Halo *${name}*! Semua perintah gratis untuk semua orang 🔥\n` +
    `💡 _Ketik perintah sesuai contoh di atas_\n` +
    `🔥 _Wreck Bot System — pure console base_`
  );
}

// ══════════════════════════════════════
// MAIN BOT
// ══════════════════════════════════════
async function startBot() {
  showBanner();
  await fs.ensureDir(TMP_DIR);
  await pullGithub();

  const ytBin = toolPath('yt-dlp');
  const ffBin = toolPath('ffmpeg');
  console.log(ytBin ? chalk.green(`  ✅ yt-dlp: ${ytBin}`) : chalk.yellow('  ⚠️  yt-dlp tidak ada! Jalankan: pkg install yt-dlp -y'));
  console.log(ffBin ? chalk.green(`  ✅ ffmpeg: ${ffBin}`) : chalk.yellow('  ⚠️  ffmpeg tidak ada (optional)'));
  console.log('');

  await fs.ensureDir(SESSION_DIR);
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version }          = await fetchLatestBaileysVersion();

  let fullPhone = '';
  if (!state.creds.registered) {
    console.log(chalk.yellow('\n  📱 Belum ada session. Login dengan Pairing Code.\n'));
    const cc  = await ask(chalk.cyan('  Kode negara (contoh: 62): '));
    const num = await ask(chalk.cyan('  Nomor WA (tanpa 0): '));
    fullPhone = (cc.replace(/\D/g,'') + num.replace(/\D/g,'').replace(/^0/,'')).trim();
    console.log(chalk.yellow(`\n  ⏳ Menyiapkan koneksi untuk +${fullPhone}...\n`));
  }

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level:'silent' })) },
    browser: ['Ubuntu', 'Chrome', '22.04'],
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
  });

  if (fullPhone) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const code = await sock.requestPairingCode(fullPhone);
      const fmt  = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(chalk.bgRed.white.bold(`\n  ╔══════════════════════════════╗`));
      console.log(chalk.bgRed.white.bold(`  ║  🔥 PAIRING CODE: ${fmt.padEnd(9)}  ║`));
      console.log(chalk.bgRed.white.bold(`  ╚══════════════════════════════╝\n`));
      console.log(chalk.gray('  1. WhatsApp → ⋮ → Perangkat Tertaut → Tautkan Perangkat'));
      console.log(chalk.gray('  2. Tautkan dengan nomor telepon'));
      console.log(chalk.gray(`  3. Masukkan kode: `) + chalk.red.bold(fmt) + '\n');
    } catch (e) {
      console.log(chalk.red('  ❌ Gagal dapat pairing code: ' + e.message));
      await fs.remove(SESSION_DIR); process.exit(1);
    }
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0];
      console.log(chalk.green(`\n  ✅ Wreck terhubung! +${phone}`));
      console.log(chalk.cyan('  🔥 Bot siap! CTRL+C untuk berhenti\n'));
      console.log(chalk.gray('  ─────────────────────────────────────────────────'));
      await syncGithub();
      setInterval(syncGithub, 30 * 60 * 1000);
      setInterval(() => {
        console.log(chalk.gray(`  [${new Date().toLocaleTimeString('id-ID')}] ${getUptimeFmt()} | Pesan: ${stats.msg} | Cmd: ${stats.cmd}`));
      }, 5 * 60 * 1000);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const recon = code !== DisconnectReason.loggedOut;
      console.log(chalk.red(`\n  ⚠️  Terputus (${code})`));
      if (recon) { console.log(chalk.yellow('  🔄 Reconnecting...\n')); setTimeout(startBot, 5000); }
      else { await fs.remove(SESSION_DIR); process.exit(1); }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid  = msg.key.remoteJid;
      if (!jid) continue;
      const body = getBody(msg);
      if (!body.startsWith('.')) continue;
      const [rawCmd, ...argArr] = body.trim().split(' ');
      const cmd  = rawCmd.toLowerCase();
      const args = argArr.join(' ').trim();
      const name = msg.pushName || 'User';
      stats.msg++; stats.cmd++;
      const ts = new Date().toLocaleTimeString('id-ID', { hour12:false });
      console.log(chalk.magenta(`  [${ts}]`) + chalk.white(` ${name}: `) + chalk.cyan(body));
      try {
        switch(cmd) {
          case '.ai':        if (!args) { await sendText(jid, '❌ Format: .ai [pertanyaan]'); break; } await handleAI(jid, args); break;
          case '.generate':  if (!args) { await sendText(jid, '❌ Format: .generate [prompt]'); break; } await handleGenerate(jid, args); break;
          case '.cuaca':     if (!args) { await sendText(jid, '❌ Format: .cuaca [kota]'); break; } await handleCuaca(jid, args); break;
          case '.s':         await handleSticker(jid, msg); break;
          case '.sticker':   await handleStickerURL(jid, args); break;
          case '.ytm':       await handleYTMusic(jid, args); break;
          case '.ytv':       await handleYTVideo(jid, args); break;
          case '.dtt':       await handleTikTok(jid, args); break;
          case '.vs':        await handleVS(jid, msg); break;
          case '.igdw':      await handleIG(jid, args); break;
          case '.neko':      await handleNeko(jid); break;
          case '.waifu':     await handleWaifu(jid); break;
          case '.quote':     await handleQuote(jid); break;
          case '.calc':      await handleCalc(jid, args); break;
          case '.ping':      await handlePing(jid); break;
          case '.runtime':   await handleRuntime(jid); break;
          case '.info':      await handleInfo(jid); break;
          case '.translate': if (!args) { await sendText(jid, '❌ Format: .translate [lang]|[teks]\nContoh: .translate en|Halo'); break; } await handleTranslate(jid, args); break;
          case '.wiki':      if (!args) { await sendText(jid, '❌ Format: .wiki [kata kunci]'); break; } await handleWiki(jid, args); break;
          case '.tts':       if (!args) { await sendText(jid, '❌ Format: .tts [teks]'); break; } await handleTTS(jid, args); break;
          case '.lirik':     if (!args) { await sendText(jid, '❌ Format: .lirik [judul lagu]'); break; } await handleLirik(jid, args); break;
          case '.menu':      await handleMenu(jid, name); break;
          default: break;
        }
      } catch(e) {
        console.log(chalk.red(`  ❌ Error ${cmd}: ${e.message}`));
        await sendText(jid, `❌ Error: ${e.message}`);
      }
    }
  });
}

startBot().catch(e => { console.error(chalk.red('Fatal: ' + e.message)); process.exit(1); });
