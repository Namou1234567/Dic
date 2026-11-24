const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');

const page = fs.readFileSync('index.html', 'utf8');
const start = page.indexOf('const initialDB =');
const end = page.indexOf('let db = restoreVocabulary', start);
assert(start >= 0 && end > start, 'Cannot find the vocabulary and merge logic');
const scope = { pinyinPro: { pinyin: text => text }, window: {} };
vm.createContext(scope);
vm.runInContext(fs.readFileSync('vocabulary.js', 'utf8'), scope);
vm.runInContext(page.slice(start, end) + '\nwords = mergeVocabulary(initialDB);', scope);
vm.runInContext(`
    migrated = restoreVocabulary([
        { lao: 'ລະດັບນ້ຳ', meanings: ['水平仪', '水平尺', '水位'], cat: '工作' },
        { lao: 'ເງິນ', meanings: ['钱', '银/钱'], cat: '生活' },
        { lao: '个人词测试', zh: '保留', cat: '生活' }
    ]);
`, scope);
assert.equal(scope.migrated.length, scope.words.length + 1);
assert.equal(scope.migrated.find(word => word.lao === 'ລະດັບນ້ຳ').zh, '水位');
assert.equal(scope.migrated.find(word => word.lao === 'ເງິນ').zh, '钱');
assert(scope.migrated.some(word => word.lao === '个人词测试'));
const words = scope.words;
assert.equal(scope.window.NAMOU_VOCABULARY.length, words.length, 'Duplicate headword in source vocabulary');
assert(words.length > 0, 'Missing vocabulary');
assert.equal(new Set(words.map(word => word.lao)).size, words.length, 'Duplicate Lao headword');
for (const word of words) {
    assert(word.lao && word.meanings.length, 'Empty headword or meaning');
    assert(['工作', '生活'].includes(word.cat), 'Invalid category for ' + word.lao);
    assert.equal(JSON.stringify(word.categories), JSON.stringify([word.cat]), word.lao);
}

const lao = words.map(word => word.lao);
const zh = [...new Set(words.flatMap(word => word.meanings))];
if (process.argv[2] === '--export') {
    process.stdout.write(JSON.stringify({ lao, zh }, null, 2) + '\n');
} else {
    for (const path of ['audio/manifest.js', 'audio/lao/manifest.js']) {
        vm.runInContext(fs.readFileSync(path, 'utf8'), scope);
    }
    const limits = new Map();
    for (const [keys, clips, pattern] of [
        [zh, scope.window.NAMOU_VOICE_CLIPS, /^audio\/mandarin-\d+\.mp3$/],
        [lao, scope.window.NAMOU_LAO_CLIPS, /^audio\/lao\/chanthavong-\d+\.mp3$/]
    ]) {
        for (const key of keys) {
            const clip = clips?.[key];
            assert(clip, 'Missing audio for ' + key);
            assert(pattern.test(clip.src), 'Incorrect audio language or path for ' + key);
            assert(Number.isFinite(clip.start) && Number.isFinite(clip.end) &&
                clip.start >= 0 && clip.end > clip.start, 'Invalid clip range for ' + key);
            limits.set(clip.src, Math.max(limits.get(clip.src) || 0, clip.end));
        }
    }
    for (const [path, end] of limits) {
        const duration = Number(execFileSync('ffprobe', [
            '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path
        ], { encoding: 'utf8' }));
        assert(duration + 0.05 >= end, 'Clip extends beyond ' + path);
    }
    console.log(`Verified ${lao.length} Lao headwords, ${zh.length} Chinese meanings and ${limits.size} audio files.`);
}
