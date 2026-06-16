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
const { exec, execSync } = require('child_process');
const path = require('path');
const os = require('os');

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
const TMP_DIR = path.join(os.tmpdir(), 'wreck_tmp');
let sock = null;
let isConnected = false;
let stats = { msg: 0, cmd: 0, startTime: Date.now() };

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
function askQuestion(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans.trim()); }));
}

function runCmd(cmd, timeout = 180000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout, maxBuffer: 200 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

function checkTool(tool) {
  try { execSync(`which ${tool}`, { stdio: 'ignore' }); return true; }
  catch { return false; }
}

const sendText    = (jid, text) => sock?.sendMessage(jid, { text });
const sendImage   = (jid, buf, cap='') => sock?.sendMessage(jid, { image: buf, caption: cap });
const sendAudio   = (jid, buf) => sock?.sendMessage(jid, { audio: buf, mimetype: 'audio/mp4', ptt: false });
const sendVideo   = (jid, buf, cap='') => sock?.sendMessage(jid, { video: buf, caption: cap });
const sendSticker = (jid, buf) => sock?.sendMessage(jid, { sticker: buf });

// ══════════════════════════════════════
// GITHUB SYNC
// ══════════════════════════════════════
async function syncToGithub() {
  try {
    execSync('git add session/ && git commit -m "sync session" --allow-empty && git push', {
      stdio: 'ignore', cwd: process.cwd()
    });
    console.log(chalk.green('  ✅ Session synced ke GitHub!'));
  } catch {}
}

async function pullFromGithub() {
  try {
    execSync('git pull', { stdio: 'ignore', cwd: process.cwd() });
    console.log(chalk.cyan('  📥 Session dipull dari GitHub!'));
  } catch {}
}

// ══════════════════════════════════════
// FEATURES
// ══════════════════════════════════════

// .ai - pakai pollinations text (gratis, no key)
async function handleAI(jid, query) {
  await sendText(jid, '🤖 _Wreck AI sedang berpikir..._');
  try {
    const r = await axios.get(
      `https://text.pollinations.ai/${encodeURIComponent(query)}`,
      { timeout: 30000, responseType: 'text', headers: { 'Accept': 'text/plain' } }
    );
    const ans = typeof r.data === 'string' ? r.data.trim() : JSON.stringify(r.data);
    if (ans && ans.length > 2) return await sendText(jid, `🤖 *Wreck AI*\n\n${ans}`);
    throw new Error('empty');
  } catch {
    // fallback ke pollinations dengan method berbeda
    try {
      const r2 = await axios.post('https://text.pollinations.ai/', {
        messages: [{ role: 'user', content: query }],
        model: 'openai',
        seed: Math.floor(Math.random() * 9999)
      }, { timeout: 30000, responseType: 'text' });
      const ans2 = typeof r2.data === 'string' ? r2.data.trim() : null;
      if (ans2 && ans2.length > 2) return await sendText(jid, `🤖 *Wreck AI*\n\n${ans2}`);
    } catch {}
    await sendText(jid, '❌ AI sedang tidak tersedia. Coba lagi nanti!');
  }
}

// .generate - pakai pollinations image
async function handleGenerate(jid, prompt) {
  await sendText(jid, '🎨 _Sedang membuat gambar, tunggu ya..._');
  try {
    const seed = Math.floor(Math.random() * 999999);
    const enc = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${enc}?width=768&height=768&nologo=true&seed=${seed}&model=flux`;
    const r = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 90000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (r.data?.byteLength > 500) {
      return await sendImage(jid, Buffer.from(r.data), `🎨 ${prompt}`);
    }
    throw new Error('empty image');
  } catch {
    try {
      const enc = encodeURIComponent(prompt);
      const url2 = `https://image.pollinations.ai/prompt/${enc}?nologo=true`;
      const r2 = await axios.get(url2, { responseType: 'arraybuffer', timeout: 90000 });
      await sendImage(jid, Buffer.from(r2.data), `🎨 ${prompt}`);
    } catch {
      await sendText(jid, '❌ Gagal generate gambar. Coba lagi nanti!');
    }
  }
}

// .cuaca - wttr.in
async function handleCuaca(jid, kota) {
  await sendText(jid, `🌤️ _Mengambil data cuaca ${kota}..._`);
  try {
    const r = await axios.get(
      `https://wttr.in/${encodeURIComponent(kota)}?format=j1`,
      { timeout: 15000, headers: { 'User-Agent': 'curl/7.68.0', 'Accept': 'application/json' } }
    );
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
      `_${new Date().toLocaleString('id-ID')}_`
    );
  } catch {
    await sendText(jid, `❌ Kota *${kota}* tidak ditemukan!\nContoh: .cuaca Jakarta`);
  }
}

// .s - foto/video ke sticker
async function handleSticker(jid, msg) {
  try {
    const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imgMsg = msg.message?.imageMessage || q?.imageMessage;
    const vidMsg = msg.message?.videoMessage || q?.videoMessage;
    if (!imgMsg && !vidMsg) {
      return await sendText(jid,
        '❌ Cara pakai:\n1. Kirim foto/video\n2. Tekan lama → Reply\n3. Ketik *.s*'
      );
    }
    await sendText(jid, '🎭 _Membuat sticker..._');
    const target = imgMsg
      ? { message: { imageMessage: imgMsg } }
      : { message: { videoMessage: vidMsg } };
    const buf = await sock.downloadMediaMessage(target);
    await sendSticker(jid, Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  } catch (e) {
    await sendText(jid, '❌ Gagal buat sticker: ' + e.message);
  }
}

// ── DOWNLOAD HELPER pakai yt-dlp ──
async function ytdlpDownload(url, opts = {}) {
  await fs.ensureDir(TMP_DIR);
  const outFile = path.join(TMP_DIR, `wreck_${Date.now()}`);
  const format = opts.audio ? 'bestaudio[ext=m4a]/bestaudio/best' : 'best[filesize<50M]/best';
  const ext = opts.audio ? 'm4a' : 'mp4';
  const outPath = `${outFile}.${ext}`;

  let cmd = `yt-dlp`;
  if (opts.audio) {
    cmd += ` -x --audio-format m4a --audio-quality 0`;
  } else {
    cmd += ` -f "${format}"`;
  }
  cmd += ` --no-playlist`;
  cmd += ` --no-warnings`;
  cmd += ` -o "${outPath}"`;
  if (opts.noWatermark) cmd += ` --add-header "Referer:https://www.tiktok.com/"`;
  cmd += ` "${url}"`;

  await runCmd(cmd, 180000);

  // Cari file yang berhasil didownload
  const files = await fs.readdir(TMP_DIR);
  const downloaded = files
    .filter(f => f.startsWith(`wreck_`) && f.includes(path.basename(outFile).split('_')[1]))
    .map(f => path.join(TMP_DIR, f));

  if (!downloaded.length) throw new Error('File tidak ditemukan setelah download');
  return downloaded[0];
}

async function cleanTmp(filePath) {
  try { await fs.remove(filePath); } catch {}
}

// .ytm - YouTube ke musik
async function handleYTMusic(jid, url) {
  if (!url?.includes('youtu')) {
    return sendText(jid, '❌ Format: .ytm [link YouTube]\nContoh: .ytm https://youtu.be/xxxxx');
  }
  if (!checkTool('yt-dlp')) {
    return sendText(jid, '❌ yt-dlp belum terinstall!\nJalankan: pkg install yt-dlp -y');
  }
  await sendText(jid, '🎵 _Mengunduh musik dari YouTube..._');
  let filePath = null;
  try {
    filePath = await ytdlpDownload(url, { audio: true });
    const buf = await fs.readFile(filePath);
    await sendAudio(jid, buf);
    await sendText(jid, '✅ *Download musik selesai!*');
  } catch (e) {
    await sendText(jid, '❌ Gagal download musik: ' + e.message.split('\n')[0]);
  } finally {
    if (filePath) await cleanTmp(filePath);
  }
}

// .ytv - YouTube ke video
async function handleYTVideo(jid, url) {
  if (!url?.includes('youtu')) {
    return sendText(jid, '❌ Format: .ytv [link YouTube]\nContoh: .ytv https://youtu.be/xxxxx');
  }
  if (!checkTool('yt-dlp')) {
    return sendText(jid, '❌ yt-dlp belum terinstall!\nJalankan: pkg install yt-dlp -y');
  }
  await sendText(jid, '▶️ _Mengunduh video YouTube..._');
  let filePath = null;
  try {
    filePath = await ytdlpDownload(url, { audio: false });
    const buf = await fs.readFile(filePath);
    await sendVideo(jid, buf, '▶️ *YouTube Video*');
  } catch (e) {
    await sendText(jid, '❌ Gagal download video: ' + e.message.split('\n')[0]);
  } finally {
    if (filePath) await cleanTmp(filePath);
  }
}

// .dtt - TikTok tanpa watermark
async function handleTikTok(jid, url) {
  if (!url?.includes('tiktok') && !url?.includes('vm.tik')) {
    return sendText(jid, '❌ Format: .dtt [link TikTok]\nContoh: .dtt https://vm.tiktok.com/xxxxx');
  }
  if (!checkTool('yt-dlp')) {
    return sendText(jid, '❌ yt-dlp belum terinstall!\nJalankan: pkg install yt-dlp -y');
  }
  await sendText(jid, '🎵 _Mengunduh TikTok tanpa watermark..._');
  let filePath = null;
  try {
    // yt-dlp support TikTok no watermark
    await fs.ensureDir(TMP_DIR);
    const outFile = path.join(TMP_DIR, `wreck_tiktok_${Date.now()}.mp4`);
    const cmd = `yt-dlp --no-watermark -f "best[ext=mp4]/best" --no-playlist -o "${outFile}" "${url}"`;
    await runCmd(cmd, 120000);
    const buf = await fs.readFile(outFile);
    await sendVideo(jid, buf, '🎵 *TikTok No Watermark*');
    filePath = outFile;
  } catch (e) {
    await sendText(jid, '❌ Gagal download TikTok: ' + e.message.split('\n')[0]);
  } finally {
    if (filePath) await cleanTmp(filePath);
  }
}

// .vs - video ke audio
async function handleVideoToSound(jid, msg) {
  try {
    const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const vidMsg = msg.message?.videoMessage || q?.videoMessage;
    if (!vidMsg) {
      return sendText(jid, '❌ Cara pakai:\n1. Kirim video\n2. Reply video dengan *.vs*');
    }
    await sendText(jid, '🎵 _Mengkonversi video ke audio..._');
    const buf = await sock.downloadMediaMessage({ message: { videoMessage: vidMsg } });
    const vidBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

    // Simpan video sementara lalu konversi pakai ffmpeg jika ada
    await fs.ensureDir(TMP_DIR);
    const vidPath = path.join(TMP_DIR, `wreck_vs_${Date.now()}.mp4`);
    const audPath = vidPath.replace('.mp4', '.m4a');
    await fs.writeFile(vidPath, vidBuf);

    if (checkTool('ffmpeg')) {
      await runCmd(`ffmpeg -i "${vidPath}" -vn -acodec copy "${audPath}" -y`, 60000);
      const audioBuf = await fs.readFile(audPath);
      await sendAudio(jid, audioBuf);
      await cleanTmp(audPath);
    } else {
      // Kirim langsung sebagai audio tanpa konversi
      await sendAudio(jid, vidBuf);
    }
    await cleanTmp(vidPath);
    await sendText(jid, '✅ Berhasil konversi ke audio!');
  } catch (e) {
    await sendText(jid, '❌ Gagal konversi: ' + e.message);
  }
}

// .igdw - Instagram download pakai yt-dlp
async function handleInstagram(jid, url) {
  if (!url?.includes('instagram') && !url?.includes('instagr.am')) {
    return sendText(jid, '❌ Format: .igdw [link Instagram]\nContoh: .igdw https://www.instagram.com/p/xxxxx');
  }
  if (!checkTool('yt-dlp')) {
    return sendText(jid, '❌ yt-dlp belum terinstall!\nJalankan: pkg install yt-dlp -y');
  }
  await sendText(jid, '📸 _Mengunduh dari Instagram..._');
  let filePath = null;
  try {
    await fs.ensureDir(TMP_DIR);
    const outFile = path.join(TMP_DIR, `wreck_ig_${Date.now()}.%(ext)s`);
    const cmd = `yt-dlp --no-playlist -o "${outFile}" "${url}"`;
    await runCmd(cmd, 120000);

    // Cari file hasil download
    const files = await fs.readdir(TMP_DIR);
    const igFiles = files.filter(f => f.includes('wreck_ig_')).map(f => path.join(TMP_DIR, f));

    if (!igFiles.length) throw new Error('Tidak ada file terdownload');

    for (const f of igFiles) {
      const buf = await fs.readFile(f);
      const isVideo = f.endsWith('.mp4') || f.endsWith('.mov');
      if (isVideo) await sendVideo(jid, buf, '📸 Instagram');
      else await sendImage(jid, buf, '📸 Instagram');
      await cleanTmp(f);
    }
  } catch (e) {
    await sendText(jid, '❌ Gagal download Instagram: ' + e.message.split('\n')[0]);
  }
}

// .neko - anime neko girl
async function handleNeko(jid) {
  await sendText(jid, '🐱 _Generating neko girl..._');
  try {
    let imgUrl = null;
    for (const ep of ['https://nekos.life/api/v2/img/neko', 'https://api.waifu.pics/sfw/neko', 'https://nekos.best/api/v2/neko']) {
      try {
        const r = await axios.get(ep, { timeout: 10000 });
        imgUrl = r.data?.url || r.data?.results?.[0]?.url;
        if (imgUrl) break;
      } catch { continue; }
    }
    if (!imgUrl) {
      const seed = Math.floor(Math.random() * 99999);
      imgUrl = `https://image.pollinations.ai/prompt/cute%20anime%20neko%20cat%20girl%20kawaii%20high%20quality?width=512&height=512&nologo=true&seed=${seed}`;
    }
    const img = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 30000 });
    await sendImage(jid, Buffer.from(img.data), '🐱 *Neko Girl!*\n_Ketik .neko lagi untuk gambar lain~_');
  } catch {
    await sendText(jid, '❌ Gagal generate neko. Coba lagi!');
  }
}

// .menu
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
  return `${String(~~(s/3600)).padStart(2,'0')}:${String(~~((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

// ══════════════════════════════════════
// MAIN BOT
// ══════════════════════════════════════
async function startBot() {
  showBanner();
  await fs.ensureDir(TMP_DIR);
  await pullFromGithub();

  // Cek yt-dlp
  if (!checkTool('yt-dlp')) {
    console.log(chalk.yellow('  ⚠️  yt-dlp tidak ditemukan!'));
    console.log(chalk.yellow('  Install dengan: pkg install yt-dlp -y\n'));
  } else {
    console.log(chalk.green('  ✅ yt-dlp tersedia'));
  }
  if (checkTool('ffmpeg')) {
    console.log(chalk.green('  ✅ ffmpeg tersedia'));
  } else {
    console.log(chalk.yellow('  ⚠️  ffmpeg tidak ada (fitur .vs terbatas)'));
  }
  console.log('');

  await fs.ensureDir(SESSION_DIR);
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  let fullPhone = '';
  if (!state.creds.registered) {
    console.log(chalk.yellow('\n  📱 Belum ada session. Login dengan Pairing Code.\n'));
    const cc = await askQuestion(chalk.cyan('  Kode negara (contoh: 62): '));
    const phone = await askQuestion(chalk.cyan('  Nomor WA (tanpa 0, contoh: 8xxxxxxxxxx): '));
    fullPhone = (cc.replace(/\D/g,'') + phone.replace(/\D/g,'').replace(/^0/,'')).trim();
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
    keepAliveIntervalMs: 10000,
  });

  if (fullPhone) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const code = await sock.requestPairingCode(fullPhone);
      const fmt = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(chalk.bgRed.white.bold(`\n  ╔══════════════════════════════╗`));
      console.log(chalk.bgRed.white.bold(`  ║  🔥 PAIRING CODE: ${fmt.padEnd(9)}  ║`));
      console.log(chalk.bgRed.white.bold(`  ╚══════════════════════════════╝\n`));
      console.log(chalk.white('  Cara di WhatsApp:'));
      console.log(chalk.gray('  1. ⋮ Menu → Perangkat Tertaut → Tautkan Perangkat'));
      console.log(chalk.gray('  2. Tautkan dengan nomor telepon'));
      console.log(chalk.gray(`  3. Ketik kode: `) + chalk.red.bold(fmt) + '\n');
    } catch (e) {
      console.log(chalk.red('  ❌ Gagal dapat pairing code: ' + e.message));
      await fs.remove(SESSION_DIR);
      process.exit(1);
    }
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      isConnected = true;
      const phone = sock.user?.id?.split(':')[0];
      console.log(chalk.green(`\n  ✅ Wreck terhubung! Nomor: +${phone}`));
      console.log(chalk.cyan('  🔥 Bot siap! Ketik CTRL+C untuk berhenti\n'));
      console.log(chalk.gray('  ─────────────────────────────────────────────────'));
      await syncToGithub();
      setInterval(syncToGithub, 30 * 60 * 1000);
      setInterval(() => {
        console.log(chalk.gray(`  [${new Date().toLocaleTimeString('id-ID')}] Uptime: ${getUptime()} | Pesan: ${stats.msg} | Cmd: ${stats.cmd}`));
      }, 5 * 60 * 1000);
    }
    if (connection === 'close') {
      isConnected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const reconnect = code !== DisconnectReason.loggedOut;
      console.log(chalk.red(`\n  ⚠️  Terputus (kode: ${code})`));
      if (reconnect) {
        console.log(chalk.yellow('  🔄 Reconnecting dalam 5 detik...\n'));
        setTimeout(startBot, 5000);
      } else {
        console.log(chalk.red('  ❌ Session tidak valid. Hapus folder session/ dan jalankan ulang.\n'));
        await fs.remove(SESSION_DIR);
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

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
      const name = msg.pushName || 'User';
      stats.msg++; stats.cmd++;
      const ts = new Date().toLocaleTimeString('id-ID', { hour12: false });
      console.log(chalk.magenta(`  [${ts}]`) + chalk.white(` ${name}: `) + chalk.cyan(body));
      try {
        switch(cmd) {
          case '.ai':
            if (!args) { await sendText(jid, '❌ Format: .ai [pertanyaan]\nContoh: .ai Apa itu AI?'); break; }
            await handleAI(jid, args); break;
          case '.generate':
            if (!args) { await sendText(jid, '❌ Format: .generate [prompt]\nContoh: .generate neko cat girl'); break; }
            await handleGenerate(jid, args); break;
          case '.cuaca':
            if (!args) { await sendText(jid, '❌ Format: .cuaca [kota]\nContoh: .cuaca Jakarta'); break; }
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
            await handleMenu(jid, name); break;
          default: break;
        }
      } catch(e) {
        console.log(chalk.red(`  ❌ Error ${cmd}: ${e.message}`));
        await sendText(jid, `❌ Error: ${e.message}`);
      }
    }
  });
}

startBot().catch(e => {
  console.error(chalk.red('Fatal: ' + e.message));
  process.exit(1);
});
