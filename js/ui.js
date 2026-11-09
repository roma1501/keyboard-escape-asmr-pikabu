/* ===== UI: HUD, vendor panel, death/pause screens ===== */
'use strict';

var UI = (function () {
  var $ = function (id) { return document.getElementById(id); };

  var screens = ['screen-loading', 'screen-pause', 'screen-death', 'screen-shop', 'screen-bonus', 'screen-daily', 'screen-tutorial', 'screen-vid-offer'];
  var reviveBlocked = false;
  var noticeTimers = {}, noticesPaused = false;
  var currentVendor = null;
  var shopCategory = 'skins';
  var parkPromptData = null;

  // Колбэки, назначаются в main.js
  var handlers = {
    onBuyUpgrade: null,   // (id)
    onBuyPet: null,       // (petId)
    onEquipPet: null,     // (petId)
    onGift: null,         // ()
    onBuySkin: null,      // (skinId)
    onEquipSkin: null,    // (skinId)
    onWatchSkin: null,
    onReward: null,
    onBuyCollection: null, onWatchCollection: null, onEquipCollection: null,
    onOpenCollection: null, onUseEmote: null, onWatchPurchase: null
  };

  var EMOJI_ICONS = {
    '🍬': 'candy', '❤️': 'heart', '👕': 'wardrobe', '⏸': 'pause',
    '🚪': 'home', '🏠': 'home', '⬆️': 'jump', '⬆': 'jump', '🐇': 'jump',
    '⚔️': 'attack', '🔊': 'speaker', '⚡': 'sprint', '👟': 'sprint',
    '💰': 'candy', '🎁': 'gift', '🏆': 'trophy', '🐾': 'paw'
  };

  function iconHtml(name) {
    return '<span class="game-icon icon-' + name + '" aria-hidden="true"></span>';
  }

  function setIcon(el, name) {
    el.textContent = '';
    el.className = 'game-icon icon-' + name;
    el.setAttribute('aria-hidden', 'true');
  }

  function rewardsAvailable() {
    return !!Platform.rewardedAvailable;
  }

  function syncCapabilities() {
    $('btn-lang').classList.add('hidden');
    $('btn-boost').classList.toggle('hidden', !rewardsAvailable() || !!Game.inPark);
    $('btn-revive').classList.toggle('hidden', !rewardsAvailable() || reviveBlocked);
    $('btn-gifts').classList.remove('hidden');
  }

  // Host pause freezes the remaining lifetime of every transient UI notice.
  function scheduleNotice(id, duration) {
    var previous = noticeTimers[id];
    if (previous && previous.timer !== null) clearTimeout(previous.timer);
    var notice = { timer: null, remaining: duration, until: 0 };
    noticeTimers[id] = notice;
    if (!noticesPaused) resumeNotice(id, notice);
  }

  function resumeNotice(id, notice) {
    notice.until = performance.now() + notice.remaining;
    notice.timer = setTimeout(function () {
      $(id).classList.add('hidden');
      delete noticeTimers[id];
    }, notice.remaining);
  }

  function setPlatformPaused(on) {
    on = !!on;
    var overlay = $('platform-pause-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden', !on);
      overlay.setAttribute('aria-hidden', String(!on));
      if (on && !noticesPaused) {
        overlay._resumeFocus = document.activeElement;
        overlay.focus({ preventScroll: true });
      } else if (!on && noticesPaused) {
        var previousFocus = overlay._resumeFocus;
        overlay._resumeFocus = null;
        if (previousFocus && previousFocus.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true });
      }
    }
    if (on === noticesPaused) return;
    noticesPaused = on;
    Object.keys(noticeTimers).forEach(function (id) {
      var notice = noticeTimers[id];
      if (on) {
        clearTimeout(notice.timer);
        notice.timer = null;
        notice.remaining = Math.max(0, notice.until - performance.now());
      } else resumeNotice(id, notice);
    });
  }

  function showScreen(name) {
    for (var i = 0; i < screens.length; i++) {
      $(screens[i]).classList.toggle('hidden', screens[i] !== name);
    }
    $('hud').classList.toggle('hidden', name !== null);
    $('game-root').setAttribute('data-screen', name || 'play');
    if (name) {
      var panel = $(name).querySelector('.panel');
      if (panel) panel.scrollTop = 0;
    }
    if (name && typeof Input !== 'undefined') Input.reset();
    if (!name && currentVendor === 'gift') refreshVendorButtons();
  }

  function applyI18n() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = I18N.t(nodes[i].getAttribute('data-i18n'));
    }
    $('lang-name').textContent = I18N.t('langName');
    document.documentElement.lang = I18N.lang;
    document.title = 'Сладкий побег по клавиатуре';
    syncCapabilities();
    updateRoom(Game.room ? Game.room : 1, Game.inHub);
    if (currentVendor) renderVendor(currentVendor);
  }

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    scheduleNotice('toast', 2200);
  }

  function banner(text) {
    var el = $('room-flash');
    el.textContent = text;
    el.classList.remove('hidden');
    scheduleNotice('room-flash', 2000);
  }

  function setMuteIcons() {
    ['btn-mute', 'btn-mute-menu'].forEach(function (id) {
      $(id).innerHTML = iconHtml('speaker');
      $(id).setAttribute('aria-label', GameAudio.muted ? 'Включить звук' : 'Выключить звук');
      $(id).setAttribute('aria-pressed', String(GameAudio.muted));
    });
  }

  /* --- HUD --- */

  function updateCoins(coins) {
    if ($('shop-coins')) $('shop-coins').textContent = coins.toLocaleString('en-US');
    $('hud-coins').textContent = coins >= 1000000 ? (coins / 1000000).toFixed(1).replace(/\.0$/, '') + 'm' : coins >= 100000 ? (coins / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : coins.toLocaleString('en-US');
    $('hud-coins').parentElement.setAttribute('aria-label', coins + ' candies');
    // не пересобираем панель вендора (иначе кнопки пересоздаются и клик теряется),
    // а только обновляем доступность существующих кнопок
    if (currentVendor) refreshVendorButtons();
    refreshParkButtons();
  }

  // Обновить только состояние (вкл/выкл) кнопок вендора без пересборки DOM
  function refreshVendorButtons() {
    if (!currentVendor) return;
    var st = Game.getVendorState(currentVendor);
    if (!st) return;
    var btns = $('vendor-body').querySelectorAll('.vendor-buy');
    if (st.kind === 'upgrade') {
      if (btns[0]) btns[0].disabled = (st.price === null || !st.afford);
      var ad = $('vendor-body').querySelector('.purchase-vid');
      if (ad) ad.classList.toggle('hidden', st.price === null || st.afford);
    } else if (st.kind === 'pets') {
      if (btns[0]) btns[0].disabled = false;
    } else if (st.kind === 'gift') {
      var info = $('vendor-body').querySelector('.vendor-row-info');
      if (info) info.innerHTML = giftProgressHtml();
    }
  }

  function updateRoom(room, inHub) {
    $('hud-room').textContent = inHub ? I18N.t('hub') : I18N.t('room', { n: room });
  }

  // Режим парка: скрыть obby-элементы HUD, показать кнопку выхода
  function setParkMode(on) {
    if (on) hideVendor();
    $('btn-boost').classList.toggle('hidden', on || !rewardsAvailable());
    $('hud-hearts').classList.toggle('hidden', on);
    $('btn-park-exit').classList.toggle('hidden', !on);
    if (!on) $('park-prompt').classList.add('hidden');
  }

  function updateParkStats(built, pop) {
    $('hud-room').textContent = built + '/15 · ' + pop;
  }

  function showParkPrompt(data) {
    var el = $('park-prompt');
    parkPromptData = data;
    if (!data) { el.classList.add('hidden'); return; }
    setIcon($('park-prompt-emoji'), 'gift');
    $('park-prompt-name').textContent = data.name;
    $('park-prompt-cost').innerHTML = iconHtml('candy') + data.cost;
    var actions = $('park-purchase-actions');
    if (!actions) {
      actions = document.createElement('div'); actions.id = 'park-purchase-actions'; actions.className = 'purchase-actions';
      actions.appendChild($('btn-park-build'));
      var ad = purchaseVideoButton('park', data.idx); ad.id = 'btn-park-purchase-vid'; actions.appendChild(ad);
      el.appendChild(actions);
    }
    $('btn-park-purchase-vid').dataset.purchaseId = String(data.idx);
    refreshParkButtons();
    el.classList.remove('hidden');
  }

  function refreshParkButtons() {
    if (!parkPromptData) return;
    var insufficient = Game.coins < parkPromptData.cost;
    $('btn-park-build').disabled = insufficient;
    var ad = $('btn-park-purchase-vid');
    if (ad) ad.classList.toggle('hidden', !insufficient);
  }

  function purchaseVideoButton(kind, id) {
    var button = document.createElement('button'), available = rewardsAvailable();
    button.className = 'vendor-buy vendor-vid purchase-vid';
    button.dataset.purchaseKind = kind; button.dataset.purchaseId = String(id);
    button.innerHTML = available ? '<span class="vid-tag">📺 Реклама</span> Смотреть' : 'Видео недоступны';
    button.disabled = !available;
    button.setAttribute('aria-label', available ? 'Посмотреть рекламу ради покупки' : 'Видео за награду недоступны');
    button.addEventListener('click', function () {
      GameAudio.unlock();
      if (rewardsAvailable() && handlers.onWatchPurchase) handlers.onWatchPurchase(kind, button.dataset.purchaseId);
    });
    return button;
  }

  function updateHp(hp, maxHp) {
    var el = $('hud-hearts');
    el.innerHTML = '';
    el.setAttribute('aria-label', hp + ' of ' + maxHp + ' health');
    if (maxHp > 7) {
      // компактный вид при большом запасе HP
      var heart = document.createElement('span');
      heart.className = 'game-icon icon-heart';
      heart.setAttribute('aria-hidden', 'true');
      el.appendChild(heart);
      var lbl = document.createElement('span');
      lbl.className = 'health-count';
      lbl.textContent = ' ' + hp + '/' + maxHp;
      el.appendChild(lbl);
      return;
    }
    for (var i = 0; i < maxHp; i++) {
      var s = document.createElement('span');
      s.className = 'game-icon icon-heart' + (i >= hp ? ' heart-empty' : '');
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
    }
  }

  function updateBoost(sec) {
    var btn = $('btn-boost');
    if (sec > 0) {
      btn.classList.add('boost-active');
      $('boost-label').textContent = 'x2 ' + sec + 's';
      btn.disabled = true;
    } else {
      btn.classList.remove('boost-active');
      $('boost-label').textContent = I18N.t('x2Btn');
      btn.disabled = false;
    }
  }

  function showHint(isMobile) {
    var el = $('hint');
    el.textContent = I18N.t(isMobile ? 'hintMobile' : 'hintDesktop');
    el.classList.remove('hidden');
    scheduleNotice('hint', 5000);
  }

  /* --- Панель вендора --- */

  function vendorRow(emoji, infoHtml, btnLabel, btnClass, disabled, onClick) {
    var row = document.createElement('div');
    row.className = 'vendor-row';

    var em = document.createElement('span');
    em.className = 'vendor-row-emoji';
    em.innerHTML = iconHtml(EMOJI_ICONS[emoji] || 'paw');
    row.appendChild(em);

    var info = document.createElement('div');
    info.className = 'vendor-row-info';
    info.innerHTML = infoHtml;
    row.appendChild(info);

    var btn = document.createElement('button');
    btn.className = 'vendor-buy' + (btnClass ? ' ' + btnClass : '');
    btn.innerHTML = btnLabel;
    btn.disabled = !!disabled;
    if (onClick) btn.addEventListener('click', function () { GameAudio.unlock(); onClick(); });
    row.appendChild(btn);

    return row;
  }

  function giftProgressHtml() {
    var daily = Game.getDailyGifts();
    var status = daily.completed ? 'Все подарки собраны' : daily.available ? 'Сегодняшний подарок готов' : 'Следующий подарок — завтра';
    return '<b>' + daily.claimed + '/7 подарков собрано</b>' + status;
  }

  function renderVendor(id) {
    var st = Game.getVendorState(id);
    if (!st) return;
    currentVendor = id;

    var meta = {
      speed: { emoji: '👟', title: 'vSpeed', desc: 'vSpeedDesc' },
      jump: { emoji: '🐇', title: 'vJump', desc: 'vJumpDesc' },
      income: { emoji: '💰', title: 'vIncome', desc: 'vIncomeDesc' },
      attack: { emoji: '⚔️', title: 'vAttack', desc: 'vAttackDesc' },
      hp: { emoji: '❤️', title: 'vHp', desc: 'vHpDesc' },
      pets: { emoji: '🐾', title: 'vPets', desc: 'vPetsDesc' },
      gift: { emoji: '🎁', title: 'vGift', desc: 'vGiftDesc' }
    }[id];

    setIcon($('vendor-icon'), EMOJI_ICONS[meta.emoji] || 'gift');
    $('vendor-title').textContent = I18N.t(meta.title);
    $('vendor-desc').textContent = I18N.t(meta.desc);
    if (st.kind === 'gift') {
      $('vendor-title').textContent = 'Ежедневные подарки';
      $('vendor-desc').textContent = 'Бесплатные сюрпризы каждый день и особый наряд на 7-й день.';
    }

    var body = $('vendor-body');
    body.innerHTML = '';

    if (st.kind === 'upgrade') {
      var info = '<b>' + I18N.t('level', { n: st.level }) + (st.price === null ? ' · ' + I18N.t('max') : '') + '</b>';
      if (st.price !== null) info += '<span class="price">' + iconHtml('candy') + st.price + '</span>';
      var upgradeRow = vendorRow(
        meta.emoji, info,
        st.price === null ? I18N.t('max') : I18N.t('buy'),
        null,
        st.price === null || !st.afford,
        function () { if (handlers.onBuyUpgrade) handlers.onBuyUpgrade(id); }
      );
      if (st.price !== null) {
        var actions = document.createElement('div'); actions.className = 'purchase-actions';
        actions.appendChild(upgradeRow.lastElementChild);
        var ad = purchaseVideoButton('upgrade', id); ad.classList.toggle('hidden', st.afford); actions.appendChild(ad);
        upgradeRow.appendChild(actions);
      }
      body.appendChild(upgradeRow);
    } else if (st.kind === 'pets') {
      body.appendChild(vendorRow('🐾', '<b>Коллекция питомцев</b>Познакомься со всеми и выбери спутника.',
        'Питомцы', null, false, function () { if (handlers.onOpenCollection) handlers.onOpenCollection('pets'); }));
    } else if (st.kind === 'gift') {
      body.appendChild(vendorRow(
        '🎁', giftProgressHtml(),
        'Открыть подарки', null, false,
        function () { if (handlers.onGift) handlers.onGift(); }
      ));
    }

    $('vendor-panel').classList.remove('hidden');
  }

  function hideVendor() {
    currentVendor = null;
    $('vendor-panel').classList.add('hidden');
  }

  /* --- Смерть --- */

  function showDeath(reason, canRevive) {
    var keys = { fall: 'diedFall', spike: 'diedSpike', monster: 'diedMonster', crush: 'diedCrush', combat: 'diedCombat' };
    $('death-title').textContent = I18N.t(keys[reason] || 'diedFall');
    $('death-coins').textContent = Game.coins;
    reviveBlocked = canRevive === false;
    $('btn-revive').classList.toggle('hidden', !rewardsAvailable() || reviveBlocked);
    $('btn-revive').disabled = false;
    showScreen('screen-death');
  }

  /* --- Модальное окно с предложением награды за рекламу ---
   * Требования платформы: реклама вызывается действием в модальном окне (п.4.4),
   * а награда описана явно и однозначно (п.4.5.1).
   */

  var adOfferConfirm = null, adOfferCancel = null;

  function openAdOffer(opts) {
    $('vid-offer-title').textContent = opts.title;
    setIcon($('vid-offer-emoji'), EMOJI_ICONS[opts.emoji] || 'gift');
    $('vid-offer-desc').textContent = opts.desc;
    var note = $('vid-offer-note');
    note.textContent = opts.note || '';
    note.classList.toggle('hidden', !opts.note);
    adOfferConfirm = opts.onConfirm || null;
    adOfferCancel = opts.onCancel || null;
    showScreen('screen-vid-offer');
  }

  function confirmAdOffer() {
    var cb = adOfferConfirm;
    adOfferConfirm = null; adOfferCancel = null;
    if (cb) cb();
  }

  // Возвращает true, если владелец окна сам обработал закрытие
  function cancelAdOffer() {
    var cb = adOfferCancel;
    adOfferConfirm = null; adOfferCancel = null;
    if (cb) { cb(); return true; }
    return false;
  }

  /* --- Магазин скинов --- */

  function renderShop() {
    var list = $('shop-list');
    list.innerHTML = '';
    var skins = Game.getCollection ? Game.getCollection(shopCategory) : Game.getSkins();
    var canWatch = rewardsAvailable();
    var shopSub = document.querySelector('#screen-shop .shop-sub');
    var titles = { skins: 'Наряды', trails: 'Студия следов', pets: 'Уголок питомцев', emotes: 'Клуб эмоций' };
    document.querySelector('#screen-shop h2').textContent = titles[shopCategory];
    var adCount = skins.filter(function (entry) { return entry.unlockType === 'ad'; }).length;
    shopSub.textContent = skins.length + ' всего · ' + adCount + ' за рекламу · ' + (skins.length - adCount) + (shopCategory === 'skins' ? ' за конфеты и стартовые' : ' за конфеты');
    $('shop-coins').textContent = Game.coins.toLocaleString('en-US');
    $('shop-owned').textContent = skins.filter(function (entry) { return entry.owned; }).length + '/' + skins.length + ' получено';
    $('btn-shop-remove').classList.toggle('hidden', shopCategory === 'skins' || !skins.some(function (entry) { return entry.active; }));
    $('btn-shop-remove').textContent = shopCategory === 'trails' ? 'Без следа' : shopCategory === 'pets' ? 'Отпустить питомца' : 'Без эмоции';
    document.querySelectorAll('[data-shop]').forEach(function (tab) { tab.setAttribute('aria-pressed', String(tab.dataset.shop === shopCategory)); });
    for (var i = 0; i < skins.length; i++) {
      (function (sk) {
        var name = sk.name || I18N.t(sk.nameKey);
        var row = document.createElement('div');
        row.className = 'shop-row skin-' + (sk.aura || 'none');

        var icon = document.createElement('img');
        icon.className = 'skin-preview';
        icon.src = sk.preview;
        icon.alt = name;
        icon.width = 256; icon.height = 320; icon.loading = 'lazy'; icon.decoding = 'async';
        row.appendChild(icon);

        var info = document.createElement('div');
        info.className = 'shop-info';
        var sub = sk.desc ? '<span class="collection-desc">' + sk.desc + '</span>' : sk.aura ? '<span class="shop-aura">' + I18N.t('auraLabel') + '</span>' : '';
        if (!sk.owned && sk.unlockType === 'ad') {
          // полоса прогресса просмотренных роликов
          var pct = Math.round(sk.adsDone / sk.adsNeed * 100);
          sub += '<span class="shop-prog"><i style="width:' + pct + '%"></i></span>' +
                 '<span class="shop-prog-txt">' + sk.adsDone + ' / ' + sk.adsNeed + ' видео</span>';
        }
        info.innerHTML = '<b>' + name + '</b>' + sub;
        row.appendChild(info);

        var btn = document.createElement('button');
        btn.className = 'vendor-buy';
        if (sk.owned && shopCategory === 'emotes') {
          btn.textContent = sk.active ? 'Play · B' : 'Choose & play';
          btn.addEventListener('click', function () { GameAudio.unlock(); if (handlers.onUseEmote) handlers.onUseEmote(sk.id); });
        } else if (sk.active) {
          btn.textContent = I18N.t('equipped'); btn.className += ' vendor-equipped'; btn.disabled = true;
        } else if (sk.owned) {
          btn.textContent = I18N.t('equip');
          btn.addEventListener('click', function () { GameAudio.unlock(); if (handlers.onEquipCollection) handlers.onEquipCollection(shopCategory, sk.id); });
        } else if (typeof sk.price === 'number') {
          btn.innerHTML = iconHtml('candy') + sk.price;
          btn.setAttribute('aria-label', 'Buy ' + name + ' for ' + sk.price + ' candies');
          btn.disabled = !sk.afford;
          btn.addEventListener('click', function () { GameAudio.unlock(); if (handlers.onBuyCollection) handlers.onBuyCollection(shopCategory, sk.id); });
        } else {
          btn.textContent = 'Реклама недоступна';
          btn.disabled = true;
        }
        if (sk.owned || sk.unlockType !== 'ad' || !canWatch) row.appendChild(btn);
        if (!sk.owned && sk.unlockType === 'candies' && !sk.afford) row.appendChild(purchaseVideoButton(shopCategory, sk.id));
        if (!sk.owned && sk.unlockType === 'ad' && canWatch) {
          var ad = document.createElement('button');
          ad.className = 'vendor-buy vendor-vid';
          ad.innerHTML = '<span class="vid-tag">📺 Реклама</span> Смотреть ради +1';
          ad.setAttribute('aria-label', 'Посмотреть рекламу ради: ' + name);
          ad.addEventListener('click', function () { GameAudio.unlock(); if (handlers.onWatchCollection) handlers.onWatchCollection(shopCategory, sk.id); });
          row.appendChild(ad);
        }
        list.appendChild(row);
      })(skins[i]);
    }
  }

  function openShop(type) {
    if (['skins', 'trails', 'pets', 'emotes'].indexOf(type) >= 0) shopCategory = type;
    renderShop();
    showScreen('screen-shop');
  }

  function openRewards() {
    var list = $('bonus-list'); list.innerHTML = '';
    $('bonus-sub').textContent = rewardsAvailable() ? 'Выбери награду и посмотри рекламу, чтобы её получить.' : 'Видео за награду сейчас недоступны. Попробуй позже.';
    Game.getRewardOffers().forEach(function (offer) {
      var row = document.createElement('div'); row.className = 'bonus-row';
      row.innerHTML = iconHtml(offer.icon) + '<div class="bonus-info"><b>' + offer.title + '</b><p>' + offer.desc + '</p></div>';
      var button = document.createElement('button'); button.className = 'vendor-buy vendor-vid';
      button.innerHTML = offer.active ? (offer.id === 'heal' ? 'Полное' : offer.id === 'park' && Game.parkPopularity <= 0 ? 'Построй аттракцион' : 'Действует · ' + offer.remaining + ' с') : '<span class="vid-tag">📺 Реклама</span> Получить';
      if (!offer.active && !rewardsAvailable()) button.textContent = 'Недоступно';
      button.disabled = offer.active || !rewardsAvailable();
      button.setAttribute('aria-label', 'Посмотреть рекламу: ' + offer.title);
      button.addEventListener('click', function () { GameAudio.unlock(); if (handlers.onReward) handlers.onReward(offer.id); });
      row.appendChild(button); list.appendChild(row);
    });
    showScreen('screen-bonus');
  }

  var dailyFingerprint = '';
  function dailyTime(ms) {
    var minutes = Math.max(1, Math.ceil(ms / 60000));
    return Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
  }
  function renderDaily() {
    var status = Game.getDailyGifts(), skin = Game.getDailySkin();
    var list = $('daily-days'); list.textContent = '';
    status.rewards.slice(0, 6).forEach(function (reward) {
      var collected = reward.day <= status.claimed;
      var ready = reward.day === status.claimed + 1 && status.available;
      var card = document.createElement('div');
      card.className = 'daily-card' + (collected ? ' collected' : ready ? ' ready' : '');
      card.innerHTML = '<span class="daily-day-label">ДЕНЬ ' + reward.day + '</span>' + iconHtml('candy') + '<b>' + reward.amount + '</b><span class="daily-card-state">' + (collected ? 'Получено' : ready ? 'Готово!' : 'Скоро') + '</span>';
      list.appendChild(card);
    });
    $('daily-progress-label').textContent = status.claimed + ' / 7 collected';
    $('daily-progress-fill').style.width = status.claimed / 7 * 100 + '%';
    $('daily-finale').classList.toggle('collected', skin.owned);
    $('daily-finale').classList.toggle('ready', status.available && status.claimed === 6);
    $('daily-skin-state').textContent = skin.owned ? 'Твой навсегда' : status.available && status.claimed === 6 ? 'Можно открыть!' : 'Открывается на 7-й день';
    $('btn-daily-equip').classList.toggle('hidden', !skin.owned);
    $('btn-daily-equip').disabled = skin.active;
    $('btn-daily-equip').textContent = skin.active ? 'Эксклюзивный наряд надет' : 'Надеть эксклюзивный наряд';
    dailyFingerprint = [status.claimed, status.available, skin.owned, skin.active].join(':');
    updateDailyText(status);
  }
  function updateDailyText(status) {
    var claim = $('btn-daily-claim');
    claim.classList.toggle('hidden', status.completed);
    claim.disabled = !status.available;
    claim.textContent = status.available ? (status.claimed === 6 ? 'Забрать эксклюзивный наряд' : 'Забрать день ' + (status.claimed + 1) + ' · ' + status.rewards[status.claimed].amount + ' конфет') : 'Сегодняшний подарок получен';
    var message = status.completed ? 'Все семь подарков собраны. Наслаждайся эксклюзивным нарядом!' : status.available ? 'Подарок дня ' + (status.claimed + 1) + ' готов, без рекламы.' : 'Следующий подарок через ' + dailyTime(status.nextAt - Date.now());
    if ($('daily-status').textContent !== message) $('daily-status').textContent = message;
  }
  function refreshDaily() {
    var status = Game.getDailyGifts();
    $('btn-gifts').classList.toggle('daily-ready', status.available);
    $('btn-gifts').setAttribute('aria-label', status.available ? 'Подарок дня готов. Открыть подарки и бонусы' : 'Ежедневные подарки и бонусы');
    if (!$('screen-daily').classList.contains('hidden')) {
      var skin = Game.getDailySkin();
      if (dailyFingerprint !== [status.claimed, status.available, skin.owned, skin.active].join(':')) renderDaily();
      else updateDailyText(status);
    }
  }
  function openDaily() { renderDaily(); showScreen('screen-daily'); }

  /* --- Туториал управления --- */

  function openTutorial(isMobile) {
    var cards = isMobile ? [
      { icon: 'Джойстик', text: 'Движение: веди джойстик внизу слева.' },
      { icon: iconHtml('jump'), text: 'Прыжок: нажми стрелку внизу справа.' },
      { icon: 'Свайп', text: 'Камера: проведи по свободной части экрана.' },
      { icon: iconHtml('attack'), text: 'Атака: нажми на скрещённые мечи.' },
      { icon: iconHtml('gift'), text: 'Купить / построить: подойди к прилавку или участку парка и нажми кнопку.' },
      { icon: iconHtml('trophy'), text: 'Эмоция: нажми маленький кубок рядом с прыжком. Сначала выбери её в магазине.' }
    ] : [
      { icon: 'WASD', text: 'Движение — WASD или стрелки.' },
      { icon: 'Пробел', text: 'Прыжок — пробел. Атака — F или J.' },
      { icon: 'Мышь', text: 'Только мышью: зажми левую кнопку и веди джойстик внизу слева.' },
      { icon: 'R / M', text: 'Во время движения: правая кнопка — прыжок, средняя — атака.' },
      { icon: 'Мышь', text: 'Камера: веди по свободной части экрана, колесо — приближение.' },
      { icon: 'E / P', text: 'E — купить или построить рядом. P или Esc — пауза. B — выбранная эмоция.' }
    ];
    $('btn-tut-desktop').setAttribute('aria-pressed', String(!isMobile));
    $('btn-tut-mobile').setAttribute('aria-pressed', String(isMobile));
    $('tut-start-note').textContent = isMobile ? 'Нажми «Играть!», чтобы начать. Управление всегда есть в меню паузы.' : 'Нажми клавишу движения или «Играть!», чтобы начать. Подсказки управления есть в меню паузы.';
    var wrap = $('tut-cards');
    wrap.innerHTML = '';
    for (var i = 0; i < cards.length; i++) {
      var c = document.createElement('div');
      c.className = 'tut-card';
      c.innerHTML = '<div class="tut-key">' + cards[i].icon + '</div><div class="tut-text">' + cards[i].text + '</div>';
      wrap.appendChild(c);
    }
    showScreen('screen-tutorial');
  }

  function setLoadProgress(p) {
    $('loader-fill').style.width = Math.round(p * 100) + '%';
  }

  return {
    $: $,
    handlers: handlers,
    get currentVendor() { return currentVendor; },
    get currentShop() { return shopCategory; },
    showScreen: showScreen,
    applyI18n: applyI18n,
    syncCapabilities: syncCapabilities,
    setPlatformPaused: setPlatformPaused,
    toast: toast,
    banner: banner,
    setMuteIcons: setMuteIcons,
    updateCoins: updateCoins,
    updateRoom: updateRoom,
    updateHp: updateHp,
    setParkMode: setParkMode,
    updateParkStats: updateParkStats,
    showParkPrompt: showParkPrompt,
    openShop: openShop,
    openRewards: openRewards,
    openDaily: openDaily,
    renderDaily: renderDaily,
    refreshDaily: refreshDaily,
    renderShop: renderShop,
    openTutorial: openTutorial,
    openAdOffer: openAdOffer,
    confirmAdOffer: confirmAdOffer,
    cancelAdOffer: cancelAdOffer,
    updateBoost: updateBoost,
    showHint: showHint,
    renderVendor: renderVendor,
    hideVendor: hideVendor,
    showDeath: showDeath,
    setLoadProgress: setLoadProgress
  };
})();
