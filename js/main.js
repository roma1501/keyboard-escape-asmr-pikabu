/* ===== Точка входа: инициализация, SDK, реклама, сохранение, паузы ===== */
'use strict';

(function () {
  var $ = UI.$;
  var lastDeathReason = 'fall';
  var gameInitialized = false;
  var tutorialSeen = false;
  var bootInProgress = false;
  var resumeBoot = [];
  var lastSaveWarning = 0;
  var pendingSave = null, saveRetryTimer = null;
  var reviveUsed = false; // rewarded revive: at most once per room

  /* --- Запрет контекстного меню и выделения (это игра) --- */
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* --- Gameplay API: играем, когда нет пауз/оверлеев --- */
  var gameplayActive = false;
  function syncGameplay() {
    var active = Game.state === 'play' && !Game.paused;
    if (active === gameplayActive) return;
    gameplayActive = active;
    if (active) Platform.gameplayStart();
    else Platform.gameplayStop();
  }

  /* A hidden tab pauses the game. A lost focus does not: on Playgama the focus leaves the
     game whenever the host page is clicked, and the game must keep running (and sounding)
     after the platform's own pause ends. */
  function setBlurPause(on) {
    Game.setPaused('blur', on);
    syncGameplay();
    if (on) saveNow(true); // flush progress when the page is hidden
  }
  if (!Platform.isPlayablesBuild) {
    document.addEventListener('visibilitychange', function () { setBlurPause(document.hidden); });
  }
  Platform.onPauseChange = function (on) {
    Game.setPaused('platform', on);
    Input.reset();
    document.body.classList.toggle('platform-paused', on);
    if (UI.setPlatformPaused) UI.setPlatformPaused(on);
    syncGameplay();
    if (on) {
      if (saveRetryTimer) { clearTimeout(saveRetryTimer); saveRetryTimer = null; }
      saveNow(true);
    }
    else {
      var waiting = resumeBoot; resumeBoot = [];
      waiting.forEach(function (resume) { resume(); });
      if (gameInitialized) { Game.resize(); if (!Game.paused) Input.focus(); }
      if (pendingSave) persist(pendingSave, false);
    }
  };
  Platform.onAudioChange = function (enabled) { GameAudio.setPlatformEnabled(enabled); };
  // Capture phase also blocks buttons created dynamically by vendor/shop panels.
  // Only the game's own UI is blocked: anything Bridge/ads add outside #game-root stays usable.
  // Press events are not default-prevented, so a tap can focus the frame and let Bridge resume.
  var gameRoot = $('game-root');
  function ownTarget(t) {
    return !t || t === document || t === window || t === document.body || t === document.documentElement || (gameRoot && gameRoot.contains(t));
  }
  ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keyup', 'wheel'].forEach(function (type) {
    var keepDefault = /^(click|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend)$/.test(type);
    document.addEventListener(type, function (event) {
      if (!Platform.platformPaused || !ownTarget(event.target)) return;
      event.stopImmediatePropagation();
      if (!keepDefault && event.code !== 'Escape' && event.cancelable) event.preventDefault();
    }, { capture: true, passive: false });
  });

  /* --- Пауза во время показа рекламы --- */
  Platform.onAdStateChange = function (open) {
    Game.setPaused('ad', open);
    syncGameplay();
  };

  /* Progress goes to Bridge Storage only (see platform.js). */
  function persist(save, flush) {
    save.tutorialSeen = tutorialSeen;
    save.tutorialVersion = tutorialSeen ? 1 : 0;
    pendingSave = save;
    return Platform.savePlayerData(save, { flush: !!flush }).then(function (ok) {
      if (ok && pendingSave === save) pendingSave = null;
      if (!ok && !Platform.platformPaused && Date.now() - lastSaveWarning > 10000) {
        lastSaveWarning = Date.now(); UI.toast(I18N.t('saveRetry'));
      }
      if (!ok && !Platform.platformPaused && !saveRetryTimer) {
        saveRetryTimer = setTimeout(function () {
          saveRetryTimer = null;
          if (pendingSave && !Platform.platformPaused) persist(pendingSave, false);
        }, 8000);
      }
      return ok;
    });
  }
  function saveNow(flush) {
    if (!gameInitialized) return Promise.resolve(false);
    var s = Game.getSave ? Game.getSave() : null;
    return s ? persist(s, flush) : Promise.resolve(false);
  }

  /* --- Ручная пауза --- */
  function togglePause() {
    if (!gameInitialized || Platform.platformPaused || Platform.isAdOpen || Game.state !== 'play') return;
    if (!$('screen-vid-offer').classList.contains('hidden') && UI.cancelAdOffer()) return;
    if (!$('screen-tutorial').classList.contains('hidden')) {
      finishTutorial(); return;
    }
    var on = !Game.isPausedBy('user');
    Game.setPaused('user', on);
    syncGameplay();
    UI.showScreen(on ? 'screen-pause' : null);
    if (!on) Input.focus();
  }
  Input.onPauseKey = togglePause;

  /* --- Звук --- */
  function toggleMute() {
    GameAudio.setMuted(!GameAudio.muted);
    Store.set('muted', GameAudio.muted);
    UI.setMuteIcons();
  }

  /* --- Кнопки --- */

  function bind(id, fn) {
    if (!$(id)) return;
    $(id).addEventListener('click', function () {
      if (Platform.platformPaused) return;
      GameAudio.unlock();
      GameAudio.click();
      fn();
    });
  }

  bind('btn-pause', togglePause);
  bind('btn-resume', togglePause);
  bind('btn-mute', toggleMute);
  bind('btn-mute-menu', toggleMute);

  bind('btn-lang', function () {
    I18N.next();
    Store.set('lang', I18N.lang);
    UI.applyI18n();
  });

  // Выход в хаб из паузы — с межстраничной рекламой
  bind('btn-pause-hub', function () {
    // The game stays paused (pause menu visible) until the interstitial is over.
    Platform.showInterstitial(function () {
      Game.setPaused('user', false);
      reviveUsed = false;
      Game.goHub();
      UI.updateRoom(Game.room, true);
      UI.showScreen(null);
      syncGameplay();
      saveNow();
    });
  });

  // Rewarded №1: возрождение на месте (описание награды — в модальном окне)
  bind('btn-revive', function () {
    UI.openAdOffer({
      emoji: '❤️',
      title: I18N.t('offerReviveTitle'),
      desc: I18N.t('offerReviveDesc'),
      note: I18N.t('offerReviveNote'),
      onConfirm: function () {
        Platform.showRewarded('revive',
          function () {
            reviveUsed = true;
            Game.reviveOnSpot();
            GameAudio.reward();
            UI.showScreen(null);
            syncGameplay();
          },
          function () {
            UI.toast(I18N.t('adFail'));
            UI.showDeath(lastDeathReason, !reviveUsed);
          }
        );
      },
      onCancel: function () { UI.showDeath(lastDeathReason, !reviveUsed); }
    });
  });

  // Рестарт комнаты после смерти — с межстраничной рекламой
  // Смерть → возврат в хаб + сброс счётчика комнат
  bind('btn-restart-room', function () {
    Platform.showInterstitial(function () {
      reviveUsed = false;
      Game.deathToHub();
      UI.updateRoom(Game.room, true);
      UI.showScreen(null);
      syncGameplay();
      saveNow();
    });
  });

  // Rewarded №2: удвоение добычи конфет на 90 секунд.
  // Реклама вызывается не по игровому действию, а кнопкой в модальном окне (п.4.4),
  // где явно описано, что именно даёт награда (п.4.5.1).
  bind('btn-boost', function () {
    if (Game.boostLeft > 0 || Game.state !== 'play') return;
    Game.setPaused('user', true);
    syncGameplay();
    UI.openAdOffer({
      emoji: '🍬',
      title: I18N.t('offerBoostTitle'),
      desc: I18N.t('offerBoostDesc'),
      note: I18N.t('offerBoostNote'),
      onConfirm: function () {
        Platform.showRewarded('boost',
          function () {
            Game.activateBoost(90);
            GameAudio.reward();
            UI.toast(I18N.t('boostOn'));
            Game.setPaused('user', false);
            syncGameplay();
            UI.showScreen(null);
          },
          function () {
            UI.toast(I18N.t('adFail'));
            Game.setPaused('user', false);
            syncGameplay();
            UI.showScreen(null);
          }
        );
      }
    });
  });

  bind('btn-vid-offer-ok', function () { UI.confirmAdOffer(); });
  bind('btn-vid-offer-no', function () {
    // если у окна свой обработчик отмены (например, вернуться на экран смерти) — он всё сделает сам
    if (UI.cancelAdOffer()) return;
    Game.setPaused('user', false);
    syncGameplay();
    UI.showScreen(null);
  });

  /* --- Вендоры --- */

  function offerPurchaseVideo(kind, id, quoted) {
    var quote = quoted || Game.getPurchaseOffer(kind, id);
    if (!quote) return false;
    if (!Platform.rewardedAvailable) {
      Game.cancelPurchaseOffer(quote); UI.toast('Не хватает конфет. Видео за награду недоступны.'); return false;
    }
    var shop = ['skins', 'pets', 'trails', 'emotes'].indexOf(kind) >= 0;
    Game.setPaused('user', true); syncGameplay();
    function back() {
      Game.cancelPurchaseOffer(quote);
      Game.setPaused('user', shop); syncGameplay();
      if (shop) UI.openShop(kind);
      else {
        UI.showScreen(null);
        if (UI.currentVendor) UI.renderVendor(UI.currentVendor);
        Input.focus();
      }
    }
    UI.openAdOffer({
      emoji: kind === 'pets' ? '🐾' : kind === 'skins' ? '👕' : kind === 'trails' ? '⚡' : '🎁',
      title: quote.title,
      desc: 'Цена: ' + quote.price + ' конфет. Досмотри одно видео, чтобы получить ' + (kind === 'upgrade' ? 'это улучшение' : kind === 'park' ? 'этот аттракцион' : 'этот предмет') + '.',
      note: 'Твои конфеты останутся при тебе, выдаётся только эта покупка.',
      onCancel: back,
      onConfirm: function () {
        Platform.showRewarded('purchase-' + kind + '-' + id, function () {
          var granted = Game.fulfillPurchaseAd(quote);
          if (granted) { GameAudio.reward(); UI.toast(quote.title + ' — открыто!'); saveNow(); }
          else UI.toast('Покупка изменилась. Выбери ещё раз.');
          back();
        }, function () { UI.toast(I18N.t('adFail')); back(); });
      }
    });
    return true;
  }
  UI.handlers.onWatchPurchase = function (kind, id) { offerPurchaseVideo(kind, id); };

  UI.handlers.onBuyUpgrade = function (id) {
    if (Game.buyUpgrade(id)) {
      GameAudio.buy();
      UI.toast(I18N.t('purchased'));
      saveNow();
    } else {
      if (Platform.rewardedAvailable && offerPurchaseVideo('upgrade', id)) return;
      GameAudio.deny();
      UI.toast(I18N.t('notEnough'));
    }
    UI.renderVendor(id);
  };

  UI.handlers.onBuyPet = function (pid) {
    if (Game.buyPet(pid)) {
      GameAudio.buy();
      UI.toast(I18N.t('purchased'));
      saveNow();
    } else {
      if (Platform.rewardedAvailable && offerPurchaseVideo('pets', pid)) return;
      GameAudio.deny();
      UI.toast(I18N.t('notEnough'));
    }
    UI.renderVendor('pets');
  };

  UI.handlers.onEquipPet = function (pid) {
    Game.setPet(pid);
    GameAudio.click();
    saveNow();
    UI.renderVendor('pets');
  };

  // The gift stall always opens the free daily calendar, including offline SDKs.
  UI.handlers.onGift = function () {
    Game.setPaused('user', true);
    syncGameplay();
    UI.openDaily();
  };

  UI.handlers.onBuyCollection = function (type, id) {
    if (Game.buyCollection(type, id)) { GameAudio.reward(); UI.toast('Открыто!'); saveNow(); }
    else {
      if (Platform.rewardedAvailable && offerPurchaseVideo(type, id)) return;
      GameAudio.deny(); UI.toast(I18N.t('notEnough'));
    }
    UI.renderShop();
  };
  UI.handlers.onWatchCollection = function (type, id) {
    var skin = Game.getCollection(type).filter(function (s) { return s.id === id; })[0];
    if (!skin || skin.owned || skin.unlockType !== 'ad' || !Platform.rewardedAvailable) return;
    UI.openAdOffer({
      emoji: type === 'pets' ? '🐾' : type === 'emotes' ? '🏆' : type === 'trails' ? '⚡' : '👕', title: skin.name || I18N.t(skin.nameKey),
      desc: 'Посмотри рекламу и получи 1 очко открытия. Собрано ' + skin.adsDone + ' из ' + skin.adsNeed + '.',
      note: 'Эксклюзив за рекламу. Открывается навсегда, когда собраны все очки.',
      onCancel: UI.openShop,
      onConfirm: function () { Platform.showRewarded(type === 'skins' ? 'skin-' + id : type + '-' + id,
      function () {
        var r = Game.addCollectionAd(type, id);
        if (!r) { UI.openShop(); return; }
        if (r.unlocked) { GameAudio.reward(); UI.banner('Открыто!'); }
        else { GameAudio.buy(); UI.toast(I18N.t('skinProgress', { a: r.done, b: r.need })); }
        UI.openShop();
        saveNow();
      },
      function () { UI.toast(I18N.t('adFail')); UI.openShop(); }
    ); }
    });
  };
  UI.handlers.onEquipSkin = function (id) {
    Game.equipSkin(id); GameAudio.click(); UI.renderShop(); saveNow();
  };
  UI.handlers.onBuySkin = function (id) { UI.handlers.onBuyCollection('skins', id); };
  UI.handlers.onWatchSkin = function (id) { UI.handlers.onWatchCollection('skins', id); };
  UI.handlers.onEquipCollection = function (type, id) {
    Game.equipCollection(type, id); GameAudio.click(); UI.renderShop(); saveNow();
  };
  UI.handlers.onOpenCollection = function (type) {
    Game.setPaused('user', true); syncGameplay(); UI.openShop(type);
  };
  UI.handlers.onUseEmote = function (id) {
    if (!Game.equipCollection('emotes', id)) return;
    Game.setPaused('user', false); syncGameplay(); UI.showScreen(null); Input.focus();
    Game.playEmote(); saveNow();
  };

  // E — покупка в открытой панели вендора
  Input.onInteractKey = function () {
    if (!gameInitialized || Game.paused || Game.state !== 'play') return;
    if (Game.inPark) { buyParkPlot(); return; }
    var v = UI.currentVendor;
    if (!v) return;
    if (v === 'speed' || v === 'jump' || v === 'income' || v === 'attack' || v === 'hp') UI.handlers.onBuyUpgrade(v);
    else if (v === 'gift') UI.handlers.onGift();
    else if (v === 'pets') UI.handlers.onOpenCollection('pets');
  };

  /* --- Колбэки игры --- */

  Game.onCoinsChange = UI.updateCoins;

  Game.onVendorNear = function (id) {
    if (id) UI.renderVendor(id);
    else UI.hideVendor();
  };

  Game.onRoomEnter = function (room) {
    reviveUsed = false;
    UI.banner(I18N.t('room', { n: room }));
    UI.updateRoom(room, false);
  };

  Game.onRoomComplete = function (room, reward, nextRoom) {
    Platform.roundEnded();
    UI.banner(I18N.t('roomComplete', { n: room, r: reward }));
    UI.updateRoom(nextRoom, false);
    var score = Game.earned;
    saveNow().then(function (ok) { if (ok) Platform.submitScore(score); });
    // Реклама здесь НЕ показывается: по п.4.4 требований платформы её нельзя
    // вызывать по игровому действию в реальном времени. Межстраничная реклама
    // показывается только по действию в модальных окнах (экран смерти, пауза).
  };

  Game.onDeath = function (reason) {
    Platform.roundEnded();
    lastDeathReason = reason;
    var score = Game.earned;
    saveNow().then(function (ok) { if (ok) Platform.submitScore(score); });
    UI.showDeath(reason, !reviveUsed);
    Game.setPaused('death', true);
    syncGameplay();
  };

  Game.onBoostTick = UI.updateBoost;

  Game.onHpChange = UI.updateHp;

  Game.onArenaClear = function (reward) {
    UI.banner(I18N.t('arenaWin', { r: reward }));
  };

  /* --- Парк конфет --- */
  Game.onModeChange = function (m) {
    UI.setParkMode(m === 'park');
    if (m !== 'park') UI.updateRoom(Game.room, Game.inHub);
  };
  Game.onParkStats = UI.updateParkStats;
  Game.onParkPrompt = UI.showParkPrompt;
  Game.onParkBuild = function (ok, at) {
    if (ok && at) { UI.banner(I18N.t('builtMsg', { n: I18N.t(at.key) })); GameAudio.reward(); }
    else if (!ok) UI.toast(I18N.t('notEnough'));
  };

  function buyParkPlot() {
    if (!Game.inPark || Game.paused || Game.state !== 'play') return;
    var quote = Game.getPurchaseOffer('park', Game.parkBuilt);
    if (quote) { offerPurchaseVideo('park', Game.parkBuilt, quote); return; }
    Game.requestParkBuild();
  }
  bind('btn-park-build', buyParkPlot);
  bind('btn-park-exit', function () { Game.leavePark(); });

  // Магазин скинов
  bind('btn-shop', function () {
    Game.setPaused('user', true);
    syncGameplay();
    UI.openShop();
  });
  document.querySelectorAll('[data-shop]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (Platform.platformPaused) return;
      GameAudio.unlock(); GameAudio.click(); UI.openShop(button.dataset.shop);
    });
  });
  bind('btn-shop-remove', function () { UI.handlers.onEquipCollection(UI.currentShop, null); });
  function useEmote() {
    if (!gameInitialized || Game.paused || Game.state !== 'play') return;
    if (!Game.playEmote()) UI.handlers.onOpenCollection('emotes');
  }
  bind('btn-emote', useEmote);
  document.addEventListener('keydown', function (event) {
    if (event.code === 'KeyB' && !event.repeat && !Platform.platformPaused) useEmote();
  });
  bind('btn-shop-close', function () {
    Game.setPaused('user', false);
    syncGameplay();
    UI.showScreen(null);
  });

  bind('btn-gifts', function () {
    if (Game.state !== 'play') return;
    Game.setPaused('user', true); syncGameplay(); UI.openDaily();
  });
  bind('btn-daily-videos', function () { UI.openRewards(); });
  bind('btn-bonus-daily', function () { UI.openDaily(); });
  bind('btn-daily-close', function () {
    Game.setPaused('user', false); syncGameplay(); UI.showScreen(null); Input.focus();
  });
  bind('btn-daily-claim', function () {
    if (!gameInitialized || Platform.platformPaused || Platform.isAdOpen) return;
    var reward = Game.claimDailyGift();
    UI.renderDaily(); UI.refreshDaily();
    if (!reward) return;
    GameAudio.reward();
    saveNow(true);
  });
  bind('btn-daily-equip', function () {
    Game.equipCollection('skins', 'skin_daily_crown'); UI.renderDaily(); saveNow();
  });
  // Calendar time continues across visits; the host pause still suspends UI work.
  if (UI.refreshDaily) setInterval(function () {
    if (gameInitialized && !Platform.platformPaused && !Platform.isAdOpen && UI.refreshDaily) UI.refreshDaily();
  }, 1000);
  bind('btn-bonus-close', function () {
    Game.setPaused('user', false); syncGameplay(); UI.showScreen(null); Input.focus();
  });
  UI.handlers.onReward = function (id) {
    var offer = Game.getRewardOffers().filter(function (r) { return r.id === id; })[0];
    if (!offer || offer.active || !Platform.rewardedAvailable) return;
    UI.openAdOffer({
      emoji: id === 'gift' || id === 'park' ? '🎁' : id === 'boost' ? '🍬' : id === 'sprint' ? '⚡' : id === 'jump' ? '⬆' : id === 'power' ? '⚔️' : '❤️',
      title: offer.title, desc: offer.desc, note: 'Награда выдаётся за одну досмотренную рекламу.',
      onCancel: UI.openRewards,
      onConfirm: function () {
        Platform.showRewarded('bonus-' + id, function () {
          Game.applyReward(id); GameAudio.reward(); saveNow();
          Game.setPaused('user', false); syncGameplay(); UI.showScreen(null);
          UI.toast(offer.title + ' ready!'); Input.focus();
        }, function () { UI.toast(I18N.t('adFail')); UI.openRewards(); });
      }
    });
  };

  // Туториал
  function finishTutorial() {
    tutorialSeen = true;
    if (!Platform.isPlayables) Store.set('tutSeen', true);
    Game.setPaused('user', false);
    syncGameplay();
    UI.showScreen(null);
    Input.focus();
    firstInteraction();
    saveNow();
  }
  bind('btn-tut-play', finishTutorial);
  bind('btn-tut-desktop', function () { UI.openTutorial(false); });
  bind('btn-tut-mobile', function () { UI.openTutorial(true); });
  bind('btn-controls', function () { UI.openTutorial(Platform.isMobile() || navigator.maxTouchPoints > 0); });
  // Registered before Input.init: the same first movement key starts the tutorial
  // and reaches the normal movement handler, avoiding a lost input after reload.
  document.addEventListener('keydown', function (event) {
    if (!gameInitialized || Platform.platformPaused || event.repeat || $('screen-tutorial').classList.contains('hidden')) return;
    if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Space|Enter)$/.test(event.code)) finishTutorial();
  }, true);

  Game.onSave = function (saveObj) {
    if (gameInitialized) persist(saveObj, false);
  };

  /* --- Ресайз (в т.ч. мобильные: адресная строка, поворот экрана) --- */
  function doResize() { if (!Platform.platformPaused) Game.resize(); }
  window.addEventListener('resize', doResize);
  window.addEventListener('orientationchange', function () {
    setTimeout(doResize, 60);
    setTimeout(doResize, 300);   // после анимации поворота
    setTimeout(doResize, 700);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', doResize);
    window.visualViewport.addEventListener('scroll', doResize);
  }
  // страховка от «съехавшего» вьюпорта при сворачивании панелей браузера
  window.addEventListener('pageshow', doResize);

  /* --- Загрузка: без меню, сразу в игру --- */

  UI.setLoadProgress(0.15);
  I18N.setLang('en');
  UI.applyI18n();

  var musicStarted = false;
  function firstInteraction() {
    if (Platform.platformPaused || (gameInitialized && Game.paused)) return;
    GameAudio.unlock();
    if (!musicStarted) { musicStarted = true; GameAudio.startMusic(); }
  }
  window.addEventListener('pointerdown', firstInteraction);
  window.addEventListener('keydown', firstInteraction);

  function whileActive() {
    if (!Platform.platformPaused) return Promise.resolve();
    return new Promise(function (resolve) { resumeBoot.push(resolve); });
  }
  function showLoadError() {
    bootInProgress = false;
    UI.showScreen('screen-loading');
    var label = document.querySelector('#screen-loading .loading-label');
    if (label) { label.removeAttribute('data-i18n'); label.textContent = I18N.t('loadError'); }
    var retry = $('btn-load-retry');
    if (!retry) {
      retry = document.createElement('button');
      retry.id = 'btn-load-retry'; retry.type = 'button'; retry.className = 'btn btn-primary';
      retry.addEventListener('click', function () { if (!Platform.platformPaused) boot(); });
      ($('screen-loading').querySelector('.panel') || $('screen-loading')).appendChild(retry);
    }
    retry.textContent = I18N.t('retry'); retry.classList.remove('hidden');
  }
  function boot() {
    if (bootInProgress || gameInitialized) return;
    bootInProgress = true;
    var retry = $('btn-load-retry');
    if (retry) retry.classList.add('hidden');
    var label = document.querySelector('#screen-loading .loading-label');
    if (label) { label.setAttribute('data-i18n', 'loading'); label.textContent = I18N.t('loading'); }
    var platformReady = Platform.init();
    // The loading card is visible before firstFrameReady; all SDK callbacks are already bound.
    Promise.all([platformReady, new Promise(function (resolve) {
      requestAnimationFrame(function announceLoading() {
        if (Platform.platformPaused) {
          whileActive().then(function () { requestAnimationFrame(announceLoading); });
          return;
        }
        Platform.firstFrame(); resolve();
      });
    })]).then(whileActive).then(function () {
      I18N.detect(Platform.getSdkLang(), null); // platform language (en/ru/tr, otherwise English)
      UI.applyI18n();
      if (UI.syncCapabilities) UI.syncCapabilities();
      GameAudio.setMuted(Platform.isPlayablesBuild ? false : Store.get('muted', false));
      UI.setMuteIcons();
      UI.setLoadProgress(0.45);
      return whileActive();
    }).then(function () {
      GameAudio.setKeySampleUrls(['tipe1.mp3', 'tipe2.mp3', 'tipe3.mp3', 'tipe4.mp3']);
      return Platform.loadPlayerData();
    }).then(function (save) {
      return whileActive().then(function () {
        return Promise.all([Game.preloadArt ? Game.preloadArt() : Promise.resolve(), GameAudio.preload ? GameAudio.preload() : Promise.resolve()]);
      }).then(whileActive).then(function () { return save; });
    }).then(function (save) {
      UI.setLoadProgress(0.85);
      tutorialSeen = !!(save && save.tutorialVersion === 1 && save.tutorialSeen);
      Input.init({ joyZone: $('joy-zone'), joyBase: $('joy-base'), joyKnob: $('joy-knob'),
        jumpBtn: $('btn-jump'), attackBtn: $('btn-attack'), lookTarget: $('game-canvas') });
      Game.init($('game-canvas'), save);
      gameInitialized = true;
      Game.resize();
      var touchControlsEnabled = Platform.isMobile() || navigator.maxTouchPoints > 0;
      // The pad and action buttons are pointer controls for mouse as well as touch.
      $('touch-controls').classList.remove('hidden');
      UI.setLoadProgress(1);
      UI.showScreen(null);
      UI.updateCoins(Game.coins); UI.updateRoom(Game.room, true); UI.updateHp(Game.hp, Game.maxHp); UI.updateBoost(Game.boostLeft || 0);
      if (UI.refreshDaily) UI.refreshDaily();
      if (!tutorialSeen) { Game.setPaused('user', true); UI.openTutorial(touchControlsEnabled); }
      else UI.showHint(touchControlsEnabled);
      Input.focus();
      syncGameplay();
      if (Platform.isPlayables && Platform.audioEnabled) firstInteraction();
      Platform.gameReady();
      saveNow();
      bootInProgress = false;
    }).catch(function (error) {
      console.error('Game initialization failed:', error);
      whileActive().then(showLoadError);
    });
  }
  boot();
})();

