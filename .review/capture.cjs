const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const base = 'https://reduction77.github.io/wuwa-ght/';
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'desktop-home.png', fullPage: true });

  // 尝试进入托管进度页（点击首页 CTA）
  const cta = page.locator('text=查看我的托管进度').first();
  if (await cta.count()) {
    await cta.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'desktop-portal.png', fullPage: true });
    console.log('portal url:', page.url());
  }
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
