/* Licensed sample audio. Existing keyboard click recordings remain unchanged.
 * Imported SFX: Kenney CC0. Ambient: Sunset Walk / Kilua Boy, CC0.
 * See assets/sounds/source-manifest.json and the accompanying license files.
 */
'use strict';
var GameAudio = (function () {
  var ctx = null, master = null, sfxGain = null, musicGain = null;
  var muted = false, platformEnabled = true, paused = false;
  var musicWanted = false, musicSource = null, musicOffset = 0, musicStartedAt = 0;
  var records = {}, voices = [], lastPlayed = {};
  var keySampleUrls = ['tipe1.mp3', 'tipe2.mp3', 'tipe3.mp3', 'tipe4.mp3'];
  var ROOT = 'assets/sounds/';
  var SAMPLES = {
    click: 'ui-click.mp3', jump: 'jump.mp3', candy: 'candy.mp3', stumble: 'damage.mp3',
    gameover: 'gameover.mp3', reward: 'reward.mp3', buy: 'purchase.mp3',
    deny: 'deny.mp3', door: 'door.mp3', attack: 'attack.mp3', music: 'music.mp3'
  };

  function audible() { return !paused && !muted && platformEnabled; }
  function syncGain() { if (master) master.gain.value = audible() ? 1 : 0; }
  function ensure() {
    if (ctx) return true;
    if (paused) return false;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.52; sfxGain.connect(master);
      // Keep the ambient bed below the close-up keyboard recordings.
      musicGain = ctx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(master);
      syncGain(); return true;
    } catch (error) { ctx = null; return false; }
  }
  function resumeContext() {
    // 'interrupted' is what iOS Safari reports after a call or another app took the audio.
    if (ctx && audible() && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
      try {
        var result = ctx.resume();
        // Music started while the context was still waking up is restarted once it runs.
        if (result && result.then) result.then(function () { if (audible() && !musicSource) playMusic(); }, function () {});
      } catch (error) {}
    }
  }
  // A browser may refuse to resume audio without a fresh gesture after a pause: any tap,
  // click or key inside the game brings the sound back if it should be playing.
  ['pointerdown', 'touchend', 'keydown'].forEach(function (type) {
    window.addEventListener(type, function () {
      if (ctx && audible() && ctx.state !== 'running') resumeContext();
      else if (ctx && audible() && musicWanted && !musicSource) playMusic();
    }, true);
  });

  function beginLoad(record) {
    if (paused || record.buffer || record.request || record.decoding || !ctx) return;
    var xhr = new XMLHttpRequest();
    record.request = xhr;
    function fail() {
      if (record.request !== xhr) return;
      record.request = null;
      var reject = record.reject; record.promise = null; record.resolve = null; record.reject = null;
      if (reject) reject(new Error('Audio asset could not load: ' + record.url));
    }
    xhr.open('GET', record.url, true); xhr.responseType = 'arraybuffer'; xhr.timeout = 20000;
    xhr.onload = function () {
      if (record.request !== xhr) return;
      if (!xhr.response || (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300))) { fail(); return; }
      record.request = null; record.decoding = true;
      var finished = false;
      function decoded(buffer) {
        if (finished) return; finished = true; record.decoding = false;
        record.buffer = buffer;
        if (record.resolve) record.resolve(buffer);
        record.resolve = null; record.reject = null;
        if (record.url === ROOT + SAMPLES.music) playMusic();
      }
      function invalid() {
        if (finished) return; finished = true; record.decoding = false;
        var reject = record.reject; record.promise = null; record.resolve = null; record.reject = null;
        if (reject) reject(new Error('Audio asset could not decode: ' + record.url));
      }
      try {
        var promise = ctx.decodeAudioData(xhr.response, decoded, invalid);
        if (promise && promise.catch) promise.catch(function () {});
      } catch (error) { invalid(); }
    };
    xhr.onerror = fail; xhr.ontimeout = fail;
    xhr.onabort = function () {
      // Pause aborts are deliberately pending: resume continues this same preload.
      if (record.request === xhr) record.request = null;
    };
    try { xhr.send(); } catch (error) { fail(); }
  }
  function load(url) {
    var record = records[url];
    if (!record) record = records[url] = { url: url, buffer: null, request: null, promise: null, decoding: false };
    if (record.buffer) return Promise.resolve(record.buffer);
    if (!record.promise) record.promise = new Promise(function (resolve, reject) { record.resolve = resolve; record.reject = reject; });
    var result = record.promise;
    beginLoad(record);
    return result;
  }
  function preload() {
    if (!ensure() && !paused) return Promise.resolve(false);
    var urls = keySampleUrls.concat(Object.keys(SAMPLES).map(function (name) { return ROOT + SAMPLES[name]; }));
    return Promise.all(urls.map(load)).then(function () { return true; });
  }
  function stopVoices() {
    var active = voices; voices = [];
    active.forEach(function (source) { try { source.stop(); source.disconnect(); } catch (error) {} });
  }
  function playBuffer(buffer, volume, rate) {
    if (!buffer || !audible() || !ensure() || ctx.state !== 'running') return;
    // Bound polyphony in crowded areas; keyboard recordings are still the only step sounds.
    if (voices.length >= 24) { var oldest = voices.shift(); try { oldest.stop(); } catch (error) {} }
    var source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.playbackRate.value = rate || 1;
    gain.gain.value = volume; source.connect(gain); gain.connect(sfxGain);
    source.onended = function () {
      var index = voices.indexOf(source); if (index >= 0) voices.splice(index, 1);
      try { source.disconnect(); gain.disconnect(); } catch (error) {}
    };
    voices.push(source); source.start();
  }
  function effect(name, volume, cooldown) {
    if (!audible() || !ensure()) return;
    var now = ctx.currentTime;
    if (lastPlayed[name] !== undefined && now - lastPlayed[name] < (cooldown || 0.035)) return;
    lastPlayed[name] = now;
    var record = records[ROOT + SAMPLES[name]];
    if (record && record.buffer) playBuffer(record.buffer, volume, 1);
    else load(ROOT + SAMPLES[name]).catch(function () {}); // Never replay a stale event after loading.
  }
  function stopMusicNode() {
    if (!musicSource) return;
    var record = records[ROOT + SAMPLES.music];
    if (record && record.buffer) musicOffset = (musicOffset + ctx.currentTime - musicStartedAt) % record.buffer.duration;
    try { musicSource.stop(); musicSource.disconnect(); } catch (error) {}
    musicSource = null;
  }
  function playMusic() {
    if (!musicWanted || musicSource || !audible() || !ensure()) return;
    var record = records[ROOT + SAMPLES.music];
    if (!record || !record.buffer) return;
    musicSource = ctx.createBufferSource(); musicSource.buffer = record.buffer;
    musicSource.loop = true; musicSource.connect(musicGain);
    musicStartedAt = ctx.currentTime;
    musicSource.start(0, musicOffset % record.buffer.duration);
  }
  function startMusic() {
    musicWanted = true;
    if (!ensure()) return;
    resumeContext();
    load(ROOT + SAMPLES.music).then(playMusic).catch(function () {});
    playMusic();
  }
  function stopMusic() { musicWanted = false; stopMusicNode(); musicOffset = 0; }
  function updateAudioPermission() {
    syncGain();
    if (!audible()) { stopVoices(); stopMusicNode(); }
    else { resumeContext(); playMusic(); }
  }

  return {
    preload: preload,
    setKeySampleUrls: function (urls) {
      keySampleUrls = urls.slice();
      preload().catch(function () {});
    },
    unlock: function () {
      if (paused || !ensure()) return;
      resumeContext(); preload().catch(function () {});
    },
    get muted() { return muted; },
    setMuted: function (value) { muted = !!value; updateAudioPermission(); },
    setPlatformEnabled: function (enabled) { platformEnabled = !!enabled; updateAudioPermission(); },
    suspend: function () {
      paused = true; syncGain(); stopVoices(); stopMusicNode();
      Object.keys(records).forEach(function (url) {
        var record = records[url], xhr = record.request;
        if (xhr) { record.request = null; try { xhr.abort(); } catch (error) {} }
      });
      // The context keeps running and is only silenced (master gain 0, no voices, no music):
      // a suspended context may refuse to wake without a new gesture in some browsers,
      // which left the game silent after the pause.
    },
    resume: function () {
      paused = false; ensure(); syncGain(); resumeContext();
      Object.keys(records).forEach(function (url) { if (records[url].promise) beginLoad(records[url]); });
      playMusic();
    },
    startMusic: startMusic,
    stopMusic: stopMusic,
    click: function () { effect('click', 0.55); },
    key: function (combo, volume) {
      if (!audible() || !ensure()) return;
      var gain = volume !== undefined ? volume : 0.75;
      if (gain <= 0.02) return;
      var ready = keySampleUrls.map(function (url) { return records[url] && records[url].buffer; }).filter(Boolean);
      if (ready.length) playBuffer(ready[(Math.random() * ready.length) | 0], Math.min(1.4, gain * 1.6), 0.94 + Math.random() * 0.14);
    },
    candy: function () { effect('candy', 0.40, 0.06); },
    stumble: function () { effect('stumble', 0.65, 0.12); },
    gameover: function () { effect('gameover', 0.75, 0.5); },
    reward: function () { effect('reward', 0.65, 0.12); },
    jump: function () { effect('jump', 0.43, 0.08); },
    buy: function () { effect('buy', 0.72, 0.08); },
    deny: function () { effect('deny', 0.52, 0.1); },
    door: function () { effect('door', 0.45, 0.2); },
    attack: function () { effect('attack', 0.50, 0.07); }
  };
})();
