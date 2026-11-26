const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const vm = require('node:vm');

const page = fs.readFileSync('index.html', 'utf8');
const start = page.indexOf('const initialDB =');
const end = page.indexOf('let currentCat =', start);
assert(start >= 0 && end > start, 'Could not find the vocabulary and storage logic');
const saved = new Map(Object.entries({
    lao_db_v11: JSON.stringify([
        { lao: 'ລະດັບນ້ຳ', meanings: ['水平仪', '水平尺', '水位'], cat: '生活' },
        { lao: 'ເງິນ', meanings: ['钱', '银/钱', '个人注释'], cat: '生活' },
        { lao: '个人词测试', zh: '保留', cat: '工作' }
    ]),
    lao_wrong_v11: JSON.stringify([
        { lao: ' ລະດັບນ້ຳ ' }, { lao: '个人词测试' }, { lao: '个人词测试' }, { lao: '已删除词' }
    ])
}));
function loadVocabulary(storage, warnings = []) {
    const scope = {
        pinyinPro: { pinyin: text => text },
        window: {},
        console: { warn: message => warnings.push(message) },
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        }
    };
    vm.createContext(scope);
    vm.runInContext(fs.readFileSync('vocabulary.js', 'utf8'), scope);
    vm.runInContext(page.slice(start, end) + '\nwords = mergeVocabulary(initialDB); migrated = db;', scope);
    return scope;
}

const scope = loadVocabulary(saved);
assert.equal(scope.migrated.length, scope.words.length + 1);
assert.equal(scope.migrated.find(word => word.lao === 'ລະດັບນ້ຳ').zh, '水位');
assert.equal(scope.migrated.find(word => word.lao === 'ລະດັບນ້ຳ').cat, '工作');
assert.equal(scope.migrated.find(word => word.lao === 'ເງິນ').zh, '钱；个人注释');
assert.deepEqual(JSON.parse(saved.get('lao_custom_v12')), [
    { lao: 'ເງິນ', meanings: ['个人注释'], cat: '生活' },
    { lao: '个人词测试', meanings: ['保留'], cat: '工作' }
]);
assert.deepEqual(JSON.parse(saved.get('lao_wrong_v12')), ['ລະດັບນ້ຳ', '个人词测试']);
assert(!saved.has('lao_db_v11') && !saved.has('lao_wrong_v11'));
const warnings = [];
const damaged = loadVocabulary(new Map([
    ['lao_custom_v12', '非法 JSON'],
    ['lao_wrong_v12', '{}'],
    ['lao_memory_v11', '[]']
]), warnings);
assert.equal(vm.runInContext('Array.isArray(custom) && custom.length === 0', damaged), true);
assert.equal(vm.runInContext('Array.isArray(wrongs) && wrongs.length === 0', damaged), true);
assert.equal(vm.runInContext("memory['全部']", damaged), 0);
assert.equal(damaged.migrated.length, damaged.words.length);
for (const key of ['lao_custom_v12', 'lao_wrong_v12', 'lao_memory_v11']) {
    assert.equal(warnings.filter(message => message.includes(key)).length, 1);
}
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
