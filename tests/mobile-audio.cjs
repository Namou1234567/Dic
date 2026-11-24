const assert = require('node:assert/strict');
const { chromium, devices, webkit } = require('playwright');

async function check(browserType, device) {
    const browser = await browserType.launch();
    try {
        const page = await browser.newPage(devices[device]);
        await page.addInitScript(() => {
            window.namouAudioStarts = [];
            const { start } = AudioBufferSourceNode.prototype;
            AudioBufferSourceNode.prototype.start = function (...args) {
                const result = start.apply(this, args);
                window.namouAudioStarts.push({
                    offset: args[1], duration: args[2], state: this.context.state
                });
                return result;
            };
        });
        await page.goto(process.env.NAMOU_TEST_URL || 'http://127.0.0.1:8765/');
        await page.getByRole('textbox', { name: /搜索/ }).fill('整流器');
        const row = page.locator('.dict-item').filter({ hasText: '整流器' });
        assert.equal(await row.count(), 1);
        for (const [name, key, manifest] of [
            ['朗读中文意思', '整流器', 'NAMOU_VOICE_CLIPS'],
            ['朗读老挝语', 'ຕົວແປງໄຟຟ້າກະແສສະຫຼັບເປັນກະແສກົງ', 'NAMOU_LAO_CLIPS']
        ]) {
            const clip = await page.evaluate(([name, term]) => window[name][term], [manifest,key]);
            const previous = await page.evaluate(() => window.namouAudioStarts.length);
            await row.getByRole('button', { name }).tap();
            await page.waitForFunction(count => window.namouAudioStarts.length === count + 1, previous, {timeout: 6000});
            const start = await page.evaluate(() => window.namouAudioStarts.at(-1));
            assert.deepEqual(start, {offset: clip.start, duration: clip.end - clip.start, state: 'running'});
        }
        console.log(`Verified both pronunciation clips on ${device} (${browserType.name()}).`);
    } finally {
        await browser.close();
    }
}

Promise.all([check(webkit, 'iPhone 15'), check(chromium, 'Pixel 7')]).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
