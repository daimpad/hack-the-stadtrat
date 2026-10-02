// Erzeugt das DIN-A3-Plakat aus der Veranstaltungsseite.
// 1. rendert die Straßenszene der Seite im Hochformat mit 300 dpi (artwork.jpg)
// 2. setzt Titel und Datum mit den Neon-Glyphen der Seite als Vektorgrafik
// 3. schreibt plakat.html und daraus zwei PDFs (A3 exakt, A3 mit 3 mm Beschnitt) und eine Vorschau
// Aufruf: node plakat/build.cjs   (benötigt die npm-Pakete "playwright" und "qrcode")
const { chromium } = require('playwright');
const QRCode = require('qrcode');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = __dirname;
const pageFile = path.join(dir, '..', '002-neon-rain.html');
const URL_PAGE = 'https://code.paderta.com/hack-den-stadtrat/';
const source = fs.readFileSync(pageFile, 'utf8');

// Glyphen direkt aus der Seite übernehmen (eine Quelle für Schilder und Plakat)
const gsrc = Function('return ' + source.match(/var GSRC=(\{[\s\S]*?\n\});/)[1])();
function parse(str) { return str ? str.split('|').map((s) => s.split(' ').map((q) => q.split(',').map(Number))) : []; }
const GLY = {};
for (const k of Object.keys(gsrc)) GLY[k] = { w: gsrc[k][0], s: parse(gsrc[k][1]).concat(parse(gsrc[k][2])) };

// Text als Neonröhre: Pfad in Glyphen-Einheiten (Versalhöhe 8)
function neon(text, color, core, heightMm, id) {
  let x = 0, d = '';
  for (const ch of text) {
    const g = GLY[ch] || GLY[' '];
    for (const seg of g.s) {
      seg.forEach((p, i) => { d += (i ? 'L' : 'M') + (x + p[0]).toFixed(2) + ' ' + p[1].toFixed(2); });
      if (seg.length === 1) d += 'l0.01 0';
    }
    x += g.w + 2.3;
  }
  const w = x - 2.3, pad = 4, vbW = w + pad * 2, vbH = 8 + pad * 2;
  const widthMm = heightMm * vbW / vbH;
  return `<svg class="neon" style="width:${widthMm.toFixed(1)}mm;height:${heightMm.toFixed(1)}mm" viewBox="${-pad} ${-pad} ${vbW} ${vbH}" aria-label="${text}" role="img">
  <defs><filter id="${id}a" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="1.1"/></filter>
  <filter id="${id}b" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="0.35"/></filter></defs>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${d}" stroke="${color}" stroke-width="2.4" opacity="0.55" filter="url(#${id}a)"/>
    <path d="${d}" stroke="${color}" stroke-width="1.15" opacity="0.95" filter="url(#${id}b)"/>
    <path d="${d}" stroke="${core}" stroke-width="0.5"/>
  </g></svg>`;
}

async function renderArtwork(browser) {
  // Seite für den Druck vorbereiten: höhere Pixeldichte, Bedienelemente aus, Katze von vorn
  let h = source
    .replace('dpr=Math.min(2,window.devicePixelRatio||1);\n  if(W===S.W', 'dpr=Math.min(5,window.devicePixelRatio||1);\n  if(W===S.W')
    .replace('/* ---------- Start ---------- */', 'window.__P={S:S,CAT:CAT};\n/* ---------- Start ---------- */')
    .replace('</style>', '.hud,.hero-main,.ticker,main,footer,.skip{display:none!important}.fx{background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(3,0,10,.5) 100%)!important}</style>');
  const tmp = path.join(os.tmpdir(), 'plakat-artwork.html');
  fs.writeFileSync(tmp, h);
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 3508 / 794 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + tmp);
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const P = window.__P, T = Math.PI * 2;
    P.CAT.yaw = Math.ceil(P.CAT.yaw / T) * T - 0.04;
    P.S.lastInput = P.S.t; P.S.ptr = [P.CAT.sx, P.CAT.sy + P.CAT.R * 0.3];
  });
  await page.waitForTimeout(200);
  await page.locator('#hero').screenshot({ path: path.join(dir, 'artwork.jpg'), type: 'jpeg', quality: 90 });
  await page.close();
  if (errors.length) throw new Error('Fehler beim Rendern: ' + errors.join(' | '));
}

function posterHtml(qrSvg) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Hack den Stadtrat – Plakat A3</title>
<style>
  :root{--bleed:0mm;--mag:#ff2a6d;--cyan:#05d9e8;--acid:#f9f002;--ink:#05010f}
  @page{size:calc(297mm + 2*var(--bleed)) calc(420mm + 2*var(--bleed));margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--ink)}
  .sheet{position:relative;width:calc(297mm + 2*var(--bleed));height:calc(420mm + 2*var(--bleed));overflow:hidden;
    background:var(--ink) url("artwork.jpg") center/cover no-repeat;color:#fff;
    font-family:"Bahnschrift SemiCondensed","Avenir Next Condensed","Roboto Condensed","sans-serif-condensed","Arial Narrow","Liberation Sans Narrow","DejaVu Sans Condensed","DejaVu Sans",Arial,sans-serif}
  .sheet::before{content:"";position:absolute;inset:0;background:
    linear-gradient(180deg,rgba(5,1,15,.55) 0%,rgba(5,1,15,0) 30%,rgba(5,1,15,0) 62%,rgba(5,1,15,.7) 78%,rgba(5,1,15,.92) 100%)}
  .safe{position:absolute;left:var(--bleed);top:var(--bleed);width:297mm;height:420mm}
  .title{position:absolute;left:11mm;top:12mm;margin:0;display:grid;gap:0;row-gap:0}
  .title .neon+.neon{margin-top:-9mm}
  .title .neon{display:block;filter:drop-shadow(0 0 2.5mm rgba(255,42,109,.35))}
  .sub{position:absolute;left:19mm;top:106mm;margin:0;font-weight:700;font-size:24pt;line-height:1.22;letter-spacing:.01em;
    text-shadow:0 0 3mm rgba(5,1,15,.95),0 0 1mm rgba(5,1,15,.9);max-width:170mm}
  .info{position:absolute;left:14mm;right:14mm;bottom:22mm;display:grid;grid-template-columns:1fr 60mm;gap:8mm;align-items:end;
    padding:9mm 10mm 9mm 10mm;background:rgba(5,1,15,.72);
    --c:var(--cyan);--l:7mm;--t:.7mm;
    background-image:
      linear-gradient(var(--c),var(--c)),linear-gradient(var(--c),var(--c)),linear-gradient(var(--c),var(--c)),linear-gradient(var(--c),var(--c)),
      linear-gradient(var(--c),var(--c)),linear-gradient(var(--c),var(--c)),linear-gradient(var(--c),var(--c)),linear-gradient(var(--c),var(--c));
    background-size:var(--l) var(--t),var(--t) var(--l),var(--l) var(--t),var(--t) var(--l),var(--l) var(--t),var(--t) var(--l),var(--l) var(--t),var(--t) var(--l);
    background-position:top left,top left,top right,top right,bottom left,bottom left,bottom right,bottom right;background-repeat:no-repeat}
  .date{display:block;margin:0 0 4mm -2mm}
  .when{margin:0 0 3mm;font-size:22pt;font-weight:700}
  .where{margin:0 0 3mm;font-size:16pt;line-height:1.3}
  .free{margin:0;font-size:13pt;color:var(--cyan);font-weight:700;letter-spacing:.02em}
  .qr{display:grid;justify-items:center;gap:2.5mm;text-align:center}
  .qr .code{width:44mm;height:44mm;padding:2.5mm;background:#fff;box-shadow:0 0 0 .7mm var(--mag),0 0 6mm rgba(255,42,109,.6)}
  .qr .code svg{display:block;width:100%;height:100%}
  .qr .l1{font-size:12pt;font-weight:700;margin:0}
  .qr .l2{font-family:"DejaVu Sans Mono",monospace;font-size:7pt;color:#d8d2ea;margin:0;white-space:nowrap}
  .fine{position:absolute;left:14mm;right:14mm;bottom:9mm;margin:0;font-size:7pt;line-height:1.35;color:#c9c2de}
</style>
</head>
<body>
<div class="sheet">
  <div class="safe">
    <h1 class="title">${neon('HACK DEN', '#ff2a6d', '#ffe0ea', 46, 'h1')}${neon('STADTRAT', '#05d9e8', '#e6fdff', 46, 'h2')}</h1>
    <p class="sub">Mitmach-Tag zu offenen<br>Ratsdaten und KI</p>
    <section class="info" aria-label="Veranstaltungsangaben">
      <div>
        <span class="date">${neon('SA 17.10.2026', '#f9f002', '#fffbd0', 17, 'd1')}</span>
        <p class="when">ab 11 Uhr · Ende offen</p>
        <p class="where">bitcircus101<br>Dorotheenstraße 101 · 53113 Bonn</p>
        <p class="free">Kostenlos · ohne Anmeldung · kein Programmierwissen nötig</p>
      </div>
      <div class="qr">
        <div class="code">${qrSvg}</div>
        <p class="l1">Ablauf &amp; Challenges</p>
        <p class="l2">code.paderta.com/hack-den-stadtrat</p>
      </div>
    </section>
    <p class="fine">Veranstalter: machdenstaat.de · Gefördert durch das Land Nordrhein-Westfalen im Programm „2.000 x 1.000 Euro für das Engagement“</p>
  </div>
</div>
</body>
</html>`;
}

(async () => {
  const browser = await chromium.launch();
  if (!process.argv.includes('--ohne-artwork')) await renderArtwork(browser);
  const qrSvg = await QRCode.toString(URL_PAGE, { type: 'svg', errorCorrectionLevel: 'Q', margin: 0, color: { dark: '#05010f', light: '#ffffff' } });
  const html = posterHtml(qrSvg);
  fs.writeFileSync(path.join(dir, 'plakat.html'), html);

  const page = await browser.newPage({ viewport: { width: 1123, height: 1588 } });
  await page.goto('file://' + path.join(dir, 'plakat.html'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'vorschau.jpg'), type: 'jpeg', quality: 85 });
  await page.pdf({ path: path.join(dir, 'hack-den-stadtrat-a3.pdf'), width: '297mm', height: '420mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.addStyleTag({ content: ':root{--bleed:3mm}' });
  await page.pdf({ path: path.join(dir, 'hack-den-stadtrat-a3-beschnitt.pdf'), width: '303mm', height: '426mm', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await browser.close();
  console.log('Plakat erzeugt: plakat.html, vorschau.jpg, hack-den-stadtrat-a3.pdf, hack-den-stadtrat-a3-beschnitt.pdf');
})().catch((e) => { console.error(e); process.exit(1); });
