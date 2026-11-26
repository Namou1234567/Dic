const assert = require('node:assert/strict');
const { chromium, devices, webkit } = require('playwright');

async function check(browserType, device) {
    const browser = await browserType.launch();
    try {
        const page = await browser.newPage(devices[device]);
        await page.addInitScript(() => {
            window.namouAudioStarts = [];
            window.namouContexts = [];
            const { start } = AudioBufferSourceNode.prototype;
            AudioBufferSourceNode.prototype.start = function (...args) {
                const result = start.apply(this, args);
                if (!window.namouContexts.includes(this.context)) window.namouContexts.push(this.context);
                window.namouAudioStarts.push({
                    offset: args[1], duration: args[2], state: this.context.state
                });
                window.namouLastContext = window.namouContexts.indexOf(this.context);
                return result;
            };
            // Simulate a silent context whose clock does not advance.
            const clock = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'currentTime');
            Object.defineProperty(BaseAudioContext.prototype, 'currentTime', {
                get() { return window.namouFreezeClock ? 0 : clock.get.call(this); }
            });
            // Simulate a stalled audio context: resume() never settles while the flag is set.
            const { resume } = AudioContext.prototype;
            AudioContext.prototype.resume = function () {
                return window.namouStallResume ? new Promise(() => {}) : resume.call(this);
            };
        });
        const requests = new Map();
        await page.route('**/*.mp3', async route => {
            const url = route.request().url();
            requests.set(url, (requests.get(url) || 0) + 1);
            await route.continue();
        });
        await page.goto(process.env.NAMOU_TEST_URL || 'http://127.0.0.1:8765/');
        await page.getByRole('textbox', { name: /搜索/ }).fill('整流器');
        const row = page.locator('.dict-item').filter({ hasText: '整流器' });
        assert.equal(await row.count(), 1);
        const pronunciations = [
            ['朗读中文意思', '整流器', 'NAMOU_VOICE_CLIPS'],
            ['朗读老挝语', 'ຕົວແປງໄຟຟ້າກະແສສະຫຼັບເປັນກະແສກົງ', 'NAMOU_LAO_CLIPS']
        ];
        for (const [name, key, manifest] of [...pronunciations, ...pronunciations]) {
            const clip = await page.evaluate(([name, term]) => window[name][term], [manifest,key]);
            const previous = await page.evaluate(() => window.namouAudioStarts.length);
            await row.getByRole('button', { name }).tap();
            await page.waitForFunction(count => window.namouAudioStarts.length === count + 1, previous, {timeout: 6000});
            const start = await page.evaluate(() => window.namouAudioStarts.at(-1));
            assert.deepEqual(start, {offset: clip.start, duration: clip.end - clip.start, state: 'running'});
        }
        assert.deepEqual([...requests.values()], [1, 1]);

        // A stalled audio context shows a retry message, and the next tap recovers with a new
        // context while reusing the cached recording.
        const chinese = row.getByRole('button', { name: '朗读中文意思' });
        const before = await page.evaluate(() => { window.namouStallResume = true; return window.namouAudioStarts.length; });
        await chinese.tap();
        await page.waitForFunction(() => !document.getElementById('speechNotice').hidden, null, {timeout: 6000});
        assert.equal(await page.evaluate(() => window.namouAudioStarts.length), before);
        await page.evaluate(() => { window.namouStallResume = false; });
        await chinese.tap();
        await page.waitForFunction(count => window.namouAudioStarts.length === count + 1, before, {timeout: 6000});
        assert.equal((await page.evaluate(() => window.namouAudioStarts.at(-1))).state, 'running');
        assert.deepEqual([...requests.values()], [1, 1]);

        // After the page was in the background, the next tap uses a new context.
        const tapAndWait = async () => {
            const count = await page.evaluate(() => window.namouAudioStarts.length);
            await chinese.tap();
            await page.waitForFunction(c => window.namouAudioStarts.length === c + 1, count, {timeout: 6000});
            return page.evaluate(() => window.namouLastContext);
        };
        await page.waitForTimeout(1500);
        const beforeBackground = await tapAndWait();
        await page.evaluate(() => {
            for (const state of ['hidden', 'visible']) {
                Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
                document.dispatchEvent(new Event('visibilitychange'));
            }
        });
        assert.notEqual(await tapAndWait(), beforeBackground);

        // A context whose clock does not advance shows the retry message; the next tap recovers.
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
            document.getElementById('speechNotice').hidden = true;
            window.namouFreezeClock = true;
        });
        const silent = await tapAndWait();
        await page.waitForFunction(() => !document.getElementById('speechNotice').hidden, null, {timeout: 3000});
        await page.evaluate(() => { window.namouFreezeClock = false; });
        assert.notEqual(await tapAndWait(), silent);
        assert.deepEqual([...requests.values()], [1, 1]);
        console.log(`Verified both pronunciation clips, cache reuse, stall, background and silent-context recovery on ${device} (${browserType.name()}).`);
    } finally {
        await browser.close();
    }
}

Promise.all([check(webkit, 'iPhone 15'), check(chromium, 'Pixel 7')]).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
