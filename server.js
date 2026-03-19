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
      // Video slides: pass through original URL without rendering
      if (slide.is_video) {
        results.push({
          image_url: slide.slide_image_url,
          is_video: true,
          slide_number: slide.slide_number,
          original_caption: slide.original_caption || '',
          post_id: slide.post_id || '',
          source_account: slide.source_account || '',
        });
        continue;
      }

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

      // 3. Build AIMABOOSTING branded slide — URL passed directly so Puppeteer's browser
      //    loads it (avoids server-side Instagram CDN blocks). Base64 is only for GPT Vision.
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
      await page.setExtraHTTPHeaders({
        'Referer': 'https://www.instagram.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      await page.setContent(buildSlideFromContent({
        ...extracted,
        slide_number: slide.slide_number || 1,
        total_slides: slide.total_slides || 1,
        imageUrl: slide.slide_image_url || null,
        has_image: extracted.has_image || false,
      }), { waitUntil: 'networkidle2', timeout: 15000 });
      const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: false });
      await page.close();

      // 4. Upload
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
- headline: main title or heading (string or null)
- subheadline: secondary heading (string or null)
- body: the COMPLETE body text, WORD FOR WORD — do NOT summarize, truncate, or shorten. Copy every word exactly. (string or null)
- bullets: array of bullet/list items if present, each item COMPLETE (array or null)
- stat_number: prominent number or percentage (string or null)
- stat_label: label for the stat (string or null)

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

// buildSlideFromContent: creates AIMABOOSTING branded slides.
// Layout strategy (driven by slide_type + has_image):
//   cover  + has_image → image fills slide (15px blur, 70% opacity), dark gradient at bottom for text
//   cover  + no image  → dark bg, text centered
//   content/text + has_image → SPLIT: dark top (text) + blurred image bottom
//   content/text + no image  → pure dark bg with text (no image section)
function buildSlideFromContent(data) {
  const {
    slide_type = 'text',
    has_image = false,
    headline, subheadline, body, bullets,
    stat_number, stat_label,
    slide_number = 1, total_slides = 1,
    imageUrl = null,
  } = data;

  const esc = (s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const counter = `${slide_number}/${total_slides}`;
  const hasBullets = Array.isArray(bullets) && bullets.length > 0;
  const hasStatNumber = stat_number && String(stat_number).trim();
  const hlText = headline || '';
  const hlSize = hlText.length > 80 ? 34 : hlText.length > 60 ? 40 : hlText.length > 40 ? 48 : hlText.length > 20 ? 56 : 64;

  const imgBgStyle = imageUrl ? `background-image:url('${imageUrl}');` : '';
  const showSplit = (has_image || false) && !!imageUrl;

  // ── Shared CSS ─────────────────────────────────────────────────────────────
  const baseCSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width:1080px; height:1080px; overflow:hidden; background:#07080f;
    font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif; color:#fff;
  }
  /* Cover: image fills slide, less blur so it's visible as actual content */
  .photo-cover {
    position:absolute; inset:0;
    ${imgBgStyle}
    background-size:cover; background-position:center;
    filter:blur(14px) saturate(1.2);
    transform:scale(1.06);
  }
  /* Cover gradient: dark header strip at top + dark text bar at bottom */
  .cover-gradient {
    position:absolute; inset:0;
    background:linear-gradient(180deg,
      rgba(7,8,15,0.72) 0%,
      rgba(7,8,15,0.30) 20%,
      rgba(7,8,15,0.10) 42%,
      rgba(7,8,15,0.55) 62%,
      rgba(7,8,15,0.92) 78%,
      rgba(7,8,15,0.97) 100%
    );
  }
  /* Split layout: image fills canvas, gradient reveals it only in the bottom 55% */
  .photo-split {
    position:absolute; inset:0;
    ${imgBgStyle}
    background-size:cover; background-position:center top;
    filter:blur(16px) saturate(1.2);
    transform:scale(1.07);
  }
  .split-gradient {
    position:absolute; inset:0;
    background:linear-gradient(180deg,
      rgba(7,8,15,1.00)  0%,
      rgba(7,8,15,1.00) 40%,
      rgba(7,8,15,0.80) 54%,
      rgba(7,8,15,0.38) 72%,
      rgba(7,8,15,0.18) 100%
    );
  }
  /* Plain dark bg (no image) */
  .dark-bg { position:absolute; inset:0; background:#07080f; }
  .dark-overlay { position:absolute; inset:0; background:linear-gradient(150deg, rgba(14,15,28,0.85) 0%, rgba(7,8,15,0.90) 100%); }
  .grid {
    position:absolute; inset:0;
    background-image:
      linear-gradient(rgba(108,99,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(108,99,255,0.05) 1px, transparent 1px);
    background-size:60px 60px;
  }
  .glow { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; }
  .glow-1 { width:500px; height:500px; background:rgba(108,99,255,0.18); top:-100px; right:-80px; }
  .glow-2 { width:380px; height:380px; background:rgba(0,212,255,0.07); bottom:50px; left:-60px; }
  .topbar { position:absolute; top:0; left:0; right:0; height:5px; background:linear-gradient(90deg,#6c63ff,#00d4ff,#6c63ff); }
  .bottombar { position:absolute; bottom:0; left:0; right:0; height:5px; background:linear-gradient(90deg,#6c63ff,#00d4ff); }
  .header { position:absolute; top:24px; left:44px; right:44px; display:flex; align-items:center; justify-content:space-between; z-index:10; }
  .logo { font-size:24px; font-weight:900; letter-spacing:-0.04em; line-height:1; }
  .logo .aima { color:#fff; }
  .logo .boost { color:#6c63ff; }
  .counter { font-size:14px; font-weight:700; color:rgba(255,255,255,0.35); letter-spacing:0.08em; }
  .accent { width:50px; height:4px; background:linear-gradient(90deg,#6c63ff,#00d4ff); border-radius:2px; flex-shrink:0; }
  .hl { font-weight:900; color:#fff; line-height:1.1; letter-spacing:-0.03em; }
  .sub { font-size:21px; font-weight:600; color:#6c63ff; line-height:1.4; }
  .body-text { font-size:21px; color:rgba(255,255,255,0.75); line-height:1.70; }
  .bullets { list-style:none; display:flex; flex-direction:column; gap:14px; }
  .bullets li { display:flex; align-items:flex-start; gap:14px; font-size:21px; color:rgba(255,255,255,0.85); line-height:1.45; }
  .bullets li::before { content:''; display:block; min-width:10px; height:10px; border-radius:50%; background:#6c63ff; box-shadow:0 0 8px rgba(108,99,255,0.7); margin-top:7px; flex-shrink:0; }
  .stat-num { font-size:148px; font-weight:900; line-height:1; background:linear-gradient(135deg,#6c63ff,#00d4ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:-0.05em; }
  .stat-lbl { font-size:32px; font-weight:700; color:#fff; line-height:1.3; }
  .stat-body { font-size:20px; color:rgba(255,255,255,0.45); line-height:1.6; }`;

  const header = `<div class="header"><div class="logo"><span class="aima">AIMA</span><span class="boost">BOOSTING</span></div><div class="counter">${esc(counter)}</div></div>`;
  const decorNoGlow = `<div class="grid"></div><div class="topbar"></div><div class="bottombar"></div>${header}`;
  const decorFull = `<div class="grid"></div><div class="glow glow-1"></div><div class="glow glow-2"></div><div class="topbar"></div><div class="bottombar"></div>${header}`;

  // ── COVER with image: image fills slide, text bar at bottom ───────────────
  // Mimics airesearches cover: big image visible, dark gradient at bottom for text
  if (slide_type === 'cover' && imageUrl) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${baseCSS}
  .cover-text {
    position:absolute; bottom:0; left:0; right:0; padding:32px 52px 52px;
    display:flex; flex-direction:column; gap:14px; z-index:5;
  }
  .cover-pill { display:inline-flex; align-self:flex-start; background:rgba(108,99,255,0.80); border-radius:40px; padding:7px 18px; font-size:12px; font-weight:700; color:#fff; letter-spacing:0.10em; text-transform:uppercase; }
  .cover-hl { font-size:${hlSize}px; text-shadow:0 2px 12px rgba(0,0,0,0.8); }
  .swipe { font-size:13px; font-weight:700; color:rgba(255,255,255,0.55); letter-spacing:0.12em; text-transform:uppercase; }
</style></head><body>
  <div class="photo-cover"></div>
  <div class="cover-gradient"></div>
  ${decorNoGlow}
  <div class="cover-text">
    <div class="cover-pill">@aimaboosting</div>
    <div class="accent"></div>
    ${headline ? `<h1 class="hl cover-hl">${esc(headline)}</h1>` : ''}
    ${subheadline ? `<p class="sub">${esc(subheadline)}</p>` : ''}
    ${body ? `<p class="body-text" style="font-size:19px">${esc(body)}</p>` : ''}
    <div class="swipe">Desliza →</div>
  </div>
</body></html>`;
  }

  // ── COVER without image: dark bg, text centered ───────────────────────────
  if (slide_type === 'cover') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${baseCSS}
  .cover-area { position:absolute; top:90px; left:56px; right:56px; bottom:44px; display:flex; flex-direction:column; justify-content:center; gap:24px; }
  .cover-pill { display:inline-flex; align-self:flex-start; background:rgba(108,99,255,0.18); border:1px solid rgba(108,99,255,0.5); border-radius:50px; padding:9px 22px; font-size:13px; font-weight:700; color:#6c63ff; letter-spacing:0.12em; text-transform:uppercase; }
  .cover-hl { font-size:${hlSize}px; }
  .swipe { font-size:13px; font-weight:700; color:rgba(108,99,255,0.55); letter-spacing:0.14em; text-transform:uppercase; }
</style></head><body>
  <div class="dark-bg"></div><div class="dark-overlay"></div>
  ${decorFull}
  <div class="cover-area">
    <div class="cover-pill">@aimaboosting</div>
    <div class="accent"></div>
    ${headline ? `<h1 class="hl cover-hl">${esc(headline)}</h1>` : ''}
    ${subheadline ? `<p class="sub">${esc(subheadline)}</p>` : ''}
    ${body ? `<p class="body-text">${esc(body)}</p>` : ''}
    <div class="swipe">Desliza →</div>
  </div>
</body></html>`;
  }

  // ── CONTENT / TEXT with image: split layout ────────────────────────────────
  if ((slide_type === 'content' || slide_type === 'text') && showSplit) {
    const bulletsHtml = hasBullets
      ? `<ul class="bullets">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '';
    const bodyHtml = body && !hasBullets ? `<p class="body-text">${esc(body)}</p>` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${baseCSS}
  .content-area {
    position:absolute; top:78px; left:52px; right:52px; height:430px;
    display:flex; flex-direction:column; justify-content:flex-end; gap:16px;
    padding-bottom:24px;
  }
  .content-hl { font-size:${hlSize}px; }
</style></head><body>
  <div class="photo-split"></div><div class="split-gradient"></div>
  ${decorNoGlow}
  <div class="content-area">
    <div class="accent"></div>
    ${headline ? `<h2 class="hl content-hl">${esc(headline)}</h2>` : ''}
    ${subheadline ? `<p class="sub">${esc(subheadline)}</p>` : ''}
    ${bulletsHtml}${bodyHtml}
  </div>
</body></html>`;
  }

  // ── CONTENT / TEXT / STAT without image: clean dark layout ────────────────
  let innerHtml = '';
  if (hasStatNumber) {
    innerHtml = `
      <div class="stat-num">${esc(stat_number)}</div>
      ${stat_label ? `<div class="stat-lbl">${esc(stat_label)}</div>` : ''}
      ${body ? `<p class="stat-body">${esc(body)}</p>` : ''}`;
  } else {
    const bulletsHtml = hasBullets
      ? `<ul class="bullets">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '';
    innerHtml = `
      <div class="accent"></div>
      ${headline ? `<h2 class="hl" style="font-size:${hlSize}px">${esc(headline)}</h2>` : ''}
      ${subheadline ? `<p class="sub">${esc(subheadline)}</p>` : ''}
      ${bulletsHtml}
      ${body && !hasBullets ? `<p class="body-text">${esc(body)}</p>` : ''}`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  ${baseCSS}
  .text-area {
    position:absolute; top:90px; left:56px; right:56px; bottom:44px;
    display:flex; flex-direction:column; justify-content:center; gap:22px;
  }
</style></head><body>
  <div class="dark-bg"></div><div class="dark-overlay"></div>
  ${decorFull}
  <div class="text-area">
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Image renderer running on port ${PORT}`));
