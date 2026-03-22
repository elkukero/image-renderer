const express = require('express');
const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
// ffmpeg is installed as a system package via nixpacks.toml — no path override needed

const app = express();
app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '2026-03-22-v8', endpoints: ['render-rebrand-batch', 'render-generate-batch'] }));

app.post('/render', async (req, res) => {
  const { background_url, inset_url, headline } = req.body;

  if (!background_url || !inset_url || !headline) {
    return res.status(400).json({ error: 'Missing required fields: background_url, inset_url, headline' });
  }

  const imgbbKey = process.env.IMGBB_API_KEY;
  if (!imgbbKey) {
    return res.status(500).json({ error: 'IMGBB_API_KEY environment variable not set' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    await page.setContent(buildHtml(background_url, inset_url, headline), {
      waitUntil: 'networkidle0',
      timeout: 20000,
    });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
    await browser.close();
    browser = null;

    const imageUrl = await uploadToImgbb(buffer, imgbbKey);
    res.json({ success: true, image_url: imageUrl });
  } catch (err) {
    console.error('Render error:', err.message);
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

async function uploadToImgbb(buffer, apiKey) {
  const base64 = buffer.toString('base64');
  const body = new URLSearchParams({ image: base64 });

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`imgbb upload failed: ${JSON.stringify(data.error || data)}`);
  }
  return data.data.url;
}

function buildHtml(bg, inset, headline) {
  const safe = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const parseHeadline = (text) =>
    safe(text).replace(/\[\[(.+?)\]\]/g, '<span class="kw">$1</span>');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1350px; overflow: hidden; background: #000; }

  .bg {
    position: absolute;
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0.82;
  }

  .overlay {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 60%;
    background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.97) 100%);
  }

  .handle {
    position: absolute;
    bottom: 420px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255,255,255,0.85);
    font-family: 'Oswald', 'Arial Black', sans-serif;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 4px;
    text-shadow: 1px 1px 6px rgba(0,0,0,0.95);
    white-space: nowrap;
  }

  .inset-wrap {
    position: absolute;
    top: 60px;
    right: 40px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    overflow: hidden;
    border: 5px solid rgba(255,255,255,0.92);
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  }

  .inset {
    width: 100%; height: 100%;
    object-fit: cover;
  }

  .headline {
    position: absolute;
    bottom: 50px;
    left: 28px;
    right: 28px;
    color: #fff;
    font-family: 'Oswald', 'Arial Black', Impact, sans-serif;
    font-size: 90px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    line-height: 1.06;
    text-shadow: 3px 3px 8px rgba(0,0,0,0.95), 1px 1px 0 rgba(0,0,0,0.9);
    word-break: break-word;
  }

  .headline .kw { color: #4BB8D0; }
</style>
</head>
<body>
  <img class="bg" src="${safe(bg)}" crossorigin="anonymous">
  <div class="overlay"></div>
  <div class="handle">@BACKPAINLIFE</div>
  <div class="inset-wrap">
    <img class="inset" src="${safe(inset)}" crossorigin="anonymous">
  </div>
  <div class="headline">${parseHeadline(headline)}</div>
</body>
</html>`;
}

app.post('/render-carousel', async (req, res) => {
  const { image_url, headline, template, slide_number, subtext } = req.body;

  if (!image_url || !headline || !template) {
    return res.status(400).json({ error: 'Missing required fields: image_url, headline, template' });
  }

  const imgbbKey = process.env.IMGBB_API_KEY;
  if (!imgbbKey) {
    return res.status(500).json({ error: 'IMGBB_API_KEY environment variable not set' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
    await page.setContent(buildCarouselHtml(image_url, headline, template, slide_number, subtext), {
      waitUntil: 'networkidle0',
      timeout: 20000,
    });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
    await browser.close();
    browser = null;

    const imageUrl = await uploadToImgbb(buffer, imgbbKey);
    res.json({ success: true, image_url: imageUrl });
  } catch (err) {
    console.error('Render carousel error:', err.message);
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

function buildCarouselHtml(imageUrl, headline, template, slideNumber, subtext) {
  const safe = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const parseHeadline = (text) =>
    safe(text).replace(/\[\[(.+?)\]\]/g, '<span class="kw">$1</span>');

  const parseSubtext = (text) =>
    safe(text || '').replace(/\\n/g, '<br>').replace(/\n/g, '<br>');

  const numStr = String(slideNumber || 1).padStart(2, '0');

  const fonts = `@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Bebas+Neue&display=swap');`;

  if (template === 'cover') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${fonts}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1350px; overflow: hidden; background: #000; }

  .bg {
    position: absolute;
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0.9;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      transparent 35%,
      rgba(0,0,0,0.6) 52%,
      rgba(0,0,0,0.97) 68%,
      #000 100%
    );
  }

  .text-block {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 0 44px 52px 44px;
    text-align: center;
  }

  .headline {
    color: #fff;
    font-family: 'Bebas Neue', 'Oswald', Impact, sans-serif;
    font-size: 110px;
    font-weight: 400;
    text-transform: uppercase;
    line-height: 0.96;
    letter-spacing: 2px;
    word-break: break-word;
  }

  .headline .kw { color: #4BB8D0; }

  .swipe {
    display: inline-block;
    margin-top: 18px;
    color: #4BB8D0;
    font-family: 'Oswald', sans-serif;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
  }
</style>
</head>
<body>
  <img class="bg" src="${safe(imageUrl)}" crossorigin="anonymous">
  <div class="overlay"></div>
  <div class="text-block">
    <div class="headline">${parseHeadline(headline)}</div>
    <div class="swipe">SWIPE →</div>
  </div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${fonts}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1350px; overflow: hidden; background: #000; }

  .bg {
    position: absolute;
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: center center;
    opacity: 0.85;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      transparent 28%,
      rgba(0,0,0,0.55) 42%,
      rgba(0,0,0,0.92) 56%,
      #000 72%,
      #000 100%
    );
  }

  .badge {
    position: absolute;
    top: 20px; left: 20px;
    background: rgba(0,0,0,0.72);
    color: #4BB8D0;
    font-family: 'Bebas Neue', 'Oswald', sans-serif;
    font-size: 30px;
    letter-spacing: 3px;
    padding: 4px 14px 2px;
    border-radius: 3px;
    z-index: 10;
  }

  .text-block {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 0 44px 48px 44px;
  }

  .headline {
    color: #fff;
    font-family: 'Bebas Neue', 'Oswald', Impact, sans-serif;
    font-size: 82px;
    font-weight: 400;
    text-transform: uppercase;
    line-height: 0.94;
    letter-spacing: 2px;
    word-break: break-word;
    margin-bottom: 20px;
  }
  .headline .kw { color: #4BB8D0; }

  .subtext {
    color: rgba(255,255,255,0.90);
    font-family: 'Oswald', Arial, sans-serif;
    font-size: 26px;
    font-weight: 400;
    line-height: 1.55;
  }
</style>
</head>
<body>
  <img class="bg" src="${safe(imageUrl)}" crossorigin="anonymous">
  <div class="overlay"></div>
  <div class="badge">${numStr}</div>
  <div class="text-block">
    <div class="headline">${parseHeadline(headline)}</div>
    <div class="subtext">${parseSubtext(subtext)}</div>
  </div>
</body>
</html>`;
}

app.post('/render-rebrand', async (req, res) => {
  const { slide_image_url, slide_number, total_slides } = req.body;

  if (!slide_image_url) {
    return res.status(400).json({ error: 'Missing required field: slide_image_url' });
  }

  const imgbbKey = process.env.IMGBB_API_KEY;
  if (!imgbbKey) {
    return res.status(500).json({ error: 'IMGBB_API_KEY environment variable not set' });
  }

  let imageDataUri;
  try {
    const imgResp = await fetch(slide_image_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (!imgResp.ok) throw new Error(`Image fetch failed: ${imgResp.status}`);
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    imageDataUri = `data:${contentType};base64,${imgBuffer.toString('base64')}`;
  } catch (fetchErr) {
    console.error('Image fetch error:', fetchErr.message);
    imageDataUri = slide_image_url;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(buildRebrandHtml(imageDataUri, slide_number || 1, total_slides || 1), {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
    await browser.close();
    browser = null;

    const imageUrl = await uploadToImgbb(buffer, imgbbKey);
    res.json({ success: true, image_url: imageUrl });
  } catch (err) {
    console.error('Render rebrand error:', err.message);
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.post('/render-rebrand-batch', async (req, res) => {
  const { slides } = req.body;

  if (!Array.isArray(slides) || slides.length === 0) {
    return res.status(400).json({ error: 'Missing required field: slides (array)' });
  }

  const imgbbKey = process.env.IMGBB_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!imgbbKey) return res.status(500).json({ error: 'IMGBB_API_KEY not set' });
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const results = [];
    for (const slide of slides) {
      // Video slides: FFmpeg processing — rebrand the actual video
      // Fallback: old queue data stored videoUrl in slide_image_url when is_video=true
      const effectiveVideoUrl = slide.slide_video_url ||
        (slide.is_video ? slide.slide_image_url : null);
      const effectiveThumbUrl = slide.slide_video_url ? slide.slide_image_url : null;
      if (slide.is_video && effectiveVideoUrl) {
        const slideForVideo = { ...slide, slide_video_url: effectiveVideoUrl, slide_image_url: effectiveThumbUrl };
        try {
          const result = await processVideoSlide(slideForVideo, openaiKey, browser);
          results.push(result);
        } catch (e) {
          console.error('Video processing error:', e.message, e.stack);
          // Fallback: render AIMABOOSTING branded text slide
          try {
            const caption = slide.original_caption || '';
            const short = caption.length > 200 ? caption.slice(0, 200).replace(/\s\S*$/, '...') : caption;
            const pg = await browser.newPage();
            await pg.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
            await pg.setContent(buildTextBlockHtml({
              body: short || null,
              slide_number: slide.slide_number,
              total_slides: slide.total_slides,
              width: 1080,
              height: 1080,
            }), { waitUntil: 'networkidle2', timeout: 10000 });
            const fbuf = await pg.screenshot({ type: 'jpeg', quality: 85 });
            await pg.close();
            const fallbackUrl = await uploadToImgbb(fbuf, imgbbKey);
            results.push({ image_url: fallbackUrl, is_video: false, already_cloudinary: false, slide_number: slide.slide_number, original_caption: slide.original_caption || '', post_id: slide.post_id || '', source_account: slide.source_account || '' });
          } catch (fe) {
            console.error('Fallback render error:', fe.message);
            results.push({ image_url: null, is_video: false, slide_number: slide.slide_number, original_caption: slide.original_caption || '', post_id: slide.post_id || '', source_account: slide.source_account || '' });
          }
        }
        continue;
      }

      // 1. Use pre-downloaded base64 from n8n (sent while Apify URL was fresh).
      //    Fallback: try fetching the URL directly (may fail if CDN expired).
      let base64Image = slide.slide_image_base64 || null;
      if (!base64Image && slide.slide_image_url) {
        try {
          const imgResp = await fetch(slide.slide_image_url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://www.instagram.com/',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
          });
          if (imgResp.ok) {
            const buf = Buffer.from(await imgResp.arrayBuffer());
            base64Image = buf.toString('base64');
          }
        } catch (e) {
          console.error('Image download error:', e.message);
        }
      }
      console.log(`[slide ${slide.slide_number}] base64Image=${base64Image ? 'yes (' + Math.round(base64Image.length/1024) + 'KB)' : 'null'}`);

      // 2. Extract content with GPT-4o Vision
      let extracted = {};
      if (base64Image) {
        try {
          extracted = await extractSlideContent(base64Image, openaiKey);
        } catch (e) {
          console.error('Vision extraction error:', e.message);
          extracted = { slide_type: 'text', headline: null, body: null, bullets: null };
        }
      }

      // Caption fallback: if GPT Vision found no text, use original_caption
      if (!extracted.headline && !extracted.body && !(extracted.bullets && extracted.bullets.length)) {
        const caption = slide.original_caption || '';
        const short = caption.length > 200 ? caption.slice(0, 200).replace(/\s\S*$/, '...') : caption;
        extracted.body = short || null;
        extracted.slide_type = extracted.slide_type || 'content';
      }

      // ── Force cover for slide 1; elevate caption to headline for covers ────
      if (slide.slide_number === 1) extracted.slide_type = 'cover';
      if (extracted.slide_type === 'cover' && !extracted.headline) {
        const raw = extracted.body || slide.original_caption || '';
        // Strip leading emoji/symbols, grab first sentence (max 100 chars)
        const clean = raw.replace(/^[\p{Emoji}\s\u{1F300}-\u{1FFFF}]*/u, '').trim();
        const firstSentence = clean.split(/[.!?\n]/)[0].trim();
        extracted.headline = firstSentence.slice(0, 100) || null;
        extracted.body = null;
      }

      // ── Pexels fallback: if image fetch failed, search related photo ───────
      if (!base64Image && process.env.PEXELS_API_KEY) {
        const query = (extracted.headline || slide.original_caption || 'technology')
          .replace(/[^\w\s]/g, ' ').split(/\s+/).slice(0, 4).join(' ');
        console.log(`[cover] No original image — fetching Pexels: "${query}"`);
        base64Image = await fetchPexelsImage(query, process.env.PEXELS_API_KEY);
      }

      // 3. Build AIMABOOSTING branded slide
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
      // Use base64 data URI so Puppeteer browser doesn't need to fetch Instagram CDN
      const bgDataUri = base64Image ? `data:image/jpeg;base64,${base64Image}` : null;
      await page.setContent(buildSlideFromContent({
        ...extracted,
        slide_number: slide.slide_number || 1,
        total_slides: slide.total_slides || 1,
        imageUrl: bgDataUri,
        has_image: !!base64Image,
      }), { waitUntil: 'networkidle2', timeout: 15000 });
      const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
      await page.close();

      // 4. Upload — always as image (video slides are re-rendered as branded images)
      const imageUrl = await uploadToImgbb(buffer, imgbbKey);
      results.push({
        image_url: imageUrl,
        is_video: false,
        slide_number: slide.slide_number,
        original_caption: slide.original_caption || '',
        post_id: slide.post_id || '',
        source_account: slide.source_account || '',
      });
    }

    await browser.close();
    browser = null;
    res.json({ success: true, images: results });
  } catch (err) {
    console.error('Render rebrand batch error:', err.message);
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

async function processVideoSlide(slide, openaiKey, sharedBrowser) {
  const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const videoPath   = path.join(os.tmpdir(), `vid_${tag}.mp4`);
  const textPngPath = path.join(os.tmpdir(), `txt_${tag}.png`);
  const outputPath  = path.join(os.tmpdir(), `out_${tag}.mp4`);
  const cleanup = () => [videoPath, textPngPath, outputPath].forEach(f => {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  });

  try {
    // ── 1. Get thumbnail base64 — use pre-downloaded from n8n first (URL is still fresh there)
    let base64Thumb = slide.slide_image_base64 || null;
    let extracted = { slide_type: 'content', layout: 'text_top', headline: null, body: null, bullets: null, visual_top_pct: null };
    if (!base64Thumb && slide.slide_image_url) {
      try {
        const r = await fetch(slide.slide_image_url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.instagram.com/' } });
        if (r.ok) base64Thumb = Buffer.from(await r.arrayBuffer()).toString('base64');
      } catch (e) { console.error('Thumb fetch fallback error:', e.message); }
    }
    if (base64Thumb) {
      try { extracted = await extractSlideContent(base64Thumb, openaiKey); }
      catch (e) { console.error('Vision error:', e.message); }
    }
    if (!extracted.headline && !extracted.body && !(extracted.bullets && extracted.bullets.length)) {
      const cap = slide.original_caption || '';
      extracted.body = cap.length > 200 ? cap.slice(0, 200).replace(/\s\S*$/, '...') : cap || null;
    }

    // ── 2. COVER CHECK — slide 1 of any carousel is always the cover.
    // Also cover if GPT detected cover/text_bottom layout (image top, text bottom).
    const isCover = slide.slide_number === 1
      || extracted.slide_type === 'cover'
      || extracted.layout === 'text_bottom';

    if (isCover) {
      // Use base64 data URL so Puppeteer can render the image without hitting Instagram CDN
      const imageDataUrl = base64Thumb ? `data:image/jpeg;base64,${base64Thumb}` : null;
      const coverPage = await sharedBrowser.newPage();
      await coverPage.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
      await coverPage.setContent(buildSlideFromContent({
        ...extracted,
        slide_type: 'cover',
        has_image: !!imageDataUrl,
        imageUrl: imageDataUrl,
        slide_number: slide.slide_number,
        total_slides: slide.total_slides,
      }), { waitUntil: 'networkidle2', timeout: 15000 });
      const coverBuf = await coverPage.screenshot({ type: 'jpeg', quality: 90, fullPage: false });
      await coverPage.close();
      const imageUrl = await uploadToImgbb(coverBuf, process.env.IMGBB_API_KEY);
      cleanup();
      return { image_url: imageUrl, is_video: false, already_cloudinary: false, slide_number: slide.slide_number, original_caption: slide.original_caption || '', post_id: slide.post_id || '', source_account: slide.source_account || '' };
    }

    // ── 3. CONTENT VIDEO — download and compose
    const vr = await fetch(slide.slide_video_url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.instagram.com/' } });
    if (!vr.ok) throw new Error(`Video download failed: ${vr.status}`);
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(videoPath);
      const reader = vr.body.getReader();
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { writer.end(); return; }
        writer.write(Buffer.from(value), pump);
      }).catch(reject);
      writer.on('finish', resolve).on('error', reject);
      pump();
    });

    const dims = await new Promise((resolve) => {
      ffmpeg.ffprobe(videoPath, (err, meta) => {
        if (err) return resolve({ width: 1080, height: 1080, duration: 30 });
        const vs = (meta.streams || []).find(s => s.codec_type === 'video') || {};
        resolve({ width: vs.width || 1080, height: vs.height || 1080, duration: meta.format?.duration || 30 });
      });
    });

    // ── 4. Crop: use visual_top_pct from thumbnail analysis to cut out competitor's text region
    // The thumbnail (static layout image) shows exactly where their text ends and footage begins.
    // GPT returns visual_top_pct ≈ 0.35 if their text occupies top 35% of the frame.
    // When the thumbnail shows only footage (no text visible), GPT returns 0.0 — but the
    // actual video still has competitor branding baked into the top portion. Default to 0.33
    // so we always crop roughly the top third (where competitor text/logo lives) and replace
    // it with our AIMABOOSTING text block. If GPT detects a real value, that takes priority.
    const vtp = (typeof extracted.visual_top_pct === 'number' && extracted.visual_top_pct > 0.05)
      ? Math.min(extracted.visual_top_pct, 0.8)
      : 0.33;
    const vidW = dims.width;
    const vidH = dims.height;
    const cropY = Math.round(vidH * vtp);
    const cropH = vidH - cropY;
    console.log(`[video] vtp=${vtp} cropY=${cropY}/${vidH} duration=${dims.duration}s`);

    // ── 5. Render AIMABOOSTING text block (380px)
    const textH = 380;
    const videoH = 970; // total = 380+970 = 1350px (4:5 Instagram)

    const page = await sharedBrowser.newPage();
    await page.setViewport({ width: 1080, height: textH, deviceScaleFactor: 1 });
    await page.setContent(buildTextBlockHtml({
      ...extracted,
      slide_number: slide.slide_number,
      total_slides: slide.total_slides,
      width: 1080,
      height: textH,
    }), { waitUntil: 'networkidle2', timeout: 10000 });
    const textPngBuf = await page.screenshot({ type: 'png', fullPage: false });
    await page.close();
    fs.writeFileSync(textPngPath, textPngBuf);

    // ── 6. FFmpeg: [text block 380px] + [footage 970px filled, no black bars] = 1080×1350
    // If vtp > 0: crop out competitor's text region first, then fill 970px
    // If vtp = 0: video is pure footage, just fill 970px
    const vidCropFilter = cropY > 20
      ? `[1:v]crop=${vidW}:${cropH}:0:${cropY},scale=1080:${videoH}:force_original_aspect_ratio=increase,crop=1080:${videoH},setsar=1[vid]`
      : `[1:v]scale=1080:${videoH}:force_original_aspect_ratio=increase,crop=1080:${videoH},setsar=1[vid]`;

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(textPngPath)
        .inputOptions(['-loop 1'])
        .input(videoPath)
        .complexFilter([
          `[0:v]scale=1080:${textH},setsar=1[txt]`,
          vidCropFilter,
          '[txt][vid]vstack=inputs=2[out]',
        ])
        .outputOptions([
          '-map [out]',
          '-map 1:a?',
          '-t', String(dims.duration),
          '-c:v libx264',
          '-preset ultrafast',
          '-crf 28',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
          '-threads 1',
          '-bufsize 512k',
          '-maxrate 2M',
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // ── 6. Upload to Cloudinary
    const cloudinaryUrl = await uploadVideoToCloudinary(fs.readFileSync(outputPath));
    cleanup();

    return {
      image_url: cloudinaryUrl,
      is_video: true,
      already_cloudinary: true,
      slide_number: slide.slide_number,
      original_caption: slide.original_caption || '',
      post_id: slide.post_id || '',
      source_account: slide.source_account || '',
    };
  } catch (e) {
    cleanup();
    throw e;
  }
}

async function uploadVideoToCloudinary(videoBuffer) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'drg0uit7h';
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET || 'ml_default';
  const formData = new FormData();
  formData.append('file', new Blob([videoBuffer], { type: 'video/mp4' }), 'video.mp4');
  formData.append('upload_preset', preset);
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await resp.json();
  if (!data.secure_url) throw new Error(`Cloudinary video upload failed: ${JSON.stringify(data.error || data)}`);
  return data.secure_url;
}

async function fetchPexelsImage(query, apiKey) {
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=square`,
      { headers: { Authorization: apiKey } }
    );
    const data = await resp.json();
    const photo = data.photos?.[0];
    if (!photo) return null;
    const imgUrl = photo.src.large2x || photo.src.large || photo.src.original;
    const imgResp = await fetch(imgUrl);
    if (!imgResp.ok) return null;
    return Buffer.from(await imgResp.arrayBuffer()).toString('base64');
  } catch (e) {
    console.error('Pexels fetch error:', e.message);
    return null;
  }
}

function buildTextBlockHtml({ headline, subheadline, body, bullets, slide_number = 1, total_slides = 1, width = 1080, height = 380 }) {
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const counter = `${slide_number}/${total_slides}`;
  const hlText = headline || '';
  const hlSize = hlText.length > 80 ? 34 : hlText.length > 60 ? 40 : hlText.length > 40 ? 46 : hlText.length > 20 ? 52 : 58;
  const hasBullets = Array.isArray(bullets) && bullets.length > 0;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${width}px; height:${height}px; background:#07080f; overflow:hidden; font-family:system-ui,-apple-system,Arial,sans-serif; color:#fff; }
  .grid { position:absolute; inset:0; background-image:linear-gradient(rgba(108,99,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(108,99,255,0.06) 1px,transparent 1px); background-size:54px 54px; }
  .topbar { position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(90deg,#6c63ff,#00d4ff,#6c63ff); }
  .bottombar { position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(90deg,#6c63ff,#00d4ff); }
  .header { position:absolute; top:18px; left:36px; right:36px; display:flex; align-items:center; justify-content:space-between; }
  .logo { font-size:24px; font-weight:900; letter-spacing:-0.04em; }
  .logo .aima { color:#fff; } .logo .boost { color:#6c63ff; }
  .counter { font-size:14px; font-weight:700; color:rgba(255,255,255,0.35); letter-spacing:0.08em; }
  .content { position:absolute; top:64px; left:36px; right:36px; bottom:16px; display:flex; flex-direction:column; justify-content:center; gap:14px; }
  .accent { width:44px; height:4px; background:linear-gradient(90deg,#6c63ff,#00d4ff); border-radius:2px; }
  .hl { font-family:'Bebas Neue','Oswald',Impact,Arial,sans-serif; font-size:${hlSize}px; font-weight:400; line-height:1.05; letter-spacing:0.5px; text-transform:uppercase; color:#fff; }
  .sub { font-size:20px; font-weight:600; color:#6c63ff; line-height:1.4; }
  .body-text { font-size:20px; font-weight:500; color:rgba(255,255,255,0.90); line-height:1.6; }
  .bullets { list-style:none; display:flex; flex-direction:column; gap:10px; }
  .bullets li { display:flex; align-items:flex-start; gap:12px; font-size:20px; font-weight:500; color:#fff; line-height:1.4; }
  .bullets li::before { content:''; display:block; min-width:9px; height:9px; border-radius:50%; background:#6c63ff; margin-top:6px; flex-shrink:0; }
</style></head><body>
  <div class="grid"></div>
  <div class="topbar"></div>
  <div class="bottombar"></div>
  <div class="header">
    <div class="logo"><span class="aima">AIMA</span><span class="boost">BOOSTING</span></div>
    <div class="counter">${esc(counter)}</div>
  </div>
  <div class="content">
    <div class="accent"></div>
    ${headline ? `<h2 class="hl">${esc(headline)}</h2>` : ''}
    ${subheadline ? `<p class="sub">${esc(subheadline)}</p>` : ''}
    ${hasBullets ? `<ul class="bullets">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    ${body && !hasBullets ? `<p class="body-text">${esc(body)}</p>` : ''}
  </div>
</body></html>`;
}


async function extractSlideContent(base64Image, openaiKey) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this Instagram carousel slide. Extract ALL text content and determine layout.

Return ONLY valid JSON (no markdown) with these fields:
- slide_type: "cover" | "content" | "text"
  * "cover" = first/intro slide (usually has a big title + striking visual)
  * "content" = content slide with text/bullets/prompts
  * "text" = stat, quote, or minimal-text-only slide
- has_image: true if the slide contains a significant photo, illustration, or visual element (NOT just text on a flat/dark background); false if the slide is purely text on a solid/dark background
- layout: where the TEXT/BRANDING block is located relative to the visual content: "text_top" (text above, visual below), "text_bottom" (visual above, text below), "text_full" (text throughout, no clear visual area), "visual_full" (mostly visual, minimal text)
- headline: main title or heading (string or null)
- subheadline: secondary heading (string or null)
- body: the COMPLETE body text, WORD FOR WORD — do NOT summarize, truncate, or shorten. Copy every word exactly. (string or null)
- bullets: array of bullet/list items if present, each item COMPLETE (array or null)
- stat_number: prominent number or percentage (string or null)
- stat_label: label for the stat (string or null)
- visual_top_pct: decimal 0.0-1.0 indicating where the visual/video content region starts from the top of the frame.
  Use 0.0 if the visual fills the whole frame (no text block above it).
  Use ~0.33 if there is a text/branding block in the top ~33% and the visual is in the remaining lower portion.
  Use null only if layout is "text_full" (no visual area at all).

RULES:
1. Extract body/bullets text COMPLETELY — include the full prompt, all sentences, every word
2. Ignore account logos, handles, watermarks — only extract informational content
3. Translate all extracted text to Spanish
4. For body text that is a prompt in quotes: keep it as a single body string, translated`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: 'high' },
          },
        ],
      }],
    }),
  });
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// buildSlideFromContent: Instagram-style AIMABOOSTING slides.
// Layout:
//   cover  + image → full-bleed photo, dark gradient bottom, big Bebas Neue text w/ teal highlights
//   cover  + no image → black bg, centered big text
//   content + image → black top half (text) + sharp photo bottom half (no blur)
//   content/text + no image → black bg, bold headline + body/bullets
function buildSlideFromContent(data) {
  const {
    slide_type = 'text',
    has_image = false,
    headline, subheadline, body, bullets,
    slide_number = 1, total_slides = 1,
    imageUrl = null,
  } = data;

  const esc = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const counter = `${slide_number}/${total_slides}`;
  const hasBullets = Array.isArray(bullets) && bullets.length > 0;
  const hlText = headline || '';

  // Split headline: first half white, second half teal (IG impact style)
  function splitHeadline(text) {
    if (!text) return '';
    const safe = esc(text);
    const words = safe.split(' ');
    if (words.length <= 3) return `<span class="hl-teal">${safe}</span>`;
    const split = Math.ceil(words.length * 0.42);
    const white = words.slice(0, split).join(' ');
    const teal = words.slice(split).join(' ');
    return `${white} <span class="hl-teal">${teal}</span>`;
  }

  // Font sizes
  const coverHlSize = hlText.length > 80 ? 86 : hlText.length > 60 ? 100 : hlText.length > 40 ? 116 : hlText.length > 20 ? 128 : 138;
  const contentHlSize = hlText.length > 70 ? 52 : hlText.length > 50 ? 60 : hlText.length > 30 ? 68 : 76;
  const bodySize = 28;

  const showSplit = (has_image || false) && !!imageUrl;

  // ── Shared elements ─────────────────────────────────────────────────────────
  const logoBar = `
    <div style="position:absolute;top:0;left:0;right:0;height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 40px;z-index:20;background:linear-gradient(180deg,rgba(0,0,0,0.60) 0%,transparent 100%);">
      <div style="font-family:system-ui,-apple-system,Arial,sans-serif;font-size:26px;font-weight:900;letter-spacing:-0.03em;line-height:1;">
        <span style="color:#fff;">AIMA</span><span style="color:#00d4ff;">BOOSTING</span>
      </div>
      <div style="font-size:15px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.08em;">${esc(counter)}</div>
    </div>`;

  const logoBarDark = `
    <div style="position:absolute;top:0;left:0;right:0;height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 40px;z-index:20;">
      <div style="font-family:system-ui,-apple-system,Arial,sans-serif;font-size:26px;font-weight:900;letter-spacing:-0.03em;line-height:1;">
        <span style="color:#fff;">AIMA</span><span style="color:#00d4ff;">BOOSTING</span>
      </div>
      <div style="font-size:15px;font-weight:700;color:rgba(255,255,255,0.40);letter-spacing:0.08em;">${esc(counter)}</div>
    </div>`;

  const baseFont = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@500;600;700;900&display=swap');`;

  // ── COVER with image ────────────────────────────────────────────────────────
  if (slide_type === 'cover' && imageUrl) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${baseFont}
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1080px; overflow:hidden; background:#000; font-family:'Inter',system-ui,Arial,sans-serif; }
  .photo {
    position:absolute; inset:0;
    background-image:url('${imageUrl}');
    background-size:cover; background-position:center;
    filter:brightness(0.9) saturate(1.1);
  }
  .grad {
    position:absolute; inset:0;
    background:linear-gradient(180deg,
      rgba(0,0,0,0.30) 0%,
      rgba(0,0,0,0.00) 22%,
      rgba(0,0,0,0.00) 42%,
      rgba(0,0,0,0.65) 62%,
      rgba(0,0,0,0.95) 78%,
      rgba(0,0,0,1.00) 100%
    );
  }
  .bottom-block {
    position:absolute; bottom:0; left:0; right:0;
    padding:12px 44px 50px;
    display:flex; flex-direction:column; gap:14px; z-index:10;
  }
  .sep { width:60px; height:5px; background:linear-gradient(90deg,#00d4ff,#6c63ff); border-radius:3px; }
  .cover-hl {
    font-family:'Bebas Neue',Impact,Arial,sans-serif;
    font-size:${coverHlSize}px; font-weight:400; line-height:0.93;
    text-transform:uppercase; letter-spacing:2px; color:#fff;
    text-shadow:0 3px 20px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1);
    word-break:break-word;
  }
  .hl-teal { color:#00d4ff; }
  .swipe-btn {
    display:inline-flex; align-items:center; gap:10px;
    border:2px solid rgba(255,255,255,0.35); border-radius:50px;
    padding:10px 24px; width:fit-content;
    font-size:16px; font-weight:700; color:rgba(255,255,255,0.80); letter-spacing:0.08em;
  }
</style></head><body>
  <div class="photo"></div>
  <div class="grad"></div>
  ${logoBar}
  <div class="bottom-block">
    <div class="sep"></div>
    ${headline ? `<h1 class="cover-hl">${splitHeadline(headline)}</h1>` : ''}
    <div class="swipe-btn">DESLIZA PARA VER MÁS &nbsp;›</div>
  </div>
</body></html>`;
  }

  // ── COVER without image ─────────────────────────────────────────────────────
  if (slide_type === 'cover') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${baseFont}
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1080px; overflow:hidden; background:#000; font-family:'Inter',system-ui,Arial,sans-serif; }
  .noise {
    position:absolute; inset:0;
    background:radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,212,255,0.06) 0%, transparent 70%),
               radial-gradient(ellipse 60% 80% at 80% 80%, rgba(108,99,255,0.07) 0%, transparent 70%),
               #000;
  }
  .cover-area {
    position:absolute; top:90px; left:52px; right:52px; bottom:60px;
    display:flex; flex-direction:column; justify-content:center; gap:24px;
  }
  .handle { font-size:16px; font-weight:700; color:#00d4ff; letter-spacing:0.16em; text-transform:uppercase; }
  .sep { width:64px; height:5px; background:linear-gradient(90deg,#00d4ff,#6c63ff); border-radius:3px; }
  .cover-hl {
    font-family:'Bebas Neue',Impact,Arial,sans-serif;
    font-size:${coverHlSize}px; font-weight:400; line-height:0.93;
    text-transform:uppercase; letter-spacing:2px; color:#fff;
    word-break:break-word;
  }
  .hl-teal { color:#00d4ff; }
  .cover-body { font-size:24px; font-weight:500; color:rgba(255,255,255,0.75); line-height:1.6; }
  .swipe-btn {
    display:inline-flex; align-items:center; gap:10px;
    border:2px solid rgba(255,255,255,0.25); border-radius:50px;
    padding:10px 24px; width:fit-content;
    font-size:16px; font-weight:700; color:rgba(255,255,255,0.65); letter-spacing:0.08em;
  }
</style></head><body>
  <div class="noise"></div>
  ${logoBarDark}
  <div class="cover-area">
    <div class="handle">@AIMABOOSTING</div>
    <div class="sep"></div>
    ${headline ? `<h1 class="cover-hl">${splitHeadline(headline)}</h1>` : ''}
    ${body ? `<p class="cover-body">${esc(body)}</p>` : ''}
    <div class="swipe-btn">DESLIZA PARA VER MÁS &nbsp;›</div>
  </div>
</body></html>`;
  }

  // ── CONTENT with image: full-bleed photo + gradient overlay (magazine style) ──
  if ((slide_type === 'content') && showSplit) {
    const bulletsHtml = hasBullets
      ? `<ul style="list-style:none;display:flex;flex-direction:column;gap:16px;">${bullets.map(b =>
          `<li style="display:flex;align-items:flex-start;gap:14px;font-size:${bodySize}px;font-weight:500;color:rgba(255,255,255,0.92);line-height:1.5;">
            <span style="display:block;min-width:9px;height:9px;border-radius:50%;background:#00d4ff;margin-top:10px;flex-shrink:0;box-shadow:0 0 8px rgba(0,212,255,0.6);"></span>
            ${esc(b)}</li>`
        ).join('')}</ul>`
      : '';
    const bodyHtml = body && !hasBullets
      ? `<p style="font-size:${bodySize}px;font-weight:500;color:rgba(255,255,255,0.88);line-height:1.65;">${esc(body)}</p>`
      : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${baseFont}
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1080px; overflow:hidden; background:#000; font-family:'Inter',system-ui,Arial,sans-serif; }
  .photo {
    position:absolute; inset:0;
    background-image:url('${imageUrl}');
    background-size:cover; background-position:center center;
    filter:brightness(0.75) saturate(1.1);
  }
  /* Top-heavy gradient: solid black top 45% fading smoothly to transparent */
  .grad {
    position:absolute; inset:0;
    background:linear-gradient(180deg,
      rgba(0,0,0,1.00)  0%,
      rgba(0,0,0,0.98) 30%,
      rgba(0,0,0,0.82) 50%,
      rgba(0,0,0,0.35) 72%,
      rgba(0,0,0,0.10) 88%,
      rgba(0,0,0,0.00) 100%
    );
  }
  /* Bottom vignette so brand pill is readable */
  .grad-bottom {
    position:absolute; inset:0;
    background:linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 18%);
  }
  .text-block {
    position:absolute; top:72px; left:0; right:0;
    padding:28px 48px 0;
    display:flex; flex-direction:column; gap:20px;
  }
  .sep { width:52px; height:5px; background:linear-gradient(90deg,#00d4ff,#6c63ff); border-radius:3px; flex-shrink:0; }
  .content-hl {
    font-family:'Bebas Neue',Impact,Arial,sans-serif;
    font-size:${contentHlSize}px; font-weight:400; line-height:0.95;
    text-transform:uppercase; letter-spacing:1.5px; color:#fff;
    word-break:break-word;
  }
  .brand-bottom {
    position:absolute; bottom:22px; left:0; right:0;
    display:flex; justify-content:center; align-items:center; z-index:10;
  }
  .brand-pill {
    background:rgba(0,0,0,0.80); border:1.5px solid rgba(255,255,255,0.18);
    border-radius:50px; padding:8px 24px;
    font-size:18px; font-weight:900; letter-spacing:-0.02em; color:#fff;
    backdrop-filter:blur(6px);
  }
  .brand-pill span { color:#00d4ff; }
</style></head><body>
  <div class="photo"></div>
  <div class="grad"></div>
  <div class="grad-bottom"></div>
  ${logoBar}
  <div class="text-block">
    <div class="sep"></div>
    ${headline ? `<h2 class="content-hl">${esc(headline)}</h2>` : ''}
    ${bulletsHtml}${bodyHtml}
  </div>
  <div class="brand-bottom">
    <div class="brand-pill">AIMA<span>BOOSTING</span></div>
  </div>
</body></html>`;
  }

  // ── TEXT / BULLETS (no image) ───────────────────────────────────────────────
  const bulletsHtml = hasBullets
    ? `<ul style="list-style:none;display:flex;flex-direction:column;gap:20px;">${bullets.map(b =>
        `<li style="display:flex;align-items:flex-start;gap:16px;font-size:${bodySize}px;font-weight:500;color:#fff;line-height:1.45;">
          <span style="display:block;min-width:10px;height:10px;border-radius:50%;background:#00d4ff;box-shadow:0 0 8px rgba(0,212,255,0.7);margin-top:9px;flex-shrink:0;"></span>
          ${esc(b)}</li>`
      ).join('')}</ul>`
    : '';
  const bodyHtml2 = body && !hasBullets
    ? `<p style="font-size:${bodySize}px;font-weight:500;color:rgba(255,255,255,0.85);line-height:1.65;">${esc(body)}</p>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${baseFont}
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1080px; overflow:hidden; background:#000; font-family:'Inter',system-ui,Arial,sans-serif; }
  .noise {
    position:absolute; inset:0;
    background:radial-gradient(ellipse 70% 50% at 50% 30%, rgba(0,212,255,0.05) 0%, transparent 70%), #000;
  }
  .text-area {
    position:absolute; top:90px; left:52px; right:52px; bottom:52px;
    display:flex; flex-direction:column; justify-content:center; gap:22px;
  }
  .sep { width:52px; height:5px; background:linear-gradient(90deg,#00d4ff,#6c63ff); border-radius:3px; flex-shrink:0; }
  .text-hl {
    font-family:'Bebas Neue',Impact,Arial,sans-serif;
    font-size:${contentHlSize}px; font-weight:400; line-height:0.95;
    text-transform:uppercase; letter-spacing:1.5px; color:#fff;
    word-break:break-word;
  }
</style></head><body>
  <div class="noise"></div>
  ${logoBarDark}
  <div class="text-area">
    <div class="sep"></div>
    ${headline ? `<h2 class="text-hl">${esc(headline)}</h2>` : ''}
    ${bulletsHtml}${bodyHtml2}
  </div>
</body></html>`;
}

function buildRebrandHtml(slideImageUrl, slideNumber, totalSlides) {
  const safe = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const numStr = `${slideNumber}/${totalSlides}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1080px; overflow: hidden; background: #07080f; }

  .bg {
    position: absolute;
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: center center;
  }

  .overlay-top {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 130px;
    background: linear-gradient(to bottom, rgba(7,8,15,0.55) 0%, rgba(7,8,15,0) 100%);
  }

  .brand-bar {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 88px;
    background: linear-gradient(135deg, #07080f 0%, #0d0e1f 40%, #1a1040 100%);
    border-top: 2px solid rgba(108,99,255,0.6);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
  }

  .brand-logo {
    font-family: system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-weight: 800;
    font-size: 34px;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .brand-logo .aima { color: #ffffff; }
  .brand-logo .boosting { color: #6c63ff; }

  .brand-tagline {
    font-family: system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .badge {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(7,8,15,0.72);
    border: 1px solid rgba(108,99,255,0.55);
    border-radius: 50px;
    padding: 8px 16px;
    backdrop-filter: blur(6px);
  }

  .badge-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #6c63ff;
    box-shadow: 0 0 8px #6c63ff;
  }

  .badge-counter {
    font-family: system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    font-size: 16px;
    color: rgba(255,255,255,0.9);
    letter-spacing: 0.05em;
  }
</style>
</head>
<body>
  <img class="bg" src="${safe(slideImageUrl)}" crossorigin="anonymous">
  <div class="overlay-top"></div>
  <div class="badge">
    <div class="badge-dot"></div>
    <div class="badge-counter">${safe(numStr)}</div>
  </div>
  <div class="brand-bar">
    <div class="brand-logo"><span class="aima">AIMA</span><span class="boosting">BOOSTING</span></div>
    <div class="brand-tagline">Automatización con IA</div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /render-generate-batch
// Generates AIMABOOSTING slides from pre-generated GPT content + Pexels media.
// No GPT Vision needed — content already structured by n8n before calling.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/render-generate-batch', async (req, res) => {
  const { slides } = req.body;
  if (!Array.isArray(slides) || slides.length === 0) {
    return res.status(400).json({ error: 'Missing required field: slides (array)' });
  }
  if (!process.env.IMGBB_API_KEY) return res.status(500).json({ error: 'IMGBB_API_KEY not set' });

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const results = [];
    for (const slide of slides) {
      try {
        const result = await handleGeneratedSlide(slide, browser);
        results.push(result);
      } catch (e) {
        console.error(`[generate-batch] slide ${slide.slide_number} error:`, e.message);
        // Fallback: render pure text slide
        try {
          const pg = await browser.newPage();
          await pg.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
          await pg.setContent(buildSlideFromContent({
            slide_type: 'text', has_image: false,
            headline: slide.headline || null,
            body: slide.body || null,
            bullets: slide.bullets || null,
            slide_number: slide.slide_number || 1,
            total_slides: slide.total_slides || slides.length,
            imageUrl: null,
          }), { waitUntil: 'networkidle2', timeout: 15000 });
          const buf = await pg.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
          await pg.close();
          const url = await uploadToImgbb(buf, process.env.IMGBB_API_KEY);
          results.push({ image_url: url, is_video: false, slide_number: slide.slide_number || 1 });
        } catch (fe) {
          console.error(`[generate-batch] fallback slide ${slide.slide_number} error:`, fe.message);
          results.push({ image_url: null, is_video: false, slide_number: slide.slide_number || 1 });
        }
      }
    }

    await browser.close();
    browser = null;
    res.json({ success: true, images: results });
  } catch (err) {
    console.error('[generate-batch] fatal error:', err.message);
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

// Fetch image from Pexels — photoIndex ensures each slide gets a different photo
async function fetchPexelsImageUrl(query, photoIndex = 0) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch(
      'https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) + '&per_page=15&orientation=square',
      { headers: { Authorization: key } }
    );
    const data = await resp.json();
    const photos = data.photos || [];
    if (!photos.length) return null;
    // Pick by index (mod to avoid out-of-bounds)
    const photo = photos[photoIndex % photos.length];
    return photo.src.large2x || photo.src.large || photo.src.original;
  } catch (e) {
    console.error('[pexels] search failed:', e.message);
    return null;
  }
}

// Fetch Pexels video URL by keyword query
async function fetchPexelsVideoUrl(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch(
      'https://api.pexels.com/videos/search?query=' + encodeURIComponent(query) + '&per_page=5&size=medium',
      { headers: { Authorization: key } }
    );
    const data = await resp.json();
    const video = data.videos && data.videos[0];
    if (!video) return null;
    const files = video.video_files || [];
    const hd = files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4')
      || files.find(f => f.file_type === 'video/mp4')
      || files[0];
    return hd ? hd.link : null;
  } catch (e) {
    console.error('[pexels] video search failed:', e.message);
    return null;
  }
}

// Download image URL → base64 data URL for Puppeteer
async function downloadImageAsDataUrl(url) {
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer()).toString('base64');
    return `data:image/jpeg;base64,${buf}`;
  } catch (e) {
    console.error('[img-download] failed:', e.message);
    return null;
  }
}

async function handleGeneratedSlide(slide, browser) {
  const {
    slide_type, headline, subheadline, body, bullets,
    image_base64, video_url,
    slide_number = 1, total_slides = 1,
  } = slide;

  // Use GPT-provided English Pexels query, or fall back to headline words
  const pexelsQuery = slide.pexels_query || (headline || '').replace(/[^\w\s]/g, ' ').split(/\s+/).slice(0, 5).join(' ') || 'technology artificial intelligence';
  console.log(`[generate] slide ${slide_number} pexels_query="${pexelsQuery}"`);

  // Prefer pre-supplied URL, then fetch from Pexels directly on Railway
  let image_url_raw = slide.image_url || null;

  console.log(`[generate] slide ${slide_number} type=${slide_type} pre_url=${!!image_url_raw} b64=${!!image_base64} video=${!!video_url}`);

  // VIDEO slide
  if (slide_type === 'video') {
    // Use pre-supplied video URL or fetch from Pexels
    if (!video_url) {
      slide = Object.assign({}, slide, { video_url: await fetchPexelsVideoUrl(pexelsQuery) });
    }
    if (slide.video_url) {
      return await renderPexelsVideoSlide({ slide, browser });
    }
  }

  // COVER or CONTENT: need an image
  if (slide_type === 'cover' || slide_type === 'content') {
    let imageUrl = null;

    // 1. Try pre-supplied URL
    if (image_url_raw) {
      imageUrl = await downloadImageAsDataUrl(image_url_raw);
    }
    // 2. Fetch from Pexels directly on Railway (use slide_number as index to avoid duplicates)
    if (!imageUrl) {
      const pexelsUrl = await fetchPexelsImageUrl(pexelsQuery, slide_number - 1);
      console.log(`[generate] slide ${slide_number} pexels: ${pexelsUrl}`);
      if (pexelsUrl) imageUrl = await downloadImageAsDataUrl(pexelsUrl);
    }
    // 3. base64 fallback
    if (!imageUrl && image_base64) {
      imageUrl = `data:image/jpeg;base64,${image_base64}`;
    }

    if (imageUrl) {
      const pg = await browser.newPage();
      await pg.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
      await pg.setContent(buildSlideFromContent({
        slide_type, has_image: true, headline, subheadline, body, bullets,
        slide_number, total_slides, imageUrl,
      }), { waitUntil: 'networkidle2', timeout: 15000 });
      const buf = await pg.screenshot({ type: 'jpeg', quality: 87, fullPage: false });
      await pg.close();
      const url = await uploadToImgbb(buf, process.env.IMGBB_API_KEY);
      return { image_url: url, is_video: false, slide_number };
    }
  }

  // TEXT slide (or any slide missing media): pure dark layout
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  await pg.setContent(buildSlideFromContent({
    slide_type: slide_type || 'text', has_image: false,
    headline, subheadline, body, bullets,
    slide_number, total_slides, imageUrl: null,
  }), { waitUntil: 'networkidle2', timeout: 15000 });
  const buf = await pg.screenshot({ type: 'jpeg', quality: 87, fullPage: false });
  await pg.close();
  const url = await uploadToImgbb(buf, process.env.IMGBB_API_KEY);
  return { image_url: url, is_video: false, slide_number };
}

async function renderPexelsVideoSlide({ slide, browser }) {
  const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const videoPath  = path.join(os.tmpdir(), `pvid_${tag}.mp4`);
  const textPath   = path.join(os.tmpdir(), `ptxt_${tag}.png`);
  const outputPath = path.join(os.tmpdir(), `pout_${tag}.mp4`);
  const cleanup = () => [videoPath, textPath, outputPath].forEach(f => {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  });

  try {
    // 1. Download Pexels video
    console.log(`[pexels-video] downloading: ${slide.video_url}`);
    const vr = await fetch(slide.video_url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!vr.ok) throw new Error(`Pexels video download failed: ${vr.status}`);
    fs.writeFileSync(videoPath, Buffer.from(await vr.arrayBuffer()));

    // 2. Get video duration
    const { duration } = await new Promise(resolve => {
      ffmpeg.ffprobe(videoPath, (err, meta) => {
        if (err) return resolve({ duration: 15 });
        resolve({ duration: Math.min(meta.format?.duration || 15, 60) });
      });
    });
    console.log(`[pexels-video] duration=${duration}s`);

    // 3. Render AIMABOOSTING text block (380px tall)
    const textH = 380;
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1080, height: textH, deviceScaleFactor: 1 });
    await pg.setContent(buildTextBlockHtml({
      headline: slide.headline,
      subheadline: slide.subheadline,
      body: slide.body,
      bullets: slide.bullets,
      slide_number: slide.slide_number,
      total_slides: slide.total_slides,
      width: 1080,
      height: textH,
    }), { waitUntil: 'networkidle2', timeout: 10000 });
    const textPng = await pg.screenshot({ type: 'png', fullPage: false });
    await pg.close();
    fs.writeFileSync(textPath, textPng);

    // 4. FFmpeg: text block (380px) stacked above video (970px) = 1080×1350 (4:5)
    const videoH = 970;
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(textPath).inputOptions(['-loop 1'])
        .input(videoPath)
        .complexFilter([
          `[0:v]scale=1080:${textH},setsar=1[txt]`,
          `[1:v]scale=1080:${videoH}:force_original_aspect_ratio=increase,crop=1080:${videoH},setsar=1[vid]`,
          '[txt][vid]vstack=inputs=2[out]',
        ])
        .outputOptions([
          '-map [out]',
          '-map 1:a?',
          '-t', String(duration),
          '-c:v libx264',
          '-preset ultrafast',
          '-crf 28',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
          '-threads 1',
          '-bufsize 512k',
          '-maxrate 2M',
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // 5. Upload to Cloudinary
    const cloudUrl = await uploadVideoToCloudinary(fs.readFileSync(outputPath));
    cleanup();
    console.log(`[pexels-video] done: ${cloudUrl}`);
    return {
      image_url: cloudUrl,
      is_video: true,
      already_cloudinary: true,
      slide_number: slide.slide_number,
    };
  } catch (e) {
    cleanup();
    throw e;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Image renderer running on port ${PORT}`));
