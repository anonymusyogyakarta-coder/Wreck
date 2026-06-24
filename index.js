const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const pino   = require('pino');
const fs     = require('fs-extra');
const axios  = require('axios');
const rl     = require('readline');
const chalk  = require('chalk');
const { exec, execSync } = require('child_process');
const path   = require('path');
const os     = require('os');

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
const ownerName = 'Anonymous Yogyakarta Coder';
let sock  = null;
let stats = { msg: 0, cmd: 0, startTime: Date.now() };

// ══════════════════════════════════════
// UTILS
// ══════════════════════════════════════
const ask = (q) => new Promise(res => {
  const r = rl.createInterface({ input: process.stdin, output: process.stdout });
  r.question(q, a => { r.close(); res(a.trim()); });
});

const runCmd = (cmd, timeout = 240000) => new Promise((res, rej) => {
  exec(cmd, { timeout, maxBuffer: 300 * 1024 * 1024, env: TERMUX_ENV },
    (e, out, err) => e ? rej(new Error((err || e.message).split('\n')[0])) : res(out.trim())
  );
});

const toolPath = (tool) => {
  const p = `${TERMUX_BIN}/${tool}`;
  if (fs.existsSync(p)) return p;
  try { return execSync(`which ${tool}`, { env: TERMUX_ENV, encoding: 'utf8' }).trim(); } catch {}
  return null;
};

const getUptime = () => {
  const s = ~~((Date.now() - stats.startTime) / 1000);
  return `${~~(s/3600)} Jam, ${~~((s%3600)/60)} Menit, ${s%60} Detik`;
};
const getUptimeFmt = () => {
  const s = ~~((Date.now() - stats.startTime) / 1000);
  return `${String(~~(s/3600)).padStart(2,'0')}:${String(~~((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};
const nowID = () => new Date().toLocaleString('id-ID', { dateStyle:'short', timeStyle:'medium' });

// ══════════════════════════════════════
// SEND HELPERS
// ══════════════════════════════════════
const sendText    = (jid, text)        => sock?.sendMessage(jid, { text });
const sendImage   = (jid, buf, cap='') => sock?.sendMessage(jid, { image: buf, caption: cap });
const sendAudio   = (jid, buf)         => sock?.sendMessage(jid, { audio: buf, mimetype: 'audio/mp4', ptt: false });
const sendVoice   = (jid, buf)         => sock?.sendMessage(jid, { audio: buf, mimetype: 'audio/mpeg', ptt: true });
const sendVideo   = (jid, buf, cap='') => sock?.sendMessage(jid, { video: buf, caption: cap });
const sendSticker = (jid, buf)         => sock?.sendMessage(jid, { sticker: buf });

// ══════════════════════════════════════
// MESSAGE PARSER
// ══════════════════════════════════════
const getBody = (msg) =>
  msg.message?.conversation ||
  msg.message?.extendedTextMessage?.text ||
  msg.message?.imageMessage?.caption ||
  msg.message?.videoMessage?.caption || '';

const getQuoted = (msg) =>
  msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

// ── Download media dengan cara yang benar ──
async function dlMedia(msg, type) {
  // Coba dari pesan langsung
  const direct = msg.message?.[`${type}Message`];
  if (direct) {
    return await downloadMediaMessage(
      { message: { [`${type}Message`]: direct } },
      'buffer', {},
      { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
    );
  }
  // Coba dari quoted
  const q = getQuoted(msg);
  if (q?.[`${type}Message`]) {
    return await downloadMediaMessage(
      { message: { [`${type}Message`]: q[`${type}Message`] } },
      'buffer', {},
      { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
    );
  }
  return null;
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
// yt-dlp HELPER
// ══════════════════════════════════════
async function ytdlp(url, opts = {}) {
  await fs.ensureDir(TMP_DIR);
  const bin  = toolPath('yt-dlp') || 'yt-dlp';
  const ts   = Date.now();
  const base = path.join(TMP_DIR, `wreck_${ts}`);
  let cmd;
  if (opts.audio) {
    cmd = `"${bin}" -x --audio-format m4a --audio-quality 0 --no-playlist --no-warnings -o "${base}.m4a" "${url}"`;
  } else {
    cmd = `"${bin}" -f "best[ext=mp4][filesize<49M]/best[ext=mp4]/best" --no-playlist --no-warnings -o "${base}.%(ext)s" "${url}"`;
  }
  await runCmd(cmd, 240000);
  const files = (await fs.readdir(TMP_DIR)).filter(f => f.startsWith(`wreck_${ts}`)).map(f => path.join(TMP_DIR, f));
  if (!files.length) throw new Error('File tidak ditemukan setelah download');
  return files[0];
}
const cleanFile = async (f) => { try { if (f && await fs.pathExists(f)) await fs.remove(f); } catch {} };

// ══════════════════════════════════════
// FEATURES
// ══════════════════════════════════════

// .ai
async function handleAI(jid, query) {
  await sendText(jid, '🤖 _Wreck AI sedang berpikir..._');
  const prompt = `Kamu adalah Wreck AI, asisten cerdas yang selalu menjawab dalam Bahasa Indonesia yang jelas, ramah, dan mudah dipahami. Jawab pertanyaan ini dengan baik: ${query}`;
  try {
    const r = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
      { timeout:40000, responseType:'text', headers:{'Accept':'text/plain','User-Agent':'Mozilla/5.0'} });
    const ans = typeof r.data === 'string' ? r.data.trim() : null;
    if (ans?.length > 3) return sendText(jid, `🤖 *Wreck AI*\n\n${ans}\n\n_Powered by Wreck Bot_ 🔥`);
    throw new Error('empty');
  } catch {
    try {
      const r2 = await axios.post('https://text.pollinations.ai/', {
        messages: [
          { role:'system', content:'Kamu adalah Wreck AI. Selalu jawab dalam Bahasa Indonesia yang baik, jelas, dan mudah dipahami.' },
          { role:'user', content: query }
        ], model:'openai', seed: ~~(Math.random()*9999)
      }, { timeout:40000, responseType:'text' });
      const ans2 = typeof r2.data === 'string' ? r2.data.trim() : null;
      if (ans2?.length > 3) return sendText(jid, `🤖 *Wreck AI*\n\n${ans2}\n\n_Powered by Wreck Bot_ 🔥`);
    } catch {}
    await sendText(jid, '❌ Wreck AI sedang sibuk. Coba lagi nanti!');
  }
}

// .generate
async function handleGenerate(jid, prompt) {
  await sendText(jid, '🎨 _Sedang membuat gambar, tunggu ya..._');
  try {
    const seed = ~~(Math.random()*999999);
    const r = await axios.get(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&seed=${seed}&model=flux`,
      { responseType:'arraybuffer', timeout:90000, headers:{'User-Agent':'Mozilla/5.0'} }
    );
    if (r.data?.byteLength > 500) return sendImage(jid, Buffer.from(r.data), `🎨 *${prompt}*\n_Generated by Wreck AI_`);
    throw new Error('empty');
  } catch {
    try {
      const r2 = await axios.get(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true`,
        { responseType:'arraybuffer', timeout:90000 });
      await sendImage(jid, Buffer.from(r2.data), `🎨 *${prompt}*\n_Generated by Wreck AI_`);
    } catch { await sendText(jid, '❌ Gagal generate gambar. Coba lagi!'); }
  }
}

// .cuaca
async function handleCuaca(jid, kota) {
  await sendText(jid, `🌤️ _Mengambil data cuaca ${kota}..._`);
  try {
    const r = await axios.get(`https://wttr.in/${encodeURIComponent(kota)}?format=j1`,
      { timeout:15000, headers:{'User-Agent':'curl/7.68.0','Accept':'application/json'} });
    const w    = r.data?.current_condition?.[0];
    const area = r.data?.nearest_area?.[0];
    const neg  = area?.country?.[0]?.value || '';
    await sendText(jid,
      `╔══════════════════╗\n║  🌤️  INFO CUACA  ║\n╚══════════════════╝\n\n` +
      `📍 *Lokasi  :* ${kota.toUpperCase()}${neg ? ', ' + neg : ''}\n` +
      `🌡️ *Suhu    :* ${w?.temp_C}°C (terasa ${w?.FeelsLikeC}°C)\n` +
      `💧 *Lembab  :* ${w?.humidity}%\n` +
      `💨 *Angin   :* ${w?.windspeedKmph} km/h arah ${w?.winddir16Point}\n` +
      `☁️ *Kondisi :* ${w?.weatherDesc?.[0]?.value}\n` +
      `👁️ *Visibil :* ${w?.visibility} km\n` +
      `⛅ *Awan    :* ${w?.cloudcover}%\n` +
      `🌧️ *Hujan   :* ${w?.precipMM} mm\n` +
      `\n🕐 *Update :* ${nowID()}\n_Wreck Weather System_ 🔥`
    );
  } catch { await sendText(jid, `❌ Kota *${kota}* tidak ditemukan!\nContoh: *.cuaca Yogyakarta*`); }
}

// .s - STICKER (konversi ke WebP pakai ffmpeg agar tidak hitam)
async function handleSticker(jid, msg) {
  try {
    const imgDirect = msg.message?.imageMessage;
    const vidDirect = msg.message?.videoMessage;
    const q         = getQuoted(msg);
    const imgQ      = q?.imageMessage;
    const vidQ      = q?.videoMessage;

    if (!imgDirect && !vidDirect && !imgQ && !vidQ) {
      return sendText(jid,
        '🎭 *CARA BUAT STICKER*\n\n' +
        '📌 *Metode 1 — Langsung:*\n' +
        'Kirim foto dengan caption *.s*\n\n' +
        '📌 *Metode 2 — Reply:*\n' +
        '1. Tekan lama foto/video\n' +
        '2. Ketuk *Balas*\n' +
        '3. Ketik *.s* lalu kirim\n\n' +
        '📌 *Metode 3 — dari URL:*\n' +
        'Ketik *.sticker* [url gambar]'
      );
    }

    await sendText(jid, '🎭 _Membuat sticker, harap tunggu..._');

    // Download buffer media
    let buf = null;
    if (imgDirect || vidDirect) {
      buf = await downloadMediaMessage(
        msg, 'buffer', {},
        { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
      );
    } else {
      const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = {
        key: { remoteJid: jid, id: ctxInfo?.stanzaId || '', participant: ctxInfo?.participant || '' },
        message: q
      };
      buf = await downloadMediaMessage(
        quotedMsg, 'buffer', {},
        { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
      );
    }

    if (!buf || buf.length < 50) throw new Error('Media kosong atau rusak');
    const inputBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

    // Konversi ke WebP pakai ffmpeg — WAJIB agar sticker tidak hitam
    await fs.ensureDir(TMP_DIR);
    const ts      = Date.now();
    const isVideo = !!(vidDirect || vidQ);
    const inExt   = isVideo ? '.mp4' : '.jpg';
    const inPath  = path.join(TMP_DIR, `stk_in_${ts}${inExt}`);
    const outPath = path.join(TMP_DIR, `stk_out_${ts}.webp`);
    await fs.writeFile(inPath, inputBuf);

    const ffmpeg = toolPath('ffmpeg');
    let stickerSent = false;

    if (ffmpeg) {
      try {
        if (!isVideo) {
          // Gambar → WebP sticker
          await runCmd(
            `"${ffmpeg}" -y -i "${inPath}" ` +
            `-vf "scale='if(gt(iw,ih),512,-1)':'if(gt(iw,ih),-1,512)',` +
            `pad=512:512:(512-iw)/2:(512-ih)/2:color=white@0.0,format=rgba" ` +
            `-quality 90 "${outPath}"`,
            30000
          );
        } else {
          // Video → Animated WebP sticker
          await runCmd(
            `"${ffmpeg}" -y -i "${inPath}" -t 6 ` +
            `-vf "scale=512:512:force_original_aspect_ratio=decrease,` +
            `pad=512:512:(ow-iw)/2:(oh-ih)/2,fps=12,format=rgba" ` +
            `-vcodec libwebp -lossless 0 -quality 80 -loop 0 -an "${outPath}"`,
            60000
          );
        }
        if (await fs.pathExists(outPath)) {
          const webpBuf = await fs.readFile(outPath);
          if (webpBuf.length > 100) {
            await sendSticker(jid, webpBuf);
            stickerSent = true;
          }
        }
      } catch (ffErr) {
        console.log(chalk.yellow('  ⚠️ ffmpeg error: ' + ffErr.message + ' — trying fallback'));
      }
    }

    // Fallback: kirim buffer langsung tanpa konversi
    if (!stickerSent) {
      await sendSticker(jid, inputBuf);
    }

    await cleanFile(inPath);
    await cleanFile(outPath);

  } catch (e) {
    await sendText(jid,
      `❌ *Gagal buat sticker!*\n_${e.message}_\n\n` +
      `*Tips:*\n` +
      `• Kirim foto (bukan file/dokumen)\n` +
      `• Install ffmpeg: *pkg install ffmpeg -y*`
    );
  }
}

// .sticker dari URL
async function handleStickerURL(jid, url) {
  if (!url) return sendText(jid, '❌ Format: *.sticker* [url gambar]\nContoh: .sticker https://i.imgur.com/xxx.jpg');
  try {
    await sendText(jid, '🎭 _Membuat sticker dari URL..._');
    const r = await axios.get(url, { responseType:'arraybuffer', timeout:30000 });
    await sendSticker(jid, Buffer.from(r.data));
  } catch { await sendText(jid, '❌ Gagal buat sticker dari URL!'); }
}

// .ytm
async function handleYTMusic(jid, url) {
  if (!url?.match(/youtu/)) return sendText(jid, '❌ Format: *.ytm* [link YouTube]\nContoh: .ytm https://youtu.be/xxx');
  if (!toolPath('yt-dlp')) return sendText(jid, '❌ yt-dlp belum ada!\nInstall: *pkg install yt-dlp -y*');
  await sendText(jid, '🎵 _Mengunduh musik dari YouTube..._');
  let f = null;
  try {
    f = await ytdlp(url, { audio:true });
    await sendAudio(jid, await fs.readFile(f));
    await sendText(jid, '✅ *Download musik selesai!*\n_Powered by Wreck Downloader_ 🔥');
  } catch (e) { await sendText(jid, '❌ Gagal download musik: ' + e.message); }
  finally { await cleanFile(f); }
}

// .ytv
async function handleYTVideo(jid, url) {
  if (!url?.match(/youtu/)) return sendText(jid, '❌ Format: *.ytv* [link YouTube]\nContoh: .ytv https://youtu.be/xxx');
  if (!toolPath('yt-dlp')) return sendText(jid, '❌ yt-dlp belum ada!\nInstall: *pkg install yt-dlp -y*');
  await sendText(jid, '▶️ _Mengunduh video YouTube..._');
  let f = null;
  try {
    f = await ytdlp(url, { audio:false });
    await sendVideo(jid, await fs.readFile(f), '▶️ *YouTube Video*\n_Powered by Wreck Downloader_ 🔥');
  } catch (e) { await sendText(jid, '❌ Gagal download video: ' + e.message); }
  finally { await cleanFile(f); }
}

// .dtt - TikTok (fix: kirim sebagai video bukan audio)
async function handleTikTok(jid, url) {
  if (!url?.match(/tiktok|vm\.tik|vt\.tik/)) return sendText(jid, '❌ Format: *.dtt* [link TikTok]\nContoh: .dtt https://vt.tiktok.com/xxx');
  if (!toolPath('yt-dlp')) return sendText(jid, '❌ yt-dlp belum ada!\nInstall: *pkg install yt-dlp -y*');
  await sendText(jid, '🎵 _Mengunduh TikTok tanpa watermark..._');
  await fs.ensureDir(TMP_DIR);
  const bin = toolPath('yt-dlp');
  const out = path.join(TMP_DIR, `wreck_tt_${Date.now()}.mp4`);
  try {
    // Download langsung sebagai mp4
    await runCmd(`"${bin}" -f "mp4/best[ext=mp4]/best" --no-playlist --merge-output-format mp4 --no-warnings -o "${out}" "${url}"`, 180000);
    if (!await fs.pathExists(out)) throw new Error('File tidak ada');
    const buf = await fs.readFile(out);
    if (buf.length < 1000) throw new Error('File terlalu kecil');
    await sendVideo(jid, buf, '🎵 *TikTok No Watermark*\n_Powered by Wreck Downloader_ 🔥');
  } catch {
    // Fallback tanpa format spesifik
    try {
      const out2 = path.join(TMP_DIR, `wreck_tt2_${Date.now()}.mp4`);
      await runCmd(`"${bin}" --no-playlist --no-warnings -o "${out2}" "${url}"`, 180000);
      if (await fs.pathExists(out2)) {
        await sendVideo(jid, await fs.readFile(out2), '🎵 *TikTok Download*\n_Powered by Wreck Downloader_ 🔥');
        await cleanFile(out2);
      } else throw new Error('Semua metode gagal');
    } catch (e2) { await sendText(jid, '❌ Gagal download TikTok: ' + e2.message); }
  } finally { await cleanFile(out); }
}

// .vs - Video ke Audio (fix downloadMediaMessage)
async function handleVS(jid, msg) {
  try {
    const q      = getQuoted(msg);
    const vidDirect = msg.message?.videoMessage;
    const vidQ   = q?.videoMessage;
    if (!vidDirect && !vidQ) return sendText(jid, '❌ Cara pakai:\n1. Kirim video\n2. Reply video dengan *.vs*');
    await sendText(jid, '🎵 _Mengkonversi video ke audio..._');

    let buf;
    if (vidDirect) {
      buf = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level:'silent' }), reuploadRequest: sock.updateMediaMessage });
    } else {
      buf = await downloadMediaMessage({ message: { videoMessage: vidQ } }, 'buffer', {}, { logger: pino({ level:'silent' }), reuploadRequest: sock.updateMediaMessage });
    }

    if (!buf) throw new Error('Gagal download video');
    const vidBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

    await fs.ensureDir(TMP_DIR);
    const vidPath = path.join(TMP_DIR, `wreck_vs_${Date.now()}.mp4`);
    const audPath = vidPath.replace('.mp4', '.m4a');
    await fs.writeFile(vidPath, vidBuf);

    const ffmpeg = toolPath('ffmpeg');
    if (ffmpeg) {
      await runCmd(`"${ffmpeg}" -i "${vidPath}" -vn -acodec copy "${audPath}" -y`, 60000);
      if (await fs.pathExists(audPath)) {
        await sendAudio(jid, await fs.readFile(audPath));
        await cleanFile(audPath);
      } else {
        // Fallback re-encode
        const audPath2 = vidPath.replace('.mp4', '_re.m4a');
        await runCmd(`"${ffmpeg}" -i "${vidPath}" -vn -ar 44100 -ac 2 "${audPath2}" -y`, 60000);
        await sendAudio(jid, await fs.readFile(audPath2));
        await cleanFile(audPath2);
      }
    } else {
      // Tanpa ffmpeg, kirim buffer langsung
      await sendAudio(jid, vidBuf);
    }
    await cleanFile(vidPath);
    await sendText(jid, '✅ *Konversi selesai!*\n_Powered by Wreck Bot_ 🔥');
  } catch (e) { await sendText(jid, '❌ Gagal konversi: ' + e.message); }
}

// .igdw
async function handleIG(jid, url) {
  if (!url?.match(/instagram|instagr\.am/)) return sendText(jid, '❌ Format: *.igdw* [link Instagram]\nContoh: .igdw https://instagram.com/p/xxx');
  if (!toolPath('yt-dlp')) return sendText(jid, '❌ yt-dlp belum ada!\nInstall: *pkg install yt-dlp -y*');
  await sendText(jid, '📸 _Mengunduh dari Instagram..._');
  await fs.ensureDir(TMP_DIR);
  const base = path.join(TMP_DIR, `wreck_ig_${Date.now()}`);
  const bin  = toolPath('yt-dlp');
  try {
    await runCmd(`"${bin}" --no-playlist --no-warnings -o "${base}.%(ext)s" "${url}"`, 180000);
    const files = (await fs.readdir(TMP_DIR)).filter(f => f.startsWith(path.basename(base))).map(f => path.join(TMP_DIR, f));
    if (!files.length) throw new Error('Tidak ada file terdownload');
    for (const f of files) {
      const buf = await fs.readFile(f);
      const isVid = /\.(mp4|mov|webm|mkv)$/i.test(f);
      if (isVid) await sendVideo(jid, buf, '📸 *Instagram Download*\n_Powered by Wreck_ 🔥');
      else await sendImage(jid, buf, '📸 *Instagram Download*\n_Powered by Wreck_ 🔥');
      await cleanFile(f);
    }
  } catch (e) { await sendText(jid, '❌ Gagal download Instagram: ' + e.message); }
}

// .neko
async function handleNeko(jid) {
  await sendText(jid, '🐱 _Generating neko girl..._');
  try {
    let imgUrl = null;
    for (const ep of ['https://nekos.life/api/v2/img/neko','https://api.waifu.pics/sfw/neko','https://nekos.best/api/v2/neko']) {
      try { const r = await axios.get(ep,{timeout:8000}); imgUrl = r.data?.url||r.data?.results?.[0]?.url; if(imgUrl) break; } catch {}
    }
    if (!imgUrl) imgUrl = `https://image.pollinations.ai/prompt/cute%20anime%20neko%20cat%20girl%20kawaii%20high%20quality?width=512&height=512&nologo=true&seed=${~~(Math.random()*99999)}`;
    const img = await axios.get(imgUrl,{responseType:'arraybuffer',timeout:30000});
    await sendImage(jid, Buffer.from(img.data), '🐱 *Neko Girl!*\n_Ketik .neko lagi untuk gambar berbeda~_');
  } catch { await sendText(jid,'❌ Gagal generate neko. Coba lagi!'); }
}

// .waifu
async function handleWaifu(jid) {
  await sendText(jid, '🌸 _Generating waifu..._');
  try {
    let imgUrl = null;
    for (const ep of ['https://api.waifu.pics/sfw/waifu','https://nekos.life/api/v2/img/waifu']) {
      try { const r = await axios.get(ep,{timeout:8000}); imgUrl = r.data?.url; if(imgUrl) break; } catch {}
    }
    if (!imgUrl) imgUrl = `https://image.pollinations.ai/prompt/beautiful%20anime%20waifu%20girl%20stunning?width=512&height=512&nologo=true&seed=${~~(Math.random()*99999)}`;
    const img = await axios.get(imgUrl,{responseType:'arraybuffer',timeout:30000});
    await sendImage(jid, Buffer.from(img.data), '🌸 *Waifu!*\n_Ketik .waifu lagi untuk gambar berbeda~_');
  } catch { await sendText(jid,'❌ Gagal generate waifu. Coba lagi!'); }
}

// .quote
async function handleQuote(jid) {
  const fallback = [
    { q:'Hidup adalah tentang membuat dampak, bukan membuat penghasilan.', a:'Kevin Kruse' },
    { q:'Jangan hitung harinya, buatlah hari itu berarti.', a:'Muhammad Ali' },
    { q:'Kamu tidak harus hebat untuk memulai, tapi harus mulai untuk menjadi hebat.', a:'Zig Ziglar' },
    { q:'Satu-satunya cara untuk melakukan pekerjaan hebat adalah mencintai apa yang kamu lakukan.', a:'Steve Jobs' },
    { q:'Kesuksesan bukanlah kunci kebahagiaan. Kebahagiaan adalah kunci kesuksesan.', a:'Albert Schweitzer' },
    { q:'Jangan takut bermimpi besar, tapi jangan lupa untuk bangun dan bekerja keras.', a:'Unknown' },
    { q:'Setiap hari adalah kesempatan baru untuk menjadi lebih baik dari kemarin.', a:'Unknown' },
  ];
  try {
    const r = await axios.get('https://api.quotable.io/random',{timeout:8000});
    await sendText(jid, `💬 *QUOTE OF THE DAY*\n\n_"${r.data.content}"_\n\n— *${r.data.author}*\n\n_Powered by Wreck Bot_ 🔥`);
  } catch {
    const q = fallback[~~(Math.random()*fallback.length)];
    await sendText(jid, `💬 *QUOTE OF THE DAY*\n\n_"${q.q}"_\n\n— *${q.a}*\n\n_Powered by Wreck Bot_ 🔥`);
  }
}

// .calc - FIX: handle x sebagai perkalian, support lebih banyak operator
async function handleCalc(jid, expr) {
  if (!expr) return sendText(jid, '❌ Format: *.calc* [ekspresi]\nContoh:\n.calc 10 x 5\n.calc 100 / 4\n.calc 2 ^ 8');
  try {
    // Normalisasi ekspresi
    let safe = expr
      .replace(/[×xX]/g, '*')     // × atau x → *
      .replace(/[÷]/g, '/')        // ÷ → /
      .replace(/\^/g, '**')        // ^ → **
      .replace(/[^0-9+\-*/.() %]/g, '')  // hapus karakter berbahaya
      .trim();
    if (!safe) return sendText(jid, '❌ Ekspresi tidak valid!');
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + safe + ')')();
    if (!isFinite(result)) throw new Error('Hasil tidak valid');
    // Format hasil
    const fmt = Number.isInteger(result) ? result.toLocaleString('id-ID') : parseFloat(result.toFixed(10)).toLocaleString('id-ID');
    await sendText(jid,
      `🧮 *KALKULATOR WRECK*\n\n` +
      `📝 *Input  :* ${expr}\n` +
      `✏️ *Proses :* ${safe}\n` +
      `✅ *Hasil  :* *${fmt}*\n\n` +
      `_Powered by Wreck Bot_ 🔥`
    );
  } catch (e) {
    await sendText(jid,
      `❌ Ekspresi tidak valid!\n\n` +
      `*Operator yang tersedia:*\n` +
      `➕ Tambah : 10 + 5\n` +
      `➖ Kurang : 10 - 5\n` +
      `✖️ Kali   : 10 x 5 atau 10 * 5\n` +
      `➗ Bagi   : 10 / 5\n` +
      `🔢 Pangkat: 2 ^ 8\n` +
      `📊 Modulo : 10 % 3`
    );
  }
}

// .ping
async function handlePing(jid) {
  const start = Date.now();
  await sendText(jid, '🏓 _Pong!_');
  const delay = Date.now() - start;
  await sendText(jid,
    `🏓 *PONG!*\n\n` +
    `⚡ *Delay  :* ${delay}ms\n` +
    `🕐 *Waktu  :* ${nowID()}\n` +
    `🔥 *Status :* Online ✅\n` +
    `⏱️ *Uptime :* ${getUptime()}\n\n` +
    `_Wreck Bot System_ 🔥`
  );
}

// .runtime
async function handleRuntime(jid) {
  await sendText(jid,
    `╔══════════════════╗\n║  📡 SERVER INFO  ║\n╚══════════════════╝\n\n` +
    `⏱️ *Uptime  :* ${getUptime()}\n` +
    `📨 *Pesan   :* ${stats.msg}\n` +
    `⚡ *Perintah:* ${stats.cmd}\n` +
    `💾 *RAM     :* ${~~(process.memoryUsage().heapUsed/1024/1024)} MB\n` +
    `🖥️ *OS      :* ${os.platform()} ${os.arch()}\n` +
    `📦 *Node.js :* ${process.version}\n` +
    `🔧 *yt-dlp  :* ${toolPath('yt-dlp') ? '✅' : '❌'}\n` +
    `🎬 *FFmpeg  :* ${toolPath('ffmpeg') ? '✅' : '❌'}\n\n` +
    `_Wreck Bot System_ 🔥`
  );
}

// .info
async function handleInfo(jid) {
  await sendText(jid,
    `╔══════════════════╗\n║   🔥 WRECK BOT   ║\n╚══════════════════╝\n\n` +
    `🤖 *Nama    :* Wreck Bot\n` +
    `📦 *Versi   :* v1.0.0\n` +
    `👤 *Owner   :* ${ownerName}\n` +
    `🌐 *Platform:* WhatsApp\n` +
    `⚡ *Library :* @whiskeysockets/baileys\n` +
    `📅 *Tahun   :* 2026\n` +
    `🔗 *GitHub  :* github.com/anonymusyogyakarta-coder/Wreck\n\n` +
    `_Bot serba bisa dengan AI, Downloader & Tools_ 🔥`
  );
}

// .translate
async function handleTranslate(jid, args) {
  const parts = args.split('|');
  if (parts.length < 2) return sendText(jid, '❌ Format: *.translate* [bahasa]|[teks]\nContoh: .translate en|Halo apa kabar\n\nKode bahasa:\nen=Inggris, ja=Jepang, ko=Korea\nzh=Cina, ar=Arab, fr=Prancis');
  const lang = parts[0].trim();
  const text = parts.slice(1).join('|').trim();
  if (!text) return sendText(jid, '❌ Teks tidak boleh kosong!');
  await sendText(jid, '🌐 _Menerjemahkan..._');
  try {
    const prompt = `Terjemahkan teks berikut ke bahasa dengan kode "${lang}", berikan HANYA hasil terjemahan tanpa penjelasan apapun: "${text}"`;
    const r = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`,{timeout:30000,responseType:'text'});
    const result = typeof r.data === 'string' ? r.data.trim() : null;
    if (result) {
      await sendText(jid,
        `🌐 *TRANSLATE*\n\n` +
        `📝 *Original:*\n${text}\n\n` +
        `✅ *Hasil (${lang}):*\n${result}\n\n` +
        `_Powered by Wreck AI_ 🔥`
      );
    } else throw new Error('empty');
  } catch { await sendText(jid, '❌ Gagal translate. Coba lagi!'); }
}

// .wiki
async function handleWiki(jid, query) {
  await sendText(jid, `🔍 _Mencari "${query}" di Wikipedia..._`);
  try {
    const r = await axios.get(`https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,{timeout:15000});
    const d = r.data;
    await sendText(jid,
      `📚 *WIKIPEDIA*\n\n` +
      `📌 *${d.title}*\n\n` +
      `${d.extract?.slice(0,700) || 'Tidak ada deskripsi'}${(d.extract?.length||0)>700?'...':''}\n\n` +
      `🔗 ${d.content_urls?.desktop?.page || ''}\n\n` +
      `_Powered by Wreck Bot_ 🔥`
    );
  } catch { await sendText(jid, `❌ Artikel untuk *${query}* tidak ditemukan!\nCoba kata kunci lain.`); }
}

// .tts
async function handleTTS(jid, text) {
  await sendText(jid, '🔊 _Membuat suara..._');
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(text.slice(0,200))}`;
    const r   = await axios.get(url,{responseType:'arraybuffer',timeout:20000,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0 Safari/537.36'}});
    await sendVoice(jid, Buffer.from(r.data));
  } catch { await sendText(jid, '❌ Gagal buat TTS. Coba lagi!'); }
}

// .lirik
async function handleLirik(jid, query) {
  await sendText(jid, `🎵 _Mencari lirik "${query}"..._`);
  try {
    const r    = await axios.get(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`,{timeout:15000});
    const song = r.data?.data?.[0];
    if (!song) throw new Error('not found');
    const r2   = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`,{timeout:15000});
    const lyric = r2.data?.lyrics?.slice(0,3000)||'';
    await sendText(jid,
      `🎵 *${song.title}*\n👤 *${song.artist.name}*\n\n${lyric}${lyric.length>=3000?'\n\n_...lirik terpotong_':''}\n\n_Powered by Wreck Bot_ 🔥`
    );
  } catch { await sendText(jid, `❌ Lirik *${query}* tidak ditemukan!`); }
}

// .cuaca2 - forecast 3 hari
async function handleForecast(jid, kota) {
  await sendText(jid, `📅 _Mengambil prakiraan cuaca ${kota}..._`);
  try {
    const r = await axios.get(`https://wttr.in/${encodeURIComponent(kota)}?format=j1`,
      { timeout:15000, headers:{'User-Agent':'curl/7.68.0'} });
    const days = r.data?.weather || [];
    let txt = `📅 *PRAKIRAAN CUACA ${kota.toUpperCase()}*\n\n`;
    for (const day of days.slice(0,3)) {
      const date    = day.date;
      const maxC    = day.maxtempC;
      const minC    = day.mintempC;
      const kondisi = day.hourly?.[4]?.weatherDesc?.[0]?.value || '-';
      const angin   = day.hourly?.[4]?.windspeedKmph || '-';
      txt += `📆 *${date}*\n🌡️ ${minC}°C - ${maxC}°C\n☁️ ${kondisi}\n💨 Angin ${angin} km/h\n\n`;
    }
    txt += `_Wreck Weather System_ 🔥`;
    await sendText(jid, txt);
  } catch { await sendText(jid, `❌ Kota *${kota}* tidak ditemukan!`); }
}

// .random - random number
async function handleRandom(jid, args) {
  const parts  = args.split('-').map(s => parseInt(s.trim()));
  const min    = parts[0] || 1;
  const max    = parts[1] || 100;
  if (isNaN(min) || isNaN(max) || min >= max) {
    return sendText(jid, '❌ Format: *.random* [min]-[max]\nContoh: .random 1-100');
  }
  const result = Math.floor(Math.random() * (max - min + 1)) + min;
  await sendText(jid,
    `🎲 *RANDOM NUMBER*\n\n` +
    `📊 *Range  :* ${min} - ${max}\n` +
    `🎯 *Hasil  :* *${result}*\n\n` +
    `_Powered by Wreck Bot_ 🔥`
  );
}

// .flip - flip koin
async function handleFlip(jid) {
  const hasil = Math.random() < 0.5 ? '🪙 *HEADS (Gambar)*' : '🪙 *TAILS (Angka)*';
  await sendText(jid, `🪙 *LEMPAR KOIN*\n\nHasilnya: ${hasil}\n\n_Powered by Wreck Bot_ 🔥`);
}

// .dice - dadu
async function handleDice(jid, sisi) {
  const n   = parseInt(sisi) || 6;
  const max = Math.min(Math.max(n, 2), 100);
  const hasil = Math.floor(Math.random() * max) + 1;
  await sendText(jid,
    `🎲 *LEMPAR DADU*\n\n` +
    `🎯 *Dadu   :* D${max}\n` +
    `✅ *Hasil  :* *${hasil}*\n\n` +
    `_Powered by Wreck Bot_ 🔥`
  );
}

// .suhu - konversi suhu
async function handleSuhu(jid, args) {
  if (!args) return sendText(jid, '❌ Format: *.suhu* [nilai][satuan]\nContoh:\n.suhu 100c → ke Fahrenheit & Kelvin\n.suhu 212f → ke Celsius & Kelvin');
  const match = args.match(/^([\d.]+)\s*([cfkCFK])$/);
  if (!match) return sendText(jid, '❌ Format salah!\nContoh: .suhu 100c atau .suhu 212f');
  const val  = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  let c, f, k;
  if (unit === 'c') { c=val; f=val*9/5+32; k=val+273.15; }
  else if (unit === 'f') { f=val; c=(val-32)*5/9; k=c+273.15; }
  else { k=val; c=val-273.15; f=c*9/5+32; }
  await sendText(jid,
    `🌡️ *KONVERSI SUHU*\n\n` +
    `🔢 *Input    :* ${val}°${unit.toUpperCase()}\n\n` +
    `🌡️ *Celsius  :* ${c.toFixed(2)}°C\n` +
    `🌡️ *Fahrenheit:* ${f.toFixed(2)}°F\n` +
    `🌡️ *Kelvin   :* ${k.toFixed(2)}K\n\n` +
    `_Powered by Wreck Bot_ 🔥`
  );
}

// .bmi - hitung BMI
async function handleBMI(jid, args) {
  const parts = args.split(' ').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return sendText(jid, '❌ Format: *.bmi* [berat kg] [tinggi cm]\nContoh: .bmi 65 170');
  }
  const [berat, tinggi] = parts;
  const tinggiM = tinggi / 100;
  const bmi     = berat / (tinggiM * tinggiM);
  let kategori, saran;
  if (bmi < 18.5)      { kategori = '🔵 Kurus (Underweight)';  saran = 'Tambah asupan kalori dan olahraga'; }
  else if (bmi < 25)   { kategori = '🟢 Normal (Ideal)';       saran = 'Pertahankan gaya hidup sehatmu!'; }
  else if (bmi < 30)   { kategori = '🟡 Gemuk (Overweight)';   saran = 'Kurangi kalori dan perbanyak olahraga'; }
  else                 { kategori = '🔴 Obesitas';              saran = 'Konsultasikan ke dokter'; }
  await sendText(jid,
    `⚖️ *KALKULATOR BMI*\n\n` +
    `📊 *Berat   :* ${berat} kg\n` +
    `📏 *Tinggi  :* ${tinggi} cm\n` +
    `🔢 *BMI     :* *${bmi.toFixed(2)}*\n` +
    `📋 *Kategori:* ${kategori}\n` +
    `💡 *Saran   :* ${saran}\n\n` +
    `_Powered by Wreck Bot_ 🔥`
  );
}

// .color - generate warna random
async function handleColor(jid) {
  const r   = ~~(Math.random()*256);
  const g   = ~~(Math.random()*256);
  const b   = ~~(Math.random()*256);
  const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`.toUpperCase();
  await sendText(jid,
    `🎨 *RANDOM COLOR*\n\n` +
    `🔢 *HEX  :* \`${hex}\`\n` +
    `🔴 *R    :* ${r}\n` +
    `🟢 *G    :* ${g}\n` +
    `🔵 *B    :* ${b}\n\n` +
    `_Powered by Wreck Bot_ 🔥`
  );
}

// .menu
async function handleMenu(jid, name) {
  await sendText(jid,
    `╔═══════════════════════════╗\n` +
    `║   🔥  WRECK BOT  v1.0  🔥  ║\n` +
    `╚═══════════════════════════╝\n` +
    `👤 *Owner  :* ${ownerName}\n` +
    `⏱️ *Uptime :* ${getUptime()}\n` +
    `📨 *Pesan  :* ${stats.msg} masuk\n` +
    `🕐 *Waktu  :* ${nowID()}\n` +
    `🌐 *Akses  :* Semua Pengguna (Publik)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +

    `📥 *[ MEDIA DOWNLOADER ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🎵 *.ytm* <link>\n` +
    `│    Download lagu YouTube → MP3\n` +
    `│ 🎬 *.ytv* <link>\n` +
    `│    Download video YouTube → MP4\n` +
    `│ 🎵 *.dtt* <link>\n` +
    `│    Download TikTok tanpa watermark\n` +
    `│ 📸 *.igdw* <link>\n` +
    `│    Download foto/video Instagram\n` +
    `│ 🔊 *.vs* [reply video]\n` +
    `│    Ubah video jadi file audio\n` +
    `└─────────────────────────\n\n` +

    `🤖 *[ AI & KREATIF ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🧠 *.ai* <pertanyaan>\n` +
    `│    Chat AI pintar Bahasa Indonesia\n` +
    `│ 🎨 *.generate* <deskripsi>\n` +
    `│    Buat gambar dari teks pakai AI\n` +
    `│ 🌐 *.translate* <lang>|<teks>\n` +
    `│    Terjemah teks (en/ja/ko/zh dll)\n` +
    `│ 🔊 *.tts* <teks>\n` +
    `│    Ubah teks jadi pesan suara\n` +
    `└─────────────────────────\n\n` +

    `🌐 *[ INFORMASI ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🌤️ *.cuaca* <kota>\n` +
    `│    Cuaca real-time suatu kota\n` +
    `│ 📅 *.forecast* <kota>\n` +
    `│    Prakiraan cuaca 3 hari ke depan\n` +
    `│ 📚 *.wiki* <kata kunci>\n` +
    `│    Cari info dari Wikipedia Indonesia\n` +
    `│ 🎵 *.lirik* <judul lagu>\n` +
    `│    Cari lirik lagu apa saja\n` +
    `└─────────────────────────\n\n` +

    `🎮 *[ FUN & GAMES ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🐱 *.neko*  — Anime neko girl random\n` +
    `│ 🌸 *.waifu* — Anime waifu random\n` +
    `│ 💬 *.quote* — Kata motivasi random\n` +
    `│ 🎲 *.random* 1-100 — Angka random\n` +
    `│ 🪙 *.flip*  — Lempar koin\n` +
    `│ 🎲 *.dice* [sisi] — Lempar dadu\n` +
    `│ 🎨 *.color* — Warna random\n` +
    `└─────────────────────────\n\n` +

    `🔧 *[ TOOLS ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🧮 *.calc* <expr>\n` +
    `│    Kalkulator (10 x 5, 2 ^ 8 dll)\n` +
    `│ 🌡️ *.suhu* <nilai><satuan>\n` +
    `│    Konversi suhu (100c, 212f, 373k)\n` +
    `│ ⚖️ *.bmi* <berat> <tinggi>\n` +
    `│    Hitung indeks massa tubuh\n` +
    `│ 🎭 *.s* [kirim/reply foto/video]\n` +
    `│    Buat sticker WhatsApp\n` +
    `│ 🖼️ *.sticker* <url gambar>\n` +
    `│    URL gambar → Sticker WA\n` +
    `└─────────────────────────\n\n` +

    `📊 *[ BOT INFO ]*\n` +
    `┌─────────────────────────\n` +
    `│ 🏓 *.ping*    — Cek kecepatan bot\n` +
    `│ 📡 *.runtime* — Status server bot\n` +
    `│ ℹ️  *.info*   — Tentang Wreck Bot\n` +
    `│ 📋 *.menu*    — Tampilkan menu ini\n` +
    `└─────────────────────────\n\n` +

    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 Halo *${name}*! Semua perintah gratis untuk semua! 🔥\n` +
    `💡 _Ketik perintah sesuai contoh di atas_\n` +
    `🔥 _Wreck Bot — pure console base by @anonymusyogyakarta-coder_`
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
  console.log(ytBin ? chalk.green(`  ✅ yt-dlp : ${ytBin}`) : chalk.yellow('  ⚠️  yt-dlp tidak ada! pkg install yt-dlp -y'));
  console.log(ffBin ? chalk.green(`  ✅ ffmpeg : ${ffBin}`) : chalk.yellow('  ⚠️  ffmpeg tidak ada (optional)'));
  console.log('');

  await fs.ensureDir(SESSION_DIR);
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version }          = await fetchLatestBaileysVersion();

  let fullPhone = '';
  if (!state.creds.registered) {
    console.log(chalk.yellow('\n  📱 Belum ada session. Login dengan Pairing Code.\n'));
    const cc  = await ask(chalk.cyan('  Kode negara (62): '));
    const num = await ask(chalk.cyan('  Nomor WA (tanpa 0): '));
    fullPhone  = (cc.replace(/\D/g,'') + num.replace(/\D/g,'').replace(/^0/,'')).trim();
    console.log(chalk.yellow(`\n  ⏳ Menyiapkan untuk +${fullPhone}...\n`));
  }

  sock = makeWASocket({
    version,
    logger: pino({ level:'silent' }),
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
      console.log(chalk.gray('  1. WA → ⋮ → Perangkat Tertaut → Tautkan Perangkat'));
      console.log(chalk.gray('  2. Tautkan dengan nomor telepon'));
      console.log(chalk.gray(`  3. Masukkan kode: `) + chalk.red.bold(fmt) + '\n');
    } catch (e) {
      console.log(chalk.red('  ❌ Gagal pairing code: ' + e.message));
      await fs.remove(SESSION_DIR); process.exit(1);
    }
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0];
      console.log(chalk.green(`\n  ✅ Wreck terhubung! +${phone}`));
      console.log(chalk.cyan('  🔥 Bot siap menerima perintah!\n'));
      console.log(chalk.gray('  ─────────────────────────────────────────────────'));
      await syncGithub();
      setInterval(syncGithub, 30 * 60 * 1000);
      setInterval(() => {
        console.log(chalk.gray(`  [${new Date().toLocaleTimeString('id-ID')}] ${getUptimeFmt()} | Pesan: ${stats.msg} | Cmd: ${stats.cmd}`));
      }, 5 * 60 * 1000);
    }
    if (connection === 'close') {
      const code  = lastDisconnect?.error?.output?.statusCode;
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
      const ts = new Date().toLocaleTimeString('id-ID',{hour12:false});
      console.log(chalk.magenta(`  [${ts}]`) + chalk.white(` ${name}: `) + chalk.cyan(body));
      try {
        switch(cmd) {
          // AI & Media
          case '.ai':        if(!args){await sendText(jid,'❌ Format: .ai [pertanyaan]');break;} await handleAI(jid,args); break;
          case '.generate':  if(!args){await sendText(jid,'❌ Format: .generate [prompt]');break;} await handleGenerate(jid,args); break;
          case '.translate': if(!args){await sendText(jid,'❌ Format: .translate [lang]|[teks]\nContoh: .translate en|Halo');break;} await handleTranslate(jid,args); break;
          case '.tts':       if(!args){await sendText(jid,'❌ Format: .tts [teks]');break;} await handleTTS(jid,args); break;
          // Downloader
          case '.ytm':       await handleYTMusic(jid,args); break;
          case '.ytv':       await handleYTVideo(jid,args); break;
          case '.dtt':       await handleTikTok(jid,args); break;
          case '.igdw':      await handleIG(jid,args); break;
          case '.vs':        await handleVS(jid,msg); break;
          // Info
          case '.cuaca':     if(!args){await sendText(jid,'❌ Format: .cuaca [kota]');break;} await handleCuaca(jid,args); break;
          case '.forecast':  if(!args){await sendText(jid,'❌ Format: .forecast [kota]');break;} await handleForecast(jid,args); break;
          case '.wiki':      if(!args){await sendText(jid,'❌ Format: .wiki [kata kunci]');break;} await handleWiki(jid,args); break;
          case '.lirik':     if(!args){await sendText(jid,'❌ Format: .lirik [judul lagu]');break;} await handleLirik(jid,args); break;
          // Fun
          case '.neko':      await handleNeko(jid); break;
          case '.waifu':     await handleWaifu(jid); break;
          case '.quote':     await handleQuote(jid); break;
          case '.random':    await handleRandom(jid,args); break;
          case '.flip':      await handleFlip(jid); break;
          case '.dice':      await handleDice(jid,args); break;
          case '.color':     await handleColor(jid); break;
          // Tools
          case '.calc':      await handleCalc(jid,args); break;
          case '.suhu':      if(!args){await sendText(jid,'❌ Format: .suhu [nilai][satuan]\nContoh: .suhu 100c');break;} await handleSuhu(jid,args); break;
          case '.bmi':       if(!args){await sendText(jid,'❌ Format: .bmi [berat] [tinggi]\nContoh: .bmi 65 170');break;} await handleBMI(jid,args); break;
          case '.s':         await handleSticker(jid,msg); break;
          case '.sticker':   await handleStickerURL(jid,args); break;
          // Bot info
          case '.ping':      await handlePing(jid); break;
          case '.runtime':   await handleRuntime(jid); break;
          case '.info':      await handleInfo(jid); break;
          case '.menu':      await handleMenu(jid,name); break;
          default: break;
        }
      } catch(e) {
        console.log(chalk.red(`  ❌ ${cmd}: ${e.message}`));
        await sendText(jid, `❌ Error pada *${cmd}*: ${e.message}`);
      }
    }
  });
}

startBot().catch(e => { console.error(chalk.red('Fatal: ' + e.message)); process.exit(1); });
