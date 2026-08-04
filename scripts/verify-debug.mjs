import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire('C:/Users/Ayush Maurya/AppData/Local/Temp/bunx-2897388273-playwright@latest/package.json');
const { chromium } = require('playwright');

const OUT = 'C:/Users/Ayush Maurya/masti/iiith.online/matrix/.verify-log.txt';
const log = (m) => {
  fs.appendFileSync(OUT, m + '\n');
  console.log(m);
};

const browser = await chromium.launchPersistentContext(
  'C:/Users/Ayush Maurya/masti/iiith.online/matrix/.verify-profile',
  {
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-web-security', '--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessDeny'],
  }
);
const page = browser.pages()[0] ?? (await browser.newPage());
await page.goto('https://social.iiith.online/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

const result = await page.evaluate(async () => {
  const token = localStorage.getItem('matrix_iiit_access_token');
  const space = '!y0BHB4cmD2DaPooiNn:matrix.iiit.ac.in';
  const res = await fetch(
    `https://matrix.iiit.ac.in/_matrix/client/v1/rooms/${encodeURIComponent(space)}/hierarchy?suggested_only=false&limit=100`,
    { headers: { Authorization: 'Bearer ' + token } }
  );
  const j = await res.json();
  const sample = j.rooms.slice(0, 2);
  return {
    next_token: j.next_token ? 'present' : 'absent',
    roomKeys: Object.keys(sample[0]),
    rootChildren: sample[0].children_state?.map((c) => ({ key: c.state_key, type: c.type, content: c.content })) ?? [],
    messSpaceEntry: j.rooms.find((r) => r.name === 'Mess Space'),
  };
});
log(JSON.stringify(result, null, 1));
await browser.close();
log('DONE');
