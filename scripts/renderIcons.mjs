/**
 * Renders QuizPulse brand icons from public/brand/quizpulse-mark.svg.
 * Uses already-installed @playwright/test Chromium — no new dependencies.
 * Run: node scripts/renderIcons.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const markSvg = fs.readFileSync(path.join(root, 'public/brand/quizpulse-mark.svg'), 'utf8');

// maskable: mark inside central 80% safe zone on #f3f2f2 background
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
  <rect width="100" height="100" fill="#f3f2f2"/>
  <svg x="10" y="10" width="80" height="80" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#201e1d"/>
    <circle cx="48" cy="44" r="24" fill="none" stroke="white" stroke-width="8"/>
    <line x1="60" y1="58" x2="76" y2="78" stroke="#ca2910" stroke-width="8" stroke-linecap="square"/>
  </svg>
</svg>`;

// badge: white Q ring + tail on transparent (for Android notification badge)
const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="72" height="72">
  <circle cx="48" cy="44" r="24" fill="none" stroke="white" stroke-width="8"/>
  <line x1="60" y1="58" x2="76" y2="78" stroke="white" stroke-width="8" stroke-linecap="square"/>
</svg>`;

async function renderSvgToPng(browser, svgContent, size, outputPath) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const encoded = encodeURIComponent(svgContent);
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><style>body{margin:0;padding:0;background:transparent;}</style></head>
    <body>
      <img src="data:image/svg+xml;charset=utf-8,${encoded}" width="${size}" height="${size}"/>
    </body>
    </html>
  `);
  await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
  await page.close();
  console.log(`  wrote ${path.relative(root, outputPath)} (${size}x${size})`);
}

const browser = await chromium.launch();

const anySvg = markSvg.replace(/width="100"/, 'width="512"').replace(/height="100"/, 'height="512"');

await renderSvgToPng(browser, anySvg, 192, path.join(root, 'public/icon-192.png'));
await renderSvgToPng(browser, anySvg, 512, path.join(root, 'public/icon-512.png'));
await renderSvgToPng(browser, maskableSvg, 512, path.join(root, 'public/icon-maskable-512.png'));
await renderSvgToPng(browser, badgeSvg, 72, path.join(root, 'public/badge-72.png'));

await browser.close();
console.log('Icons generated.');
