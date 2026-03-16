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
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
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
</style>
</head>
<body>
  <img class="bg" src="${safe(bg)}" crossorigin="anonymous">
  <div class="overlay"></div>
  <div class="handle">@BACKPAINLIFE</div>
  <div class="inset-wrap">
    <img class="inset" src="${safe(inset)}" crossorigin="anonymous">
  </div>
  <div class="headline">${safe(headline)}</div>
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
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
    await page.setContent(buildCarouselHtml(image_url, headline, template, slide_number, subtext), {
      waitUntil: 'networkidle0',
      timeout: 20000,
    });
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
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
  html, body { width: 1080px; height: 1080px; overflow: hidden; background: #000; }

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

  // template === 'slide' — clean split: light top / solid black bottom
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${fonts}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1080px; overflow: hidden; background: #f5f2ee; display: flex; flex-direction: column; }

  /* TOP: image on light background */
  .photo-section {
    flex: 0 0 460px;
    background: #f5f2ee;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
  }

  .photo-section img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
  }

  /* Slide number badge */
  .slide-badge {
    position: absolute;
    top: 18px;
    left: 22px;
    background: rgba(0,0,0,0.65);
    color: #4BB8D0;
    font-family: 'Bebas Neue', 'Oswald', sans-serif;
    font-size: 36px;
    letter-spacing: 2px;
    padding: 4px 14px 2px 14px;
    border-radius: 4px;
  }

  /* DIVIDER */
  .divider {
    flex: 0 0 28px;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
  }

  .divider-line {
    flex: 1;
    height: 2px;
    background: #4BB8D0;
    opacity: 0.7;
  }

  .divider-icon {
    width: 28px;
    height: 28px;
    margin: 0 10px;
    color: #4BB8D0;
    font-size: 22px;
    line-height: 28px;
    text-align: center;
  }

  /* BOTTOM: black content area */
  .content {
    flex: 1;
    background: #000;
    padding: 28px 44px 32px 44px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .headline {
    color: #fff;
    font-family: 'Bebas Neue', 'Oswald', Impact, sans-serif;
    font-size: 80px;
    font-weight: 400;
    text-transform: uppercase;
    line-height: 0.97;
    letter-spacing: 1.5px;
    word-break: break-word;
    margin-bottom: 22px;
  }

  .headline .kw { color: #4BB8D0; }

  .subtext {
    color: rgba(255,255,255,0.8);
    font-family: 'Oswald', Arial, sans-serif;
    font-size: 30px;
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
  <div class="photo-section">
    <img src="${safe(imageUrl)}" crossorigin="anonymous">
    <div class="slide-badge">${numStr}</div>
  </div>
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-icon">◆</div>
    <div class="divider-line"></div>
  </div>
  <div class="content">
    <div class="headline">${parseHeadline(headline)}</div>
    <div class="subtext">${parseSubtext(subtext)}</div>
  </div>
</body>
</html>`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Image renderer running on port ${PORT}`));
