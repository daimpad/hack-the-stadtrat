// Browser-Smoke-Test für die Veranstaltungsseite: Konsolenfehler, Layout, Bedienelemente.
// Aufruf: node tests/smoke.cjs  (benötigt das npm-Paket "playwright" mit Chromium)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const pageUrl = 'file://' + path.join(root, '002-neon-rain.html');
const indexUrl = 'file://' + path.join(root, 'index.html');
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const configs = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: 'mobil', viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  { name: 'reduziert', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' },
];

(async () => {
  const browser = await chromium.launch();
  for (const cfg of configs) {
    const { name, ...opts } = cfg;
    const context = await browser.newContext({ ...opts, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(pageUrl);
    await page.waitForTimeout(1500);

    const info = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      h1: document.querySelector('h1') && document.querySelector('h1').textContent.trim(),
      ld: (() => { try { return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@type']; } catch (e) { return 'FEHLER'; } })(),
      count: document.getElementById('hud-count').textContent,
    }));
    check(info.sw <= info.cw, `${name}: horizontales Scrollen (${info.sw} > ${info.cw})`);
    check(info.h1 === 'Hack den Stadtrat', `${name}: Überschrift fehlt oder falsch (${info.h1})`);
    check(info.ld === 'Event', `${name}: JSON-LD nicht lesbar`);
    check(info.count && info.count !== '–', `${name}: Countdown nicht gesetzt`);

    // Blitz per Klick in den Himmel, Ein- und Ausklappen der Infos
    await page.mouse.click(cfg.viewport.width * 0.92, cfg.viewport.height * 0.2);
    await page.click('#btn-peek');
    check(await page.isHidden('#hero-details'), `${name}: Infos lassen sich nicht einklappen`);
    await page.click('#btn-peek');
    check(await page.isVisible('#hero-details'), `${name}: Infos lassen sich nicht wieder einblenden`);

    // Kalenderdatei
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('.hero-panel .js-ics')]);
    const ics = fs.readFileSync(await download.path(), 'utf8');
    check(/BEGIN:VEVENT/.test(ics) && /DTSTART:20261017T090000Z/.test(ics), `${name}: Kalenderdatei unvollständig`);
    check(ics.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75), `${name}: Kalenderzeilen länger als 75 Byte`);

    // CTA am Seitenende: Kalenderdatei, kein Fiktionshinweis im Footer
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#cta-ics')]);
    check(/DTSTART:20261017T090000Z/.test(fs.readFileSync(await dl2.path(), 'utf8')), `${name}: CTA liefert keine Kalenderdatei`);
    check(!(await page.textContent('footer')).includes('fiktive'), `${name}: Footer enthält noch den Fiktionshinweis`);

    // Abschnitte
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('ablauf').scrollIntoView(); });
    await page.waitForTimeout(900);
    check(await page.evaluate(() => getComputedStyle(document.getElementById('ablauf')).opacity === '1'), `${name}: Abschnitt Ablauf wird nicht eingeblendet`);

    check(errors.length === 0, `${name}: Fehler in der Konsole: ${errors.join(' | ')}`);
    await context.close();
  }
  // Startseite leitet weiter
  const p = await browser.newPage();
  await p.goto(indexUrl);
  await p.waitForURL(/002-neon-rain\.html$/, { timeout: 5000 }).catch(() => {});
  check(/002-neon-rain\.html$/.test(p.url()), 'index.html leitet nicht weiter');
  await browser.close();

  if (failures.length) { console.error('Fehlgeschlagen:\n- ' + failures.join('\n- ')); process.exit(1); }
  console.log('Alle Prüfungen bestanden (' + configs.length + ' Ansichten, Weiterleitung).');
})().catch((e) => { console.error(e); process.exit(1); });
