const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

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

  /* Strong gradient: transparent top → solid black bottom 50% */
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

  // template === 'slide' — full-bleed image with gradient overlay (like cover, but with bullets)
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

  /* gradient: transparent top → solid black from 38% down */
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

  // Download the Instagram image server-side to avoid CDN blocking in Puppeteer
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
    // Fallback: pass URL directly and hope Puppeteer can load it
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
      // 1. Download image as base64
      let base64Image = null;
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

      // 3. Render from scratch using AIMABOOSTING design system (with original image embedded)
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
      await page.setContent(buildSlideFromContent({
        ...extracted,
        slide_number: slide.slide_number || 1,
        total_slides: slide.total_slides || 1,
        imageBase64: base64Image,
      }), { waitUntil: 'domcontentloaded', timeout: 10000 });
      const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
      await page.close();

      // 4. Upload
      const imageUrl = await uploadToImgbb(buffer, imgbbKey);
      results.push({
        image_url: imageUrl,
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

async function extractSlideContent(base64Image, openaiKey) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this Instagram carousel slide. Extract the informational content and determine the layout type. Ignore ALL competitor logos, handles, watermarks, and account branding — only extract the actual educational/informational content.\n\nReturn ONLY valid JSON (no markdown) with these fields:\n- slide_type: "cover" (intro slide, large hero photo with a person or scene, minimal text OR title-only) | "content" (has meaningful photo AND text, bullets, or explanation) | "text" (mostly text, stats, bullets, quote — no significant photo)\n- headline: main heading or title text (string or null)\n- subheadline: secondary heading (string or null)\n- body: paragraph or description text (string or null)\n- bullets: array of bullet point strings if present (array or null)\n- stat_number: a prominent number or percentage if any (string or null)\n- stat_label: label/context for the stat (string or null)\n\nIMPORTANT: Extract the actual informational content. If the slide text is in English, keep it in Spanish if already Spanish, or translate to Spanish.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: 'low' },
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

function buildSlideFromContent(data) {
  const {
    slide_type = 'text',
    headline, subheadline, body, bullets,
    stat_number, stat_label,
    slide_number = 1, total_slides = 1,
    imageBase64 = null,
  } = data;

  const esc = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const counter = `${slide_number}/${total_slides}`;
  const imgSrc = imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null;
  const hasBullets = Array.isArray(bullets) && bullets.length > 0;

  const logoHtml = `<div class="logo"><span class="aima">AIMA</span><span class="boost">BOOSTING</span></div>`;

  const hlText = headline || '';
  const hlSize = hlText.length > 80 ? 36 : hlText.length > 50 ? 44 : hlText.length > 30 ? 54 : 64;

  // ── COVER layout ──────────────────────────────────────────────────────────
  // Photo fills top ~620px, dark bottom area with logo + headline
  if (slide_type === 'cover' && imgSrc) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1080px; overflow:hidden; background:#07080f;
    font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif; }

  .photo-zone {
    position:absolute; top:0; left:0; right:0; height:625px;
    background:url('${imgSrc}') center/cover no-repeat;
  }
  .photo-fade {
    position:absolute; top:495px; left:0; right:0; height:130px;
    background:linear-gradient(to bottom, rgba(7,8,15,0) 0%, rgba(7,8,15,1) 100%);
  }
  .counter-badge {
    position:absolute; top:22px; right:22px;
    background:rgba(7,8,15,0.75); border:1px solid rgba(108,99,255,0.55);
    border-radius:40px; padding:8px 20px;
    font-size:15px; font-weight:700; color:rgba(255,255,255,0.85);
    letter-spacing:0.05em; backdrop-filter:blur(4px);
  }
  .text-zone {
    position:absolute; bottom:0; left:0; right:0; top:595px;
    background:#07080f; padding:12px 50px 44px 50px;
    display:flex; flex-direction:column; gap:14px;
  }
  .brand-row { display:flex; align-items:center; gap:12px; }
  .logo { font-size:22px; font-weight:900; letter-spacing:-0.04em; line-height:1; }
  .logo .aima { color:#fff; }
  .logo .boost { color:#6c63ff; }
  .brand-sep { width:1px; height:18px; background:rgba(255,255,255,0.12); }
  .brand-handle { font-size:13px; font-weight:600; color:rgba(255,255,255,0.32); letter-spacing:0.1em; text-transform:uppercase; }
  .accent { width:48px; height:3px; background:linear-gradient(90deg,#6c63ff,#00d4ff); border-radius:2px; }
  .cover-headline { font-size:${hlSize}px; font-weight:900; color:#fff; line-height:1.08; letter-spacing:-0.03em; }
  .cover-sub { font-size:21px; font-weight:600; color:#00d4ff; line-height:1.4; }
  .swipe { margin-top:auto; font-size:13px; font-weight:700; color:rgba(108,99,255,0.65); letter-spacing:0.12em; text-transform:uppercase; }
</style></head><body>
  <div class="photo-zone"></div>
  <div class="photo-fade"></div>
  <div class="counter-badge">${esc(counter)}</div>
  <div class="text-zone">
    <div class="brand-row">
      ${logoHtml}
      <div class="brand-sep"></div>
      <div class="brand-handle">@aimaboosting</div>
    </div>
    <div class="accent"></div>
    ${headline ? `<h1 class="cover-headline">${esc(headline)}</h1>` : ''}
    ${subheadline ? `<p class="cover-sub">${esc(subheadline)}</p>` : ''}
    <div class="swipe">Desliza →</div>
  </div>
</body></html>`;
  }

  // ── CONTENT layout ────────────────────────────────────────────────────────
  // Dark bg top ~55% with text, original photo embedded at bottom ~40%
  if (slide_type === 'content' && imgSrc) {
    const hlSizeC = hlText.length > 60 ? 36 : hlText.length > 40 ? 44 : hlText.length > 20 ? 52 : 58;
    const bulletsHtml = hasBullets
      ? `<ul class="bullets">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '';
    const bodyHtml = body && !hasBullets ? `<p class="body-text">${esc(body)}</p>` : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1080px; overflow:hidden; background:#07080f;
    font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif; color:#fff; }

  .topbar { position:absolute; top:0; left:0; right:0; height:5px; background:linear-gradient(90deg,#6c63ff,#00d4ff,#6c63ff); }
  .glow { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
  .glow-1 { width:420px; height:420px; background:rgba(108,99,255,0.16); top:-80px; right:-60px; }

  .header {
    position:absolute; top:22px; left:44px; right:44px;
    display:flex; align-items:center; justify-content:space-between;
  }
  .logo { font-size:24px; font-weight:900; letter-spacing:-0.04em; }
  .logo .aima { color:#fff; }
  .logo .boost { color:#6c63ff; }
  .counter { font-size:14px; font-weight:700; color:rgba(255,255,255,0.32); letter-spacing:0.08em; }

  .text-area {
    position:absolute; top:86px; left:44px; right:44px; bottom:368px;
    display:flex; flex-direction:column; justify-content:center; gap:18px;
  }
  .accent { width:44px; height:4px; background:linear-gradient(90deg,#6c63ff,#00d4ff); border-radius:2px; }
  .content-headline { font-size:${hlSizeC}px; font-weight:900; color:#fff; line-height:1.1; letter-spacing:-0.03em; }
  .content-sub { font-size:19px; font-weight:600; color:#6c63ff; }
  .bullets { list-style:none; display:flex; flex-direction:column; gap:13px; }
  .bullets li { display:flex; align-items:flex-start; gap:14px; font-size:21px; color:rgba(255,255,255,0.82); line-height:1.4; }
  .bullets li::before { content:''; display:block; min-width:9px; height:9px; border-radius:50%;
    background:#6c63ff; box-shadow:0 0 8px rgba(108,99,255,0.7); margin-top:7px; }
  .body-text { font-size:22px; color:rgba(255,255,255,0.75); line-height:1.6; }

  .photo-zone {
    position:absolute; bottom:0; left:0; right:0; height:356px;
  }
  .photo-zone img { width:100%; height:100%; object-fit:cover; object-position:center 30%; display:block; }
  .photo-top-fade {
    position:absolute; top:0; left:0; right:0; height:70px;
    background:linear-gradient(to bottom,#07080f,transparent);
  }
  .photo-bottom-bar {
    position:absolute; bottom:0; left:0; right:0; height:5px;
    background:linear-gradient(90deg,#6c63ff,#00d4ff);
  }
</style></head><body>
  <div class="glow glow-1"></div>
  <div class="topbar"></div>
  <div class="header">
    ${logoHtml}
    <div class="counter">${esc(counter)}</div>
  </div>
  <div class="text-area">
    <div class="accent"></div>
    ${headline ? `<h2 class="content-headline">${esc(headline)}</h2>` : ''}
    ${subheadline ? `<p class="content-sub">${esc(subheadline)}</p>` : ''}
    ${bulletsHtml}${bodyHtml}
  </div>
  <div class="photo-zone">
    <img src="${imgSrc}" alt="">
    <div class="photo-top-fade"></div>
    <div class="photo-bottom-bar"></div>
  </div>
</body></html>`;
  }

  // ── TEXT layout (default) ─────────────────────────────────────────────────
  // Pure dark, glow, grid — no photo. Used for stats, quotes, text-only slides,
  // or as fallback when no image is available.
  const hasStatNumber = stat_number && String(stat_number).trim();
  let innerHtml = '';

  if (hasStatNumber) {
    innerHtml = `
      <div class="stat-number">${esc(stat_number)}</div>
      ${stat_label ? `<div class="stat-label">${esc(stat_label)}</div>` : ''}
      ${body ? `<p class="stat-body">${esc(body)}</p>` : ''}`;
  } else {
    innerHtml = `
      <div class="accent"></div>
      ${headline ? `<h2 class="text-headline" style="font-size:${hlSize}px">${esc(headline)}</h2>` : ''}
      ${subheadline ? `<p class="text-sub">${esc(subheadline)}</p>` : ''}
      ${hasBullets ? `<ul class="bullets">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${body && !hasBullets ? `<p class="body-text">${esc(body)}</p>` : ''}`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1080px; overflow:hidden; background:#07080f;
    font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif; }

  .topbar { position:absolute; top:0; left:0; right:0; height:5px; background:linear-gradient(90deg,#6c63ff,#00d4ff,#6c63ff); }
  .bottombar { position:absolute; bottom:0; left:0; right:0; height:5px; background:linear-gradient(90deg,#6c63ff,#00d4ff); }
  .glow { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; }
  .glow-1 { width:500px; height:500px; background:rgba(108,99,255,0.18); top:-100px; right:-80px; }
  .glow-2 { width:380px; height:380px; background:rgba(0,212,255,0.08); bottom:80px; left:-60px; }
  .grid { position:absolute; inset:0;
    background-image:linear-gradient(rgba(108,99,255,0.05) 1px,transparent 1px),
      linear-gradient(90deg,rgba(108,99,255,0.05) 1px,transparent 1px);
    background-size:60px 60px; }

  .header { position:absolute; top:22px; left:44px; right:44px;
    display:flex; align-items:center; justify-content:space-between; }
  .logo { font-size:24px; font-weight:900; letter-spacing:-0.04em; }
  .logo .aima { color:#fff; }
  .logo .boost { color:#6c63ff; }
  .counter { font-size:14px; font-weight:700; color:rgba(255,255,255,0.32); letter-spacing:0.08em; }

  .content-area { position:absolute; top:100px; left:64px; right:64px; bottom:30px;
    display:flex; flex-direction:column; justify-content:center; gap:22px; }

  .accent { width:44px; height:4px; background:linear-gradient(90deg,#6c63ff,#00d4ff); border-radius:2px; }
  .text-headline { font-weight:900; color:#fff; line-height:1.1; letter-spacing:-0.03em; }
  .text-sub { font-size:21px; font-weight:600; color:#6c63ff; line-height:1.4; }
  .bullets { list-style:none; display:flex; flex-direction:column; gap:17px; }
  .bullets li { display:flex; align-items:flex-start; gap:16px;
    font-size:23px; color:rgba(255,255,255,0.82); line-height:1.45; }
  .bullets li::before { content:''; display:block; min-width:10px; height:10px; border-radius:50%;
    background:#6c63ff; box-shadow:0 0 10px rgba(108,99,255,0.7); margin-top:8px; }
  .body-text { font-size:24px; color:rgba(255,255,255,0.75); line-height:1.65; }

  .stat-number { font-size:150px; font-weight:900; line-height:1;
    background:linear-gradient(135deg,#6c63ff,#00d4ff);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    letter-spacing:-0.05em; }
  .stat-label { font-size:34px; font-weight:700; color:#fff; line-height:1.3; }
  .stat-body { font-size:20px; color:rgba(255,255,255,0.45); max-width:700px; line-height:1.6; }
</style></head><body>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>
  <div class="grid"></div>
  <div class="topbar"></div>
  <div class="bottombar"></div>
  <div class="header">
    ${logoHtml}
    <div class="counter">${esc(counter)}</div>
  </div>
  <div class="content-area">
    ${innerHtml}
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

  /* Top gradient to darken area behind badge */
  .overlay-top {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 130px;
    background: linear-gradient(to bottom, rgba(7,8,15,0.55) 0%, rgba(7,8,15,0) 100%);
  }

  /* Bottom brand bar — covers competitor watermarks/handles */
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

  /* Top-right slide counter badge */
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Image renderer running on port ${PORT}`));
