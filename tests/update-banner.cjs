const assert = require('node:assert/strict');
const { chromium } = require('playwright');

// The update banner stays hidden for the current version, appears when a newer version is
// published, and loads the new version under a new address when tapped.
(async () => {
    const browser = await chromium.launch();
    try {
        const base = process.env.NAMOU_TEST_URL || 'http://127.0.0.1:8765/';
        const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
        await page.goto(base);
        await page.waitForFunction(() => document.querySelector('.dict-item'));
        await page.waitForTimeout(500);
        assert.equal(await page.locator('#updateBanner').isHidden(), true, 'Banner shown for the current version');

        await page.route(/index\.html\?check=/, async route => {
            const response = await route.fetch();
            const body = (await response.text()).replace(/class="dict-version">v[\d.]+</, 'class="dict-version">v9.9.9<');
            await route.fulfill({ response, body });
        });
        await page.reload();
        const banner = page.locator('#updateBanner');
        await banner.waitFor({ state: 'visible', timeout: 5000 });
        assert.equal((await banner.innerText()).trim(), '有新版本 v9.9.9，点此更新');
        await banner.click();
        await page.waitForURL(/\?v=v9\.9\.9$/);
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        console.log('Verified the update banner and one-tap update.');
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
