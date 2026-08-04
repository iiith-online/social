// UI verification for the IIIT social app (workflow per .agents/AGENTS.md).
// Usage: node scripts/verify-ui.mjs [app-url]
// Reads CAS credentials from .env. Requires a local playwright install
// (PLAYWRIGHT_DIR env or the default bunx cache path).
import { createRequire } from 'module';
import fs from 'fs';

const PLAYWRIGHT_DIR =
  process.env.PLAYWRIGHT_DIR ??
  'C:/Users/Ayush Maurya/AppData/Local/Temp/bunx-2897388273-playwright@latest';
const require = createRequire(PLAYWRIGHT_DIR + '/package.json');
const { chromium } = require('playwright');

const APP = process.argv[2] ?? 'http://localhost:5173/';
const PROFILE = 'C:/Users/Ayush Maurya/masti/iiith.online/matrix/.verify-profile';
const OUT = 'C:/Users/Ayush Maurya/masti/iiith.online/matrix/.verify-log.txt';
const log = (m) => {
  fs.appendFileSync(OUT, m + '\n');
  console.log(m);
};

const env = fs.readFileSync('C:/Users/Ayush Maurya/masti/iiith.online/matrix/.env', 'utf8');
const CAS_EMAIL = env.match(/CAS_EMAIL=(.*)/)?.[1]?.trim();
const CAS_PASSWORD = env.match(/CAS_PASSWORD=(.*)/)?.[1]?.trim();
const HOMESERVER = new URL(APP).hostname === 'localhost' ? 'matrix.iiit.ac.in' : 'matrix.iiit.ac.in';

const browser = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  viewport: { width: 1440, height: 900 },
  // matrix.iiit.ac.in resolves to a private IP on the campus network; Chrome
  // blocks public->private fetches unless the PNA checks are disabled.
  args: [
    '--disable-web-security',
    '--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessDeny',
  ],
});
const page = browser.pages()[0] ?? (await browser.newPage());
const reqs = [];
page.on('request', (r) => {
  if (r.url().includes(HOMESERVER)) {
    reqs.push({ m: r.method(), u: r.url().replace('https://' + HOMESERVER, '').split('?')[0].slice(0, 100) });
  }
});

log(`APP: ${APP}`);
await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
if (await page.locator('text=Continue with CAS').count()) {
  log('logging in via CAS');
  await page.locator('text=Continue with CAS').first().click();
  await page.waitForTimeout(5000);
  await page.fill('#username', CAS_EMAIL);
  await page.fill('#password', CAS_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(10000);
  const allowBtn = page.locator('text=Allow').first();
  if (await allowBtn.count()) {
    await allowBtn.click();
    await page.waitForTimeout(8000);
  }
}
await page.waitForTimeout(15000);

const body = await page.evaluate(() => document.body.innerText.slice(0, 5000));
log(`BODY:\n${body}`);

const uniq = {};
reqs.forEach((r) => {
  const k = r.u;
  uniq[k] = uniq[k] ?? { m: r.m, u: k, count: 0 };
  uniq[k].count++;
});
log('REQS:');
log(Object.values(uniq).map((x) => `${x.m} x${x.count} ${x.u}`).join('\n'));
await browser.close();
log('DONE');
