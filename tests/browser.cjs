// Browser checks for flashcard audio, mobile playback and the update banner.
// Serve the site first, for example with `python3 -m http.server 8765`.
const assert = require('node:assert/strict');
const { chromium, devices, webkit } = require('playwright');

// Flashcards: the Lao and Mandarin buttons play separate audio on opposite card faces.
async function checkFlashcardAudio() {
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

// Phones: playback, cache reuse, and recovery after stalls, backgrounding and silent contexts.
async function checkMobileAudio(browserType, device) {
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

// The update banner stays hidden for the current version, appears when a newer version is
// published, and loads the new version under a new address when tapped.
async function checkUpdateBanner() {
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
}

(async () => {
    await checkFlashcardAudio();
    await Promise.all([checkMobileAudio(webkit, 'iPhone 15'), checkMobileAudio(chromium, 'Pixel 7')]);
    await checkUpdateBanner();
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
