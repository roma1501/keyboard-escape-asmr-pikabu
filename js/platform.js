/* Platform layer for Playgama (Playgama Bridge SDK v2, window.bridge).
   Same public interface as the previous platform.js: lifecycle, pause/audio, ads, storage.
   No sign-in and no leaderboards. Rewards are granted only after Bridge reports 'rewarded'. */
'use strict';
var Store; // assigned below: preferences live in Bridge Storage next to the save
var Platform = (function () {
  var LEADERBOARD_NAME = 'Score';
  var SAVE_KEY = 'kbescape_save', PREFS_KEY = 'kbescape_prefs';
  // Keys of the old Playgama 1.0.x build (adapter shim over Bridge): read once for migration.
  var LEGACY_DATA_KEY = 'ya_player_data', LEGACY_SNAPSHOT_KEY = 'local_storage_snapshot';
  var PREF_NAMES = ['muted', 'lang', 'tutSeen'];
  var LANGS = ['en', 'ru', 'tr'];
  var INIT_TIMEOUT = 10000, STORAGE_TIMEOUT = 8000, WRITE_TIMEOUT = 10000;
  var AD_SILENT_TIMEOUT = 6000, AD_LOADING_TIMEOUT = 20000, AD_MAX_OPEN = 180000;
  var INTERSTITIAL_ROUNDS = 2, INTERSTITIAL_COOLDOWN = 65000;

  var bridgeReady = false, bridgeStorage = false, initialized = null;
  var sdkLang = 'en';
  var adOpen = false, adPending = false, platformPaused = false, audioEnabled = true;
  var readyRequested = false, readyDelivered = false, gameplayOn = false, levelStarted = false;
  var lastInterstitial = 0, completedRounds = 0;
  var onAdStateChange = null, onPauseChange = null, onAudioChange = null;
  var resumedCallbacks = [];
  var prefetched = null, loadPromise = null, loaded = false;
  var prefs = {}, saveJson = null, memorySave = null;
  var saveDirty = false, prefsDirty = false, writeTimer = null, writing = false, waiters = [];
  var failsafeTimer = null;
  var log = [];

  function note(what) { if (log.length < 400) log.push([Math.round(performance.now()), String(what)]); }
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function once(fn) { var done = false; return function (a) { if (!done) { done = true; fn(a); } }; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function parse(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (e) { return null; }
  }
  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error(label + ' timed out')); }, ms);
      Promise.resolve(promise).then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function B() { var b = window.bridge; return bridgeReady && b ? b : null; }
  function eventName(b, name) { return (b && b.EVENT_NAME && b.EVENT_NAME[name]) || name.toLowerCase(); }
  function pickLang(lang) {
    lang = String(lang || '').toLowerCase().slice(0, 2);
    return LANGS.indexOf(lang) >= 0 ? lang : 'en';
  }

  function setAdOpen(open) { adOpen = !!open; note('ad_open:' + adOpen); if (onAdStateChange) onAdStateChange(adOpen); }
  function setPlatformPaused(on) {
    on = !!on;
    if (on === platformPaused) return;
    platformPaused = on;
    note('platform_paused:' + on);
    if (!on && failsafeTimer) { clearTimeout(failsafeTimer); failsafeTimer = null; }
    if (onPauseChange) onPauseChange(on);
    if (on) flushWrites();
    else {
      var callbacks = resumedCallbacks; resumedCallbacks = [];
      callbacks.forEach(function (callback) { safe(callback); });
    }
  }
  function whenResumed(callback) { if (platformPaused) resumedCallbacks.push(callback); else callback(); }
  function setAudioEnabled(on) { audioEnabled = on !== false; note('audio:' + audioEnabled); if (onAudioChange) onAudioChange(audioEnabled); }

  function advertisement() { var b = B(); return b ? safe(function () { return b.advertisement; }) || null : null; }
  function rewardedSupported() { var adv = advertisement(); return !!(adv && adv.isRewardedSupported && typeof adv.showRewarded === 'function'); }

  function send(message) {
    var b = B();
    if (!b) return;
    try { var r = b.platform.sendMessage(message); if (r && r.catch) r.catch(function () {}); note('message:' + message); }
    catch (e) { note('message_error:' + message); }
  }
  function deliverReady() {
    if (!readyRequested || readyDelivered || !B()) return;
    readyDelivered = true;
    send('game_ready');
    if (gameplayOn && !levelStarted) { levelStarted = true; send('level_started'); }
  }

  /* ---------- Bridge ---------- */
  function attachBridge(b, late) {
    bridgeReady = true;
    if (!late) {
      bridgeStorage = !!(b.storage && typeof b.storage.get === 'function' && typeof b.storage.set === 'function');
      sdkLang = pickLang(safe(function () { return b.platform.language; })); // read once, right after init
    }
    note('bridge_ready:' + safe(function () { return b.platform.id; }) + ':' + safe(function () { return b.platform.language; }) + '->' + sdkLang + (late ? ':late' : ''));
    /* Bridge folds several causes into one pause/audio state: the platform's own command
       ('platform'), an ad ('interstitial'/'rewarded') and 'visibility', which it also sets
       when the frame merely loses focus. On Playgama the focus leaves the game whenever the
       player (or the QA Tool) clicks the host page, so after the platform's resume Bridge
       would keep the game paused and silent until a click inside it. The game therefore
       follows the platform and ad causes, plus a really hidden tab, and not a lost focus. */
    function causes(kind) {
      var agg = safe(function () { return b.platform._platformBridge['_' + kind + 'StateAggregator']; });
      return agg && typeof agg.getState === 'function' ? agg : null;
    }
    function shouldPause(fallback) {
      var agg = causes('pause');
      if (!agg) return fallback;
      return !!(agg.getState('platform') || agg.getState('interstitial') || agg.getState('rewarded')) || document.hidden;
    }
    function audioAllowed(fallback) {
      var agg = causes('audio');
      if (!agg) return fallback;
      return !(agg.getState('platform') || agg.getState('interstitial') || agg.getState('rewarded') || document.hidden);
    }
    function sync(pauseFallback, audioFallback) {
      setPlatformPaused(shouldPause(pauseFallback));
      setAudioEnabled(audioAllowed(audioFallback));
    }
    sync(safe(function () { return b.platform.isPaused; }) === true,
         safe(function () { return b.platform.isAudioEnabled; }) !== false);
    safe(function () {
      b.platform.on(eventName(b, 'AUDIO_STATE_CHANGED'), function (enabled) {
        note('bridge_audio:' + (enabled !== false));
        setAudioEnabled(audioAllowed(enabled !== false));
      });
      b.platform.on(eventName(b, 'PAUSE_STATE_CHANGED'), function (paused) {
        note('bridge_pause:' + !!paused);
        sync(!!paused, audioEnabled);
      });
    });
    // When the platform's command ends while the lost focus still holds Bridge's combined
    // state, Bridge sends no event at all: watch each cause change directly.
    ['pause', 'audio'].forEach(function (kind) {
      var agg = causes(kind);
      if (!agg || agg.__kbWatched) return;
      var setState = agg.setState;
      agg.setState = function () {
        var result = setState.apply(this, arguments);
        safe(function () { sync(platformPaused, audioEnabled); });
        return result;
      };
      agg.__kbWatched = true;
    });
    document.addEventListener('visibilitychange', function () { sync(platformPaused, audioEnabled); });
    window.addEventListener('focus', function () { sync(platformPaused, audioEnabled); });
    deliverReady();
  }

  /* ---------- Storage (Bridge only; one get, one set per write) ---------- */
  function lsGet(key) { return safe(function () { return parse(window.localStorage.getItem('kbescape.' + key)); }); }
  function readStorage() {
    var b = B();
    note('storage_get');
    return withTimeout(b.storage.get([SAVE_KEY, PREFS_KEY, LEGACY_DATA_KEY, LEGACY_SNAPSHOT_KEY]), STORAGE_TIMEOUT, 'storage.get')
      .then(function (values) {
        if (!Array.isArray(values)) throw new Error('Invalid storage response.');
        return values;
      });
  }
  function interpret(values) {
    var save = parse(values[0]), stored = parse(values[1]), from = null;
    if (!isObj(save)) save = null;
    var snapshot = parse(values[3]);
    if (!isObj(snapshot)) snapshot = null;
    function legacyValue(name) {
      if (snapshot && snapshot['kbescape.' + name] !== undefined && snapshot['kbescape.' + name] !== null) return parse(snapshot['kbescape.' + name]);
      return lsGet(name);
    }
    if (!save) {
      var legacy = parse(values[2]);
      if (isObj(legacy) && isObj(legacy.save)) { save = legacy.save; from = LEGACY_DATA_KEY; }
      if (!save && snapshot && isObj(parse(snapshot['kbescape.save']))) { save = parse(snapshot['kbescape.save']); from = LEGACY_SNAPSHOT_KEY; }
      if (!save && isObj(lsGet('save'))) { save = lsGet('save'); from = 'localStorage'; }
    }
    var p = {}, prefsFrom = null;
    if (isObj(stored)) PREF_NAMES.forEach(function (k) { if (stored[k] !== undefined) p[k] = stored[k]; });
    else {
      PREF_NAMES.forEach(function (k) { var v = legacyValue(k); if (v !== null && v !== undefined) { p[k] = v; prefsFrom = 'legacy'; } });
    }
    return { save: save, prefs: p, from: from, prefsFrom: prefsFrom };
  }
  function prefetch() {
    if (!bridgeStorage) {
      // Bridge unavailable: play from memory; an old local save is only read, never written.
      var legacy = interpret([null, null, null, null]);
      memorySave = legacy.save; prefs = legacy.prefs;
      note('storage:memory' + (legacy.from ? ':read_' + legacy.from : ''));
      return Promise.resolve();
    }
    return readStorage().then(function (values) {
      prefetched = interpret(values);
      prefs = prefetched.prefs;
      if (prefetched.prefsFrom) prefsDirty = true;
    }, function (e) { note('storage_prefetch_failed:' + (e && e.message)); });
  }

  function flushWrites() { if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; } pump(); }
  function scheduleWrite(flush) {
    if (flush) { flushWrites(); return; }
    if (!writeTimer) writeTimer = setTimeout(function () { writeTimer = null; pump(); }, 300);
  }
  function pump() {
    if (writing) return;
    var b = B();
    var keys = [], values = [];
    if (bridgeStorage && b) {
      if (saveDirty && loaded && saveJson) { keys.push(SAVE_KEY); values.push(saveJson); }
      if (prefsDirty) { keys.push(PREFS_KEY); values.push(JSON.stringify(prefs)); }
    }
    var batch = waiters; waiters = [];
    if (!keys.length) { batch.forEach(function (fn) { fn(true); }); return; }
    var sentSave = keys.indexOf(SAVE_KEY) >= 0 ? saveJson : null;
    saveDirty = false; prefsDirty = false; writing = true;
    note('storage_set:' + keys.join(','));
    withTimeout(Promise.resolve().then(function () { return b.storage.set(keys, values); }), WRITE_TIMEOUT, 'storage.set')
      .then(function () { return true; }, function (e) { note('storage_set_failed:' + (e && e.message)); return false; })
      .then(function (ok) {
        writing = false;
        if (!ok) {
          if (sentSave !== null && !saveDirty) saveDirty = true;
          if (keys.indexOf(PREFS_KEY) >= 0) prefsDirty = true;
        }
        batch.forEach(function (fn) { fn(ok); });
        // Newer saves queued while writing go out next, in order.
        if (waiters.length || (ok && (saveDirty || prefsDirty))) pump();
      });
  }
  function onHidden() { if (document.visibilityState === 'hidden') flushWrites(); }
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', flushWrites);

  /* ---------- Pause overlay safety ----------
     Bridge pauses on tab hide and on window blur and resumes on show/focus. A blur pause can outlive the
     blur (e.g. focus stays on the host page after an ad), so a tap inside the game re-focuses the frame;
     if no focus event follows, the same focus signal is replayed for Bridge. Explicit platform/ad pauses
     are left to Bridge. */
  var frameVisibility = document.visibilityState === 'hidden' ? 'hidden' : 'visible';
  document.addEventListener('visibilitychange', function () { frameVisibility = document.visibilityState === 'hidden' ? 'hidden' : 'visible'; });
  window.addEventListener('blur', function () { frameVisibility = 'hidden'; });
  window.addEventListener('focus', function () { frameVisibility = 'visible'; });
  function onGesture() {
    if (!platformPaused || frameVisibility !== 'hidden' || document.visibilityState !== 'visible') return;
    safe(function () { window.focus(); });
    if (failsafeTimer) clearTimeout(failsafeTimer);
    failsafeTimer = setTimeout(function () {
      failsafeTimer = null;
      if (platformPaused && frameVisibility === 'hidden' && document.visibilityState === 'visible') {
        note('pause_refocus');
        safe(function () { window.dispatchEvent(new Event('focus')); });
      }
    }, 300);
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (type) {
    document.addEventListener(type, onGesture, { capture: true, passive: true });
  });

  /* ---------- Ads ---------- */
  function runAd(kind, onFinish) {
    var adv = advertisement(), b = B();
    var ev = eventName(b, kind === 'rewarded' ? 'REWARDED_STATE_CHANGED' : 'INTERSTITIAL_STATE_CHANGED');
    var opened = false, earned = false, timer = null;
    adPending = true;
    note(kind + ':request');
    function arm(ms, why) { clearTimeout(timer); timer = setTimeout(function () { finish(why); }, ms); }
    var finish = once(function (why) {
      clearTimeout(timer);
      safe(function () { adv.off(ev, onState); });
      adPending = false;
      note(kind + ':finish:' + why + (kind === 'rewarded' ? ':earned=' + earned : ''));
      whenResumed(function () { if (adOpen) setAdOpen(false); onFinish(earned); });
    });
    function onState(state) {
      note(kind + ':' + state);
      if (state === 'loading') { if (!opened) arm(AD_LOADING_TIMEOUT, 'loading_timeout'); }
      else if (state === 'opened' || (state === 'rewarded' && kind === 'rewarded')) {
        if (state === 'rewarded') earned = true;
        if (!opened) { opened = true; setAdOpen(true); arm(AD_MAX_OPEN, 'open_timeout'); }
      }
      else if (state === 'closed' || state === 'failed') finish(state);
    }
    try { adv.on(ev, onState); } catch (e) { finish('subscribe_error'); return; }
    arm(AD_SILENT_TIMEOUT, 'no_response');
    try {
      var r = kind === 'rewarded' ? adv.showRewarded('reward') : adv.showInterstitial('transition');
      if (r && typeof r.then === 'function') r.then(null, function () { finish('show_error'); });
    } catch (e) { finish('show_error'); }
  }

  var api = {
    LEADERBOARD_NAME: LEADERBOARD_NAME,
    get available() { return bridgeReady; },
    get isPlayables() { return false; },
    get isPlayablesBuild() { return false; },
    get isAdOpen() { return adOpen; },
    get platformPaused() { return platformPaused; },
    get audioEnabled() { return audioEnabled; },
    get rewardedAvailable() { return rewardedSupported(); },
    get adsAvailable() { return rewardedSupported(); },
    get leaderboardAvailable() { return false; },
    get canSave() { return !bridgeStorage || loaded; },
    set onAdStateChange(fn) { onAdStateChange = fn; },
    set onPauseChange(fn) { onPauseChange = fn; if (platformPaused && fn) fn(true); },
    set onAudioChange(fn) { onAudioChange = fn; if (fn) fn(audioEnabled); },
    init: function () {
      if (initialized) return initialized;
      initialized = new Promise(function (resolve) {
        var b = window.bridge, settled = false;
        function done(why) { if (settled) return; settled = true; note('init:' + why); resolve(); }
        if (!b || typeof b.initialize !== 'function') { done('no_bridge'); return; }
        var timer = setTimeout(function () { done('timeout'); }, INIT_TIMEOUT);
        Promise.resolve().then(function () { return b.initialize(); }).then(function () {
          clearTimeout(timer);
          // A late Bridge still gets pause/audio/ads/game_ready, but never replaces this session's save source.
          attachBridge(b, settled);
          done('ok');
        }, function (e) { clearTimeout(timer); note('init_error:' + (e && e.message)); done('error'); });
      }).then(prefetch).then(function () { return null; });
      return initialized;
    },
    getSdkLang: function () { return sdkLang; },
    isMobile: function () { return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || '')); },
    firstFrame: function () {},
    gameReady: function () {
      if (readyRequested) return;
      readyRequested = true;
      // After the frame without the loader has been painted (timer fallback for hidden tabs).
      var go = once(deliverReady);
      requestAnimationFrame(function () { setTimeout(go, 0); });
      setTimeout(go, 300);
    },
    gameplayStart: function () {
      if (gameplayOn) return;
      gameplayOn = true;
      if (!readyDelivered) return;
      if (!levelStarted) { levelStarted = true; send('level_started'); } else send('level_resumed');
    },
    gameplayStop: function () {
      if (!gameplayOn) return;
      gameplayOn = false;
      if (readyDelivered && levelStarted) send('level_paused');
    },
    roundEnded: function () { completedRounds++; },
    showInterstitial: function (onDone) {
      var callback = once(function () { if (onDone) onDone(); });
      if (adPending || adOpen || platformPaused || completedRounds < INTERSTITIAL_ROUNDS || Date.now() - lastInterstitial < INTERSTITIAL_COOLDOWN) {
        note('interstitial:skip:rounds=' + completedRounds); callback(); return;
      }
      var adv = advertisement();
      if (!adv || !adv.isInterstitialSupported || typeof adv.showInterstitial !== 'function') { note('interstitial:unsupported'); callback(); return; }
      lastInterstitial = Date.now(); completedRounds = 0;
      runAd('interstitial', function () { callback(); });
    },
    showRewarded: function (placement, onRewarded, onFail) {
      if (adPending) { note('rewarded:busy'); return; } // a second tap while one is loading is ignored
      if (!placement || adOpen || platformPaused || !rewardedSupported()) { note('rewarded:unavailable'); if (onFail) onFail(); return; }
      note('rewarded:placement:' + placement);
      runAd('rewarded', function (earned) {
        if (earned) { if (onRewarded) onRewarded(); }
        else if (onFail) onFail();
      });
    },
    loadPlayerData: function () {
      if (!bridgeStorage) { loaded = true; return Promise.resolve(memorySave); }
      if (loadPromise) return loadPromise;
      var source = prefetched ? Promise.resolve(prefetched) : readStorage().then(interpret);
      prefetched = null;
      loadPromise = source.then(function (result) {
        loaded = true;
        if (!prefs || !Object.keys(prefs).length) prefs = result.prefs;
        note('storage_loaded:' + (result.save ? 'save' : 'empty') + (result.from ? ':migrated_from_' + result.from : ''));
        if (result.save && result.from) {
          // One-time migration of an old 1.0.x save into this build's key.
          saveJson = JSON.stringify(result.save); saveDirty = true; scheduleWrite(true);
        } else if (prefsDirty) scheduleWrite(true);
        return result.save;
      }).catch(function (error) {
        loadPromise = null; loaded = false;
        note('storage_load_failed:' + (error && error.message));
        throw error || new Error('Saved progress could not be loaded.');
      });
      return loadPromise;
    },
    savePlayerData: function (saveObj, options) {
      var flush = !!(options && options.flush);
      if (!bridgeStorage) { memorySave = saveObj; return Promise.resolve(true); }
      if (!loaded) return Promise.resolve(false); // never overwrite a save that has not been read
      var serialized;
      try {
        serialized = JSON.stringify(saveObj);
        if (typeof serialized !== 'string' || serialized.length >= 1024 * 1024) return Promise.resolve(false);
      } catch (error) { return Promise.resolve(false); }
      saveJson = serialized; saveDirty = true;
      return new Promise(function (resolve) { waiters.push(resolve); scheduleWrite(flush); });
    },
    submitScore: function () { return Promise.resolve(false); },
    getLeaderboard: function () { return Promise.resolve(null); },
    isPlayerAuthorized: function () { return false; },
    openAuthDialog: function (onDone) { if (onDone) onDone(false); }
  };

  /* Preferences (mute, language, tutorial) are written with the save in the same storage.set call;
     there are no direct localStorage writes. */
  Store = {
    get: function (key, def) { return Object.prototype.hasOwnProperty.call(prefs, key) ? prefs[key] : def; },
    set: function (key, value) {
      if (PREF_NAMES.indexOf(key) < 0) return;
      prefs[key] = value; prefsDirty = true;
      if (bridgeStorage) scheduleWrite(false);
    }
  };

  // Read-only debug hook for automated QA (no controls).
  window.__pg = {
    log: log,
    get state() {
      return { bridgeReady: bridgeReady, bridgeStorage: bridgeStorage, lang: sdkLang, paused: platformPaused, audio: audioEnabled,
        adOpen: adOpen, adPending: adPending, ready: readyDelivered, loaded: loaded, rounds: completedRounds, prefs: Object.assign({}, prefs) };
    }
  };
  return api;
})();
