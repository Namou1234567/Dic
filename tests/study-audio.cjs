const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function check() {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.goto(process.env.NAMOU_TEST_URL || 'http://127.0.0.1:8765');
        await page.getByRole('button', { name: /背诵/ }).click();
        const card = page.locator('#mainCard');
        const lao = page.locator('#cardLaoSpeak');
        const zh = page.locator('#cardSpeak');
        const audio = page.locator('#recordedSpeechAudio');
        await page.emulateMedia({ reducedMotion: 'reduce' });

        assert.equal(await card.locator('.card-back').getAttribute('inert'), '');
        await lao.click();
        assert.match(await audio.getAttribute('src'), /^audio\/lao\/chanthavong-/);
        await page.getByText('点击卡片翻看答案', { exact: true }).click();
        assert.equal(await card.locator('.card-front').getAttribute('inert'), '');
        assert.equal(await audio.count(), 0, 'Flipping should stop the previous clip');
        await zh.click();
        assert.match(await audio.getAttribute('src'), /^audio\/mandarin-/);
        console.log('Verified that the Lao and Mandarin buttons play separate audio on opposite card faces.');
    } finally {
        await browser.close();
    }
}

check().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
