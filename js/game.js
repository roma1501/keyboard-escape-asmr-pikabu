/* ===== Игра: обби-режим в стиле Roblox на Three.js =====
 * Третье лицо со свободной орбитальной камерой, движение относительно камеры.
 * Большой хаб с фонтаном и вендорами -> большие комнаты-испытания
 * (озеро с мостами, сад шипов, аллея поршней, паркур, арена монстров).
 * Все персонажи — процедурные «роблоксовские» блочные модели с лицами.
 */
'use strict';

// Keep numeric art colors and canvas textures in the same sRGB color pipeline.
THREE.ColorManagement.legacyMode = false;

var Game = (function () {

  /* --- Константы поля --- */
  var LANES = 20;             // клавиш в ряду (широкий уровень)
  var FIELD_HALF = 10;
  var KEY_H = 0.34;
  var VISIBLE = 56;
  var HUB_LEN = 24;           // большой хаб
  var GRAVITY = 22;
  var PLAYER_CLAMP = 9.45;
  var CANDY_POOL = 14;
  var PARTICLE_POOL = 26;
  var SPIKE_POOL = 140;
  var PISTON_POOL = 12;
  var MONSTER_POOL = 14;
  var RUNNER_BOTS = 5;
  var HUB_BOTS = 3;

  var UP_MAX = 10;
  var PETS = {
    bear: { name: 'Cocoa Cub', mult: 2, price: 300, ads: 0, emoji: '🧸', nameKey: 'petBear' },
    cat: { name: 'Caramel Cat', mult: 3, price: 1500, ads: 0, emoji: '🐱', nameKey: 'petCat' },
    dragon: { name: 'Gummy Dragon', mult: 5, price: 6000, ads: 0, emoji: '🐲', nameKey: 'petDragon' },
    bunny: { name: 'Marshmallow Bunny', mult: 2, price: null, ads: 1, emoji: '🐰', nameKey: 'petBunny' },
    fox: { name: 'Toffee Fox', mult: 3, price: null, ads: 3, emoji: '🦊', nameKey: 'petFox' },
    owl: { name: 'Moonberry Owl', mult: 5, price: null, ads: 5, emoji: '🦉', nameKey: 'petOwl' }
  };
  var PET_ORDER = ['bear', 'cat', 'dragon', 'bunny', 'fox', 'owl'];

  var VENDORS = [
    { id: 'speed', emoji: '👟', x: -8, z: 6, color: 0x6fd44d },
    { id: 'jump', emoji: '🐇', x: -8, z: 11, color: 0x5bc8f5 },
    { id: 'income', emoji: '💰', x: -8, z: 16, color: 0xffd23f },
    { id: 'attack', emoji: '⚔️', x: -8, z: 20.5, color: 0xff8a3d },
    { id: 'pets', emoji: '🐾', x: 8, z: 8.5, color: 0xc589e8 },
    { id: 'gift', emoji: '🎁', x: 8, z: 13.5, color: 0xff6b9d },
    { id: 'hp', emoji: '❤️', x: 8, z: 18.5, color: 0xff5a6e }
  ];

  /* --- Палитры --- */
  var HUB_COLORS = [0xe8a0b8, 0xd9a05e, 0xe0b27a, 0xf0b8cc, 0xc98a4b, 0xe8a0b8];
  var HUB_PATH = 0xf078b8; // дорожка к двери
  var KEY_PALETTES = [
    [0xc98a4b, 0xb5713a, 0xa25c2c, 0x8a4a24, 0xd9a05e, 0x7a3e1e, 0xe0b27a, 0xc27947], // шоколад
    [0xe8a0b8, 0xf0c0d0, 0xd98aa8, 0xe0b27a, 0xf0b8cc, 0xc98a8a, 0xe8b0c0, 0xd9a05e], // клубника
    [0xa8d9b8, 0x8cc7a0, 0xb8e0c8, 0xd9a05e, 0x9fd9b3, 0x7cb890, 0xc8e8d0, 0xb5713a], // мята
    [0xd9a05e, 0xe0b27a, 0xc98a4b, 0xe8c890, 0xb5713a, 0xf0d0a0, 0xd9b070, 0xc27947]  // карамель
  ];
  var CANDY_COLORS = [0xff4d6d, 0x7ed957, 0x5bc8f5, 0xffd23f, 0xc589e8, 0xff9ecf];
  var SPIKE_TINT = 0xd95555;

  var BOT_NAMES = ['Бонбон', 'Какао', 'Зефирка', 'Прыгун', 'Карамелька',
    'Мармеладка', 'Печенька', 'Леденец', 'Имбирь', 'Сахарок',
    'Турбоулитка', 'Пончик', 'Кексик', 'Ириска', 'Нуга',
    'Корица', 'Вафля', 'Тортик'];
  var BOT_SHIRTS = [0xdd3344, 0x2277dd, 0x22aa55, 0xaa44cc, 0xff8822, 0x17171c, 0x00b8b8, 0xffffff];
  var BOT_PANTS = [0x1b3d24, 0x223366, 0x552211, 0x333333, 0x664488, 0x3fa93f];
  var BOT_SKINS = [0xf3be9e, 0xffd9b3, 0xb87957, 0x89573f];
  var BOT_HAIRS = [0xb5651d, 0x222222, 0xf0d060, 0x883322, 0x5533aa, 0xff7ec1, 0x4fc3f7];
  var BOT_SHOES = [0x2a2a30, 0xffffff, 0xdd3344, 0x2277dd, 0x22aa55, 0x8a5a2a];
  var MONSTER_SCHEMES = [
    { body: 0x4a2410, belly: 0x6b3a1c, horn: 0xfff2e0 }, // тёмный шоколад
    { body: 0xc2325a, belly: 0xe0507a, horn: 0xffe8f0 }, // вишнёвый мармелад
    { body: 0x3f8a52, belly: 0x5cb072, horn: 0xe8ffe0 }, // кислое яблоко
    { body: 0x5a4bc2, belly: 0x7a6be0, horn: 0xe8e0ff }  // черничный
  ];

  var SHADOWS = true;
  var SPARKLE_COUNT = 46;

  function isMobileDevice() {
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || ('ontouchstart' in window);
  }

  /* --- Three.js объекты --- */
  var renderer, scene, camera;
  var keysMesh, lettersMesh, lettersUvAttr, spikesMesh;
  var liquidMesh, deckMesh, wallLMesh, wallRMesh, skyMesh, sunLight, worldScenery;
  var liquidBase = null;
  var sparkles = [];
  var playerGroup, playerChar;
  var petObj = null;
  var candyPool = [], particlePool = [], pistonPool = [], monsterPool = [];
  var arches = [], decorations = [];
  var bots = [];
  var vendorNpcs = [];
  var vendorSprites = {};
  var texPlusCache = {}, faceTexCache = {}, glowTex = null;
  var texBlob;
  var decorShared = null;
  var dummy = new THREE.Object3D();
  var tmpColor = new THREE.Color();

  /* --- Камера (орбитальная, как в Roblox) --- */
  var camYaw = 0, camPitch = 0.52, camDist = 8.5;
  var followX = 0, followY = KEY_H, followZ = 3;

  /* --- Мир --- */
  var rows = new Map();
  var slotRow = new Int32Array(VISIBLE).fill(-99999);
  var triggers = [];
  var doorways = [];          // стены между комнатами: {z}
  var entities = [];
  var activeCandies = [];
  var presses = [];
  var staticColliders = [];   // круглые коллайдеры хаба: {x, z, r}
  var wallColliders = [];     // AABB-стены лабиринтов: {x, z, hw, hd, mesh}
  var crumbling = [];         // тающие клавиши: {r, lane, t}
  var mounds = [];            // приподнятые ярусы-сцены (конусы): {cx, cz, Rb, Rt, top}
  var builtEnd = 0;
  var backWallZ = 0.5;
  var genPath = 9;
  var genPalette = KEY_PALETTES[0];
  var lastBotKeyAt = 0;

  /* --- Игрок --- */
  var px = 0, py = KEY_H, pz = 3;
  var vy = 0, grounded = true, coyoteT = 0;
  var moveVX = 0, moveVZ = 0;
  var yaw = 0;
  var invulnT = 0;
  var lastTileR = -999, lastTileL = -999;
  var lastSafe = { x: 0, z: 3 };
  var safeTimer = 0;
  var respawn = { x: 0, z: 3 };

  /* --- Состояние --- */
  var state = 'play';
  var deathReason = '';
  var deathT = 0;
  var deathNotified = false;
  var pauseReasons = {};
  var pauseCount = 0;
  var lastNow = 0;
  var frameId = 0;
  var nowSec = 0;

  /* --- Экономика / сохранение --- */
  var coins = 0, earned = 0;
  var roomNum = 1;
  var upSpeed = 0, upJump = 0, upIncome = 0, upHp = 0, upAtk = 0;
  var petsOwned = {};
  var petActive = null;
  var petAdProgress = {};
  var boostT = 0;
  var shieldT = 0, sprintT = 0, jumpBoostT = 0, powerT = 0, parkBoostT = 0;
  var saveTimer = 0, saveDirty = false;

  /* --- Скины и ауры (открываются за просмотр рекламы) --- */
  var ownedSkins = { 'default': true };
  var activeSkin = 'default';
  var skinAdProgress = {};   // id -> сколько роликов уже просмотрено
  var playerAura = null;

  /* --- Здоровье и бой --- */
  var hp = 3;
  var attackCd = 0, attackAnimT = 0;
  var arena = { active: false, cleared: false, enemies: [], doorway: null, z0: 0, z1: 0, reward: 0 };
  var pendingArena = null;

  /* --- Парк конфет (tycoon) --- */
  var mode = 'obby';               // 'obby' | 'park'
  var park = null;                 // { group, plots, visitors, exitPortal }
  var parkBuilt = 0;               // сколько аттракционов построено (сохраняется)
  var parkPopularity = 0;
  var parkIncomeAcc = 0;
  var buildQueued = false;         // запрос постройки из UI
  var nearPlot = -1;               // индекс плота рядом (для UI-подсказки)
  var PARK_Z0 = -300, PARK_Y = 0;
  var PARK_INCOME_RATE = 0.18;     // конфет/сек на единицу популярности
  var hubParkGate = { x: 6, z: 4 }; // портал в парк, стоит в хабе

  var api = {
    onCoinsChange: null,
    onRoomEnter: null,
    onRoomComplete: null,
    onDeath: null,
    onVendorNear: null,
    onBoostTick: null,
    onSave: null,
    onHpChange: null,
    onArenaClear: null,
    onModeChange: null,
    onParkStats: null,
    onParkPrompt: null,
    onParkBuild: null
  };
  var nearVendorId = null;

  /* ============ Экономика ============ */

  function petMult() { return petActive && PETS[petActive] ? PETS[petActive].mult : 1; }
  function coinMult() { return petMult() * (boostT > 0 ? 2 : 1); }
  function perKey() { return (1 + upIncome) * coinMult(); }
  function moveSpeed() { return 5.5 * (1 + 0.08 * upSpeed) * (sprintT > 0 ? 1.2 : 1); }
  function jumpV() { return 7.4 * (1 + 0.05 * upJump) * (jumpBoostT > 0 ? 1.12 : 1); }
  function maxHpVal() { return 3 + upHp; }
  function attackPower() { return (1 + upAtk) * (powerT > 0 ? 2 : 1); }
  function upPrice(id, lvl) {
    var base = id === 'speed' ? 40 : id === 'jump' ? 35 : id === 'income' ? 60 : id === 'hp' ? 80 : 70;
    return Math.round(base * Math.pow(1.6, lvl));
  }
  function giftAmount() { return 100 + roomNum * 25; }

  function addCoins(n, atX, atY, atZ) {
    coins += n;
    earned += n;
    if (api.onCoinsChange) api.onCoinsChange(coins);
    if (atX !== undefined) spawnPopup(n, atX, atY, atZ);
    markSave();
  }

  function markSave() { saveDirty = true; }

  function getSave() {
    var list = [];
    for (var p in petsOwned) if (petsOwned[p]) list.push(p);
    return {
      v: 1, coins: coins, earned: earned, room: roomNum,
      upSpeed: upSpeed, upJump: upJump, upIncome: upIncome, upHp: upHp, upAtk: upAtk,
      pets: list, pet: petActive, petAds: petAdProgress, parkBuilt: parkBuilt,
      skin: activeSkin, skins: Object.keys(ownedSkins), skinAds: skinAdProgress,
      bonuses: { boost: boostT, shield: shieldT, sprint: sprintT, jump: jumpBoostT, power: powerT, park: parkBoostT },
      collections: typeof Collections !== 'undefined' ? Collections.save() : null,
      dailyGifts: typeof DailyGifts !== 'undefined' ? DailyGifts.save() : null
    };
  }

  function applySave(s) {
    if (typeof Collections !== 'undefined') Collections.load(s && s.collections);
    if (typeof DailyGifts !== 'undefined') DailyGifts.load(s && s.dailyGifts);
    if (!s) return;
    coins = s.coins | 0;
    earned = s.earned | 0;
    roomNum = Math.max(1, s.room | 0);
    upSpeed = Math.min(UP_MAX, s.upSpeed | 0);
    upJump = Math.min(UP_MAX, s.upJump | 0);
    upIncome = Math.min(UP_MAX, s.upIncome | 0);
    upHp = Math.min(UP_MAX, s.upHp | 0);
    upAtk = Math.min(UP_MAX, s.upAtk | 0);
    parkBuilt = Math.max(0, Math.min(15, s.parkBuilt | 0));
    ownedSkins = { 'default': true };
    if (s.skins) for (var si = 0; si < s.skins.length; si++) ownedSkins[s.skins[si]] = true;
    if (typeof DailyGifts !== 'undefined' && DailyGifts.status().completed) ownedSkins.skin_daily_crown = true;
    activeSkin = (s.skin && ownedSkins[s.skin]) ? s.skin : 'default';
    skinAdProgress = {};
    if (s.skinAds) for (var sk in s.skinAds) skinAdProgress[sk] = s.skinAds[sk] | 0;
    // Lowered 1–5 view requirements honour progress earned in older saves.
    Object.keys(AD_OUTFITS).forEach(function (id) {
      if ((skinAdProgress[id] | 0) >= AD_OUTFITS[id]) ownedSkins[id] = true;
    });
    var bonus = s.bonuses || {};
    function duration(value, cap) { return Math.max(0, Math.min(cap, Number(value) || 0)); }
    boostT = duration(bonus.boost, 90); shieldT = duration(bonus.shield, 60); sprintT = duration(bonus.sprint, 90);
    jumpBoostT = duration(bonus.jump, 60); powerT = duration(bonus.power, 90); parkBoostT = duration(bonus.park, 120);
    petsOwned = {};
    if (Array.isArray(s.pets)) for (var i = 0; i < s.pets.length; i++) if (PETS[s.pets[i]]) petsOwned[s.pets[i]] = true;
    petAdProgress = {};
    PET_ORDER.forEach(function (id) {
      if (!PETS[id].ads) return;
      petAdProgress[id] = Math.max(0, Math.min(PETS[id].ads, (s.petAds && s.petAds[id]) | 0));
      if (petAdProgress[id] >= PETS[id].ads) petsOwned[id] = true;
    });
    petActive = (s.pet && PETS[s.pet] && petsOwned[s.pet]) ? s.pet : null;
  }

  /* ============ Текстуры ============ */

  function colorCanvasTexture(canvas) {
    var texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function makeLetterAtlas() {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '400 62px "Lilita One", "Rubik", sans-serif';
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var i = 0; i < 26; i++) {
      var col = i % 6, row = Math.floor(i / 6);
      g.fillText(letters[i], col * (512 / 6) + 512 / 12, row * (512 / 5) + 512 / 10 + 4);
    }
    var tex = colorCanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  function makeTextTexture(text, fill) {
    var c = document.createElement('canvas');
    c.width = 192; c.height = 112;
    var g = c.getContext('2d');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '400 64px "Lilita One", "Rubik", sans-serif';
    g.lineWidth = 13;
    g.lineJoin = 'round';
    g.strokeStyle = '#4a2410';
    g.strokeText(text, 96, 58);
    g.fillStyle = fill || '#ffffff';
    g.fillText(text, 96, 58);
    return colorCanvasTexture(c);
  }

  function makeNameTexture(name) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '400 30px "Lilita One", "Rubik", sans-serif';
    g.lineWidth = 6;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(40,18,8,0.85)';
    g.strokeText(name, 128, 32);
    g.fillStyle = '#ffffff';
    g.fillText(name, 128, 32);
    return colorCanvasTexture(c);
  }

  // Классическое роблоксовское лицо: глаза-овалы и улыбка
  // Детализированное лицо: глаза с бликами, брови, румянец, улыбка с зубами
  function makeFaceTexture(skinHex, style) {
    var key = skinHex + '|' + (style || 'happy');
    if (faceTexCache[key]) return faceTexCache[key];
    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var g = c.getContext('2d');
    var base = '#' + ('000000' + skinHex.toString(16)).slice(-6);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);

    // мягкая тень по низу лица (объём)
    var sh = g.createLinearGradient(0, 150, 0, 256);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.14)');
    g.fillStyle = sh; g.fillRect(0, 150, 256, 106);

    var ex = [84, 172], ey = 104;
    if (style === 'explorer') {
      g.fillStyle = 'rgba(151,73,49,0.48)';
      [42,56,70,186,200,214].forEach(function(x,i){g.beginPath();g.arc(x,144+(i%2)*8,2.5,0,Math.PI*2);g.fill();});
    }
    // брови
    g.strokeStyle = 'rgba(30,20,10,0.75)';
    g.lineWidth = 9; g.lineCap = 'round';
    for (var b = 0; b < 2; b++) {
      var dir = b === 0 ? 1 : -1;
      g.beginPath();
      if (style === 'angry') { g.moveTo(ex[b] - dir * 22, ey - 34); g.lineTo(ex[b] + dir * 20, ey - 22); }
      else { g.moveTo(ex[b] - 20, ey - 32); g.quadraticCurveTo(ex[b], ey - 40, ex[b] + 20, ey - 32); }
      g.stroke();
    }
    // глаза (белок + радужка + зрачок + блик)
    for (var i = 0; i < 2; i++) {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(ex[i], ey, 19, 24, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = style === 'cool' ? '#2f6fd0' : '#4a2a16';
      g.beginPath(); g.ellipse(ex[i], ey + 2, 12, 15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#101010';
      g.beginPath(); g.ellipse(ex[i], ey + 3, 7, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.ellipse(ex[i] - 6, ey - 7, 5, 6, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(ex[i] + 6, ey + 9, 2.5, 3, 0, 0, Math.PI * 2); g.fill();
      // обводка глаза
      g.strokeStyle = 'rgba(30,20,10,0.55)'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(ex[i], ey, 19, 24, 0, 0, Math.PI * 2); g.stroke();
    }
    // румянец
    g.fillStyle = 'rgba(255,120,150,0.28)';
    g.beginPath(); g.ellipse(52, 150, 22, 13, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(204, 150, 22, 13, 0, 0, Math.PI * 2); g.fill();
    // рот
    g.strokeStyle = '#20140c'; g.lineWidth = 8; g.lineCap = 'round';
    if (style === 'angry') {
      g.beginPath(); g.arc(128, 196, 30, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
    } else {
      g.beginPath(); g.arc(128, 152, 44, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
      // зубы
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(104, 186); g.lineTo(152, 186); g.lineTo(146, 196); g.lineTo(110, 196); g.closePath(); g.fill();
    }
    var tex = colorCanvasTexture(c);
    tex.anisotropy = 4;
    faceTexCache[key] = tex;
    return tex;
  }

  function popupTexture(n) {
    var key = '+' + n;
    if (!texPlusCache[key]) texPlusCache[key] = makeTextTexture(key, n >= 10 ? '#ffe066' : '#ffffff');
    return texPlusCache[key];
  }

  var iconAtlas = null;
  var iconCells = { '🍬':0, '💰':0, '❤️':1, '👕':2, '⏸':3, '🚪':4,
    '🏠':4, '⬆':5, '🐇':5, '⚔️':6, '🔊':7, '⚡':8, '👟':8, '🎁':9, '🏆':10, '🐾':11 };
  function makeEmojiTexture(emoji) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    if (iconAtlas && iconCells[emoji] !== undefined) {
      var cell = iconCells[emoji];
      g.drawImage(iconAtlas, (cell % 4) * 256, Math.floor(cell / 4) * 256, 256, 256, 0, 0, 128, 128);
      return colorCanvasTexture(c);
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '96px sans-serif';
    g.fillText(emoji, 64, 70);
    return colorCanvasTexture(c);
  }

  function makeBlobTexture() {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, '#6b3418');
    grad.addColorStop(1, 'rgba(70,32,12,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return colorCanvasTexture(c);
  }

  function makeWallTexture() {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var g = c.getContext('2d');
    // мягкий вертикальный градиент обоев
    var bg = g.createLinearGradient(0, 0, 0, 256);
    bg.addColorStop(0, '#ffb3da');
    bg.addColorStop(1, '#ff8fc4');
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 256);
    // вертикальные полосы «вафли»
    for (var s = 0; s < 256; s += 42) {
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(s, 0, 21, 256);
    }
    // конфетные горошины с бликами
    var colors = ['#ffffff', '#ffe066', '#7ed957', '#5bc8f5', '#ff6b9d', '#c589e8', '#ffa94d'];
    for (var i = 0; i < 60; i++) {
      var x = Math.random() * 256, y = Math.random() * 256, r = 5 + Math.random() * 8;
      var col = colors[(Math.random() * colors.length) | 0];
      g.fillStyle = col;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      // блик
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, Math.PI * 2); g.fill();
    }
    var tex = colorCanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  /* ============ Персонажи (роблоксовские блочные модели) ============ */

  // Пометить все меши объекта как отбрасывающие тень
  function castShadows(obj) {
    if (!SHADOWS) return obj;
    obj.traverse(function (n) { if (n.isMesh) n.castShadow = true; });
    return obj;
  }

  // Shared bevel geometry keeps the toy silhouette while softening hard box edges.
  var toyGeometryCache = {};
  function toyBox(w, h, d) {
    var key = w + ',' + h + ',' + d;
    if (toyGeometryCache[key]) return toyGeometryCache[key];
    var geo = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
    var radius = Math.min(w, h, d) * 0.13;
    var pos = geo.attributes.position, v = new THREE.Vector3(), q = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      q.set(Math.max(-w / 2 + radius, Math.min(w / 2 - radius, v.x)),
        Math.max(-h / 2 + radius, Math.min(h / 2 - radius, v.y)),
        Math.max(-d / 2 + radius, Math.min(d / 2 - radius, v.z)));
      v.sub(q).normalize().multiplyScalar(radius).add(q);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    toyGeometryCache[key] = geo;
    return geo;
  }

  // Bake rigid, untextured Lambert pieces into one draw while retaining their
  // exact vertices, normals and linear-space colors. Animated bones, face maps
  // and named parts stay separate. This runs only when a model is constructed.
  function batchRigidParts(parent, keep) {
    var parts = [], vertices = 0, indices = 0;
    for (var i = 0; i < parent.children.length; i++) {
      var part = parent.children[i], mat = part.material, geo = part.geometry;
      if (!part.isMesh || part.children.length || (keep && keep.indexOf(part) >= 0) ||
          !mat || !mat.isMeshLambertMaterial || mat.map || mat.alphaMap || mat.transparent ||
          mat.opacity !== 1 || mat.vertexColors || mat.flatShading || mat.wireframe ||
          mat.side !== THREE.FrontSide || mat.emissive.getHex() !== 0 ||
          !geo || !geo.attributes.position || !geo.attributes.normal) continue;
      parts.push(part); vertices += geo.attributes.position.count;
      indices += geo.index ? geo.index.count : geo.attributes.position.count;
    }
    if (parts.length < 2) return;
    var positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3);
    var colors = new Float32Array(vertices * 3), uvs = new Float32Array(vertices * 2);
    var index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    var offset = 0, cursor = 0, point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
    for (var p = 0; p < parts.length; p++) {
      var mesh = parts[p], attrs = mesh.geometry.attributes, tint = mesh.material.color;
      mesh.updateMatrix(); normalMatrix.getNormalMatrix(mesh.matrix);
      for (var v = 0; v < attrs.position.count; v++) {
        point.fromBufferAttribute(attrs.position, v).applyMatrix4(mesh.matrix);
        normal.fromBufferAttribute(attrs.normal, v).applyMatrix3(normalMatrix).normalize();
        var at = (offset + v) * 3;
        positions[at] = point.x; positions[at + 1] = point.y; positions[at + 2] = point.z;
        normals[at] = normal.x; normals[at + 1] = normal.y; normals[at + 2] = normal.z;
        colors[at] = tint.r; colors[at + 1] = tint.g; colors[at + 2] = tint.b;
        if (attrs.uv) { uvs[(offset + v) * 2] = attrs.uv.getX(v); uvs[(offset + v) * 2 + 1] = attrs.uv.getY(v); }
      }
      var sourceIndex = mesh.geometry.index;
      for (var ix = 0, count = sourceIndex ? sourceIndex.count : attrs.position.count; ix < count; ix++) index[cursor++] = offset + (sourceIndex ? sourceIndex.getX(ix) : ix);
      offset += attrs.position.count;
      parent.remove(mesh);
    }
    var merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    merged.setIndex(new THREE.BufferAttribute(index, 1));
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    var batch = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }));
    batch.name = 'rigid-parts'; batch.updateMatrix(); batch.matrixAutoUpdate = false;
    parent.add(batch);
  }

  // cfg: {skin, shirt, front?, pants, hair: 'none'|'flat'|'side'|'long', hairColor?}
  function createCharacter(cfg) {
    var group = new THREE.Group();
    var body = new THREE.Group();
    group.add(body);

    var skinMat = new THREE.MeshLambertMaterial({ color: cfg.skin });
    var shirtMat = new THREE.MeshLambertMaterial({ color: cfg.shirt });
    var frontMat = cfg.front !== undefined ? new THREE.MeshLambertMaterial({ color: cfg.front }) : shirtMat;
    var pantsMat = new THREE.MeshLambertMaterial({ color: cfg.pants });
    var shoeMat = new THREE.MeshLambertMaterial({ color: cfg.shoe !== undefined ? cfg.shoe : 0x2a2a30 });
    var soleMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    var faceMat = new THREE.MeshLambertMaterial({ map: makeFaceTexture(cfg.skin, cfg.face) });
    // затемнённый оттенок рубашки для воротника/манжет
    var trimC = new THREE.Color(cfg.shirt).multiplyScalar(0.72);
    var trimMat = new THREE.MeshLambertMaterial({ color: trimC });

    function makeLeg(x) {
      var g = new THREE.Group();
      g.position.set(x, 0.78, 0);
      var leg = new THREE.Mesh(toyBox(0.26, 0.68, 0.3), pantsMat);
      leg.position.y = -0.34;
      g.add(leg);
      // кроссовок с белой подошвой
      var sh = new THREE.Mesh(toyBox(0.29, 0.14, 0.42), shoeMat);
      sh.position.set(0, -0.74, 0.05);
      g.add(sh);
      var sole = new THREE.Mesh(toyBox(0.31, 0.07, 0.44), soleMat);
      sole.position.set(0, -0.82, 0.05);
      g.add(sole);
      return g;
    }
    var legL = makeLeg(-0.2), legR = makeLeg(0.2);
    body.add(legL); body.add(legR);

    var torso = new THREE.Mesh(
      toyBox(0.72, 0.72, 0.4),
      frontMat === shirtMat ? shirtMat : [shirtMat, shirtMat, shirtMat, shirtMat, frontMat, shirtMat]
    );
    torso.position.y = 1.14;
    torso.name = 'torso';
    body.add(torso);

    // пояс и воротник — читаемые детали силуэта
    var belt = new THREE.Mesh(toyBox(0.75, 0.12, 0.43), trimMat);
    belt.position.y = 0.82; body.add(belt);
    var collar = new THREE.Mesh(toyBox(0.62, 0.1, 0.44), trimMat);
    collar.position.y = 1.52; body.add(collar);
    // шея
    var neck = new THREE.Mesh(toyBox(0.24, 0.12, 0.24), skinMat);
    neck.position.y = 1.56; body.add(neck);

    function makeArm(x) {
      var g = new THREE.Group();
      g.position.set(x, 1.46, 0);
      var sleeve = new THREE.Mesh(toyBox(0.25, 0.22, 0.29), shirtMat);
      sleeve.position.y = -0.08;
      g.add(sleeve);
      var hand = new THREE.Mesh(toyBox(0.24, 0.16, 0.28), skinMat);
      hand.position.y = -0.66;
      g.add(hand);
      var arm = new THREE.Mesh(toyBox(0.22, 0.58, 0.26), cfg.hoodie ? shirtMat : skinMat);
      arm.position.y = -0.3;
      g.add(arm);
      return g;
    }
    var armL = makeArm(-0.48), armR = makeArm(0.48);
    body.add(armL); body.add(armR);

    // Голова с лицом (лицо — на передней грани +Z)
    var head = new THREE.Mesh(
      toyBox(0.54, 0.52, 0.54),
      skinMat
    );
    head.position.y = 1.8;
    head.name = 'head';
    var face = new THREE.Mesh(new THREE.PlaneGeometry(0.49, 0.47), faceMat);
    face.position.z = 0.271;
    head.add(face);
    body.add(head);

    // Причёска (с объёмом: макушка + затылок + чёлка)
    var hairColor = cfg.hairColor !== undefined ? cfg.hairColor : 0xb5651d;
    var hairMat = new THREE.MeshLambertMaterial({ color: hairColor });
    var hairLo = new THREE.MeshLambertMaterial({ color: new THREE.Color(hairColor).multiplyScalar(0.8) });
    if (cfg.hair === 'flat' || cfg.hair === 'side' || cfg.hair === 'long' || cfg.hair === 'spiky') {
      var hairTop = new THREE.Mesh(toyBox(0.6, 0.2, 0.6), hairMat);
      hairTop.position.y = 2.06;
      body.add(hairTop);
      var hairBack = new THREE.Mesh(toyBox(0.6, 0.3, 0.16), hairLo);
      hairBack.position.set(0, 1.9, -0.28);
      body.add(hairBack);
    }
    if (cfg.hair === 'side') {
      var fringe = new THREE.Mesh(toyBox(0.6, 0.16, 0.14), hairMat);
      fringe.position.set(0, 1.99, 0.26);
      body.add(fringe);
      var tuft = new THREE.Mesh(toyBox(0.22, 0.14, 0.2), hairMat);
      tuft.position.set(0.22, 2.16, 0.14); tuft.rotation.z = 0.4;
      body.add(tuft);
    }
    if (cfg.hair === 'spiky') {
      for (var sp = 0; sp < 5; sp++) {
        var spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 4), hairMat);
        var sa = (sp / 5) * Math.PI * 2;
        spike.position.set(Math.cos(sa) * 0.18, 2.24, Math.sin(sa) * 0.18);
        spike.rotation.z = Math.cos(sa) * 0.35; spike.rotation.x = -Math.sin(sa) * 0.35;
        body.add(spike);
      }
    }
    if (cfg.hair === 'long') {
      var back = new THREE.Mesh(toyBox(0.6, 0.85, 0.14), hairMat);
      back.position.set(0, 1.62, -0.3);
      body.add(back);
      var sideL = new THREE.Mesh(toyBox(0.12, 0.5, 0.4), hairMat);
      sideL.position.set(-0.32, 1.75, -0.05);
      body.add(sideL);
      var sideR = sideL.clone();
      sideR.position.x = 0.32;
      body.add(sideR);
      var fr2 = new THREE.Mesh(toyBox(0.6, 0.14, 0.13), hairMat);
      fr2.position.set(0, 2.0, 0.26);
      body.add(fr2);
    }

    if (cfg.hoodie) {
      var vanilla = new THREE.MeshLambertMaterial({ color: 0xfff2d8 });
      var mint = new THREE.MeshLambertMaterial({ color: 0x72d9bf });
      var darkMint = new THREE.MeshLambertMaterial({ color: 0x259b91 });
      function detail(w, h, d, material, x, y, z) {
        var m = new THREE.Mesh(toyBox(w, h, d), material);
        m.position.set(x, y, z); body.add(m); return m;
      }
      detail(0.63, 0.31, 0.25, shirtMat, 0, 1.52, -0.2);
      detail(0.43, 0.2, 0.05, trimMat, 0, 1.0, 0.222);
      detail(0.045, 0.32, 0.04, vanilla, -0.10, 1.35, 0.239);
      detail(0.045, 0.28, 0.04, vanilla, 0.10, 1.37, 0.239);
      detail(0.46, 0.53, 0.24, mint, 0, 1.17, -0.34);
      detail(0.34, 0.19, 0.08, darkMint, 0, 1.04, -0.49);
      for (var s = -1; s <= 1; s += 2) {
        detail(0.065, 0.61, 0.045, mint, s * 0.25, 1.2, 0.23);
        detail(0.17, 0.33, 0.34, darkMint, s * 0.35, 1.87, -0.015);
        detail(0.08, 0.26, 0.28, mint, s * 0.44, 1.87, -0.015);
        var lace = new THREE.Mesh(toyBox(0.21, 0.035, 0.12), vanilla);
        lace.position.set(0, -0.65, 0.17); (s < 0 ? legL : legR).add(lace);
      }
      var band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 5, 14, Math.PI), mint);
      band.position.set(0, 1.92, -0.06); body.add(band);
      // Asymmetric chocolate fringe is a recognizable original silhouette.
      detail(0.34, 0.16, 0.22, hairMat, -0.13, 2.1, 0.21).rotation.z = -0.22;
    }
    batchRigidParts(legL); batchRigidParts(legR);
    batchRigidParts(armL); batchRigidParts(armR);
    batchRigidParts(body, [head, torso]);
    castShadows(group);
    return { group: group, body: body, head: head, torso: torso, legL: legL, legR: legR, armL: armL, armR: armR };
  }

  /* --- Аксессуары --- */

  function addCap(ch, color) {
    var mat = new THREE.MeshLambertMaterial({ color: color });
    var crown = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.58), mat);
    crown.position.y = 2.08;
    ch.body.add(crown);
    var brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.3), mat);
    brim.position.set(0, 2.0, 0.42);
    ch.body.add(brim);
  }

  function addBunnyEars(ch) {
    var white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var pink = new THREE.MeshLambertMaterial({ color: 0xffb8dd });
    for (var s = -1; s <= 1; s += 2) {
      var ear = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.08), white);
      ear.position.set(s * 0.16, 2.35, 0);
      ear.rotation.z = -s * 0.15;
      ch.body.add(ear);
      var inner = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.02), pink);
      inner.position.set(s * 0.15, 2.35, 0.045);
      inner.rotation.z = -s * 0.15;
      ch.body.add(inner);
    }
  }

  function addTopHat(ch) {
    var black = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    var band = new THREE.MeshLambertMaterial({ color: 0xffd23f });
    var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16), black);
    brim.position.y = 2.08;
    ch.body.add(brim);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 16), black);
    top.position.y = 2.36;
    ch.body.add(top);
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 16), band);
    ring.position.y = 2.17;
    ch.body.add(ring);
  }

  function addChain(ch) {
    var gold = new THREE.MeshLambertMaterial({ color: 0xffd23f });
    var chain = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05), gold);
    chain.position.set(0, 1.38, 0.22);
    ch.body.add(chain);
    var pendant = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.05), gold);
    pendant.rotation.z = Math.PI / 4;
    pendant.position.set(0, 1.26, 0.22);
    ch.body.add(pendant);
  }

  function addPartyHat(ch) {
    var cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.55, 12),
      new THREE.MeshLambertMaterial({ color: 0x5bc8f5 })
    );
    cone.position.y = 2.32;
    ch.body.add(cone);
    var pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd23f })
    );
    pom.position.y = 2.62;
    ch.body.add(pom);
  }

  function addGiftInHands(ch) {
    // руки вытянуты вперёд, в них подарок
    ch.armL.rotation.x = -1.15;
    ch.armR.rotation.x = -1.15;
    var box = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.32, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xdd3344 })
    );
    box.position.set(0, 1.15, 0.55);
    ch.body.add(box);
    var ribMat = new THREE.MeshLambertMaterial({ color: 0xffe066 });
    var rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.08), ribMat);
    rib1.position.copy(box.position);
    ch.body.add(rib1);
    var rib2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.38), ribMat);
    rib2.position.copy(box.position);
    ch.body.add(rib2);
  }

  function addShoulderPet(ch) {
    var brown = new THREE.MeshLambertMaterial({ color: 0x8a5a2a });
    var headP = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.2), brown);
    headP.position.set(0.42, 1.62, 0.05);
    ch.body.add(headP);
    for (var s = -1; s <= 1; s += 2) {
      var ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), brown);
      ear.position.set(0.42 + s * 0.08, 1.74, 0.05);
      ch.body.add(ear);
    }
  }

  function addBackpack(ch, color) {
    var pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.56, 0.2),
      new THREE.MeshLambertMaterial({ color: color })
    );
    pack.position.set(0, 1.16, -0.32);
    ch.body.add(pack);
  }

  /* --- Анимация бега/прыжка --- */

  function animateRun(ch, phase, moving, inAir) {
    // Soft pose blending removes hard changes between idle, running and flight.
    var blend = 0.24;
    if (inAir) {
      ch.legL.rotation.x += (0.65 - ch.legL.rotation.x) * blend;
      ch.legR.rotation.x += (-0.38 - ch.legR.rotation.x) * blend;
      ch.armL.rotation.x += (-1.0 - ch.armL.rotation.x) * blend;
      ch.armR.rotation.x += (-0.8 - ch.armR.rotation.x) * blend;
      ch.armL.rotation.z = -0.16; ch.armR.rotation.z = 0.16;
      ch.body.position.y = 0;
      ch.body.rotation.x = 0.05;
    } else if (moving) {
      var swing = Math.sin(phase);
      ch.legL.rotation.x = swing * 0.95;
      ch.legR.rotation.x = -swing * 0.95;
      ch.armL.rotation.x = -swing * 0.85;
      ch.armR.rotation.x = swing * 0.85;
      ch.body.position.y = Math.abs(swing) * 0.065;
      ch.body.rotation.x = 0.08;
      ch.body.rotation.z = Math.sin(phase) * 0.035;
      ch.armL.rotation.z = -0.06; ch.armR.rotation.z = 0.06;
    } else {
      ch.legL.rotation.x *= 0.8; ch.legR.rotation.x *= 0.8;
      ch.armL.rotation.x *= 0.8; ch.armR.rotation.x *= 0.8;
      ch.body.position.y += (Math.sin(phase * 1.3) * 0.015 - ch.body.position.y) * 0.12;
      ch.body.rotation.x = 0;
      ch.body.rotation.z *= 0.8;
      ch.armL.rotation.z *= 0.8; ch.armR.rotation.z *= 0.8;
    }
  }

  function createRigFromChar(ch) {
    var mode = 'idle';
    var rig = {
      group: ch.group, body: ch.body, ch: ch, phase: Math.random() * 6,
      setMode: function (m) { mode = m; },
      update: function (dt, moveLen) {
        rig.phase += mode === 'run' ? (moveLen || 4) * dt * 1.9 : dt * 1.6;
        animateRun(ch, rig.phase, mode === 'run', mode === 'air');
      }
    };
    return rig;
  }

  /* --- Skins --- */

  function pmat(c) { return new THREE.MeshLambertMaterial({ color: c }); }

  function accFire(ch) {
    for (var s = -1; s <= 1; s += 2) { var horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.44, 6), pmat(0xff5722)); horn.position.set(s * 0.17, 2.22, 0); horn.rotation.z = -s * 0.3; ch.body.add(horn); }
    var m = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 6), pmat(0xff8f00)); m.position.set(0, 2.32, 0); ch.body.add(m);
  }
  function accThunder(ch) {
    var bolt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.06), pmat(0xffd600)); bolt.position.set(0, 1.35, 0.22); bolt.rotation.z = 0.4; ch.body.add(bolt);
    var b2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.06), pmat(0xffd600)); b2.position.set(0, 1.05, 0.22); b2.rotation.z = -0.4; ch.body.add(b2);
    var ant = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 4), pmat(0x9fd0ff)); ant.position.set(0, 2.3, 0); ch.body.add(ant);
  }
  function accFrost(ch) {
    for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; var sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 4), pmat(0xe1f5fe)); sp.position.set(Math.cos(a) * 0.29, 2.16, Math.sin(a) * 0.29); ch.body.add(sp); }
  }
  function accRainbow(ch) {
    var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.2, 10), pmat(0xffd700)); crown.position.y = 2.15; ch.body.add(crown);
    for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; var spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 4), pmat(0xffd700)); spike.position.set(Math.cos(a) * 0.3, 2.33, Math.sin(a) * 0.3); ch.body.add(spike); var gem = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), pmat(CANDY_COLORS[i % CANDY_COLORS.length])); gem.position.set(Math.cos(a) * 0.3, 2.46, Math.sin(a) * 0.3); ch.body.add(gem); }
  }
  function accShadow(ch) {
    for (var s = -1; s <= 1; s += 2) { var horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 6), pmat(0x2a0033)); horn.position.set(s * 0.2, 2.22, 0); horn.rotation.z = -s * 0.5; ch.body.add(horn); }
  }

  // Each new outfit has a distinct silhouette, built from the same toy materials.
  function outfitPart(ch, w, h, d, color, x, y, z, tilt) {
    var part = new THREE.Mesh(toyBox(w, h, d), pmat(color));
    part.position.set(x, y, z); part.rotation.z = tilt || 0; ch.body.add(part); return part;
  }
  function outfitScarf(ch, color) {
    outfitPart(ch, 0.69, 0.15, 0.5, color, 0, 1.56, 0);
    outfitPart(ch, 0.17, 0.43, 0.08, color, -0.21, 1.32, 0.28, -0.12);
  }
  function outfitGoggles(ch, color) {
    outfitPart(ch, 0.74, 0.15, 0.09, color, 0, 1.93, 0.35);
    for (var s = -1; s <= 1; s += 2) outfitPart(ch, 0.23, 0.12, 0.05, 0x95eee1, s * 0.17, 1.93, 0.41);
  }
  function accScout(ch) { addCap(ch, 0x6cc9b2); addBackpack(ch, 0xc89059); outfitScarf(ch, 0xffe2a0); }
  function accChef(ch) {
    outfitPart(ch, 0.7, 0.17, 0.62, 0xfff5dd, 0, 2.15, 0);
    for (var i = -1; i <= 1; i++) outfitPart(ch, 0.32, 0.35, 0.48, 0xfff5dd, i * 0.2, 2.36, 0);
    outfitPart(ch, 0.52, 0.57, 0.05, 0xffedd6, 0, 1.12, 0.26); outfitScarf(ch, 0xdd7569);
    for (var b = 0; b < 2; b++) outfitPart(ch, 0.045, 0.045, 0.035, 0x603e39, 0.14, 1.2 - b * 0.16, 0.3);
  }
  function accPilot(ch) { addCap(ch, 0xb54166); outfitGoggles(ch, 0x5c384b); outfitScarf(ch, 0xffe7cd); addBackpack(ch, 0xd8b099); }
  function accAstronaut(ch) {
    outfitPart(ch, 0.82, 0.17, 0.73, 0xfff1d8, 0, 2.19, 0);
    for (var s = -1; s <= 1; s += 2) outfitPart(ch, 0.13, 0.61, 0.66, 0xfff1d8, s * 0.38, 1.88, 0);
    outfitPart(ch, 0.75, 0.12, 0.66, 0xfff1d8, 0, 1.57, 0);
    outfitPart(ch, 0.37, 0.23, 0.06, 0x58cbbc, 0, 1.23, 0.28); addBackpack(ch, 0xe9d6c6);
  }
  function accKnight(ch) {
    outfitPart(ch, 0.71, 0.23, 0.67, 0xc99263, 0, 2.17, 0);
    outfitPart(ch, 0.1, 0.4, 0.43, 0xef8973, 0, 2.42, 0);
    for (var s = -1; s <= 1; s += 2) outfitPart(ch, 0.31, 0.18, 0.46, 0xdcb187, s * 0.5, 1.49, 0);
    outfitPart(ch, 0.5, 0.45, 0.07, 0xffdeb1, 0, 1.21, 0.25); outfitScarf(ch, 0x674661);
  }
  function accMage(ch) {
    var hat = new THREE.Mesh(new THREE.ConeGeometry(0.41, 0.75, 8), pmat(0x9a67bd)); hat.position.set(0, 2.42, 0); hat.rotation.z = -0.16; ch.body.add(hat);
    outfitPart(ch, 0.92, 0.09, 0.78, 0x785393, 0, 2.13, 0); outfitScarf(ch, 0xf6bfce); addChain(ch);
  }
  function accDiver(ch) { outfitGoggles(ch, 0xffbd70); addBackpack(ch, 0x70c2cf); outfitPart(ch, 0.065, 0.55, 0.07, 0xffbd70, 0.41, 2.02, 0.31); }
  function accDJ(ch) { addCap(ch, 0x4c3f71); addChain(ch); outfitPart(ch, 0.35, 0.15, 0.07, 0xffb67e, 0, 1.13, 0.28); }
  function accExplorer(ch) { addCap(ch, 0xd4a453); outfitScarf(ch, 0x479285); addBackpack(ch, 0x977144); outfitPart(ch, 0.77, 0.055, 0.62, 0xe7bc77, 0, 2.03, 0.08); }
  function accRacer(ch) { addCap(ch, 0xf4f4dd); outfitGoggles(ch, 0x335970); outfitPart(ch, 0.11, 0.52, 0.05, 0xffe0a1, 0.12, 1.2, 0.25); }
  function accCrystal(ch) { accFrost(ch); outfitScarf(ch, 0xa498dc); addBackpack(ch, 0x7dafbb); }
  function accRanger(ch) { outfitScarf(ch, 0x668eaa); addCap(ch, 0x363c62); addBackpack(ch, 0x5c6689); outfitPart(ch, 0.15, 0.22, 0.08, 0xf5cc83, -0.21, 1.11, 0.28); }

  function accDailyCrown(ch) {
    var regalia = new THREE.Group(), gold = pmat(0xe9bb65), ivory = pmat(0xffefd2);
    var navy = pmat(0x303d60), coral = pmat(0xe98274), deepGold = pmat(0xb98640);
    ch.body.add(regalia);
    function piece(parent, w, h, d, material, x, y, z, tilt) {
      var mesh = new THREE.Mesh(toyBox(w, h, d), material);
      mesh.position.set(x, y, z); mesh.rotation.z = tilt || 0; parent.add(mesh); return mesh;
    }
    // A short, flared courier cape clears the moving hips and legs.
    piece(regalia, .87, .76, .075, navy, 0, 1.10, -.32).rotation.x = -.13;
    for (var side = -1; side <= 1; side += 2) {
      piece(regalia, .27, .77, .075, navy, side * .47, 1.09, -.32, side * .13);
      piece(regalia, .045, .77, .095, gold, side * .59, 1.08, -.30, side * .13);
      piece(regalia, .31, .095, .44, ivory, side * .36, 1.53, -.06);
      piece(regalia, .24, .04, .46, gold, side * .36, 1.60, -.06);
    }
    piece(regalia, 1.04, .055, .11, gold, 0, .71, -.35);
    piece(regalia, .71, .13, .48, ivory, 0, 1.54, -.035);
    // Ivory jacket, gold clasps and a navy courier sash remain readable at play scale.
    piece(regalia, .055, .57, .045, gold, -.27, 1.14, .242);
    piece(regalia, .055, .57, .045, gold, .27, 1.14, .242);
    piece(regalia, .12, .68, .065, navy, -.025, 1.20, .265, -.42);
    piece(regalia, .035, .68, .07, gold, .035, 1.20, .272, -.42);
    for (var button = 0; button < 3; button++) piece(regalia, .052, .052, .055, gold, .17, 1.34 - button * .16, .265);
    piece(regalia, .27, .30, .21, coral, -.43, .91, .12);
    piece(regalia, .29, .08, .24, ivory, -.43, 1.06, .14);
    piece(regalia, .075, .11, .03, gold, -.43, .99, .257);
    // Squared gold crown with a coral sunrise star, distinct from the shop crown.
    for (var s = -1; s <= 1; s += 2) {
      piece(regalia, .73, .12, .085, gold, 0, 2.17, s * .32);
      piece(regalia, .085, .12, .59, gold, s * .32, 2.17, 0);
      piece(regalia, .73, .025, .09, deepGold, 0, 2.115, s * .32);
      piece(regalia, .09, .29, .10, gold, s * .28, 2.34, .32, -s * .16);
      piece(regalia, .10, .22, .10, gold, s * .28, 2.30, -.31, -s * .10);
    }
    piece(regalia, .11, .38, .10, gold, 0, 2.39, .32);
    if (!toyGeometryCache.dailyCrownStar) {
      var shape = new THREE.Shape();
      for (var point = 0; point < 10; point++) {
        var angle = Math.PI / 2 + point * Math.PI / 5, radius = point % 2 ? .075 : .165;
        if (!point) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      shape.closePath();
      toyGeometryCache.dailyCrownStar = new THREE.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: true, bevelSize: .012, bevelThickness: .008, bevelSegments: 1, steps: 1 });
    }
    var crest = new THREE.Mesh(toyGeometryCache.dailyCrownStar, coral); crest.position.set(0, 2.35, .39); regalia.add(crest);
    piece(regalia, .045, .045, .035, ivory, 0, 2.35, .455, Math.PI / 4);
    batchRigidParts(regalia);
    // Cuffs and boot straps stay attached to the actual animated limb groups.
    [ch.armL, ch.armR, ch.legL, ch.legR].forEach(function (limb, index) {
      var trim = new THREE.Group(); limb.add(trim);
      if (index < 2) {
        piece(trim, .255, .11, .29, ivory, 0, -.50, 0);
        piece(trim, .265, .034, .30, gold, 0, -.435, 0);
        piece(trim, .265, .034, .30, gold, 0, -.564, 0);
      } else {
        piece(trim, .32, .075, .22, navy, 0, -.70, .14);
        piece(trim, .17, .055, .035, gold, 0, -.70, .265);
      }
      batchRigidParts(trim);
    });
    castShadows(ch.group);
  }

  // Candy purchases and optional rewarded-video progress unlock the same outfits.
  var SKINS = [
    { id: 'default', nameKey: 'skinDefault', char: { skin: 0xf3be9e, shirt: 0xef796f, pants: 0x25304c, shoe: 0xffe9ce, hair: 'side', hairColor: 0x38231f, hoodie: true, face: 'explorer' }, aura: null, ads: 0 },
    { id: 'skin_fire', nameKey: 'skinFire', char: { skin: 0xff7043, shirt: 0x8b1a1a, front: 0xd32f2f, pants: 0x3a0f0f, hair: 'flat', hairColor: 0xff5722 }, acc: accFire, aura: 'fire', ads: 1 },
    { id: 'skin_thunder', nameKey: 'skinThunder', char: { skin: 0xfff0a0, shirt: 0x1a237e, front: 0x3949ab, pants: 0x0d1440, hair: 'side', hairColor: 0xfff060 }, acc: accThunder, aura: 'thunder', ads: 3 },
    { id: 'skin_frost', nameKey: 'skinFrost', char: { skin: 0xcdeeff, shirt: 0x4fc3f7, front: 0xe1f5fe, pants: 0x0277bd, hair: 'long', hairColor: 0xb3e5fc }, acc: accFrost, aura: 'frost', ads: 4 },
    { id: 'skin_shadow', nameKey: 'skinShadow', char: { skin: 0x9575cd, shirt: 0x311b92, front: 0x4a148c, pants: 0x1a0033, hair: 'flat', hairColor: 0x1a0033 }, acc: accShadow, aura: 'shadow', ads: 5 },
    { id: 'skin_rainbow', nameKey: 'skinRainbow', char: { skin: 0xf3be9e, shirt: 0xe0489a, front: 0xffd700, pants: 0x8e24aa, hair: 'side', hairColor: 0x452747 }, acc: accRainbow, aura: 'rainbow', ads: 7 },
    { id: 'skin_scout', nameKey: 'skinScout', char: { skin: 0xbc825b, shirt: 0x75b9a0, pants: 0x635048, shoe: 0xffdeb3, hair: 'side', hairColor: 0x3a282b, face: 'explorer' }, acc: accScout, aura: null, ads: 1 },
    { id: 'skin_chef', nameKey: 'skinChef', char: { skin: 0xe7aa84, shirt: 0x7b4e40, pants: 0x3e3043, shoe: 0xffefdd, hair: 'flat', hairColor: 0x442b2c, face: 'explorer' }, acc: accChef, aura: null, ads: 1 },
    { id: 'skin_pilot', nameKey: 'skinPilot', char: { skin: 0xf2c4ac, shirt: 0xe985a2, pants: 0x4a4268, shoe: 0xffe3ba, hair: 'side', hairColor: 0x9c4639 }, acc: accPilot, aura: null, ads: 2 },
    { id: 'skin_astronaut', nameKey: 'skinAstronaut', char: { skin: 0xa76e53, shirt: 0xeae1d3, pants: 0x6e8f9f, shoe: 0xfaf1d7, hair: 'flat', hairColor: 0x392b38 }, acc: accAstronaut, aura: 'frost', ads: 3 },
    { id: 'skin_knight', nameKey: 'skinKnight', char: { skin: 0xe5ad83, shirt: 0xb67e53, pants: 0x594353, shoe: 0xedd6ac, hair: 'flat', hairColor: 0x61413a }, acc: accKnight, aura: 'fire', ads: 3 },
    { id: 'skin_mage', nameKey: 'skinMage', char: { skin: 0xe9b6a4, shirt: 0x9368b9, pants: 0x583c78, shoe: 0xf4cee6, hair: 'long', hairColor: 0xeab4d2 }, acc: accMage, aura: 'shadow', ads: 3 },
    { id: 'skin_diver', nameKey: 'skinDiver', char: { skin: 0xba825b, shirt: 0x4898ac, pants: 0x314e75, shoe: 0xffad70, hair: 'flat', hairColor: 0x392f3d }, acc: accDiver, aura: null, ads: 2 },
    { id: 'skin_dj', nameKey: 'skinDJ', char: { skin: 0x9a664d, shirt: 0xc978ad, pants: 0x353457, shoe: 0xffe1bb, hair: 'side', hairColor: 0x302637, hoodie: true, face: 'cool' }, acc: accDJ, aura: 'rainbow', ads: 4 },
    { id: 'skin_explorer', nameKey: 'skinExplorer', char: { skin: 0xf1b891, shirt: 0xd5b478, pants: 0x63634c, shoe: 0x715245, hair: 'side', hairColor: 0x704735, face: 'explorer' }, acc: accExplorer, aura: null, ads: 2 },
    { id: 'skin_racer', nameKey: 'skinRacer', char: { skin: 0xe8b093, shirt: 0x64bfae, pants: 0x344b63, shoe: 0xfff0d6, hair: 'flat', hairColor: 0x423637 }, acc: accRacer, aura: 'thunder', ads: 3 },
    { id: 'skin_crystal', nameKey: 'skinCrystal', char: { skin: 0xe3c7bc, shirt: 0x9acbcf, pants: 0x776494, shoe: 0xebf8f0, hair: 'long', hairColor: 0xdee0f4 }, acc: accCrystal, aura: 'frost', ads: 4 },
    { id: 'skin_ranger', nameKey: 'skinRanger', char: { skin: 0xb48370, shirt: 0x44466e, pants: 0x2b2e47, shoe: 0x95aaba, hair: 'side', hairColor: 0x2a2631, face: 'explorer' }, acc: accRanger, aura: 'shadow', ads: 4 }
  ];

  // Day-seven reward is deliberately outside the purchasable shop catalog.
  var DAILY_SKIN = { id: 'skin_daily_crown', name: 'Владыка рассвета',
    char: { skin: 0xe9b49b, shirt: 0xe98274, front: 0xffefd2, pants: 0x303d60, shoe: 0xffefd2,
      hair: 'side', hairColor: 0x433034, face: 'explorer' }, acc: accDailyCrown, aura: null, exclusive: true };

  function skinById(id) { if (id === DAILY_SKIN.id) return DAILY_SKIN; for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i]; return SKINS[0]; }
  var AD_OUTFITS = { skin_fire: 1, skin_thunder: 2, skin_frost: 3, skin_shadow: 4, skin_rainbow: 5, skin_astronaut: 2, skin_mage: 3, skin_dj: 4, skin_crystal: 5 };

  function createSkinAura(type) {
    if (!type) return null;
    if (!glowTex) glowTex = makeGlowTexture();
    var pal = {
      fire: [0xff4500, 0xff8c00, 0xffd000],
      thunder: [0xfff060, 0x9fd0ff, 0xffffff],
      frost: [0x9fe0ff, 0xd0f4ff, 0xffffff],
      rainbow: [0xff5a6e, 0xffd23f, 0x6fd44d, 0x5bc8f5, 0xc589e8],
      shadow: [0x7a3fbf, 0x4a1f7f, 0xb060ff]
    }[type] || [0xffffff];
    var group = new THREE.Group();
    var sprites = [];
    var n = type === 'thunder' ? 14 : 12;
    for (var i = 0; i < n; i++) {
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: pal[i % pal.length], transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      var sz = 0.5 + Math.random() * 0.5; spr.scale.set(sz, sz, 1);
      spr.userData = { baseA: Math.random() * 6.28, rad: 0.5 + Math.random() * 0.45, y0: Math.random() * 2.2, ySpeed: 0.6 + Math.random(), phase: Math.random() * 6.28, sz: sz };
      group.add(spr); sprites.push(spr);
    }
    return { group: group, sprites: sprites, type: type, t: 0 };
  }

  function updateAura(dt, now) {
    if (!playerAura) return;
    playerAura.t += dt;
    var T = playerAura.t;
    for (var i = 0; i < playerAura.sprites.length; i++) {
      var s = playerAura.sprites[i], u = s.userData;
      if (playerAura.type === 'fire') {
        var y = (u.y0 + T * u.ySpeed * 1.7) % 2.4;
        var shrink = 1 - y / 3;
        s.position.set(Math.cos(u.baseA) * u.rad * shrink, y, Math.sin(u.baseA) * u.rad * shrink);
        s.material.opacity = Math.max(0, 0.85 * (1 - y / 2.4));
        s.scale.setScalar((0.4 + (2.4 - y) * 0.12) * (0.8 + Math.sin(now * 0.02 + u.phase) * 0.2));
      } else if (playerAura.type === 'thunder') {
        var a = u.baseA + T * 3.2;
        s.position.set(Math.cos(a) * u.rad, 0.4 + (Math.sin(now * 0.03 + u.phase) * 0.5 + 0.9), Math.sin(a) * u.rad);
        s.material.opacity = (Math.sin(now * 0.06 + u.phase * 4) > 0.3) ? 0.9 : 0.15;
        s.scale.setScalar(u.sz * (0.7 + Math.random() * 0.5));
      } else if (playerAura.type === 'rainbow') {
        var a2 = u.baseA + T * 1.6;
        s.position.set(Math.cos(a2) * u.rad, 0.4 + Math.sin(T * 2 + u.phase) * 0.8 + 0.8, Math.sin(a2) * u.rad);
        s.material.opacity = 0.7;
        s.scale.setScalar(u.sz * (0.9 + Math.sin(now * 0.008 + u.phase) * 0.15));
      } else {
        var a3 = u.baseA + T * (playerAura.type === 'shadow' ? -1.3 : 1.0);
        var yy = 0.4 + u.y0 * 0.5 + Math.sin(T + u.phase) * 0.3;
        s.position.set(Math.cos(a3) * u.rad, yy, Math.sin(a3) * u.rad);
        s.material.opacity = 0.5 + Math.sin(now * 0.005 + u.phase) * 0.25;
      }
    }
  }

  function setSkin(id) {
    var cfg = skinById(id);
    var pos = playerGroup ? playerGroup.position.clone() : new THREE.Vector3(px, py, pz);
    var rotY = playerChar ? playerChar.body.rotation.y : 0;
    if (playerGroup) { scene.remove(playerGroup); releaseWorldProp(playerGroup); }
    var ch = createCharacter(cfg.char);
    if (cfg.acc) cfg.acc(ch);
    playerChar = createRigFromChar(ch);
    playerGroup = playerChar.group;
    playerChar.body.rotation.y = rotY;

    var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.name = 'shadow';
    playerGroup.add(shadow);

    playerAura = createSkinAura(cfg.aura);
    if (playerAura) playerGroup.add(playerAura.group);

    playerGroup.position.copy(pos);
    scene.add(playerGroup);
    activeSkin = cfg.id;
    markSave();
  }

  function buildPlayer() {
    setSkin(activeSkin || 'default');
    playerGroup.position.set(px, py, pz);
  }

  function buildBots() {
    var used = [];
    function pickName() {
      var n;
      do { n = BOT_NAMES[(Math.random() * BOT_NAMES.length) | 0]; } while (used.indexOf(n) >= 0);
      used.push(n);
      return n;
    }
    function makeBot(isHub) {
      var hairRoll = Math.random();
      var ch = createCharacter({
        skin: BOT_SKINS[(Math.random() * BOT_SKINS.length) | 0],
        shirt: BOT_SHIRTS[(Math.random() * BOT_SHIRTS.length) | 0],
        front: Math.random() < 0.45 ? BOT_SHIRTS[(Math.random() * BOT_SHIRTS.length) | 0] : undefined,
        pants: BOT_PANTS[(Math.random() * BOT_PANTS.length) | 0],
        shoe: BOT_SHOES[(Math.random() * BOT_SHOES.length) | 0],
        face: Math.random() < 0.25 ? 'cool' : 'happy',
        hair: hairRoll < 0.32 ? 'flat' : hairRoll < 0.55 ? 'side' : hairRoll < 0.72 ? 'long' : hairRoll < 0.86 ? 'spiky' : 'none',
        hairColor: BOT_HAIRS[(Math.random() * BOT_HAIRS.length) | 0]
      });
      if (hairRoll >= 0.86 && Math.random() < 0.7) addCap(ch, BOT_SHIRTS[(Math.random() * BOT_SHIRTS.length) | 0]);
      if (Math.random() < 0.25) addBackpack(ch, BOT_SHIRTS[(Math.random() * BOT_SHIRTS.length) | 0]);

      var rig = createRigFromChar(ch);
      var tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeNameTexture(pickName()), transparent: true, depthWrite: false }));
      tag.scale.set(2.1, 0.52, 1);
      tag.position.y = 2.75;
      rig.group.add(tag);
      scene.add(rig.group);
      return {
        rig: rig, hub: isHub,
        px: 0, py: KEY_H, pz: 3, vy: 0, grounded: true,
        tx: 0, tz: 3, yaw: 0,
        speed: isHub ? 2.6 : 6.0 + Math.random() * 0.7,
        waitT: 0, doorSide: (Math.random() * 2) | 0,
        tileR: -999, tileL: -999,
        prevX: 0, prevZ: 0,
        hp: 3, binv: 0, dead: false, respawnT: 0,
        id: bots.length + used.length, route: [], routeGoal: '', replanT: 0,
        checkpoint: null, jump: null, expedition: null, completed: 0,
        roomIndex: 0, roomTemplate: 0, lastDoorPassed: -Infinity,
        attackCd: 0, attackT: 0, blockedT: 0, failures: 0
      };
    }
    for (var i = 0; i < RUNNER_BOTS; i++) bots.push(makeBot(false));
    for (var h = 0; h < HUB_BOTS; h++) bots.push(makeBot(true));
    resetBots();
  }

  function hubWanderTarget() {
    // случайная точка хаба вне фонтана
    for (var t = 0; t < 5; t++) {
      var x = (Math.random() - 0.5) * 15;
      var z = 2.5 + Math.random() * (HUB_LEN - 5);
      var dx = x, dz = z - 12.5;
      if (dx * dx + dz * dz > 3.2 * 3.2) return { x: x, z: z };
    }
    return { x: 0, z: 4 };
  }

  function resetBots() {
    for (var i = 0; i < bots.length; i++) {
      var b = bots[i];
      if (b.hub) {
        var pt = hubWanderTarget();
        b.px = pt.x; b.pz = pt.z;
        var t2 = hubWanderTarget();
        b.tx = t2.x; b.tz = t2.z;
        b.waitT = Math.random() * 2;
      } else {
        // Раннеры стартуют внутри хаба и сами бегут к двери-развилке, открывая её
        b.px = laneX(9) + (Math.random() - 0.5) * 3;
        b.pz = 6 + i * 3 + Math.random() * 2;
        b.doorSide = (Math.random() * 2) | 0;
      }
      b.py = KEY_H + 0.3;
      b.vy = 0;
      b.tileR = -999; b.tileL = -999;
      b.hp = 3; b.binv = 1; b.dead = false; b.respawnT = 0;
      b.route = []; b.routeGoal = ''; b.jump = null; b.expedition = null;
      b.completed = 0; b.roomIndex = 0; b.roomTemplate = 0; b.lastDoorPassed = -Infinity;
      b.checkpoint = { x: b.px, z: b.pz }; b.replanT = 0; b.blockedT = 0; b.failures = 0;
      b.rig.group.visible = true;
      b.rig.body.rotation.x = 0;
      b.rig.group.position.set(b.px, b.py, b.pz);
    }
  }

  // Возрождение отдельного бота (после гибели в ловушке)
  function respawnBot(b) {
    if (b.hub) {
      var pt = hubWanderTarget();
      b.px = pt.x; b.pz = pt.z;
    } else {
      // A failed attempt returns to its own last safe checkpoint, never ahead
      // of the obstacle and never relative to the player's position.
      var cp = b.checkpoint || { x: 0, z: 3 };
      b.px = cp.x; b.pz = cp.z;
    }
    b.py = KEY_H + 0.4; b.vy = 0;
    b.hp = 3; b.binv = 1.2; b.dead = false; b.respawnT = 0;
    b.tileR = -999; b.tileL = -999;
    b.route = []; b.routeGoal = ''; b.jump = null; b.blockedT = 0; b.failures++;
    b.rig.body.rotation.x = 0;
    b.rig.group.visible = !b.expedition && Math.abs(b.pz - pz) < 52;
  }

  // Урон боту от ловушки; при 0 HP — гибель и таймер возрождения
  function hurtBot(b) {
    if (b.binv > 0 || b.dead) return;
    b.hp -= 1;
    b.binv = 1;
    if (!b.expedition && Math.abs(b.pz - pz) < 22) splash(b.px, KEY_H + 0.6, b.pz);
    if (b.hp <= 0) {
      b.dead = true;
      b.respawnT = 2.2;
    }
  }

  /* Collision-only courses let distant runners keep playing without expanding
     the player's scene. Templates are reused, then temporary meshes are freed. */
  function botCourse(ti, difficulty) {
    var saved = { rows: rows, entities: entities, walls: wallColliders, scene: scene,
      slots: slotRow, path: genPath, palette: genPalette, art: currentRoomArt, pending: pendingArena };
    var course;
    try {
      rows = new Map(); entities = []; wallColliders = []; scene = new THREE.Group();
      slotRow = new Int32Array(VISIBLE).fill(-99999); genPath = 9;
      currentRoomArt = ROOM_ART[ROOM_ART_INDEX[ti] || 0]; genPalette = currentRoomArt.keys; pendingArena = null;
      fillSafe(-3, 3);
      var length = TEMPLATES[ti].fn(0, Math.min(12, Math.max(1, difficulty)));
      fillSafe(length, 3);
      course = { rows: rows, entities: entities, walls: wallColliders.map(function (w) {
        return { x: w.x, z: w.z, hw: w.hw, hd: w.hd };
      }), doors: [], circles: [], start: -2, end: length + 1, local: false, crumbs: [], enemies: [] };
      if (pendingArena) {
        for (var i = 0; i < pendingArena.count; i++) course.enemies.push({
          px: -5 + (i % 3) * 5, pz: pendingArena.z0 + 3 + Math.floor(i / 3) * 5,
          hp: 3, dead: false, botAttackCd: 0
        });
      }
      entities.forEach(function (en) { en.mesh = null; en.own = null; });
      while (scene.children.length) releaseWorldProp(scene.children[0]);
    } finally {
      rows = saved.rows; entities = saved.entities; wallColliders = saved.walls; scene = saved.scene;
      slotRow = saved.slots; genPath = saved.path; genPalette = saved.palette;
      currentRoomArt = saved.art; pendingArena = saved.pending;
    }
    return course;
  }

  function botWorld() {
    return { rows: rows, walls: wallColliders, entities: entities, doors: doorways,
      circles: staticColliders, start: Math.max(0, Math.floor(backWallZ) - 20), end: builtEnd - 1,
      local: true, crumbs: crumbling, enemies: arena.cleared ? [] : arena.enemies };
  }

  function botLane(x) { return Math.max(0, Math.min(LANES - 1, Math.round(x + 9.5))); }
  function botSolid(ctx, x, z) {
    var row = ctx.rows.get(Math.floor(z)), lane = Math.round(x + 9.5);
    return row && lane >= 0 && lane < LANES && row.type[lane] >= 1;
  }
  function botBlocked(ctx, x, z) {
    if (Math.abs(x) > PLAYER_CLAMP) return true;
    for (var i = 0; i < ctx.walls.length; i++) {
      var w = ctx.walls[i];
      if (Math.abs(x - w.x) < w.hw + 0.27 && Math.abs(z - w.z) < w.hd + 0.27) return true;
    }
    for (var c = 0; c < ctx.circles.length; c++) {
      var circle = ctx.circles[c], dx = x - circle.x, dz = z - circle.z;
      if (dx * dx + dz * dz < (circle.r + 0.25) * (circle.r + 0.25)) return true;
    }
    for (var d = 0; d < ctx.doors.length; d++) {
      var door = ctx.doors[d];
      if (Math.abs(z - door.z) >= 0.7) continue;
      var passage = false;
      for (var o = 0; o < door.opts.length; o++) {
        if (door.opts[o].open && Math.abs(x - door.opts[o].x) < OPEN_HALF - 0.28) passage = true;
      }
      if (!passage) return true;
    }
    return false;
  }

  // Predict the same hazard phase even when its pooled render mesh is culled.
  function botDanger(ctx, x, y, z, time) {
    var r = Math.floor(z), lane = botLane(x), row = ctx.rows.get(r);
    if (row && row.type[lane] === 2 && y < KEY_H + 0.7) {
      var cycle = (time / row.spikePeriod + hash01(r * 13.37 + lane * 7.77)) % 1;
      if (spikeDangerous(cycle)) return 1;
    }
    for (var i = 0; i < ctx.entities.length; i++) {
      var en = ctx.entities[i], ex, ez = en.z, ey = KEY_H + 0.85;
      if (en.kind === 'roller') { ex = en.laneX; ez = en.z0 - ((time * en.speed + en.phase) % en.span); }
      else if (en.kind === 'pendulum') {
        var angle = Math.sin(time * en.speed + en.phase) * en.amp;
        ex = Math.sin(angle) * en.len; ey = KEY_H + 3.6 - Math.cos(angle) * en.len;
      } else ex = (en.cx || 0) + Math.sin(time * en.speed + en.phase) * (en.kind === 'piston' ? 8.6 : en.amp);
      if (Math.abs(ez - z) > 1.2) continue;
      var dx = ex - x, dz = ez - z;
      if (en.kind === 'piston' && Math.abs(dx) < 1.6 && Math.abs(dz) < 1.1 && y < KEY_H + 1.7) return 1;
      if (en.kind === 'monster' && dx * dx + dz * dz < 1.15 && y < KEY_H + 1.6) return 1;
      if (en.kind === 'roller' && dx * dx + dz * dz < 1.3 && y < KEY_H + 1.7) return 1;
      if (en.kind === 'saw' && Math.abs(dx) < 0.98 && Math.abs(dz) < 0.8 && y < KEY_H + 1.5) return 1;
      if (en.kind === 'pendulum' && Math.abs(dx) < 0.9 && Math.abs(dz) < 0.9 && ey < KEY_H + 2 && y < ey + 0.9) return 1;
    }
    return 0;
  }

  function botSegment(ctx, x0, z0, x1, z1, jumping, time, duration, checkDanger) {
    var dist = Math.hypot(x1 - x0, z1 - z0), steps = Math.max(3, Math.ceil(dist * 4));
    var risk = 0;
    for (var i = 1; i <= steps; i++) {
      var u = i / steps, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u;
      if (botBlocked(ctx, x, z) || (!jumping && !botSolid(ctx, x, z))) return -1;
      var y = KEY_H + (jumping ? 0.5 * GRAVITY * duration * duration * u * (1 - u) : 0);
      if (checkDanger) risk += botDanger(ctx, x, y, z, time + duration * u);
    }
    return risk;
  }

  // A* across the actual tile lattice. Edges are walks or ballistic jumps with
  // a reachable landing; horizontal speed and gravity bound every jump.
  function botPlan(b, ctx, target) {
    var sr = Math.floor(b.pz), sl = botLane(b.px), gr = Math.floor(target.z), gl = botLane(target.x);
    var minR = Math.max(ctx.start, Math.min(sr, gr) - 5), maxR = Math.min(ctx.end, Math.max(sr, gr) + 2);
    var costs = new Map(), previous = new Map(), open = [], visited = new Set();
    var startKey = sr * LANES + sl, goalKey = gr * LANES + gl;
    var flight = 2 * 9.8 / GRAVITY, reach = b.speed * flight * 0.96;
    function push(node) {
      var n = open.length; open.push(node);
      while (n > 0) { var parent = (n - 1) >> 1; if (open[parent].f <= node.f) break; open[n] = open[parent]; n = parent; } open[n] = node;
    }
    function pop() {
      var result = open[0], last = open.pop();
      if (open.length) {
        var n = 0; open[0] = last;
        while (true) { var child = n * 2 + 1; if (child >= open.length) break;
          if (child + 1 < open.length && open[child + 1].f < open[child].f) child++;
          if (open[child].f >= last.f) break; open[n] = open[child]; n = child;
        } open[n] = last;
      } return result;
    }
    costs.set(startKey, 0); push({ key: startKey, r: sr, l: sl, f: 0 });
    var examined = 0, found = false;
    while (open.length && examined < 1300) {
      var node = pop(); if (visited.has(node.key)) continue;
      examined++;
      if (node.key === goalKey) { found = true; break; }
      visited.add(node.key);
      var base = costs.get(node.key), x0 = laneX(node.l), z0 = node.r + 0.5;
      function edge(dl, dr, jumping) {
        var l = node.l + dl, r = node.r + dr, key = r * LANES + l;
        if (l < 0 || l >= LANES || r < minR || r > maxR || visited.has(key)) return;
        var row = ctx.rows.get(r); if (!row || row.type[l] < 1) return;
        var distance = Math.hypot(dl, dr); if (jumping && (distance > reach || distance < 1.8)) return;
        var duration = jumping ? flight : distance / b.speed;
        if (botSegment(ctx, x0, z0, laneX(l), r + 0.5, jumping, 0, duration, false) < 0) return;
        // Coarse arrival risk guides A*. Dense time samples are reserved for
        // the one edge about to execute, rather than every search candidate.
        var arrival = nowSec + base / b.speed + duration;
        var risk = botDanger(ctx, laneX(l), KEY_H, r + 0.5, arrival);
        if (!jumping) risk += botDanger(ctx, (x0 + laneX(l)) / 2, KEY_H, (z0 + r + 0.5) / 2, arrival - duration / 2);
        var next = base + distance + (jumping ? 1.3 : 0) + risk * 1.4 + (row.type[l] === 2 ? 2 : 0) + (row.type[l] === 4 ? 0.08 : 0);
        if (costs.has(key) && costs.get(key) <= next) return;
        costs.set(key, next); previous.set(key, { from: node.key, jump: jumping });
        push({ key: key, r: r, l: l, f: next + Math.hypot(gr - r, gl - l) });
      }
      for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) if (dx || dz) edge(dx, dz, false);
      var jumpUseful = false;
      for (var nr = node.r; nr <= node.r + 2 && !jumpUseful; nr++) {
        var nearRow = ctx.rows.get(nr);
        for (var nl = Math.max(0, node.l - 1); nl <= Math.min(LANES - 1, node.l + 1); nl++) {
          if (!nearRow || nearRow.type[nl] === 0 || nearRow.type[nl] === 2 || nearRow.type[nl] === 5) { jumpUseful = true; break; }
        }
      }
      if (jumpUseful) for (var jz = 0; jz <= 5; jz++) for (var jx = -5; jx <= 5; jx++) edge(jx, jz, true);
    }
    if (!found) return [];
    var path = [], key = goalKey;
    while (key !== startKey) {
      var link = previous.get(key); if (!link) return [];
      var rr = Math.floor(key / LANES), ll = key - rr * LANES;
      path.push({ x: laneX(ll), z: rr + 0.5, jump: link.jump }); key = link.from;
    }
    path.reverse();
    // First align inside the current tile before taking an edge from its centre.
    if (Math.hypot(b.px - laneX(sl), b.pz - (sr + 0.5)) > 0.12 && botSolid(ctx, laneX(sl), sr + 0.5)) path.unshift({ x: laneX(sl), z: sr + 0.5, jump: false });
    return path;
  }

  function botNavigate(b, ctx, target, dt) {
    var goal = Math.floor(target.z) + ':' + botLane(target.x);
    b.replanT = Math.max(0, b.replanT - dt);
    if (!b.jump && (b.routeGoal !== goal || (!b.route.length && b.replanT <= 0))) {
      b.route = botPlan(b, ctx, target); b.routeGoal = goal; b.replanT = 0.7;
    }
    var underfoot = ctx.rows.get(Math.floor(b.pz));
    if (!b.jump && b.grounded && underfoot && underfoot.type[botLane(b.px)] === 5 && b.route.length) {
      var bounceTime = 2 * 9.8 / GRAVITY, bounceReach = b.speed * bounceTime * 0.96;
      for (var bp = b.route.length - 1; bp >= 0; bp--) {
        var landing = b.route[bp], bounceDistance = Math.hypot(landing.x - b.px, landing.z - b.pz);
        if (bounceDistance < 1 || bounceDistance > bounceReach) continue;
        if (botSegment(ctx, b.px, b.pz, landing.x, landing.z, true, nowSec, bounceTime, true) !== 0) continue;
        b.route.splice(0, bp); b.route[0].jump = true; break;
      }
    }
    if (b.jump) {
      var j = b.jump; j.time = Math.min(j.duration, j.time + dt);
      var u = j.time / j.duration;
      b.px = j.x0 + (j.x1 - j.x0) * u; b.pz = j.z0 + (j.z1 - j.z0) * u;
      b.py = KEY_H + 0.5 * GRAVITY * j.duration * j.duration * u * (1 - u);
      b.grounded = false;
      if (u >= 1) { b.jump = null; b.grounded = !!botSolid(ctx, b.px, b.pz); b.vy = 0; b.route.shift(); }
    } else if (b.route.length) {
      var next = b.route[0], dx = next.x - b.px, dz = next.z - b.pz, distance = Math.hypot(dx, dz);
      if (distance < 0.06) b.route.shift();
      else {
        var duration = next.jump ? 2 * 9.8 / GRAVITY : distance / b.speed;
        var risk = botSegment(ctx, b.px, b.pz, next.x, next.z, next.jump, nowSec, duration, true);
        if (risk < 0) { b.route = []; b.replanT = 0; }
        else if (risk > 0 && !botDanger(ctx, b.px, b.py, b.pz, nowSec)) {
          b.blockedT += dt;
          if (b.blockedT > 0.8) { b.route = []; b.replanT = 0; b.blockedT = 0; }
        } else if (next.jump && b.grounded) {
          b.jump = { x0: b.px, z0: b.pz, x1: next.x, z1: next.z, time: 0, duration: duration };
          b.blockedT = 0;
        } else {
          // Counter-steering on conveyors consumes the same finite movement
          // budget as forward motion; the belt is not silently ignored.
          var belt = underfoot && underfoot.conv ? underfoot.conv : 0, ux = dx / distance;
          var effectiveSpeed = belt * ux + Math.sqrt(Math.max(0, b.speed * b.speed - belt * belt * (1 - ux * ux)));
          var amount = Math.min(distance, Math.max(0.3, effectiveSpeed) * dt), separation = 1;
          if (ctx.local) for (var other = 0; other < bots.length; other++) {
            var o = bots[other]; if (o === b || o.dead || o.expedition || o.id > b.id) continue;
            var ox = o.px - b.px, oz = o.pz - b.pz, od = Math.hypot(ox, oz);
            if (od < 0.72 && od > 0.05 && (ox * dx + oz * dz) / (od * distance) > 0.65) separation = 0.22;
          }
          amount *= separation;
          var nx = b.px + dx / distance * amount, nz = b.pz + dz / distance * amount;
          if (!botBlocked(ctx, nx, nz) && botSolid(ctx, nx, nz)) { b.px = nx; b.pz = nz; b.blockedT = 0; }
          else { b.route = []; b.replanT = 0; }
        }
      }
    }
    if (!b.jump) {
      if (botSolid(ctx, b.px, b.pz)) { b.py = KEY_H; b.vy = 0; b.grounded = true; }
      else { b.vy -= GRAVITY * dt; b.py += b.vy * dt; b.grounded = false; }
    }
    var row = ctx.rows.get(Math.floor(b.pz));
    if (b.grounded && row && row.type[botLane(b.px)] === 1 && !botDanger(ctx, b.px, b.py, b.pz, nowSec)) b.checkpoint = { x: b.px, z: b.pz };
    return Math.hypot(b.px - laneX(botLane(target.x)), b.pz - (Math.floor(target.z) + 0.5)) < 0.16 && !b.jump;
  }

  function botStartExpedition(b, ti, idx) {
    b.expedition = botCourse(ti, idx); b.roomTemplate = ti; b.roomIndex = idx;
    b.px = -0.5; b.pz = -1.5; b.py = KEY_H; b.grounded = true; b.jump = null;
    b.route = []; b.routeGoal = ''; b.checkpoint = { x: b.px, z: b.pz }; b.hp = 3; b.binv = 1;
    b.rig.group.visible = false;
  }

  function botCombat(b, ctx, dt) {
    b.attackCd = Math.max(0, b.attackCd - dt); b.attackT = Math.max(0, b.attackT - dt);
    var nearest = null, best = Infinity;
    for (var i = 0; i < ctx.enemies.length; i++) {
      var enemy = ctx.enemies[i]; if (enemy.dead) continue;
      var dist = Math.hypot(enemy.px - b.px, enemy.pz - b.pz);
      if (dist < best) { nearest = enemy; best = dist; }
    }
    if (!nearest) return null;
    if (ctx.local && (b.pz < arena.z0 - 1 || b.pz > arena.z1 + 2)) return null;
    if (best < 1.8 && b.attackCd <= 0) {
      b.attackCd = 0.6; b.attackT = 0.22; nearest.hp--; nearest.flash = 0.2;
      if (nearest.hp <= 0) { nearest.dead = true; nearest.deadT = 0; }
    }
    if (best < 1.6 && !nearest.dead) {
      nearest.botAttackCd = (nearest.botAttackCd || 0) - dt;
      if (nearest.botAttackCd <= 0) { nearest.botAttackCd = 1.4; hurtBot(b); }
    }
    return best > 1.5 ? { x: nearest.px, z: nearest.pz } : { x: b.px, z: b.pz };
  }

  // Проверка попадания бота в ловушку (шипы + движущиеся сущности)
  function botTrapCheck(b, ctx) {
    if (b.binv <= 0 && botDanger(ctx || botWorld(), b.px, b.py, b.pz, nowSec)) hurtBot(b);
    if (b.py < -2 && !b.dead) { b.dead = true; b.respawnT = 1.8; }
  }

  /* ============ Монстры (детализированные, процедурные) ============ */

  function createMonster(scheme) {
    var g = new THREE.Group();
    var bodyMat = toyMaterial(scheme.body);
    var bellyMat = toyMaterial(scheme.belly);
    var hornMat = toyMaterial(scheme.horn);
    var white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var red = new THREE.MeshLambertMaterial({ color: 0x392c46 });
    var dark = new THREE.MeshLambertMaterial({ color: 0x1a0d05 });

    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.75), bodyMat);
    torso.position.y = 0.85;
    g.add(torso);
    var belly = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.08), bellyMat);
    belly.position.set(0, 0.78, 0.36);
    g.add(belly);

    var head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.7), bodyMat);
    head.position.y = 1.55;
    g.add(head);

    // Челюсть с зубами (жуёт)
    var jaw = new THREE.Group();
    jaw.position.set(0, 1.28, 0.15);
    var jawBox = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.2, 0.55), bellyMat);
    jawBox.position.set(0, -0.08, 0.08);
    jaw.add(jawBox);
    for (var t = -1; t <= 1; t++) {
      var tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), white);
      tooth.position.set(t * 0.2, 0.06, 0.33);
      jaw.add(tooth);
    }
    g.add(jaw);

    // Глаза со злыми бровями
    for (var s = -1; s <= 1; s += 2) {
      var eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.05), white);
      eye.position.set(s * 0.2, 1.62, 0.36);
      g.add(eye);
      var pupil = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.03), red);
      pupil.position.set(s * 0.2, 1.6, 0.39);
      g.add(pupil);
      var brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), dark);
      brow.position.set(s * 0.2, 1.76, 0.36);
      brow.rotation.z = -s * 0.45;
      g.add(brow);
      // Рога
      var horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 8), hornMat);
      horn.position.set(s * 0.28, 1.98, 0);
      horn.rotation.z = -s * 0.4;
      g.add(horn);
      var cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bellyMat);
      cheek.scale.z = 0.25; cheek.position.set(s * 0.32, 1.48, 0.37); g.add(cheek);
      var glint = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.032, 0.015), white);
      glint.position.set(s * 0.2 - 0.015, 1.63, 0.412); g.add(glint);
    }
    var icing = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.1, 0.73), hornMat);
    icing.position.y = 1.86; g.add(icing);
    for (var sprinkleId = 0; sprinkleId < 4; sprinkleId++) {
      var sprinkle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.17), toyMaterial(CANDY_COLORS[sprinkleId]));
      sprinkle.position.set(-0.27 + sprinkleId * 0.18, 1.93, (sprinkleId % 2 ? 0.12 : -0.1));
      sprinkle.rotation.y = sprinkleId * 0.9; g.add(sprinkle);
    }

    // Лапы
    function limb(x, y, w, h) {
      var lg = new THREE.Group();
      lg.position.set(x, y, 0);
      var box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), bodyMat);
      box.position.y = -h / 2;
      lg.add(box);
      return lg;
    }
    var armL = limb(-0.62, 1.1, 0.22, 0.6);
    var armR = limb(0.62, 1.1, 0.22, 0.6);
    var legL = limb(-0.25, 0.5, 0.3, 0.48);
    var legR = limb(0.25, 0.5, 0.3, 0.48);
    g.add(armL); g.add(armR); g.add(legL); g.add(legR);

    castShadows(g);
    return { obj: g, m: { jaw: jaw, armL: armL, armR: armR, legL: legL, legR: legR, phase: Math.random() * 6 } };
  }

  /* ============ Питомцы (детализированные 3D-модели) ============ */

  function createPetModel(pid) {
    var g = new THREE.Group();
    var parts = { wings: [], tail: null };
    function mat(c) { return toyMaterial(c); }
    function petBox(parent, w, h, d, material, x, y, z) {
      var mesh = new THREE.Mesh(toyBox(w, h, d), material);
      mesh.position.set(x || 0, y || 0, z || 0); parent.add(mesh); return mesh;
    }
    function petBall(parent, radius, material, x, y, z) {
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
      mesh.position.set(x || 0, y || 0, z || 0); parent.add(mesh); return mesh;
    }

    if (pid === 'bear') {
      // Шоко-мишка
      var brown = mat(0x8a5a2a), cream = mat(0xc9925a), dark = mat(0x2a1408);
      var body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.28), brown);
      body.position.y = 0.18;
      g.add(body);
      var belly = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.03), cream);
      belly.position.set(0, 0.16, 0.145);
      g.add(belly);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), brown);
      head.position.y = 0.52;
      g.add(head);
      var muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.06), cream);
      muzzle.position.set(0, 0.46, 0.17);
      g.add(muzzle);
      var nose = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), dark);
      nose.position.set(0, 0.5, 0.2);
      g.add(nose);
      for (var s = -1; s <= 1; s += 2) {
        var ear = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.07), brown);
        ear.position.set(s * 0.14, 0.7, 0);
        g.add(ear);
        var earIn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), cream);
        earIn.position.set(s * 0.14, 0.7, 0.04);
        g.add(earIn);
        var eye = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.02), dark);
        eye.position.set(s * 0.09, 0.56, 0.155);
        g.add(eye);
        var paw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.1), brown);
        paw.position.set(s * 0.15, 0.04, 0.06);
        g.add(paw);
      }
    } else if (pid === 'cat') {
      // Карамельный кот
      var cara = mat(0xd9883f), cream2 = mat(0xf5d6ad), dark2 = mat(0x2a1408), stripeM = mat(0xa9611f);
      var cbody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.4), cara);
      cbody.position.y = 0.16;
      g.add(cbody);
      for (var st = 0; st < 2; st++) {
        var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.07), stripeM);
        stripe.position.set(0, 0.28, -0.1 + st * 0.16);
        g.add(stripe);
      }
      var chead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.26), cara);
      chead.position.set(0, 0.46, 0.14);
      g.add(chead);
      var cmuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.04), cream2);
      cmuzzle.position.set(0, 0.41, 0.28);
      g.add(cmuzzle);
      var cnose = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.02), mat(0xff8fa0));
      cnose.position.set(0, 0.45, 0.3);
      g.add(cnose);
      for (var cs = -1; cs <= 1; cs += 2) {
        var cear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), cara);
        cear.position.set(cs * 0.11, 0.65, 0.12);
        g.add(cear);
        var ceye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.02), dark2);
        ceye.position.set(cs * 0.08, 0.5, 0.275);
        g.add(ceye);
        // усы
        for (var wh = 0; wh < 2; wh++) {
          var whisk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.012), cream2);
          whisk.position.set(cs * 0.2, 0.41 + wh * 0.03, 0.27);
          whisk.rotation.z = cs * (0.12 - wh * 0.24);
          g.add(whisk);
        }
        var cpaw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.09), cara);
        cpaw.position.set(cs * 0.12, 0.03, 0.16);
        g.add(cpaw);
      }
      // хвост (виляет)
      var tail = new THREE.Group();
      tail.position.set(0, 0.24, -0.2);
      var tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), cara);
      tailMesh.position.set(0, 0.06, -0.15);
      tailMesh.rotation.x = -0.5;
      tail.add(tailMesh);
      var tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.1), cream2);
      tailTip.position.set(0, 0.14, -0.28);
      tail.add(tailTip);
      g.add(tail);
      parts.tail = tail;
    } else if (pid === 'bunny') {
      var bunCream = mat(0xffefda), bunPink = mat(0xe9a2b2), bunDark = mat(0x51404d), bunWhite = mat(0xffffff);
      petBox(g, 0.4, 0.34, 0.34, bunCream, 0, 0.2, 0);
      petBox(g, 0.23, 0.24, 0.025, bunPink, 0, 0.21, 0.175);
      petBox(g, 0.4, 0.33, 0.35, bunCream, 0, 0.57, 0.025);
      for (var bs = -1; bs <= 1; bs += 2) {
        var earGroup = new THREE.Group(); earGroup.position.set(bs * 0.12, 0.74, 0.02); earGroup.rotation.z = -bs * 0.16;
        petBox(earGroup, 0.115, 0.39, 0.1, bunCream, 0, 0.16, 0);
        petBox(earGroup, 0.055, 0.28, 0.025, bunPink, 0, 0.17, 0.06); g.add(earGroup);
        petBox(g, 0.14, 0.1, 0.21, bunPink, bs * 0.145, 0.035, 0.11);
        petBox(g, 0.05, 0.062, 0.035, bunDark, bs * 0.095, 0.595, 0.211);
        petBox(g, 0.018, 0.022, 0.012, bunWhite, bs * 0.095 - 0.01, 0.614, 0.234);
        var cheek = petBall(g, 0.06, bunPink, bs * 0.143, 0.523, 0.199); cheek.scale.z = 0.22;
      }
      petBox(g, 0.055, 0.037, 0.035, bunPink, 0, 0.538, 0.224);
      petBox(g, 0.06, 0.055, 0.02, bunWhite, 0, 0.49, 0.218);
      var bunnyTail = new THREE.Group(); bunnyTail.position.set(0, 0.23, -0.23); petBall(bunnyTail, 0.115, bunCream, 0, 0, 0); g.add(bunnyTail); parts.tail = bunnyTail;
    } else if (pid === 'fox') {
      var foxOrange = mat(0xd9945b), foxCream = mat(0xffe8c6), foxDark = mat(0x4d3741), foxWhite = mat(0xffffff);
      petBox(g, 0.39, 0.3, 0.5, foxOrange, 0, 0.21, 0);
      petBox(g, 0.37, 0.32, 0.33, foxOrange, 0, 0.55, 0.15);
      petBox(g, 0.26, 0.14, 0.12, foxCream, 0, 0.48, 0.33);
      petBox(g, 0.065, 0.052, 0.04, foxDark, 0, 0.51, 0.407);
      for (var fs = -1; fs <= 1; fs += 2) {
        var foxEar = new THREE.Mesh(new THREE.ConeGeometry(0.104, 0.25, 4), foxOrange); foxEar.position.set(fs * 0.125, 0.8, 0.11); foxEar.rotation.z = -fs * 0.16; g.add(foxEar);
        var earInner = new THREE.Mesh(new THREE.ConeGeometry(0.057, 0.15, 4), foxCream); earInner.position.set(fs * 0.125, 0.81, 0.158); g.add(earInner);
        petBox(g, 0.048, 0.063, 0.03, foxDark, fs * 0.105, 0.59, 0.326);
        petBox(g, 0.015, 0.023, 0.01, foxWhite, fs * 0.105 - 0.009, 0.61, 0.347);
        petBox(g, 0.1, 0.1, 0.14, foxDark, fs * 0.135, 0.04, 0.17);
        petBox(g, 0.1, 0.1, 0.14, foxDark, fs * 0.135, 0.04, -0.17);
      }
      var foxTail = new THREE.Group(); foxTail.position.set(0, 0.26, -0.21);
      var fluffy = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.56, 5), foxOrange); fluffy.rotation.x = -Math.PI / 2; fluffy.position.set(0, 0.07, -0.22); foxTail.add(fluffy);
      var creamTip = new THREE.Mesh(new THREE.ConeGeometry(0.093, 0.24, 5), foxCream); creamTip.rotation.x = -Math.PI / 2; creamTip.position.set(0, 0.07, -0.49); foxTail.add(creamTip);
      g.add(foxTail); parts.tail = foxTail;
    } else if (pid === 'owl') {
      var owlPurple = mat(0x9f88bc), owlDark = mat(0x675d87), owlCream = mat(0xffeacc), owlEye = mat(0x323648), owlGold = mat(0xe9b677), owlWhite = mat(0xffffff);
      petBox(g, 0.46, 0.44, 0.35, owlPurple, 0, 0.3, 0);
      petBox(g, 0.49, 0.3, 0.37, owlDark, 0, 0.61, 0.02);
      petBox(g, 0.29, 0.26, 0.04, owlCream, 0, 0.3, 0.187);
      for (var os = -1; os <= 1; os += 2) {
        var eyeRing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), owlCream); eyeRing.rotation.x = Math.PI / 2; eyeRing.position.set(os * 0.125, 0.63, 0.222); g.add(eyeRing);
        var pupil = petBall(g, 0.055, owlEye, os * 0.125, 0.637, 0.255); pupil.scale.z = 0.38;
        petBall(g, 0.016, owlWhite, os * 0.125 - 0.018, 0.66, 0.277);
        var tuft = new THREE.Mesh(new THREE.ConeGeometry(0.078, 0.2, 4), owlPurple); tuft.position.set(os * 0.18, 0.815, 0); tuft.rotation.z = -os * 0.2; g.add(tuft);
        petBox(g, 0.14, 0.065, 0.18, owlGold, os * 0.12, 0.045, 0.08);
        var owlWing = new THREE.Group(); owlWing.position.set(os * 0.22, 0.43, -0.035);
        var feather = petBox(owlWing, 0.22, 0.28, 0.085, owlPurple, os * 0.09, -0.1, 0); feather.rotation.z = os * 0.22;
        petBox(owlWing, 0.12, 0.18, 0.1, owlDark, os * 0.17, -0.23, 0); g.add(owlWing); parts.wings.push(owlWing);
      }
      var beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.115, 4), owlGold); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.544, 0.255); g.add(beak);
      for (var featherId = 0; featherId < 3; featherId++) petBox(g, 0.035, 0.06, 0.02, owlPurple, -0.08 + featherId * 0.08, 0.31, 0.214);
    } else {
      // Мармеладный дракон
      var green = mat(0x58c470), light = mat(0x8ce0a0), horn = mat(0xfff2e0), dark3 = mat(0x1a3d24), wingM = mat(0x3fa93f);
      var dbody = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.42), green);
      dbody.position.y = 0.2;
      g.add(dbody);
      var dbelly = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.03), light);
      dbelly.position.set(0, 0.17, 0.215);
      g.add(dbelly);
      var dhead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.26), green);
      dhead.position.set(0, 0.52, 0.16);
      g.add(dhead);
      var snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), light);
      snout.position.set(0, 0.47, 0.33);
      g.add(snout);
      for (var ns = -1; ns <= 1; ns += 2) {
        var nostril = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), dark3);
        nostril.position.set(ns * 0.05, 0.49, 0.4);
        g.add(nostril);
        var dhorn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), horn);
        dhorn.position.set(ns * 0.1, 0.7, 0.08);
        dhorn.rotation.z = -ns * 0.3;
        g.add(dhorn);
        var deye = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.02), dark3);
        deye.position.set(ns * 0.09, 0.56, 0.29);
        g.add(deye);
        // крылья (машут)
        var wing = new THREE.Group();
        wing.position.set(ns * 0.18, 0.34, -0.02);
        var wingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), wingM);
        wingMesh.position.x = ns * 0.18;
        wing.add(wingMesh);
        var wingTip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), wingM);
        wingTip.position.set(ns * 0.36, 0, -0.06);
        wing.add(wingTip);
        g.add(wing);
        parts.wings.push(wing);
      }
      // хвост с шипом
      var dtail = new THREE.Group();
      dtail.position.set(0, 0.2, -0.24);
      var dtailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.3), green);
      dtailMesh.position.z = -0.14;
      dtail.add(dtailMesh);
      var dtip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), horn);
      dtip.rotation.x = -Math.PI / 2;
      dtip.position.z = -0.34;
      dtail.add(dtip);
      g.add(dtail);
      parts.tail = dtail;
      // гребень на спине
      for (var sp2 = 0; sp2 < 3; sp2++) {
        var crest = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 4), wingM);
        crest.position.set(0, 0.38, 0.08 - sp2 * 0.12);
        g.add(crest);
      }
    }

    // Rounded reusable toy boxes and a travel tag unify all six companions.
    g.traverse(function (mesh) {
      if (!mesh.isMesh || mesh.geometry.type !== 'BoxGeometry') return;
      var geo = mesh.geometry, p = geo.parameters, rounded = toyBox(p.width, p.height, p.depth);
      if (geo !== rounded) { mesh.geometry = rounded; geo.dispose(); }
    });
    var collar = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.055, 0.31), mat(0x74cdbb));
    collar.position.set(0, pid === 'owl' ? 0.43 : 0.34, pid === 'bear' || pid === 'bunny' || pid === 'owl' ? 0 : 0.12); g.add(collar);
    var tag = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mat(0xffd99a));
    tag.scale.z = 0.35; tag.position.set(0, pid === 'owl' ? 0.39 : 0.3, pid === 'bear' || pid === 'bunny' || pid === 'owl' ? 0.195 : 0.3); g.add(tag);
    castShadows(g);
    return { group: g, parts: parts, pid: pid };
  }

  /* ============ Вендоры (уникальные NPC) ============ */

  function createVendorNpc(id) {
    var ch;
    if (id === 'speed') {
      // спортсмен-бегун
      ch = createCharacter({ skin: 0xe9ad88, shirt: 0xffffff, front: 0xdd3344, pants: 0xdd3344, hair: 'none' });
      addCap(ch, 0xdd3344);
    } else if (id === 'jump') {
      // «кролик»
      ch = createCharacter({ skin: 0xffd9b3, shirt: 0x9fd7f5, pants: 0xffffff, hair: 'none' });
      addBunnyEars(ch);
    } else if (id === 'income') {
      // богач в цилиндре
      ch = createCharacter({ skin: 0xc58d69, shirt: 0x1a1a1a, front: 0xffffff, pants: 0x1a1a1a, hair: 'none' });
      addTopHat(ch);
      addChain(ch);
    } else if (id === 'pets') {
      // девушка с питомцем на плече
      ch = createCharacter({ skin: 0xffd9b3, shirt: 0xff8fc0, pants: 0xc589e8, hair: 'long', hairColor: 0x8a5a2a });
      addShoulderPet(ch);
    } else if (id === 'attack') {
      // воин с мечом
      ch = createCharacter({ skin: 0xd98a5a, shirt: 0x8a2a2a, front: 0xb03030, pants: 0x3a2a1a, hair: 'flat', hairColor: 0x111111 });
      addSword(ch);
    } else if (id === 'hp') {
      // «медсестра» с крестом
      ch = createCharacter({ skin: 0xffd9b3, shirt: 0xffffff, front: 0xff6b7d, pants: 0xffffff, hair: 'long', hairColor: 0xc06030 });
      addCross(ch);
    } else {
      // именинник с подарком
      ch = createCharacter({ skin: 0xf2bd97, shirt: 0xb9a0dd, pants: 0x444c64, hair: 'side', hairColor: 0x222222 });
      addPartyHat(ch);
      addGiftInHands(ch);
    }
    return { ch: ch, id: id, phase: Math.random() * 6 };
  }

  function addSword(ch) {
    ch.armR.rotation.x = -0.4;
    var blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.0, 0.04),
      new THREE.MeshLambertMaterial({ color: 0xd8dbe0 })
    );
    blade.position.set(0.62, 1.75, 0.15);
    ch.body.add(blade);
    var hilt = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.09, 0.09),
      new THREE.MeshLambertMaterial({ color: 0xffd23f })
    );
    hilt.position.set(0.62, 1.22, 0.15);
    ch.body.add(hilt);
  }

  function addCross(ch) {
    var red = new THREE.MeshLambertMaterial({ color: 0xff3b52 });
    var v = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.05), red);
    v.position.set(0, 1.2, 0.22);
    ch.body.add(v);
    var h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.05), red);
    h.position.set(0, 1.2, 0.22);
    ch.body.add(h);
  }

  /* ============ Сцена ============ */

  function buildKeycapGeometry() {
    // A gently bevelled injection-moulded key. Shared by every instance.
    var shape = new THREE.Shape(), h = 0.385, r = 0.065;
    shape.moveTo(-h + r, -h);
    shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r);
    shape.lineTo(h, h - r); shape.quadraticCurveTo(h, h, h - r, h);
    shape.lineTo(-h + r, h); shape.quadraticCurveTo(-h, h, -h, h - r);
    shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: KEY_H - 0.13, bevelEnabled: true, bevelSegments: 2,
      steps: 1, bevelSize: 0.065, bevelThickness: 0.065, curveSegments: 2
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.065, 0);
    var pos = geo.attributes.position;
    geo.computeVertexNormals();
    // Запечённое затенение: верх клавиши светлее, бока темнее (объём без света)
    var colAttr = new Float32Array(pos.count * 3);
    for (var v = 0; v < pos.count; v++) {
      var y = pos.getY(v);
      var shade = 0.76 + 0.24 * (y / KEY_H);
      colAttr[v * 3] = shade; colAttr[v * 3 + 1] = shade; colAttr[v * 3 + 2] = shade;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colAttr, 3));
    return geo;
  }

  function buildFloor() {
    var count = VISIBLE * LANES;

    keysMesh = new THREE.InstancedMesh(
      buildKeycapGeometry(),
      new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, specular: 0x5f5147, shininess: 38 }),
      count
    );
    keysMesh.frustumCulled = false;
    keysMesh.receiveShadow = true;
    for (var i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.0001, 0.0001, 0.0001); dummy.updateMatrix();
      keysMesh.setMatrixAt(i, dummy.matrix);
      keysMesh.setColorAt(i, tmpColor.setHex(0xffffff));
    }
    scene.add(keysMesh);

    var letterGeo = new THREE.PlaneGeometry(0.58, 0.58);
    letterGeo.rotateX(-Math.PI / 2);
    lettersUvAttr = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    letterGeo.setAttribute('uvOffset', lettersUvAttr);

    var letterMat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        map: { value: makeLetterAtlas() },
        color: { value: new THREE.Color(0x3d1e0c) },
        uvScale: { value: new THREE.Vector2(1 / 6, 1 / 5) },
        fogColor: { value: new THREE.Color(0xe5d8ce) },
        fogNear: { value: 35 },
        fogFar: { value: 76 }
      },
      vertexShader: [
        'attribute vec2 uvOffset;',
        'uniform vec2 uvScale;',
        'varying vec2 vUv;',
        'varying float vFogDepth;',
        'void main() {',
        '  vUv = uv * uvScale + uvOffset;',
        '  vec4 mvPosition;',
        '  #ifdef USE_INSTANCING',
        '    mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);',
        '  #else',
        '    mvPosition = modelViewMatrix * vec4(position, 1.0);',
        '  #endif',
        '  vFogDepth = -mvPosition.z;',
        '  gl_Position = projectionMatrix * mvPosition;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D map;',
        'uniform vec3 color;',
        'uniform vec3 fogColor;',
        'uniform float fogNear;',
        'uniform float fogFar;',
        'varying vec2 vUv;',
        'varying float vFogDepth;',
        'void main() {',
        '  vec4 tex = texture2D(map, vUv);',
        '  if (tex.a < 0.45) discard;',
        '  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);',
        '  gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);',
        '}'
      ].join('\n')
    });

    lettersMesh = new THREE.InstancedMesh(letterGeo, letterMat, count);
    lettersMesh.frustumCulled = false;
    for (var j = 0; j < count; j++) {
      dummy.position.set(0, 0, 0); dummy.scale.set(0.0001, 0.0001, 0.0001); dummy.updateMatrix();
      lettersMesh.setMatrixAt(j, dummy.matrix);
    }
    scene.add(lettersMesh);

    spikesMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.16, 0.6, 6),
      new THREE.MeshLambertMaterial({ color: 0xe8e0d8 }),
      SPIKE_POOL
    );
    spikesMesh.frustumCulled = false;
    spikesMesh.count = 0;
    scene.add(spikesMesh);
  }

  function makeSkyTexture() {
    var c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#79b8d7');
    grad.addColorStop(0.45, '#b7dce7');
    grad.addColorStop(0.8, '#f8e6d5');
    grad.addColorStop(1.0, '#f2d3bf');
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 256);
    return colorCanvasTexture(c);
  }

  function buildEnvironment() {
    var horizon = 0xe5d8ce;
    scene.fog = new THREE.Fog(horizon, 35, 76);

    // Купол неба с вертикальным градиентом (рисуется первым, за всей сценой)
    var skyMat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false, toneMapped: false });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 16), skyMat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);
    skyMesh = sky;

    // Освещение: тёплое небо + прохладная подсветка снизу + солнце с мягкой тенью
    scene.add(new THREE.HemisphereLight(0xffeddf, 0x66777e, 0.48));
    var fill = new THREE.DirectionalLight(0xbedbea, 0.16);
    fill.position.set(-8, 6, -6);
    scene.add(fill);

    sunLight = new THREE.DirectionalLight(0xffebd3, 0.66);
    sunLight.position.set(9, 16, 6);
    if (SHADOWS) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      var sc = sunLight.shadow.camera;
      sc.near = 1; sc.far = 70; sc.left = -18; sc.right = 18; sc.top = 22; sc.bottom = -22;
      sunLight.shadow.bias = -0.00015;
      sunLight.shadow.normalBias = 0.055;
      scene.add(sunLight.target);
    }
    scene.add(sunLight);

    // Глянцевая шоколадная река (Phong даёт блики от солнца)
    liquidMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_HALF * 2 + 1.4, 120, 20, 40),
      new THREE.MeshPhongMaterial({ color: 0x563629, specular: 0x40352c, shininess: 48, emissive: 0x100704 })
    );
    liquidMesh.rotation.x = -Math.PI / 2;
    liquidMesh.position.y = -0.55;
    liquidBase = liquidMesh.geometry.attributes.position.array.slice();
    scene.add(liquidMesh);

    // широкая «зелёная» земля вокруг (открытый мир, а не коробка);
    // ниже шоколадной реки, чтобы дыры в поле по-прежнему показывали шоколад
    deckMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 130),
      new THREE.MeshLambertMaterial({ color: 0x8fbea9 })
    );
    deckMesh.rotation.x = -Math.PI / 2;
    deckMesh.position.y = -0.62;
    deckMesh.receiveShadow = true;
    scene.add(deckMesh);

    // Стен по краям больше нет — открытый мир (бортик убран)
    wallLMesh = null;
    wallRMesh = null;

    buildWorldScenery();
    buildSparkles();
  }

  // Открытый конфетный пейзаж по бокам поля (следует за игроком)
  function buildWorldScenery() {
    worldScenery = new THREE.Group();
    var hillColors = [0xffd0e0, 0xffe4b8, 0xd4f0d4, 0xe4d4ff, 0xffc8dc, 0xd0ecff];
    for (var side = -1; side <= 1; side += 2) {
      // холмы двумя рядами (ближе и дальше)
      for (var i = 0; i < 8; i++) {
        var z = (i - 4) * 16 + (Math.random() * 8);
        var nearRadius = 6 + Math.random() * 5;
        var near = new THREE.Mesh(new THREE.SphereGeometry(nearRadius, 14, 10),
          new THREE.MeshLambertMaterial({ color: hillColors[(i + (side > 0 ? 3 : 0)) % hillColors.length] }));
        near.scale.y = 0.45;
        near.position.set(side * (FIELD_HALF + nearRadius + 4 + Math.random() * 4), -2 + Math.random() * 1.5, z);
        worldScenery.add(near);
        var far = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 8, 14, 10),
          new THREE.MeshLambertMaterial({ color: hillColors[(i + 2) % hillColors.length] }));
        far.scale.y = 0.4;
        far.position.set(side * (36 + Math.random() * 12), -3, z * 1.3);
        worldScenery.add(far);
      }
      // гигантские леденцы и деревья по краям
      for (var j = 0; j < 6; j++) {
        var lz = (j - 3) * 20 + Math.random() * 10;
        var lx = side * (14 + Math.random() * 3);
        if (Math.random() < 0.5) {
          var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
          stick.position.set(lx, 2.5, lz);
          worldScenery.add(stick);
          var head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 12), new THREE.MeshLambertMaterial({ color: CANDY_COLORS[(Math.random() * CANDY_COLORS.length) | 0] }));
          head.scale.z = 0.4; head.position.set(lx, 5.5, lz);
          head.rotation.y = Math.PI / 2;
          worldScenery.add(head);
          var swirl = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.17, 6, 24), toyMaterial(0xfff4e7));
          swirl.rotation.y = Math.PI / 2;
          swirl.position.set(lx - side * 0.51, 5.5, lz); worldScenery.add(swirl);
        } else {
          var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 3.4, 8), new THREE.MeshLambertMaterial({ color: 0x9a6a3a }));
          trunk.position.set(lx, 1.7, lz);
          worldScenery.add(trunk);
          var can = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 12), new THREE.MeshLambertMaterial({ color: 0x74cf5a }));
          can.scale.y = 0.85; can.position.set(lx, 4.2, lz);
          worldScenery.add(can);
        }
      }
      // A small confectionery skyline gives the open landscape recognisable
      // silhouettes; all façades remain well outside the playable keyboard.
      for (var houseId = 0; houseId < 2; houseId++) {
        var house = new THREE.Group();
        var houseColor = side > 0 ? 0x91cabb : 0xe7a195;
        var facade = sweetBox(2.6, 2.65, 2.25, toyMaterial(houseColor), 0.13);
        facade.position.y = 0.8; house.add(facade);
        var roof = new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.5, 4), toyMaterial(0xf6dfb7));
        roof.rotation.y = Math.PI / 4; roof.position.y = 2.76; house.add(roof);
        var eave = sweetBox(2.82, 0.16, 2.48, toyMaterial(0x765547), 0.055);
        eave.position.y = 2.09; house.add(eave);
        var door = sweetBox(0.58, 1.12, 0.13, toyMaterial(0x6c6869), 0.035);
        door.position.set(0, 0.04, -1.18); house.add(door);
        for (var winSide = -1; winSide <= 1; winSide += 2) {
          var windowFrame = sweetBox(0.64, 0.86, 0.11, toyMaterial(0xffedce), 0.035);
          windowFrame.position.set(winSide * 0.83, 1.13, -1.18); house.add(windowFrame);
          var glass = sweetBox(0.42, 0.6, 0.05, toyMaterial(0x689dba), 0.014);
          glass.position.set(winSide * 0.83, 1.13, -1.26); house.add(glass);
          var sill = sweetBox(0.7, 0.1, 0.26, toyMaterial(0xffedce), 0.025);
          sill.position.set(winSide * 0.83, 0.69, -1.26); house.add(sill);
        }
        var chimney = sweetBox(0.42, 1.2, 0.42, toyMaterial(0x765547), 0.035);
        chimney.position.set(0.7, 2.85, 0.45); house.add(chimney);
        var chimneyCap = sweetBox(0.58, 0.14, 0.58, toyMaterial(0xffedce), 0.035);
        chimneyCap.position.set(0.7, 3.45, 0.45); house.add(chimneyCap);
        house.rotation.y = side * Math.PI / 2;
        house.position.set(side * (16.7 + houseId * 2), 0, 13 + houseId * 29);
        worldScenery.add(house);
      }
    }
    // облака
    for (var c = 0; c < 16; c++) {
      var cloud = new THREE.Group();
      var n = 3 + (Math.random() * 3 | 0);
      for (var k = 0; k < n; k++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random() * 1.4, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        puff.position.set((k - n / 2) * 1.8, Math.random() * 0.8, Math.random() * 1.4); puff.scale.y = 0.7; cloud.add(puff);
      }
      cloud.position.set((Math.random() - 0.5) * 90, 13 + Math.random() * 12, (Math.random() - 0.5) * 120);
      worldScenery.add(cloud);
    }
    scene.add(worldScenery);
  }

  // Атмосферные плавающие искры-боке
  function buildSparkles() {
    var tex = makeGlowTexture();
    for (var i = 0; i < SPARKLE_COUNT; i++) {
      var col = CANDY_COLORS[(Math.random() * CANDY_COLORS.length) | 0];
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: col, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      var sz = 0.16 + Math.random() * 0.3;
      spr.scale.set(sz, sz, 1);
      spr.userData = {
        ox: (Math.random() - 0.5) * 24,
        oy: 1 + Math.random() * 6,
        oz: (Math.random() - 0.5) * 60,
        sway: Math.random() * 6.28, swaySpeed: 0.3 + Math.random() * 0.5,
        drift: 0.2 + Math.random() * 0.4
      };
      scene.add(spr);
      sparkles.push(spr);
    }
  }

  function makeGlowTexture() {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return colorCanvasTexture(c);
  }

  function buildPools() {
    var ballGeo = new THREE.SphereGeometry(0.3, 14, 12);
    var wrapGeo = new THREE.ConeGeometry(0.14, 0.26, 8);
    if (!glowTex) glowTex = makeGlowTexture();
    for (var i = 0; i < CANDY_POOL; i++) {
      var g = new THREE.Group();
      var cc = CANDY_COLORS[i % CANDY_COLORS.length];
      g.add(new THREE.Mesh(ballGeo, new THREE.MeshPhongMaterial({ color: cc, specular: 0xffffff, shininess: 70, emissive: cc, emissiveIntensity: 0.15 })));
      var wrapMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      var w1 = new THREE.Mesh(wrapGeo, wrapMat);
      w1.rotation.z = Math.PI / 2; w1.position.x = -0.42;
      g.add(w1);
      var w2 = new THREE.Mesh(wrapGeo, wrapMat);
      w2.rotation.z = -Math.PI / 2; w2.position.x = 0.42;
      g.add(w2);
      // мягкое свечение вокруг конфеты
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: cc, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      glow.scale.set(1.7, 1.7, 1);
      g.add(glow);
      castShadows(g);
      g.visible = false;
      scene.add(g);
      candyPool.push(g);
    }

    texBlob = makeBlobTexture();
    for (var p = 0; p < PARTICLE_POOL; p++) {
      var mat = new THREE.SpriteMaterial({ map: texBlob, transparent: true, depthWrite: false });
      var s = new THREE.Sprite(mat);
      s.visible = false;
      s.userData = { life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grav: 0 };
      scene.add(s);
      particlePool.push(s);
    }

    // Поршни-давилки
    var pistonMat = toyMaterial(0xd7a069);
    var pistonTopMat = toyMaterial(0x536e75);
    for (var q = 0; q < PISTON_POOL; q++) {
      var pg = new THREE.Group();
      pg.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.7), pistonMat));
      var top = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 1.8), pistonTopMat);
      top.position.y = 0.9;
      pg.add(top);
      var bottom = top.clone(); bottom.position.y = -0.82; pg.add(bottom);
      // Waffle-grid ribs and a bright warning centre remain legible in motion.
      var ribGeo = new THREE.BoxGeometry(0.1, 1.4, 0.08);
      for (var rib = 0; rib < 5; rib++) {
        var waffle = new THREE.Mesh(ribGeo, pistonTopMat);
        waffle.position.set(-1 + rib * 0.5, 0, -0.88); pg.add(waffle);
      }
      var stamp = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), toyMaterial(0xf8dc8c));
      stamp.rotation.x = Math.PI / 2; stamp.position.z = -0.95; pg.add(stamp);
      pg.visible = false;
      scene.add(pg);
      pistonPool.push({ obj: pg, m: null });
    }

    // Монстры
    for (var m = 0; m < MONSTER_POOL; m++) {
      var entry = createMonster(MONSTER_SCHEMES[m % MONSTER_SCHEMES.length]);
      entry.obj.visible = false;
      scene.add(entry.obj);
      monsterPool.push(entry);
    }
  }

  /* ============ Декор ============ */

  // Six confectionery districts shared by all 28 obstacle layouts.
  // Hazard colours stay fixed so their meaning never changes between districts.
  var ROOM_ART = [
    { accent: 0xe87c9f, dark: 0x9c4264, keys: [0xf9d4df, 0xffe7db, 0xf1acc5, 0xf8c3d6], prop: 0 },
    { accent: 0x66c9ba, dark: 0x366d69, keys: [0xd4f0e6, 0xe8f8e7, 0x9edbcb, 0xffeed4], prop: 0 },
    { accent: 0xe9b05b, dark: 0x784b39, keys: [0xd7a071, 0xffd99d, 0xe9bd88, 0xffe8c9], prop: 2 },
    { accent: 0xa799dc, dark: 0x685a9c, keys: [0xd9cdf2, 0xf2eaff, 0xbfb7e7, 0xffe1ec], prop: 1 },
    { accent: 0x69bddd, dark: 0x3f738d, keys: [0xc5e8f3, 0xf5f4e8, 0xa6d5e8, 0xddebf9], prop: 0 },
    { accent: 0xf19a78, dark: 0x9f5b49, keys: [0xffdfae, 0xffc9b0, 0xffedcc, 0xf5bba0], prop: 2 }
  ];
  var ROOM_ART_INDEX = [0, 2, 5, 4, 3, 1, 1, 5, 2, 0, 3, 4, 1, 2, 0, 4, 3, 2, 0, 5, 3, 1, 5, 4, 0, 1, 3, 5];
  var currentRoomArt = ROOM_ART[0];

  function toyMaterial(color) {
    return new THREE.MeshPhongMaterial({ color: color, specular: 0x746152, shininess: 42 });
  }

  function animateDecor(now) {
    for (var i = 0; i < decorations.length; i++) {
      var g = decorations[i], data = g.userData;
      g.visible = g.position.z > pz - 30 && g.position.z < pz + 52;
      if (!g.visible) continue;
      if (data.spinner) data.spinner.rotation.y = now * 0.0006 + g.position.z;
      if (data.wheel) data.wheel.rotation.z = now * 0.00028 + g.position.z;
      if (data.pennants) for (var p = 0; p < data.pennants.length; p++) data.pennants[p].rotation.z = Math.PI + Math.sin(now * 0.002 + p) * 0.12;
      if (data.sway) g.rotation.z = Math.sin(now * 0.0014 + g.position.z) * 0.025;
    }
  }

  function initDecorShared() {
    decorShared = {
      stick: new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8),
      head: new THREE.SphereGeometry(0.6, 14, 12),
      gum: new THREE.SphereGeometry(0.55, 12, 10),
      bar: new THREE.BoxGeometry(1.1, 0.4, 0.7),
      bulb: new THREE.SphereGeometry(0.13, 8, 8),
      band: new THREE.TorusGeometry(0.42, 0.075, 5, 20),
      white: toyMaterial(0xfff4df),
      choco: toyMaterial(0x744737),
      candyMats: CANDY_COLORS.map(function (c) { return toyMaterial(c); })
    };
  }

  function candyMat() {
    return decorShared.candyMats[(Math.random() * decorShared.candyMats.length) | 0];
  }

  function addProp(kind, x, z, yBase) {
    var g = new THREE.Group();
    if (kind === 0) { // леденец на палочке
      var stick = new THREE.Mesh(decorShared.stick, decorShared.white);
      stick.position.y = 1.1;
      g.add(stick);
      var spinner = new THREE.Group();
      spinner.position.y = 2.3;
      var head = new THREE.Mesh(decorShared.head, candyMat());
      head.scale.z = 0.35;
      spinner.add(head);
      for (var face = -1; face <= 1; face += 2) {
        var band = new THREE.Mesh(decorShared.band, decorShared.white);
        band.position.z = face * 0.17; spinner.add(band);
        var center = new THREE.Mesh(decorShared.bulb, decorShared.white);
        center.position.z = face * 0.23; spinner.add(center);
      }
      g.add(spinner); g.userData.spinner = spinner;
      g.userData.sway = true;
    } else if (kind === 1) { // мармеладки
      var gum = new THREE.Mesh(decorShared.gum, candyMat());
      gum.scale.y = 0.72;
      gum.position.y = 0.4;
      g.add(gum);
      var gum2 = new THREE.Mesh(decorShared.gum, candyMat());
      gum2.scale.set(0.6, 0.45, 0.6);
      gum2.position.set(0.5, 0.25, 0.4);
      g.add(gum2);
      var sugar = new THREE.Mesh(decorShared.band, decorShared.white);
      sugar.rotation.x = Math.PI / 2; sugar.scale.set(1.15, 1.15, 1); sugar.position.y = 0.14;
      g.add(sugar);
      var shine = new THREE.Mesh(decorShared.bulb, decorShared.white);
      shine.scale.set(0.6, 1.4, 0.25); shine.position.set(-0.18, 0.63, 0.35); g.add(shine);
    } else { // стопка шоколадных плиток
      var b1 = new THREE.Mesh(decorShared.bar, decorShared.choco);
      b1.position.y = 0.2;
      g.add(b1);
      var b2 = new THREE.Mesh(decorShared.bar, decorShared.choco);
      b2.position.y = 0.6;
      b2.rotation.y = 0.5;
      b2.scale.set(0.85, 1, 0.85);
      g.add(b2);
      for (var seg = 0; seg < 3; seg++) {
        var chunk = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.5), decorShared.choco);
        chunk.position.set(-0.3 + seg * 0.3, 0.85, 0); chunk.rotation.y = 0.5; g.add(chunk);
      }
      var wrapper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.73), decorShared.white);
      wrapper.position.set(-0.25, 0.21, 0); g.add(wrapper);
    }
    g.position.set(x, yBase !== undefined ? yBase : -0.6, z);
    castShadows(g);
    scene.add(g);
    decorations.push(g);
    return g;
  }

  function addGarland(z) {
    var g = new THREE.Group();
    var n = 13;
    var points = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var b = new THREE.Mesh(decorShared.bulb, decorShared.candyMats[i % decorShared.candyMats.length]);
      b.position.set(-FIELD_HALF + t * FIELD_HALF * 2, 4.6 - Math.sin(Math.PI * t) * 0.85, 0);
      g.add(b);
      points.push(b.position.clone());
    }
    var cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.025, 3, false), toyMaterial(0x685548));
    g.add(cord);
    g.userData.pennants = [];
    var flagGeo = new THREE.ConeGeometry(0.18, 0.36, 3);
    for (var f = 0; f < 6; f++) {
      var ft = (f + 1) / 7;
      var flag = new THREE.Mesh(flagGeo, f % 2 ? decorShared.white : decorShared.candyMats[0]);
      flag.position.set(-FIELD_HALF + ft * FIELD_HALF * 2, 4.4 - Math.sin(Math.PI * ft) * 0.85, 0);
      flag.rotation.z = Math.PI; g.add(flag); g.userData.pennants.push(flag);
    }
    for (var side = -1; side <= 1; side += 2) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 5.2, 6), decorShared.white);
      pole.position.set(side * FIELD_HALF, 2, 0); g.add(pole);
    }
    g.position.z = z;
    scene.add(g);
    decorations.push(g);
  }

  function sweetBox(w, h, d, material, radius) {
    var r = Math.min(radius || 0.09, w / 5, d / 5, h / 3);
    var x = w / 2 - r, z = d / 2 - r, corner = r * 0.5;
    var shape = new THREE.Shape();
    shape.moveTo(-x + corner, -z);
    shape.lineTo(x - corner, -z); shape.quadraticCurveTo(x, -z, x, -z + corner);
    shape.lineTo(x, z - corner); shape.quadraticCurveTo(x, z, x - corner, z);
    shape.lineTo(-x + corner, z); shape.quadraticCurveTo(-x, z, -x, z - corner);
    shape.lineTo(-x, -z + corner); shape.quadraticCurveTo(-x, -z, -x + corner, -z);
    var geo = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * r, steps: 1, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 1, curveSegments: 2 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -h / 2 + r, 0);
    var mesh = new THREE.Mesh(geo, material); mesh.receiveShadow = true;
    return mesh;
  }

  // The hub is a completely flat keyboard plaza. Colour is the wayfinding;
  // no central geometry or hidden mound collision replaces the removed cake.
  function addHubPlaza() {
    for (var r = 0; r < HUB_LEN; r++) {
      var row = rows.get(r); if (!row) continue;
      for (var lane = 0; lane < LANES; lane++) {
        var edge = Math.min(lane, LANES - 1 - lane);
        row.colors[lane] = edge < 2 ? 0xcf9c6c : ((r + lane) % 2 ? 0xf3dabc : 0xffefda);
        if (edge === 2 || edge === 3) row.colors[lane] = r % 4 < 2 ? 0x8dccbd : 0xa6ddcf;
        if (lane >= 8 && lane <= 11) row.colors[lane] = (r % 5 < 2) ? 0xf2b6a6 : 0xe98c83;
        // A pair of diagonal mint trails branches toward the two exit doors.
        if (r >= 17) {
          var branch = Math.min(5, Math.floor((r - 16) * 0.75));
          if (Math.abs(lane - (9 - branch)) <= 1 || Math.abs(lane - (10 + branch)) <= 1) row.colors[lane] = 0x86c8b8;
        }
      }
    }
    for (var side = -1; side <= 1; side += 2) {
      var border = new THREE.Group();
      var base = sweetBox(0.32, 0.34, HUB_LEN - 1, toyMaterial(0x667f7a), 0.06);
      base.position.y = -0.04; border.add(base);
      var cap = sweetBox(0.36, 0.1, HUB_LEN - 1, decorShared.white, 0.025);
      cap.position.y = 0.17; border.add(cap);
      border.position.set(side * (FIELD_HALF + 0.22), 0, HUB_LEN / 2);
      scene.add(border); decorations.push(border);
    }
  }

  // Architectural landmarks stay beyond the keyboard boundary.
  function addCandyWindmill(x, z, color) {
    var g = new THREE.Group(), cream = decorShared.white, mint = toyMaterial(color), cocoa = toyMaterial(0x725142);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.05, 0.36, 12), cocoa); base.position.y = -0.32; g.add(base);
    var tower = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.75, 3.3, 12), mint); tower.position.y = 1.45; g.add(tower);
    var collar = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.1, 6, 16), cream); collar.rotation.x = Math.PI / 2; collar.position.y = 2.4; g.add(collar);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.85, 12), cocoa); roof.position.y = 3.46; g.add(roof);
    var window = sweetBox(0.38, 0.68, 0.12, toyMaterial(0xf6d88d), 0.05); window.position.set(0, 1.5, -0.67); g.add(window);
    var wheel = new THREE.Group(); wheel.position.set(0, 3.2, -0.83);
    var hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), toyMaterial(0xefaa71)); wheel.add(hub);
    for (var b = 0; b < 4; b++) {
      var blade = new THREE.Group(); blade.rotation.z = b * Math.PI / 2;
      var wafer = sweetBox(0.44, 1.12, 0.16, cream, 0.05); wafer.position.y = 0.84; blade.add(wafer);
      var inset = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.66, 0.025), mint); inset.position.set(0, 0.91, -0.095); blade.add(inset);
      wheel.add(blade);
    }
    g.add(wheel); g.userData.wheel = wheel;
    g.position.set(x, 0, z); castShadows(g); scene.add(g); decorations.push(g);
  }

  function decorateRoom(start, end, ti) {
    var art = currentRoomArt;
    for (var side = -1; side <= 1; side += 2) {
      // Low tray edges frame the playable keyboard without hiding hazards.
      var tray = new THREE.Group();
      var edge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, end - start - 2), toyMaterial(art.accent));
      edge.position.y = -0.08; tray.add(edge);
      var icing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.055, end - start - 2), decorShared.white);
      icing.position.y = 0.065; tray.add(icing);
      tray.position.set(side * (FIELD_HALF + 0.3), 0, (start + end) / 2);
      scene.add(tray); decorations.push(tray);
      for (var z = start + 4; z < end - 3; z += 9) {
        var prop = addProp(art.prop, side * (FIELD_HALF + 1.0), z);
        prop.scale.setScalar(1.1 + ((ti + Math.floor(z)) % 3) * 0.12);
      }
      // District landmark: giant glazed doughnut / frosted cupcake.
      var landmark = new THREE.Group();
      var pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.32, 0.4, 12), toyMaterial(art.dark));
      pedestal.position.y = -0.25; landmark.add(pedestal);
      var treat = new THREE.Group();
      treat.position.y = 1.65;
      if (ti % 2 === 0) {
        var dough = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.38, 8, 22), toyMaterial(0xe5b175));
        treat.add(dough);
        var glaze = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.3, 6, 22), toyMaterial(art.accent));
        glaze.position.z = -0.22; treat.add(glaze);
        for (var s = 0; s < 8; s++) {
          var a = s / 8 * Math.PI * 2;
          var sprinkle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.06), decorShared.candyMats[s % decorShared.candyMats.length]);
          sprinkle.position.set(Math.cos(a) * 1.03, Math.sin(a) * 1.03, -0.51);
          sprinkle.rotation.z = a + 0.4; treat.add(sprinkle);
        }
        landmark.userData.spinner = treat;
      } else {
        var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.65, 1.0, 12), toyMaterial(art.accent));
        cup.position.y = -0.65; treat.add(cup);
        for (var layer = 0; layer < 3; layer++) {
          var cream = new THREE.Mesh(new THREE.SphereGeometry(0.84 - layer * 0.2, 12, 8), decorShared.white);
          cream.scale.y = 0.55; cream.position.y = -0.1 + layer * 0.3; treat.add(cream);
        }
        var cherry = new THREE.Mesh(decorShared.gum, decorShared.candyMats[0]);
        cherry.scale.setScalar(0.4); cherry.position.y = 0.86; treat.add(cherry);
      }
      landmark.add(treat);
      landmark.position.set(side * (FIELD_HALF + 2.3), 0, start + (end - start) * 0.56 + side * 2);
      scene.add(landmark); decorations.push(landmark);
    }
    addGarland(start + 2);
    addGarland(end - 2);
  }

  function finishRoomArt(start, end, ti) {
    var art = currentRoomArt;
    for (var r = start; r < end; r++) {
      var row = rows.get(r); if (!row) continue;
      for (var lane = 0; lane < LANES; lane++) {
        // Consistent warning surfaces; route hints never paint over a trap.
        if (row.type[lane] === 2) { row.colors[lane] = 0xe46b77; continue; }
        if (row.type[lane] !== 1) continue;
        if (row.conv) continue;
        var stripe = (Math.floor(r / 3) + Math.floor(lane / 2)) % art.keys.length;
        row.colors[lane] = art.keys[stripe];
        if (lane === row.safeLane && (r - start) % 4 < 2) row.colors[lane] = 0xfff7e7;
      }
      // Make each row recognisably a keyboard rather than random type blocks.
      var keyboard = 'QWERTYUIOPASDFGHJKLZX';
      for (var l = 0; l < LANES; l++) row.letters[l] = keyboard.charCodeAt((l + Math.floor(r / 5)) % LANES) - 65;
    }
    decorateRoom(start, end, ti);
  }

  function decorateHub() {
    addParkGate();
    addHubPlaza();
    addCandyWindmill(-12.4, 17.5, 0x82c5b5);
    addCandyWindmill(12.4, 21, 0xeaa099);
    addProp(0, -FIELD_HALF - 1.45, 5);
    addProp(0, FIELD_HALF + 1.45, 9);
    addProp(1, -FIELD_HALF - 1.45, 21);
    addProp(2, FIELD_HALF + 1.45, 14);
    addGarland(7);
    addGarland(20.5);
  }

  function buildVendorStands() {
    for (var i = 0; i < VENDORS.length; i++) {
      var v = VENDORS[i];
      var stand = new THREE.Group();
      var stallColor = [0x80bdad, 0x81b9d1, 0xe4b269, 0xe49b7c, 0xad99c9, 0xeaa1ae, 0xe78d8c][i];
      var bodyMat = toyMaterial(stallColor), cocoaMat = toyMaterial(0x715246), creamMat = decorShared.white;
      var counter = sweetBox(1.8, 0.9, 1.22, bodyMat, 0.1);
      counter.position.y = KEY_H + 0.45;
      stand.add(counter);
      var trim = sweetBox(1.99, 0.18, 1.42, creamMat, 0.06);
      trim.position.y = KEY_H + 0.95;
      stand.add(trim);
      var skirt = sweetBox(1.86, 0.16, 1.3, cocoaMat, 0.04);
      skirt.position.y = KEY_H + 0.12; stand.add(skirt);
      var frontPanel = sweetBox(1.38, 0.52, 0.08, creamMat, 0.025);
      frontPanel.position.set(0, KEY_H + 0.51, 0.65); stand.add(frontPanel);
      var medal = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.055, 12), bodyMat);
      medal.rotation.x = Math.PI / 2; medal.position.set(0, KEY_H + 0.51, 0.72); stand.add(medal);
      for (var panelSide = -1; panelSide <= 1; panelSide += 2) {
        var groove = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.03), cocoaMat);
        groove.position.set(panelSide * 0.44, KEY_H + 0.51, 0.71); stand.add(groove);
      }
      // навес
      var poleMat = cocoaMat;
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), poleMat);
        pole.position.set(sgn * 0.8, KEY_H + 1.2, -0.45);
        stand.add(pole);
      }
      var canopy = sweetBox(2.25, 0.2, 1.7, creamMat, 0.06);
      canopy.position.set(0, KEY_H + 2.45, -0.1);
      canopy.rotation.x = 0.15;
      stand.add(canopy);
      for (var stripe = 0; stripe < 5; stripe++) {
        var roofStripe = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.025, 1.58), bodyMat);
        roofStripe.position.set(-0.88 + stripe * 0.44, 0.11, 0); canopy.add(roofStripe);
        var scallop = new THREE.Mesh(new THREE.SphereGeometry(0.215, 8, 6), stripe % 2 ? creamMat : bodyMat);
        scallop.scale.set(1, 0.72, 0.28); scallop.position.set(-0.87 + stripe * 0.44, KEY_H + 2.18, 0.75); stand.add(scallop);
      }
      // A low pastry display leaves each shopkeeper visible above the counter.
      var tray = sweetBox(1.15, 0.075, 0.55, cocoaMat, 0.02); tray.position.set(0, KEY_H + 1.1, 0.12); stand.add(tray);
      for (var item = 0; item < 3; item++) {
        var sweet = new THREE.Mesh(decorShared.gum, decorShared.candyMats[(i + item) % decorShared.candyMats.length]);
        sweet.scale.set(0.29, 0.24, 0.29); sweet.position.set(-0.37 + item * 0.37, KEY_H + 1.22, 0.12); stand.add(sweet);
      }
      // Unframed camera-facing artwork stays whole from either side of a stall.
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeEmojiTexture(v.emoji), transparent: true, depthWrite: false }));
      spr.scale.set(1.04, 1.04, 1);
      spr.position.set(0, KEY_H + 3.2, 0.13);
      stand.add(spr);
      vendorSprites[v.id] = spr;

      // Прилавок развёрнут лицом к центральному проходу (как и продавец)
      stand.position.set(v.x, 0, v.z);
      stand.rotation.y = v.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      castShadows(stand);
      scene.add(stand);

      // Уникальный NPC-продавец за прилавком, лицом к центру
      var npc = createVendorNpc(v.id);
      npc.ch.group.position.set(v.x + (v.x < 0 ? -1.1 : 1.1), KEY_H, v.z);
      npc.ch.body.rotation.y = v.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(npc.ch.group);
      vendorNpcs.push(npc);

      staticColliders.push({ x: v.x, z: v.z, r: 1.4 });
    }
  }

  /* --- Стена между комнатами: развилка из двух дверей ---
   * На каждой двери — табличка с типом испытания за ней. Подойди к двери,
   * чтобы выбрать: комната строится, створка уезжает в пол, вторая дверь
   * остаётся запертой.
   */

  var DOOR_X = 5;        // позиции проёмов
  var OPEN_HALF = 1.6;   // полуширина проёма

  function addChoiceWall(b, nextIdx) {
    var g = new THREE.Group();
    var wallMat = toyMaterial(0xffe5d1);
    var trimMat = toyMaterial(0x436c75);
    var panelMat = toyMaterial(0x8bd9cd);

    // сегменты стены: края и центральный блок между дверями
    var edgeW = (FIELD_HALF + 0.7) - (DOOR_X + OPEN_HALF);
    var left = new THREE.Mesh(new THREE.BoxGeometry(edgeW, 4.6, 0.8), wallMat);
    left.position.set(-(DOOR_X + OPEN_HALF + edgeW / 2), KEY_H + 2.3, 0);
    g.add(left);
    var right = left.clone();
    right.position.x = DOOR_X + OPEN_HALF + edgeW / 2;
    g.add(right);
    var center = new THREE.Mesh(new THREE.BoxGeometry((DOOR_X - OPEN_HALF) * 2, 4.6, 0.8), wallMat);
    center.position.set(0, KEY_H + 2.3, 0);
    g.add(center);

    // два разных испытания на выбор
    // Introduce the more demanding combinations gradually, while keeping two
    // genuine route choices. The debug/gallery API still exposes every layout.
    var available = Math.min(TEMPLATES.length, 6 + Math.max(0, nextIdx - 1) * 3);
    var t1 = (nextIdx - 1) % available;
    var t2;
    do { t2 = (Math.random() * available) | 0; } while (t2 === t1);
    var tpls = [t1, t2];

    var doorway = { z: b + 0.5, buildStart: b + 1, roomIdx: nextIdx, decided: false, opts: [] };

    for (var i = 0; i < 2; i++) {
      var ox = i === 0 ? -DOOR_X : DOOR_X;
      var meta = TEMPLATES[tpls[i]];

      // перемычка и колонны проёма
      var lintel = new THREE.Mesh(new THREE.BoxGeometry(OPEN_HALF * 2 + 1, 2.0, 0.8), wallMat);
      lintel.position.set(ox, KEY_H + 3.6, 0);
      g.add(lintel);
      for (var c = -1; c <= 1; c += 2) {
        var col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.7, 0.95), trimMat);
        col.position.set(ox + c * (OPEN_HALF + 0.15), KEY_H + 1.35, 0);
        g.add(col);
      }
      var top = new THREE.Mesh(new THREE.BoxGeometry(OPEN_HALF * 2 + 1.3, 0.5, 0.95), trimMat);
      top.position.set(ox, KEY_H + 2.85, 0);
      g.add(top);

      // створка двери (уезжает в пол при выборе)
      var panel = new THREE.Mesh(new THREE.BoxGeometry(OPEN_HALF * 2 - 0.1, 2.55, 0.3), panelMat);
      panel.position.set(ox, KEY_H + 1.28, 0);
      g.add(panel);
      // A mint keycap door with a recessed candy handle and cream inset.
      var inset = new THREE.Mesh(new THREE.BoxGeometry(OPEN_HALF * 2 - 0.5, 1.98, 0.05), decorShared.white);
      inset.position.z = -0.185; panel.add(inset);
      var handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 6, 16), toyMaterial(0xe9ad65));
      handle.position.set(0.65, -0.35, -0.27); panel.add(handle);
      var arrow = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.4, 3), toyMaterial(0x589e99));
      arrow.position.set(0, 0.3, -0.25); panel.add(arrow);
      // Frosting trim gives the wall a bakery arch silhouette.
      var cap = new THREE.Mesh(new THREE.BoxGeometry(OPEN_HALF * 2 + 1.4, 0.13, 1.08), decorShared.white);
      cap.position.set(ox, KEY_H + 4.65, 0); g.add(cap);

      // табличка: название + эмодзи испытания на стороне, обращённой к игроку (−Z)
      var nm = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeNameTexture(I18N.t(meta.nameKey)), transparent: true, depthWrite: false, depthTest: false }));
      nm.scale.set(2.3, 0.58, 1);
      nm.position.set(ox, KEY_H + 3.55, -0.7);
      nm.renderOrder = 6;
      g.add(nm);
      var em = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeEmojiTexture(meta.emoji), transparent: true, depthWrite: false, depthTest: false }));
      em.scale.set(1.2, 1.2, 1);
      em.position.set(ox, KEY_H + 4.5, -0.7);
      em.renderOrder = 6;
      g.add(em);

      doorway.opts.push({ x: ox, tpl: tpls[i], panel: panel, open: false });
    }

    g.position.z = b + 0.5;
    scene.add(g);
    arches.push(g);
    doorways.push(doorway);
  }

  // Игрок подошёл к двери — выбор сделан: строим комнату, открываем створку
  function decideDoor(dw, opt) {
    dw.decided = true;
    opt.open = true;
    var doorLane = Math.max(0, Math.min(LANES - 1, Math.round(opt.x + (LANES - 1) / 2)));
    genPath = doorLane;
    buildRoomInterior(dw.buildStart, dw.roomIdx, opt.tpl);
    // ботам — путь через выбранную дверь
    var bRow = Math.floor(dw.z);
    for (var r = bRow - 2; r <= bRow; r++) {
      var row = rows.get(r);
      if (row) row.safeLane = doorLane;
    }
    GameAudio.door();
  }

  /* ============ Генерация мира ============ */

  function hash01(n) {
    var x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function makeRow(r, opts) {
    opts = opts || {};
    var type = new Int8Array(LANES);
    var letters = new Array(LANES);
    var colors = new Array(LANES);
    var stepped = new Array(LANES);
    var palette = opts.hub ? HUB_COLORS : genPalette;
    for (var i = 0; i < LANES; i++) {
      type[i] = 1;
      letters[i] = (Math.random() * 26) | 0;
      colors[i] = palette[(Math.random() * palette.length) | 0];
      stepped[i] = false;
    }
    if (opts.hub && r < HUB_LEN) {
      colors[9] = HUB_PATH;
      colors[10] = HUB_PATH;
    }
    genPath += ((Math.random() * 3) | 0) - 1;
    genPath = Math.max(2, Math.min(LANES - 3, genPath));
    var row = {
      type: type, letters: letters, colors: colors, stepped: stepped,
      candyLane: -1, candyTaken: false, noCoin: !!opts.hub, spikePeriod: 2,
      safeLane: genPath
    };
    rows.set(r, row);
    var slot = ((r % VISIBLE) + VISIBLE) % VISIBLE;
    if (slotRow[slot] === r) slotRow[slot] = -99999;
    return row;
  }

  function fillSafe(r, n, hub) {
    for (var i = 0; i < n; i++) makeRow(r + i, { hub: hub });
    return r + n;
  }

  /* --- Шаблоны комнат --- */

  // Сад шипов: извилистая безопасная тропа сквозь поле шипов
  function tplSpikes(s, d) {
    var L = 28;
    fillSafe(s, 4);
    var period = Math.max(1.25, 2.2 - d * 0.06);
    var path = 9;
    var density = Math.min(0.45, 0.22 + d * 0.02);
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      row.spikePeriod = period;
      path += ((Math.random() * 3) | 0) - 1;
      path = Math.max(2, Math.min(LANES - 3, path));
      for (var l = 0; l < LANES; l++) {
        if (Math.abs(l - path) <= 1) continue;
        if (Math.random() < density) {
          row.type[l] = 2;
          row.colors[l] = SPIKE_TINT;
        }
      }
      row.safeLane = path;
      genPath = path;
      if (Math.random() < 0.1) {
        var cl = (Math.random() * LANES) | 0;
        if (row.type[cl] === 1 && Math.abs(cl - path) > 2) row.candyLane = cl;
      }
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Шоколадное озеро: главный мост + боковые прерывистые с наградами
  function tplLake(s, d) {
    var L = 30;
    fillSafe(s, 4);
    var main = 8 + ((Math.random() * 3) | 0);
    var sideL = 2 + ((Math.random() * 2) | 0);
    var sideR = 15 + ((Math.random() * 2) | 0);
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) row.type[l] = 0;
      // главный мост шириной 2, плавно виляет
      main += ((Math.random() * 3) | 0) - 1;
      main = Math.max(4, Math.min(LANES - 6, main));
      row.type[main] = 1; row.type[main + 1] = 1;
      // боковые мосты с разрывами (нужен прыжок), на них конфеты
      var seg = (r - s) % 6;
      if (seg < 4) {
        row.type[sideL] = 1; row.type[sideL + 1] = 1;
        row.type[sideR] = 1; row.type[sideR + 1] = 1;
        if (seg === 2 && Math.random() < 0.5) row.candyLane = Math.random() < 0.5 ? sideL : sideR;
      }
      // островки с конфетами
      if (Math.random() < 0.08) {
        var isl = 2 + ((Math.random() * (LANES - 5)) | 0);
        row.type[isl] = 1; row.type[isl + 1] = 1;
        row.candyLane = isl;
      }
      row.safeLane = main;
      genPath = main;
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Аллея поршней: широкий зал, поршни ездят поперёк
  function tplPistons(s, d) {
    var L = 30;
    fillSafe(s, L);
    var speed = Math.min(2.3, 1.0 + d * 0.07);
    var count = 3 + (d >= 5 ? 1 : 0);
    for (var k = 0; k < count; k++) {
      entities.push({
        kind: 'piston', z: s + 7 + k * 5, speed: speed * (0.9 + Math.random() * 0.3),
        phase: k * 2.1, mesh: null, curX: 9999
      });
    }
    for (var cr = s + 9; cr < s + L - 5; cr += 6) {
      var row = rows.get(cr);
      if (row) row.candyLane = 9 + ((Math.random() * 2) | 0);
    }
    return L;
  }

  // Паркур: колонны платформ с пропусками, боковые пути с наградами
  function tplParkour(s, d) {
    var L = 34;
    fillSafe(s, 4);
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) row.type[l] = 0;
      var k = (r - s - 4) % 4;
      // центральная колонна (широкая, путь ботов)
      if (k < 2) {
        for (var c = 8; c <= 11; c++) row.type[c] = 1;
        if (d >= 5 && k === 0 && Math.random() < 0.35) {
          row.type[8] = 2; row.colors[8] = SPIKE_TINT;
          row.type[11] = 2; row.colors[11] = SPIKE_TINT;
        }
      }
      // боковые колонны в противофазе — зигзаг-маршруты
      if (k >= 2) {
        for (var a = 2; a <= 4; a++) row.type[a] = 1;
        for (var b2 = 15; b2 <= 17; b2++) row.type[b2] = 1;
        if (Math.random() < 0.3) row.candyLane = Math.random() < 0.5 ? 3 : 16;
      }
      row.safeLane = 9;
      genPath = 9;
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Арена монстров: открытый зал с патрулями и ямами по краям
  function tplMonsters(s, d) {
    var L = 32;
    fillSafe(s, L);
    // декоративные ямы по бокам
    for (var r1 = s + 8; r1 < s + 12; r1++) {
      var rowA = rows.get(r1);
      for (var la = 1; la <= 3; la++) rowA.type[la] = 0;
    }
    for (var r2 = s + 20; r2 < s + 24; r2++) {
      var rowB = rows.get(r2);
      for (var lb = 16; lb <= 18; lb++) rowB.type[lb] = 0;
    }
    var n = 2 + Math.min(4, (d / 2) | 0);
    var speed = Math.min(2.0, 0.8 + d * 0.06);
    for (var k = 0; k < n; k++) {
      entities.push({
        kind: 'monster', z: s + 6 + k * (20 / n), amp: 7.6,
        speed: speed * (0.85 + Math.random() * 0.35),
        phase: Math.random() * 6.28, mesh: null, curX: 9999
      });
    }
    for (var cr = s + 8; cr < s + L - 6; cr += 7) {
      var rowC = rows.get(cr);
      if (rowC) rowC.candyLane = 8 + ((Math.random() * 4) | 0);
    }
    return L;
  }

  // Развилка внутри комнаты: два коридора через пропасть —
  // слева шипы (путь ботов), справа монстры и награды
  function tplFork(s, d) {
    var L = 30;
    fillSafe(s, 4);
    var period = Math.max(1.3, 2.2 - d * 0.06);
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      row.spikePeriod = period;
      for (var l = 7; l <= 12; l++) row.type[l] = 0; // пропасть между коридорами
      for (var a = 0; a <= 6; a++) {
        if (a >= 2 && a <= 4) continue; // безопасная середина левого коридора
        if (Math.random() < 0.22 + d * 0.015) {
          row.type[a] = 2;
          row.colors[a] = SPIKE_TINT;
        }
      }
      if (Math.random() < 0.12) row.candyLane = 13 + ((Math.random() * 6) | 0);
      row.safeLane = 3;
      genPath = 3;
    }
    var speed = Math.min(1.8, 0.8 + d * 0.06);
    entities.push({ kind: 'monster', z: s + 10, cx: 6, amp: 2.6, speed: speed, phase: Math.random() * 6.28, mesh: null, curX: 9999 });
    entities.push({ kind: 'monster', z: s + 19, cx: 6, amp: 2.6, speed: speed * 1.15, phase: Math.random() * 6.28 + 2, mesh: null, curX: 9999 });
    fillSafe(s + L - 4, 4);
    return L;
  }

  /* --- Мешлы ловушек с собственными объектами --- */

  function addWallLanes(a, b, zc) {
    if (a > b) return;
    var cx = (laneX(a) + laneX(b)) / 2;
    var hw = (b - a + 1) / 2;
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2, 1.8, 0.9),
      toyMaterial(currentRoomArt.accent)
    );
    body.position.y = KEY_H + 0.9;
    g.add(body);
    var cap = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2 + 0.12, 0.22, 1.0),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    cap.position.y = KEY_H + 1.9;
    g.add(cap);
    // белые «леденцовые» полосы
    for (var st = 0; st < Math.max(1, (hw | 0)); st++) {
      var stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 1.7, 0.92),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      stripe.position.set(-hw + 0.5 + st * 1.6, KEY_H + 0.9, 0);
      stripe.rotation.z = 0.35;
      g.add(stripe);
    }
    batchRigidParts(g, [body]);
    g.position.set(cx, 0, zc + 0.5);
    castShadows(g);
    scene.add(g);
    wallColliders.push({ x: cx, z: zc + 0.5, hw: hw, hd: 0.45, mesh: g });
  }

  function makeRoller() {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 12),
      toyMaterial(CANDY_COLORS[(Math.random() * CANDY_COLORS.length) | 0])
    ));
    for (var i = 0; i < 3; i++) {
      var band = new THREE.Mesh(
        new THREE.TorusGeometry(0.86, 0.06, 6, 20),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      band.rotation.y = i * 0.6;
      g.add(band);
    }
    return castShadows(g);
  }

  function makePendulum() {
    var pivot = new THREE.Group();
    var arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.0, 8),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    arm.position.y = -1.5;
    pivot.add(arm);
    var ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 14, 12),
      toyMaterial(0xb19adf)
    );
    ball.position.y = -3.0;
    pivot.add(ball);
    var swirl = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.08, 6, 18),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    swirl.position.y = -3.0;
    swirl.rotation.x = Math.PI / 2;
    pivot.add(swirl);
    return castShadows(pivot);
  }

  function makeSaw() {
    var g = new THREE.Group();
    var disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.14, 20),
      new THREE.MeshPhongMaterial({ color: 0xdce9ef, specular: 0xffffff, shininess: 80 })
    );
    disc.rotation.x = Math.PI / 2; // диск-«колесо», плоскость XY
    g.add(disc);
    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.18, 12),
      new THREE.MeshLambertMaterial({ color: 0xdd2244 })
    );
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    var screw = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 6), toyMaterial(0x415b6d));
    screw.rotation.x = Math.PI / 2; g.add(screw);
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      var tooth = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.28, 4),
        new THREE.MeshLambertMaterial({ color: 0xdd2244 })
      );
      tooth.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0);
      tooth.rotation.z = a - Math.PI / 2;
      g.add(tooth);
    }
    return castShadows(g);
  }

  /* --- Новые тематические комнаты --- */

  // Лабиринт мятных стен: серпантин стен с чередующимися проходами
  function tplMaze(s, d) {
    var L = 36;
    fillSafe(s, L);
    var side = 1;
    for (var wz = s + 5; wz < s + L - 5; wz += 5) {
      var gap = side > 0 ? (14 + ((Math.random() * 3) | 0)) : (3 + ((Math.random() * 3) | 0));
      var gh = 2;
      addWallLanes(0, gap - gh - 1, wz);
      addWallLanes(gap + gh + 1, LANES - 1, wz);
      for (var rr = wz - 2; rr <= wz + 1; rr++) {
        var row = rows.get(rr);
        if (row) row.safeLane = gap;
      }
      var dead = rows.get(wz + 2);
      if (dead && Math.random() < 0.6) dead.candyLane = side > 0 ? 2 : (LANES - 3);
      side = -side;
    }
    genPath = 9;
    return L;
  }

  // Карамельный транспортёр: ленты толкают вбок к пропастям по краям
  function tplConveyor(s, d) {
    var L = 30;
    fillSafe(s, 3);
    for (var r = s + 3; r < s + L - 3; r++) {
      var row = makeRow(r);
      row.type[0] = 0; row.type[1] = 0;
      row.type[LANES - 1] = 0; row.type[LANES - 2] = 0;
      var dir = ((((r - s) / 4) | 0) % 2 === 0) ? 1 : -1;
      row.conv = dir * (1.7 + d * 0.12);
      for (var l = 2; l < LANES - 2; l++) row.colors[l] = dir > 0 ? 0x8fd0ff : 0xffcf8f;
      row.safeLane = 9;
      genPath = 9;
      if (Math.random() < 0.08) row.candyLane = 3 + ((Math.random() * (LANES - 6)) | 0);
    }
    fillSafe(s + L - 3, 3);
    return L;
  }

  // Тающий шоколад: клавиши осыпаются вскоре после шага — нельзя стоять
  function tplCrumble(s, d) {
    var L = 30;
    fillSafe(s, 4);
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) {
        row.type[l] = 4;
        row.colors[l] = (l % 2 === 0) ? 0x6b3a1c : 0x7d4720;
      }
      if (Math.random() < 0.22) {
        var solidLane = (Math.random() * LANES) | 0;
        row.type[solidLane] = 1;
        row.colors[solidLane] = 0xe0b27a;
      }
      row.safeLane = 9;
      genPath = 9;
      if (Math.random() < 0.1) row.candyLane = (Math.random() * LANES) | 0;
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Катящиеся леденцы: шары катятся навстречу игроку по полосам
  function tplRollers(s, d) {
    var L = 30;
    fillSafe(s, L);
    var lanes = [4, 8, 12, 16];
    for (var i = 0; i < lanes.length; i++) {
      var own = makeRoller();
      scene.add(own);
      entities.push({
        kind: 'roller', own: own, laneX: laneX(lanes[i]),
        z: s + L / 2, z0: s + L - 4, span: L - 8,
        speed: Math.min(9, 4 + d * 0.3) * (0.85 + Math.random() * 0.3),
        phase: Math.random() * (L - 8), curX: 9999, curZ: 9999
      });
    }
    for (var cr = s + 6; cr < s + L - 4; cr += 8) {
      var row = rows.get(cr); if (row) row.candyLane = 6 + ((Math.random() * 8) | 0);
    }
    return L;
  }

  // Маятники-леденцы: качаются поперёк коридора, лови окно
  function tplPendulum(s, d) {
    var L = 30;
    fillSafe(s, L);
    var n = 3 + Math.min(3, (d / 2) | 0);
    for (var i = 0; i < n; i++) {
      var own = makePendulum();
      own.position.set(0, KEY_H + 3.6, s + 5 + i * (L - 10) / n);
      scene.add(own);
      entities.push({
        kind: 'pendulum', own: own, z: s + 5 + i * (L - 10) / n,
        amp: 1.15, speed: 1.5 + d * 0.05 + Math.random() * 0.4,
        phase: i * 1.4, len: 3.0, curX: 9999, curBallY: 99
      });
    }
    for (var cr = s + 6; cr < s + L - 4; cr += 6) {
      var row = rows.get(cr); if (row) row.candyLane = 8 + ((Math.random() * 4) | 0);
    }
    return L;
  }

  // Мятные пилы: вращающиеся диски ездят поперёк дорожки
  function tplSaws(s, d) {
    var L = 30;
    fillSafe(s, L);
    var n = 3 + Math.min(3, (d / 2) | 0);
    for (var i = 0; i < n; i++) {
      var own = makeSaw();
      scene.add(own);
      entities.push({
        kind: 'saw', own: own, z: s + 5 + i * (L - 10) / n,
        amp: 7.5, speed: 1.0 + d * 0.06 + Math.random() * 0.3,
        phase: Math.random() * 6.28, curX: 9999
      });
    }
    for (var cr = s + 7; cr < s + L - 4; cr += 7) {
      var row = rows.get(cr); if (row) row.candyLane = 7 + ((Math.random() * 6) | 0);
    }
    return L;
  }

  /* --- Ещё 15 уникальных комнат --- */

  // Зигзаг: узкий мост-серпантин над шоколадом
  function tplZigzag(s, d) {
    var L = 30;
    fillSafe(s, 4);
    var pw = 3;
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) row.type[l] = 0;
      var t = r - s - 4, period = 8;
      var tri = Math.abs(((t % period) / period) * 2 - 1);
      var c0 = Math.round(3 + tri * (LANES - 7 - pw));
      for (var k = 0; k < pw; k++) row.type[c0 + k] = 1;
      row.safeLane = c0 + 1; genPath = c0 + 1;
      if (Math.random() < 0.08) row.candyLane = c0 + ((Math.random() * pw) | 0);
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Островки: прыжки по «пряничным» камням через пропасть
  function tplStones(s, d) {
    var L = 32;
    fillSafe(s, 4);
    var sets = [[5, 6], [9, 10], [13, 14]], si = 0;
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) row.type[l] = 0;
      if ((r - s - 4) % 2 === 0) {
        var pk = sets[si % sets.length]; si++;
        row.type[pk[0]] = 1; row.type[pk[1]] = 1;
        row.safeLane = pk[0]; genPath = pk[0];
        if (Math.random() < 0.15) row.candyLane = pk[0];
      } else {
        row.safeLane = 9;
      }
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Батут: сплошной пружинный пол (тип 5) — прыгай по конфетным трамплинам
  function tplBounce(s, d) {
    var L = 28;
    fillSafe(s, 4);
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) { row.type[l] = 5; row.colors[l] = (l % 2) ? 0x5bc8f5 : 0x8fe0ff; }
      row.type[0] = 1; row.type[LANES - 1] = 1; // безопасные края
      row.safeLane = 9; genPath = 9;
      if (Math.random() < 0.1) row.candyLane = 4 + ((Math.random() * (LANES - 8)) | 0);
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Острова: широкие платформы, длинные прыжки со сменой полосы
  function tplIslands(s, d) {
    var L = 34;
    fillSafe(s, 4);
    var lane = 8;
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) row.type[l] = 0;
      var phase = (r - s - 4) % 5;
      if (phase < 3) {
        for (var k = 0; k < 4; k++) row.type[lane + k] = 1;
        row.safeLane = lane + 1; genPath = lane + 1;
        if (phase === 1 && Math.random() < 0.4) row.candyLane = lane + 1;
      } else {
        row.safeLane = lane + 1;
        if (phase === 4) { lane += ((Math.random() * 9) | 0) - 4; lane = Math.max(1, Math.min(LANES - 5, lane)); }
      }
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Крест пил: диски едут навстречу друг другу в противофазе
  function tplSawCross(s, d) {
    var L = 30;
    fillSafe(s, L);
    var n = 4 + Math.min(2, (d / 3) | 0);
    for (var i = 0; i < n; i++) {
      var own = makeSaw(); scene.add(own);
      entities.push({
        kind: 'saw', own: own, z: s + 5 + i * (L - 10) / n,
        amp: 8.5, speed: (1.0 + d * 0.06) * (0.9 + Math.random() * 0.2),
        phase: (i % 2) * Math.PI, curX: 9999
      });
    }
    for (var cr = s + 6; cr < s + L - 4; cr += 6) { var row = rows.get(cr); if (row) row.candyLane = 8 + ((Math.random() * 4) | 0); }
    return L;
  }

  // Табун: множество катящихся шаров по всем полосам
  function tplStampede(s, d) {
    var L = 32;
    fillSafe(s, L);
    var lanes = [3, 6, 9, 12, 15, 17];
    for (var i = 0; i < lanes.length; i++) {
      var own = makeRoller(); scene.add(own);
      entities.push({
        kind: 'roller', own: own, laneX: laneX(lanes[i]),
        z: s + L / 2, z0: s + L - 3, span: L - 6,
        speed: Math.min(10, 5 + d * 0.3) * (0.8 + Math.random() * 0.5),
        phase: Math.random() * (L - 6), curX: 9999, curZ: 9999
      });
    }
    for (var cr = s + 6; cr < s + L - 4; cr += 7) { var row = rows.get(cr); if (row) row.candyLane = 4 + ((Math.random() * 12) | 0); }
    return L;
  }

  // Качели: узкий мост под качающимися маятниками
  function tplSwings(s, d) {
    var L = 30;
    fillSafe(s, 4);
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) { if (l < 7 || l > 12) row.type[l] = 0; }
      row.safeLane = 9; genPath = 9;
    }
    var n = 4 + Math.min(3, (d / 2) | 0);
    for (var i = 0; i < n; i++) {
      var own = makePendulum();
      own.position.set(0, KEY_H + 3.6, s + 5 + i * (L - 10) / n);
      scene.add(own);
      entities.push({ kind: 'pendulum', own: own, z: s + 5 + i * (L - 10) / n, amp: 1.2, speed: 1.7 + d * 0.05 + Math.random() * 0.5, phase: i * 1.1, len: 3.0, curX: 9999, curBallY: 99 });
    }
    for (var cr = s + 7; cr < s + L - 4; cr += 6) { var r2 = rows.get(cr); if (r2) r2.candyLane = 9 + ((Math.random() * 3) | 0); }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Пресс-зал: плотные давилки и редкие шипы по краям
  function tplPistonHall(s, d) {
    var L = 32;
    fillSafe(s, L);
    var speed = Math.min(2.4, 1.1 + d * 0.08);
    var count = 4 + Math.min(2, (d / 3) | 0);
    for (var k = 0; k < count; k++) {
      entities.push({ kind: 'piston', z: s + 6 + k * 4.5, speed: speed * (0.85 + Math.random() * 0.3), phase: k * 1.7, mesh: null, curX: 9999 });
    }
    for (var r = s + 5; r < s + L - 5; r++) {
      var row = rows.get(r);
      if (row && Math.random() < 0.15) { var l = Math.random() < 0.5 ? 1 : LANES - 2; row.type[l] = 2; row.colors[l] = SPIKE_TINT; row.spikePeriod = 1.6; }
    }
    for (var cr = s + 8; cr < s + L - 5; cr += 7) { var rw = rows.get(cr); if (rw) rw.candyLane = 8 + ((Math.random() * 4) | 0); }
    return L;
  }

  // Спираль: тесный серпантин мятных стен с тупиками
  function tplSpiral(s, d) {
    var L = 36;
    fillSafe(s, L);
    var side = 1;
    for (var wz = s + 4; wz < s + L - 4; wz += 4) {
      var gap = side > 0 ? (15 + ((Math.random() * 2) | 0)) : (3 + ((Math.random() * 2) | 0));
      addWallLanes(0, gap - 2, wz);
      addWallLanes(gap + 2, LANES - 1, wz);
      for (var rr = wz - 1; rr <= wz + 1; rr++) { var row = rows.get(rr); if (row) row.safeLane = gap; }
      var dead = rows.get(wz + 2); if (dead && Math.random() < 0.5) dead.candyLane = side > 0 ? 2 : (LANES - 3);
      side = -side;
    }
    genPath = 9;
    return L;
  }

  // Яма монстров: узкий карниз над пропастью с патрулями
  function tplMonsterPit(s, d) {
    var L = 32;
    fillSafe(s, 4);
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) { if (l < 6 || l > 13) row.type[l] = 0; }
      row.safeLane = 9; genPath = 9;
    }
    var n = 3 + Math.min(3, (d / 2) | 0);
    var speed = Math.min(2.1, 0.9 + d * 0.06);
    for (var i = 0; i < n; i++) {
      entities.push({ kind: 'monster', z: s + 6 + i * (L - 12) / n, cx: 0, amp: 3.6, speed: speed * (0.85 + Math.random() * 0.3), phase: Math.random() * 6.28, mesh: null, curX: 9999 });
    }
    for (var cr = s + 7; cr < s + L - 5; cr += 7) { var rw2 = rows.get(cr); if (rw2) rw2.candyLane = 9 + ((Math.random() * 3) | 0); }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Обвал: извилистая тропа из тающих клавиш над пропастью
  function tplCrumblePath(s, d) {
    var L = 30;
    fillSafe(s, 4);
    var lane = 9, pw = 3;
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) row.type[l] = 0;
      lane += ((Math.random() * 3) | 0) - 1; lane = Math.max(2, Math.min(LANES - 2 - pw, lane));
      for (var k = 0; k < pw; k++) { row.type[lane + k] = 4; row.colors[lane + k] = 0x6b3a1c; }
      row.safeLane = lane + 1; genPath = lane + 1;
      if (Math.random() < 0.08) row.candyLane = lane + 1;
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Пилы и ямы: узкий мост с разрывами под скользящими пилами
  function tplSawGaps(s, d) {
    var L = 32;
    fillSafe(s, 4);
    var main = 9;
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r);
      for (var l = 0; l < LANES; l++) row.type[l] = 0;
      main += ((Math.random() * 3) | 0) - 1; main = Math.max(7, Math.min(11, main));
      row.type[main] = 1; row.type[main + 1] = 1; row.type[main + 2] = 1;
      if ((r - s) % 5 === 0) row.type[main + 1] = 0;
      row.safeLane = main + 1; genPath = main + 1;
    }
    var n = 3 + Math.min(2, (d / 3) | 0);
    for (var i = 0; i < n; i++) {
      var own = makeSaw(); scene.add(own);
      entities.push({ kind: 'saw', own: own, z: s + 6 + i * (L - 12) / n, amp: 6.5, speed: 1.1 + d * 0.06 + Math.random() * 0.3, phase: Math.random() * 6.28, curX: 9999 });
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Игольное ушко: узкие проходы среди шипов
  function tplPinch(s, d) {
    var L = 30;
    fillSafe(s, 4);
    var period = Math.max(1.1, 1.9 - d * 0.05);
    var lane = 9;
    for (var r = s + 4; r < s + L - 4; r++) {
      var row = makeRow(r); row.spikePeriod = period;
      if ((r - s - 4) % 4 === 2) {
        lane = 4 + ((Math.random() * (LANES - 8)) | 0);
        for (var l = 0; l < LANES; l++) { if (l !== lane) { row.type[l] = 2; row.colors[l] = SPIKE_TINT; } }
      } else {
        for (var l2 = 0; l2 < LANES; l2++) { if (Math.abs(l2 - lane) > 2 && Math.random() < 0.12) { row.type[l2] = 2; row.colors[l2] = SPIKE_TINT; } }
      }
      row.safeLane = lane; genPath = lane;
    }
    fillSafe(s + L - 4, 4);
    return L;
  }

  // Ленты-капкан: транспортёры сносят на шипы — иди против ленты
  function tplConveyorTrap(s, d) {
    var L = 30;
    fillSafe(s, 3);
    var period = Math.max(1.2, 2.0 - d * 0.05);
    for (var r = s + 3; r < s + L - 3; r++) {
      var row = makeRow(r); row.spikePeriod = period;
      var dir = ((((r - s) / 3) | 0) % 2 === 0) ? 1 : -1;
      row.conv = dir * (1.8 + d * 0.12);
      if (dir > 0) { for (var l = LANES - 4; l < LANES - 1; l++) { row.type[l] = 2; row.colors[l] = SPIKE_TINT; } }
      else { for (var l2 = 1; l2 < 4; l2++) { row.type[l2] = 2; row.colors[l2] = SPIKE_TINT; } }
      for (var lc = 4; lc < LANES - 4; lc++) row.colors[lc] = dir > 0 ? 0x8fd0ff : 0xffcf8f;
      row.safeLane = 9; genPath = 9;
      if (Math.random() < 0.07) row.candyLane = 9;
    }
    fillSafe(s + L - 3, 3);
    return L;
  }

  // Хаос: финальный гантлет из всех ловушек
  function tplChaos(s, d) {
    var L = 40;
    fillSafe(s, L); // сплошной пол на всю длину, ловушки вырезаем поверх
    var seg = s + 4;
    // шипы
    for (var r = seg; r < seg + 6; r++) {
      var row = rows.get(r); if (!row) continue;
      row.spikePeriod = 1.4;
      for (var l = 0; l < LANES; l++) { if (Math.abs(l - 9) > 1 && Math.random() < 0.3) { row.type[l] = 2; row.colors[l] = SPIKE_TINT; } }
      row.safeLane = 9;
    }
    // узкий мост над пропастью
    for (var r2 = seg + 8; r2 < seg + 12; r2++) {
      var row2 = rows.get(r2); if (!row2) continue;
      for (var l2 = 0; l2 < LANES; l2++) row2.type[l2] = 0;
      for (var k = 8; k <= 11; k++) row2.type[k] = 1;
      row2.safeLane = 9;
    }
    // пила → поршень → монстр → роллер (на сплошном полу)
    var sw = makeSaw(); scene.add(sw);
    entities.push({ kind: 'saw', own: sw, z: seg + 15, amp: 8, speed: 1.3, phase: 0, curX: 9999 });
    entities.push({ kind: 'piston', z: seg + 19, speed: 1.8, phase: 0, mesh: null, curX: 9999 });
    entities.push({ kind: 'monster', z: seg + 25, cx: 0, amp: 6, speed: 1.3, phase: 0, mesh: null, curX: 9999 });
    var rl = makeRoller(); scene.add(rl);
    entities.push({ kind: 'roller', own: rl, laneX: laneX(9), z: seg + 30, z0: seg + 33, span: 8, speed: 6, phase: 0, curX: 9999, curZ: 9999 });
    genPath = 9;
    return L;
  }

  // Арена: бой с ботами. Дверь заперта, пока не победишь всех врагов
  function tplArena(s, d) {
    var L = 26;
    fillSafe(s, L);
    pendingArena = { z0: s + 4, z1: s + L - 3, count: 3 + Math.min(4, (d / 2) | 0) };
    return L;
  }

  /* ============ Боевая арена ============ */

  function clearArenaEnemies() {
    // если арену бросают недобитой — разблокировать её дверь, чтобы мир не застрял
    if (arena.doorway && !arena.cleared) arena.doorway.locked = false;
    for (var i = 0; i < arena.enemies.length; i++) {
      if (arena.enemies[i].ch.group.parent) scene.remove(arena.enemies[i].ch.group);
    }
    arena.enemies.length = 0;
    arena.active = false;
    arena.cleared = false;
    arena.doorway = null;
  }

  function setupArena(info, doorway) {
    clearArenaEnemies();
    if (doorway) doorway.locked = true;
    arena.doorway = doorway;
    arena.z0 = info.z0; arena.z1 = info.z1;
    arena.reward = Math.round((40 + roomNum * 12) * coinMult());
    var enemyColors = [0x8a2a2a, 0x772266, 0x2a5a8a, 0x5a2a8a, 0x8a5a2a];
    for (var i = 0; i < info.count; i++) {
      var ch = createCharacter({
        skin: 0xd98a5a, shirt: enemyColors[i % enemyColors.length], pants: 0x2a2a2a,
        shoe: 0x1a1a1a, face: 'angry',
        hair: 'spiky', hairColor: 0x111111
      });
      addBackpack(ch, 0x111111);
      addSword(ch);
      var tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeNameTexture(I18N.t('enemyName')), transparent: true, depthWrite: false }));
      tag.scale.set(1.7, 0.45, 1); tag.position.y = 2.75;
      ch.group.add(tag);
      scene.add(ch.group);
      var ex = (Math.random() - 0.5) * 12;
      var ez = info.z0 + 3 + Math.random() * (info.z1 - info.z0 - 5);
      ch.group.position.set(ex, KEY_H, ez);
      arena.enemies.push({ ch: ch, px: ex, py: KEY_H, pz: ez, yaw: 0, phase: Math.random() * 6, hp: 3, atkCd: Math.random() * 1.5, attackT: 0, dead: false, deadT: 0, flash: 0 });
    }
  }

  function playerAttack() {
    if (state !== 'play' || attackCd > 0) return;
    if (typeof CharacterEffects !== 'undefined') CharacterEffects.stopEmote();
    attackCd = 0.45;
    attackAnimT = 0.28;
    if (GameAudio.attack) GameAudio.attack(); else GameAudio.click();
    if (!arena.enemies.length) return;
    var pw = attackPower();
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    var hitAny = false;
    for (var i = 0; i < arena.enemies.length; i++) {
      var en = arena.enemies[i];
      if (en.dead) continue;
      var dx = en.px - px, dz = en.pz - pz;
      var d2 = dx * dx + dz * dz;
      if (d2 > 2.5 * 2.5) continue;
      var dd = Math.sqrt(d2) || 1;
      if ((dx / dd) * fx + (dz / dd) * fz < -0.25) continue; // только перед собой
      en.hp -= pw;
      en.flash = 0.25;
      en.px += dx / dd * 0.7; en.pz += dz / dd * 0.7; // отбрасывание
      hitAny = true;
      if (en.hp <= 0 && !en.dead) {
        en.dead = true; en.deadT = 0;
        addCoins(Math.round(15 * coinMult()), en.px, KEY_H + 1.2, en.pz);
        GameAudio.candy();
      }
    }
    if (hitAny) GameAudio.stumble();
  }

  function updateArena(dt) {
    if (!arena.enemies.length) return;
    if (!arena.cleared && pz >= arena.z0 - 1 && pz <= arena.z1 + 2) arena.active = true;
    var alive = 0;
    for (var i = 0; i < arena.enemies.length; i++) {
      var en = arena.enemies[i];
      if (en.dead) {
        en.deadT += dt;
        en.ch.body.rotation.x = Math.min(1.5, en.deadT * 3);
        en.ch.group.position.y = Math.max(-1.5, KEY_H - en.deadT * 1.3);
        if (en.deadT > 1.3 && en.ch.group.parent) scene.remove(en.ch.group);
        continue;
      }
      alive++;
      if (en.flash > 0) en.flash -= dt;
      if (en.attackT > 0) en.attackT -= dt;
      var dx = px - en.px, dz = pz - en.pz;
      var dist = Math.sqrt(dx * dx + dz * dz) || 1;
      var chasing = false;
      if (arena.active) {
        if (dist > 1.4) {
          en.px += dx / dist * 3.2 * dt;
          en.pz += dz / dist * 3.2 * dt;
          chasing = true;
        }
        en.yaw = Math.atan2(dx, dz);
        en.atkCd -= dt;
        if (dist < 1.8 && en.atkCd <= 0) {
          en.atkCd = 1.3;
          en.attackT = 0.3;
          hurt('combat');
        }
      }
      en.px = Math.max(-PLAYER_CLAMP, Math.min(PLAYER_CLAMP, en.px));
      en.phase += (chasing ? 4 : 1.6) * dt;
      en.ch.group.position.set(en.px, KEY_H, en.pz);
      en.ch.body.rotation.y = en.yaw;
      animateRun(en.ch, en.phase, chasing, false);
      if (en.attackT > 0) { en.ch.armR.rotation.x = -1.7; en.ch.armL.rotation.x = -1.3; }
      en.ch.head.scale.setScalar(en.flash > 0 ? 1.12 : 1); // «вздрагивание» при попадании
    }
    if (arena.active && !arena.cleared && alive === 0) {
      arena.cleared = true;
      arena.active = false;
      if (arena.doorway) arena.doorway.locked = false;
      addCoins(arena.reward, px, KEY_H + 1.5, pz);
      GameAudio.reward();
      if (api.onArenaClear) api.onArenaClear(arena.reward);
    }
  }

  var TEMPLATES = [
    { fn: tplSpikes, nameKey: 'tplSpikes', emoji: '⚠️' },
    { fn: tplLake, nameKey: 'tplLake', emoji: '🍫' },
    { fn: tplPistons, nameKey: 'tplPistons', emoji: '🔨' },
    { fn: tplParkour, nameKey: 'tplParkour', emoji: '🏃' },
    { fn: tplMonsters, nameKey: 'tplMonsters', emoji: '👹' },
    { fn: tplFork, nameKey: 'tplFork', emoji: '🔀' },
    { fn: tplMaze, nameKey: 'tplMaze', emoji: '🧩' },
    { fn: tplConveyor, nameKey: 'tplConveyor', emoji: '🎢' },
    { fn: tplCrumble, nameKey: 'tplCrumble', emoji: '💥' },
    { fn: tplRollers, nameKey: 'tplRollers', emoji: '🔴' },
    { fn: tplPendulum, nameKey: 'tplPendulum', emoji: '🎯' },
    { fn: tplSaws, nameKey: 'tplSaws', emoji: '⚙️' },
    { fn: tplZigzag, nameKey: 'tplZigzag', emoji: '➿' },
    { fn: tplStones, nameKey: 'tplStones', emoji: '🟫' },
    { fn: tplBounce, nameKey: 'tplBounce', emoji: '🦘' },
    { fn: tplIslands, nameKey: 'tplIslands', emoji: '🏝' },
    { fn: tplSawCross, nameKey: 'tplSawCross', emoji: '✂' },
    { fn: tplStampede, nameKey: 'tplStampede', emoji: '🔵' },
    { fn: tplSwings, nameKey: 'tplSwings', emoji: '🪀' },
    { fn: tplPistonHall, nameKey: 'tplPistonHall', emoji: '🔩' },
    { fn: tplSpiral, nameKey: 'tplSpiral', emoji: '🌀' },
    { fn: tplMonsterPit, nameKey: 'tplMonsterPit', emoji: '👾' },
    { fn: tplCrumblePath, nameKey: 'tplCrumblePath', emoji: '🕳' },
    { fn: tplSawGaps, nameKey: 'tplSawGaps', emoji: '⚔' },
    { fn: tplPinch, nameKey: 'tplPinch', emoji: '📍' },
    { fn: tplConveyorTrap, nameKey: 'tplConveyorTrap', emoji: '🎡' },
    { fn: tplChaos, nameKey: 'tplChaos', emoji: '💀' },
    { fn: tplArena, nameKey: 'tplArena', emoji: '⚔️' }
  ];

  // Строит комнату idx по выбранному шаблону ti, в конце — новая развилка дверей
  function buildRoomInterior(start, idx, ti) {
    currentRoomArt = ROOM_ART[ROOM_ART_INDEX[ti] || 0];
    genPalette = currentRoomArt.keys;
    pendingArena = null;
    var L = TEMPLATES[ti].fn(start, idx);

    var b = start + L;
    var row = makeRow(b);
    row.safeLane = 9;
    genPath = 9;
    addChoiceWall(b, idx + 1);
    finishRoomArt(start, b, ti);
    triggers.push({ z: b + 1.2, kind: 'complete', room: idx });
    builtEnd = b + 1;
    // Боевая арена: запереть только что созданную дверь до победы
    if (pendingArena) {
      setupArena(pendingArena, doorways[doorways.length - 1]);
      pendingArena = null;
    }
  }

  function buildHub() {
    fillSafe(0, HUB_LEN, true);
    var row = makeRow(HUB_LEN, { hub: true });
    row.safeLane = 9;
    genPath = 9;
    addChoiceWall(HUB_LEN, roomNum);
    decorateHub();
    triggers.push({ z: HUB_LEN + 1.2, kind: 'enter', room: roomNum });
    builtEnd = HUB_LEN + 1;
  }

  function releaseWorldProp(obj) {
    if (!obj) return;
    scene.remove(obj);
    var shared = new Set(), geos = new Set(), mats = new Set();
    Object.keys(toyGeometryCache).forEach(function (key) { shared.add(toyGeometryCache[key]); });
    if (decorShared) {
      Object.keys(decorShared).forEach(function (key) {
        var item = decorShared[key];
        if (Array.isArray(item)) item.forEach(function (m) { shared.add(m); });
        else shared.add(item);
      });
    }
    obj.traverse(function (node) {
      if (node.geometry && !node.isSprite && !shared.has(node.geometry)) geos.add(node.geometry);
      var materialList = Array.isArray(node.material) ? node.material : [node.material];
      materialList.forEach(function (mat) { if (mat && !shared.has(mat)) mats.add(mat); });
    });
    geos.forEach(function (geo) { geo.dispose(); });
    // Texture atlases are owned by their caches, never by an individual room.
    mats.forEach(function (mat) { mat.dispose(); });
  }

  function clearWorld() {
    if (typeof CharacterEffects !== 'undefined') CharacterEffects.clear();
    rows.clear();
    slotRow.fill(-99999);
    triggers.length = 0;
    doorways.length = 0;
    presses.length = 0;
    for (var i = 0; i < entities.length; i++) {
      if (entities[i].mesh) entities[i].mesh.obj.visible = false;
      if (entities[i].own) releaseWorldProp(entities[i].own);
    }
    entities.length = 0;
    for (var c = 0; c < activeCandies.length; c++) activeCandies[c].mesh.visible = false;
    activeCandies.length = 0;
    for (var a = 0; a < arches.length; a++) releaseWorldProp(arches[a]);
    arches.length = 0;
    for (var d = 0; d < decorations.length; d++) releaseWorldProp(decorations[d]);
    decorations.length = 0;
    for (var w = 0; w < wallColliders.length; w++) releaseWorldProp(wallColliders[w].mesh);
    wallColliders.length = 0;
    crumbling.length = 0;
    mounds.length = 0;
    clearArenaEnemies();
    for (var p = 0; p < PARTICLE_POOL; p++) particlePool[p].visible = false;
  }

  function buildWorld() {
    clearWorld();
    genPath = 9;
    buildHub();
    backWallZ = 0.5;
    px = 0; py = KEY_H; pz = 3; vy = 0; grounded = true;
    respawn = { x: 0, z: 3 };
    lastSafe = { x: 0, z: 3 };
    lastTileR = -999; lastTileL = -999;
    followX = 0; followY = KEY_H; followZ = 3;
    camYaw = 0;
    hp = maxHpVal();
    if (api.onHpChange) api.onHpChange(hp, maxHpVal());
    if (bots.length) resetBots();
  }

  // Дебаг: собрать выбранную комнату и телепортировать в неё игрока
  function debugRoom(ti) {
    clearWorld();
    genPath = 9;
    var base = HUB_LEN + 4;            // за зоной хаба, чтобы его коллайдеры не мешали
    fillSafe(base - 4, 4);             // безопасный вход
    builtEnd = base;
    buildRoomInterior(base, roomNum, ti);
    var startZ = base - 1.5;
    px = 0; py = KEY_H; pz = startZ; vy = 0; grounded = true; yaw = 0;
    backWallZ = base - 3.5;
    respawn = { x: 0, z: startZ };
    lastSafe = { x: 0, z: startZ };
    lastTileR = -999; lastTileL = -999;
    followX = 0; followY = KEY_H; followZ = startZ; camYaw = 0;
    hp = maxHpVal();
    if (api.onHpChange) api.onHpChange(hp, maxHpVal());
    attackCd = 0; attackAnimT = 0; invulnT = 1;
    playerChar.body.rotation.x = 0;
    state = 'play';
    if (bots.length) {
      resetBots();
      for (var i = 0; i < bots.length; i++) {
        var b = bots[i];
        if (!b.hub) {
          b.pz = base + 2 + i * 3;
          b.px = laneX(9) + (Math.random() - 0.5) * 3;
          b.py = KEY_H + 0.3; b.vy = 0;
          b.tileR = -999; b.tileL = -999;
        }
      }
    }
    Input.reset();
    if (api.onRoomEnter) api.onRoomEnter(roomNum);
  }

  function pruneBehind() {
    var minKeep = Math.floor(backWallZ) - 24;
    if (rows.size > VISIBLE * 3) {
      rows.forEach(function (v, k) { if (k < minKeep) rows.delete(k); });
    }
    for (var i = entities.length - 1; i >= 0; i--) {
      if (entities[i].z < minKeep) {
        if (entities[i].mesh) entities[i].mesh.obj.visible = false;
        if (entities[i].own) releaseWorldProp(entities[i].own);
        entities.splice(i, 1);
      }
    }
    for (var wc = wallColliders.length - 1; wc >= 0; wc--) {
      if (wallColliders[wc].z < minKeep) {
        releaseWorldProp(wallColliders[wc].mesh);
        wallColliders.splice(wc, 1);
      }
    }
    for (var cb = crumbling.length - 1; cb >= 0; cb--) {
      if (crumbling[cb].r < minKeep) crumbling.splice(cb, 1);
    }
    for (var a = arches.length - 1; a >= 0; a--) {
      if (arches[a].position.z < minKeep) {
        releaseWorldProp(arches[a]);
        arches.splice(a, 1);
      }
    }
    for (var dw = doorways.length - 1; dw >= 0; dw--) {
      if (doorways[dw].z < minKeep) doorways.splice(dw, 1);
    }
    if (arena.enemies.length && arena.z1 < minKeep) clearArenaEnemies();
    for (var d = decorations.length - 1; d >= 0; d--) {
      if (decorations[d].position.z < minKeep && decorations[d].position.z > HUB_LEN + 2) {
        releaseWorldProp(decorations[d]);
        decorations.splice(d, 1);
      }
    }
  }

  /* ============ Запекание пола ============ */

  function laneX(lane) { return lane - (LANES - 1) / 2; }

  function bakeRow(r) {
    var slot = ((r % VISIBLE) + VISIBLE) % VISIBLE;
    if (slotRow[slot] === r) return;
    slotRow[slot] = r;
    var row = rows.get(r) || null;

    for (var lane = 0; lane < LANES; lane++) {
      var id = slot * LANES + lane;
      var solid = row && row.type[lane] >= 1;

      dummy.position.set(laneX(lane), 0, r + 0.5);
      dummy.rotation.set(0, 0, 0);
      var s = solid ? 1 : 0.0001;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      keysMesh.setMatrixAt(id, dummy.matrix);
      keysMesh.setColorAt(id, tmpColor.setHex(solid ? row.colors[lane] : 0xffffff));

      dummy.position.set(laneX(lane), KEY_H + 0.012, r + 0.5);
      dummy.updateMatrix();
      lettersMesh.setMatrixAt(id, dummy.matrix);

      if (solid) {
        var li = row.letters[lane];
        lettersUvAttr.setXY(id, (li % 6) / 6, 1 - (Math.floor(li / 6) + 1) / 5);
      }
    }

    if (row && row.candyLane >= 0 && !row.candyTaken) {
      var already = false;
      for (var ac = 0; ac < activeCandies.length; ac++) {
        if (activeCandies[ac].row === r) { already = true; break; }
      }
      if (!already) {
        for (var c = 0; c < CANDY_POOL; c++) {
          if (candyPool[c].visible) continue;
          candyPool[c].visible = true;
          candyPool[c].position.set(laneX(row.candyLane), KEY_H + 0.75, r + 0.5);
          activeCandies.push({ row: r, lane: row.candyLane, mesh: candyPool[c] });
          break;
        }
      }
    }

    keysMesh.instanceMatrix.needsUpdate = true;
    keysMesh.instanceColor.needsUpdate = true;
    lettersMesh.instanceMatrix.needsUpdate = true;
    lettersUvAttr.needsUpdate = true;
  }

  function bakeVisible() {
    var start = Math.floor(pz) - 18;
    for (var r = start; r < start + VISIBLE; r++) {
      if (r >= 0) bakeRow(r);
    }
  }

  /* ============ Шипы ============ */

  function spikeCycle(r, lane) {
    var row = rows.get(r);
    var period = row ? row.spikePeriod : 2;
    return (nowSec / period + hash01(r * 13.37 + lane * 7.77)) % 1;
  }

  function spikeHeight(cycle) {
    if (cycle < 0.04) return cycle / 0.04;
    if (cycle < 0.5) return 1;
    if (cycle < 0.58) return 1 - (cycle - 0.5) / 0.08;
    return 0;
  }

  function spikeDangerous(cycle) {
    return cycle > 0.1 && cycle < 0.48;
  }

  function updateSpikes() {
    var cursor = 0;
    var start = Math.floor(pz) - 12;
    for (var r = start; r < start + 38 && cursor < SPIKE_POOL; r++) {
      var row = rows.get(r);
      if (!row) continue;
      for (var l = 0; l < LANES && cursor < SPIKE_POOL; l++) {
        if (row.type[l] !== 2) continue;
        var h = spikeHeight(spikeCycle(r, l));
        dummy.position.set(laneX(l), KEY_H - 0.28 + h * 0.58, r + 0.5);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, Math.max(0.05, h), 1);
        dummy.updateMatrix();
        spikesMesh.setMatrixAt(cursor, dummy.matrix);
        cursor++;
      }
    }
    spikesMesh.count = cursor;
    spikesMesh.instanceMatrix.needsUpdate = true;
  }

  /* ============ Частицы ============ */

  function spawnPopup(n, x, y, z) {
    spawnParticle(popupTexture(n), x, y, z, { vy: 2.1, size: n >= 10 ? 1.25 : 1 });
  }

  function spawnParticle(tex, x, y, z, opts) {
    for (var i = 0; i < PARTICLE_POOL; i++) {
      var s = particlePool[i];
      if (s.visible) continue;
      s.material.map = tex;
      s.material.opacity = 1;
      s.material.color.setHex(opts.color === undefined ? 0xffffff : opts.color);
      s.material.rotation = opts.rotation || 0;
      s.visible = true;
      s.position.set(x, y, z);
      var u = s.userData;
      u.life = 0;
      u.maxLife = opts.maxLife || 0.9;
      u.vx = opts.vx || 0; u.vy = opts.vy || 1.9; u.vz = opts.vz || 0;
      u.grav = opts.grav || 0;
      u.spin = opts.spin || 0;
      var size = opts.size || 1;
      s.scale.set(1.35 * size, 0.8 * size, 1);
      return;
    }
  }

  function splash(x, y, z) {
    for (var i = 0; i < 6; i++) {
      spawnParticle(texBlob, x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8, {
        vx: (Math.random() - 0.5) * 3, vy: 2.5 + Math.random() * 2, vz: (Math.random() - 0.5) * 3,
        grav: -9, maxLife: 0.6, size: 0.8
      });
    }
  }

  function candyBurst(x, y, z, count) {
    for (var i = 0; i < count; i++) {
      var angle = i / count * Math.PI * 2;
      spawnParticle(glowTex, x, y, z, {
        vx: Math.cos(angle) * 2.0, vy: 1.5 + (i % 3) * 0.6, vz: Math.sin(angle) * 2.0,
        grav: -4.5, maxLife: 0.55, size: 0.2, color: CANDY_COLORS[i % CANDY_COLORS.length], spin: 3
      });
    }
  }

  /* ============ Игровая логика ============ */

  function solidGroundY(x, z) {
    var lane = Math.round(x + (LANES - 1) / 2);
    if (lane < 0 || lane >= LANES) return -Infinity;
    var row = rows.get(Math.floor(z));
    if (!row || row.type[lane] < 1) return -Infinity;
    return KEY_H;
  }

  // Высота приподнятого яруса-сцены (конуса) в точке; -Infinity если вне
  function moundSurfaceY(x, z) {
    var best = -Infinity;
    for (var i = 0; i < mounds.length; i++) {
      var m = mounds[i];
      var dx = x - m.cx, dz = z - m.cz, r = Math.sqrt(dx * dx + dz * dz);
      if (r > m.Rb) continue;
      var t = (r <= m.Rt) ? m.top : KEY_H + (m.top - KEY_H) * Math.max(0, Math.min(1, (m.Rb - r) / (m.Rb - m.Rt)));
      if (t > best) best = t;
    }
    return best;
  }

  // Выталкивание игрока из стен-лабиринта (AABB) по оси наименьшего проникновения
  function resolveWalls() {
    if (!wallColliders.length) return;
    var pr = 0.34;
    for (var i = 0; i < wallColliders.length; i++) {
      var w = wallColliders[i];
      if (Math.abs(w.z - pz) > w.hd + 1.2) continue;
      var minx = w.x - w.hw - pr, maxx = w.x + w.hw + pr;
      var minz = w.z - w.hd - pr, maxz = w.z + w.hd + pr;
      if (px > minx && px < maxx && pz > minz && pz < maxz) {
        var penL = px - minx, penR = maxx - px;
        var penB = pz - minz, penF = maxz - pz;
        var m = Math.min(penL, penR, penB, penF);
        if (m === penL) px = minx;
        else if (m === penR) px = maxx;
        else if (m === penB) pz = minz;
        else pz = maxz;
      }
    }
  }

  function die(reason) {
    if (state !== 'play') return;
    state = 'dead';
    deathReason = reason;
    deathT = 0;
    deathNotified = false;
    GameAudio.gameover();
    if (reason === 'fall') splash(px, 0.2, pz);
    if (api.onVendorNear && nearVendorId) { nearVendorId = null; api.onVendorNear(null); }
  }

  // Урон по игроку: −1 HP + мигание; при 0 HP — гибель. Падение в шоколад — сразу.
  function hurt(reason) {
    if (state !== 'play' || invulnT > 0 || shieldT > 0) return;
    hp -= 1;
    invulnT = 1.2;
    GameAudio.stumble();
    splash(px, KEY_H + 0.6, pz);
    if (api.onHpChange) api.onHpChange(hp, maxHpVal());
    if (hp <= 0) die(reason);
  }

  function onStep(r, lane) {
    var row = rows.get(r);
    if (!row) return;
    presses.push({ r: r, lane: lane, t: 0 });
    // звук нажатия клавиши — при каждом шаге на новую клавишу (и в хабе тоже)
    if (row.type[lane] >= 1) GameAudio.key(coins);
    // конфеты за новые клавиши (обычные и тающие)
    if ((row.type[lane] === 1 || row.type[lane] === 4) && !row.stepped[lane] && !row.noCoin) {
      row.stepped[lane] = true;
      var n = perKey();
      addCoins(n, laneX(lane), KEY_H + 0.5, r + 0.5);
    }
    // тающая клавиша начинает осыпаться
    if (row.type[lane] === 4) {
      if (!row.crumbHit) row.crumbHit = {};
      if (!row.crumbHit[lane]) {
        row.crumbHit[lane] = true;
        crumbling.push({ r: r, lane: lane, t: 0.55 });
      }
    }
  }

  function fireTrigger(tr) {
    GameAudio.door();
    backWallZ = tr.z - 0.4;
    respawn = { x: Math.max(-4, Math.min(4, px)), z: tr.z + 0.6 };
    lastSafe = { x: respawn.x, z: respawn.z };

    if (tr.kind === 'enter') {
      if (api.onRoomEnter) api.onRoomEnter(tr.room);
    } else {
      var reward = Math.round((20 + tr.room * 15) * coinMult());
      addCoins(reward, px, KEY_H + 1.2, pz + 1);
      candyBurst(px, py + 1.1, pz, 8);
      roomNum = tr.room + 1;
      markSave();
      if (api.onRoomComplete) api.onRoomComplete(tr.room, reward, roomNum);
    }
    pruneBehind();
  }

  function updatePlay(dt) {
    if (invulnT > 0) invulnT -= dt;
    if (attackCd > 0) attackCd -= dt;
    if (attackAnimT > 0) attackAnimT -= dt;
    if (Input.consumeAttack && Input.consumeAttack()) playerAttack();
    updateArena(dt);

    // Движение относительно камеры (как в Roblox).
    // Экранное «вправо» в мире: (-cos(yaw), sin(yaw)), «вперёд»: (sin(yaw), cos(yaw)).
    var mv = Input.getMove();
    var syaw = Math.sin(camYaw), cyaw = Math.cos(camYaw);
    var sp = moveSpeed();
    moveVX = (-mv.x * cyaw + mv.z * syaw) * sp;
    moveVZ = (mv.x * syaw + mv.z * cyaw) * sp;

    var prevPz = pz;
    px += moveVX * dt;
    pz += moveVZ * dt;
    px = Math.max(-PLAYER_CLAMP, Math.min(PLAYER_CLAMP, px));
    if (pz < backWallZ) pz = backWallZ;

    // Двери-развилки: подойди к одной из двух дверей, чтобы выбрать испытание.
    // Пройти можно только через открытую створку.
    for (var dwi = 0; dwi < doorways.length; dwi++) {
      var door = doorways[dwi];
      var ddz = door.z - pz;
      if (!door.decided && !door.locked && ddz > -0.5 && ddz < 2.6) {
        for (var oi = 0; oi < door.opts.length; oi++) {
          if (Math.abs(px - door.opts[oi].x) < 2.0) { decideDoor(door, door.opts[oi]); break; }
        }
      }
      if (Math.abs(ddz) > 1.5) continue;
      var passable = false;
      for (var oj = 0; oj < door.opts.length; oj++) {
        if (door.opts[oj].open && Math.abs(px - door.opts[oj].x) < OPEN_HALF - 0.25) { passable = true; break; }
      }
      if (!passable) {
        if (prevPz <= door.z - 0.7 && pz > door.z - 0.7) pz = door.z - 0.7;
        else if (prevPz >= door.z + 0.7 && pz < door.z + 0.7) pz = door.z + 0.7;
      }
    }

    // Круглые коллайдеры хаба (фонтан, прилавки)
    if (pz < HUB_LEN + 2) {
      for (var sc = 0; sc < staticColliders.length; sc++) {
        var col = staticColliders[sc];
        var cdx = px - col.x, cdz = pz - col.z;
        var d2 = cdx * cdx + cdz * cdz;
        if (d2 < col.r * col.r && d2 > 0.0001) {
          var d = Math.sqrt(d2);
          px = col.x + cdx / d * col.r;
          pz = col.z + cdz / d * col.r;
        }
      }
      px = Math.max(-PLAYER_CLAMP, Math.min(PLAYER_CLAMP, px));
    }

    // Стены-лабиринты
    resolveWalls();

    // Тающие клавиши осыпаются по таймеру
    for (var ci = crumbling.length - 1; ci >= 0; ci--) {
      var cbz = crumbling[ci];
      cbz.t -= dt;
      if (cbz.t <= 0) {
        var crow2 = rows.get(cbz.r);
        if (crow2) {
          crow2.type[cbz.lane] = 0;
          var cslot = ((cbz.r % VISIBLE) + VISIBLE) % VISIBLE;
          slotRow[cslot] = -99999; // форсируем перезапекание ряда как дыры
        }
        crumbling.splice(ci, 1);
      }
    }

    // Гравитация и прыжок
    vy -= GRAVITY * dt;
    py += vy * dt;
    var groundY = solidGroundY(px, pz);
    if (mounds.length) { var mY = moundSurfaceY(px, pz); if (mY > groundY) groundY = mY; }
    if (py <= groundY + 0.02 && vy <= 0) {
      py = groundY;
      vy = 0;
      grounded = true;
      coyoteT = 0.1;
    } else {
      grounded = false;
      coyoteT -= dt;
    }
    if (Input.consumeJump() && (grounded || coyoteT > 0)) {
      vy = jumpV();
      grounded = false;
      coyoteT = 0;
      GameAudio.jump();
    }

    if (py < -2.6) { die('fall'); return; }

    var tileR = Math.floor(pz);
    var tileL = Math.round(px + (LANES - 1) / 2);
    var row = rows.get(tileR);

    if (grounded && (tileR !== lastTileR || tileL !== lastTileL)) {
      lastTileR = tileR;
      lastTileL = tileL;
      onStep(tileR, tileL);
    }

    if (grounded && row && row.type[tileL] === 2 && invulnT <= 0) {
      if (spikeDangerous(spikeCycle(tileR, tileL))) { hurt('spike'); return; }
    }

    // Батут подбрасывает игрока вверх
    if (grounded && row && row.type[tileL] === 5) {
      vy = jumpV() * 1.5;
      grounded = false;
      coyoteT = 0;
      GameAudio.jump();
    }

    // Транспортёрные ленты толкают вбок
    if (grounded && row && row.conv) {
      px += row.conv * dt;
      px = Math.max(-PLAYER_CLAMP, Math.min(PLAYER_CLAMP, px));
    }

    safeTimer -= dt;
    if (grounded && safeTimer <= 0 && row && row.type[tileL] === 1) {
      lastSafe.x = px;
      lastSafe.z = pz;
      safeTimer = 0.4;
    }

    // Конфеты
    for (var c = activeCandies.length - 1; c >= 0; c--) {
      var cd = activeCandies[c];
      if (!cd.mesh.visible) continue;
      var dx = px - cd.mesh.position.x;
      var dz2 = pz - cd.mesh.position.z;
      if (dx * dx + dz2 * dz2 < 0.7 && Math.abs(py + 0.6 - cd.mesh.position.y) < 1.4) {
        var crow = rows.get(cd.row);
        if (crow) crow.candyTaken = true;
        cd.mesh.visible = false;
        var n = Math.round(10 * coinMult());
        addCoins(n, cd.mesh.position.x, cd.mesh.position.y + 0.3, cd.mesh.position.z);
        candyBurst(cd.mesh.position.x, cd.mesh.position.y, cd.mesh.position.z, 5);
        GameAudio.candy();
      }
    }

    // Столкновения с ловушками и монстрами
    if (invulnT <= 0) {
      for (var e = 0; e < entities.length; e++) {
        var en = entities[e];
        var checkZ = (en.kind === 'roller') ? en.curZ : en.z;
        if (Math.abs(checkZ - pz) > 3) continue;
        if (en.kind === 'piston') {
          if (Math.abs(en.curX - px) < 1.55 && Math.abs(en.z - pz) < 1.1 && py < KEY_H + 1.7) {
            hurt('crush'); return;
          }
        } else if (en.kind === 'monster') {
          var mdx = en.curX - px, mdz = en.z - pz;
          if (mdx * mdx + mdz * mdz < 1.0 && py < KEY_H + 1.6) {
            hurt('monster'); return;
          }
        } else if (en.kind === 'roller') {
          var rdx = en.curX - px, rdz = en.curZ - pz;
          if (rdx * rdx + rdz * rdz < 1.15 && py < KEY_H + 1.7) {
            hurt('crush'); return;
          }
        } else if (en.kind === 'saw') {
          if (Math.abs(en.curX - px) < 0.9 && Math.abs(en.z - pz) < 0.75 && py < KEY_H + 1.5) {
            hurt('crush'); return;
          }
        } else if (en.kind === 'pendulum') {
          if (Math.abs(en.curX - px) < 0.8 && Math.abs(en.z - pz) < 0.85 &&
              en.curBallY < KEY_H + 2.0 && py < en.curBallY + 0.9) {
            hurt('crush'); return;
          }
        }
      }
    }

    // Триггеры дверей
    while (triggers.length && pz >= triggers[0].z) {
      fireTrigger(triggers.shift());
    }

    // Портал в парк конфет (в хабе)
    if (pz < HUB_LEN + 2) {
      var gdx = hubParkGate.x - px, gdz = hubParkGate.z - pz;
      if (gdx * gdx + gdz * gdz < 2.6 * 2.6) { enterPark(); return; }
    }

    // Вендоры (в хабе)
    var vNear = null;
    if (pz < HUB_LEN + 2) {
      for (var v = 0; v < VENDORS.length; v++) {
        var vd = VENDORS[v];
        var vdx = vd.x - px, vdz = vd.z - pz;
        if (vdx * vdx + vdz * vdz < 5.5) { vNear = vd.id; break; }
      }
    }
    if (vNear !== nearVendorId) {
      nearVendorId = vNear;
      if (api.onVendorNear) api.onVendorNear(vNear);
    }

  }

  function updateDead(dt) {
    deathT += dt;
    if (deathReason === 'fall') {
      py -= dt * 1.5;
    } else {
      playerChar.body.rotation.x = Math.min(1.2, deathT * 2.2);
      py = Math.max(py - dt * 0.8, -0.4);
    }
    if (deathT > 0.9 && !deathNotified) {
      deathNotified = true;
      if (api.onDeath) api.onDeath(deathReason);
    }
  }

  /* ============ Боты ============ */

  function updateBots(dt) {
    for (var i = 0; i < bots.length; i++) {
      var b = bots[i]; b.prevX = b.px; b.prevZ = b.pz;
      b.binv = Math.max(0, b.binv - dt);
      if (b.dead) {
        b.respawnT -= dt; b.py -= dt * 1.6;
        b.rig.body.rotation.x = Math.min(1.4, (2.2 - b.respawnT) * 2.5);
        b.rig.group.position.set(b.px, b.py, b.pz);
        if (b.py < -3 || b.expedition) b.rig.group.visible = false;
        if (b.respawnT <= 0) respawnBot(b);
        continue;
      }
      var ctx = b.expedition || botWorld();
      if (!b.expedition && !ctx.rows.has(Math.floor(b.pz)) && !b.hub) {
        // The player has left this checkpoint behind and pruned its scene.
        // Continue an independent branch instead of teleporting beside them.
        botStartExpedition(b, b.roomTemplate, Math.max(1, b.roomIndex)); ctx = b.expedition;
      }
      if (b.hub) {
        if (b.waitT > 0) b.waitT -= dt;
        else {
          var arrived = botNavigate(b, ctx, { x: b.tx, z: b.tz }, dt);
          if (arrived || (!b.route.length && b.replanT <= 0.05)) {
            var pt = hubWanderTarget(); b.tx = pt.x; b.tz = pt.z;
            b.waitT = 0.4 + Math.random() * 1.5;
          }
        }
      } else {
        var target = null, frontDoor = null;
        if (b.expedition) {
          for (var cr = ctx.crumbs.length - 1; cr >= 0; cr--) {
            var crumb = ctx.crumbs[cr]; crumb.t -= dt;
            if (crumb.t <= 0) { var fallenRow = ctx.rows.get(crumb.r); if (fallenRow) fallenRow.type[crumb.lane] = 0; ctx.crumbs.splice(cr, 1); }
          }
          target = { x: -0.5, z: ctx.end + 0.5 };
        } else {
          for (var d = 0; d < doorways.length; d++) {
            var dw = doorways[d];
            if (dw.decided && dw.z > b.lastDoorPassed && b.pz > dw.z + 0.85) {
              if (b.roomIndex > 0) b.completed++;
              b.lastDoorPassed = dw.z; b.roomIndex = dw.roomIdx;
              b.roomTemplate = dw.opts[0].open ? dw.opts[0].tpl : dw.opts[1].tpl;
            }
            if (dw.z > b.lastDoorPassed && (!frontDoor || dw.z < frontDoor.z)) frontDoor = dw;
          }
          if (frontDoor) {
            var chosen = frontDoor.decided ? (frontDoor.opts[0].open ? frontDoor.opts[0] : frontDoor.opts[1]) : frontDoor.opts[b.doorSide % frontDoor.opts.length];
            if (!frontDoor.decided && !frontDoor.locked && frontDoor.z - b.pz < 1.7 && Math.abs(b.px - chosen.x) < OPEN_HALF - 0.2) {
              if (frontDoor.z - pz > VISIBLE + 30 && builtEnd - pz > 95) {
                if (b.roomIndex > 0) b.completed++;
                b.remoteRooms = 0;
                botStartExpedition(b, b.nextTemplate === undefined ? chosen.tpl : b.nextTemplate, frontDoor.roomIdx);
                ctx = b.expedition; target = { x: -0.5, z: ctx.end + 0.5 };
              } else {
                decideDoor(frontDoor, chosen);
                b.route = []; b.routeGoal = ''; ctx = botWorld();
              }
            }
            if (!b.expedition) target = { x: chosen.x, z: frontDoor.z + (frontDoor.decided ? 1.5 : -1.0) };
          }
        }
        var fighting = botCombat(b, ctx, dt);
        if (fighting) target = fighting;
        if (ctx.local && ctx.enemies.length && ctx.enemies.every(function (enemy) { return enemy.dead; })) {
          // Companions may unlock the shared exit, but do not award the player
          // coins, advance their room counter, or move their return barrier.
          if (arena.doorway) arena.doorway.locked = false;
          arena.cleared = true; arena.active = false;
        }
        var reached = target && botNavigate(b, ctx, target, dt);
        botTrapCheck(b, ctx);
        if (b.dead) continue;
        if (b.expedition && reached && !fighting && !ctx.enemies.some(function (enemy) { return !enemy.dead; })) {
          b.completed++; b.remoteRooms = (b.remoteRooms || 0) + 1;
          b.nextTemplate = (b.roomTemplate + 1) % TEMPLATES.length;
          if (b.remoteRooms >= 3 && pz < HUB_LEN + 2 && rows.has(2)) {
            // A completed expedition returns at the hub entrance. Only this
            // explicit return/death may reposition a runner; obstacles never do.
            b.expedition = null; b.roomIndex = 0; b.lastDoorPassed = -Infinity;
            b.px = -3.5 + (b.id % 7); b.pz = 2.5; b.py = KEY_H; b.hp = 3;
            b.route = []; b.routeGoal = ''; b.jump = null; b.checkpoint = { x: b.px, z: b.pz };
            b.binv = 1; b.rig.group.visible = true;
          } else botStartExpedition(b, b.nextTemplate, b.roomIndex + 1);
          ctx = b.expedition || botWorld();
        }
      }

      if (b.grounded) {
        var btr = Math.floor(b.pz), btl = botLane(b.px), brow = ctx.rows.get(btr);
        if (btr !== b.tileR || btl !== b.tileL) {
          b.tileR = btr; b.tileL = btl;
          if (brow && brow.type[btl] >= 1) {
            if (brow.type[btl] === 4) {
              if (!brow.crumbHit) brow.crumbHit = {};
              if (!brow.crumbHit[btl]) { brow.crumbHit[btl] = true; ctx.crumbs.push({ r: btr, lane: btl, t: 0.55 }); }
            }
            if (!b.expedition && Math.abs(b.pz - pz) < 30) {
              presses.push({ r: btr, lane: btl, t: 0 });
              var sd = Math.hypot(b.px - px, b.pz - pz);
              if (sd < 13 && nowSec - lastBotKeyAt > 0.09) { lastBotKeyAt = nowSec; GameAudio.key(0, 0.1 + 0.4 * (1 - sd / 13)); }
            }
          }
        }
      }
      var mvx = (b.px - b.prevX) / Math.max(dt, 0.001), mvz = (b.pz - b.prevZ) / Math.max(dt, 0.001);
      var mlen = Math.min(b.speed, Math.hypot(mvx, mvz));
      if (mlen > 0.3) {
        var dy = Math.atan2(mvx, mvz) - b.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        b.yaw += dy * Math.min(1, dt * 10);
      }
      b.rig.group.visible = !b.expedition && Math.abs(b.pz - pz) < 52;
      b.rig.group.position.set(b.px, b.py, b.pz); b.rig.body.rotation.y = b.yaw;
      b.rig.setMode(!b.grounded ? 'air' : (mlen > 0.3 ? 'run' : 'idle')); b.rig.update(dt, mlen);
      if (b.attackT > 0 && b.rig.body.children) b.rig.body.rotation.z = Math.sin(b.attackT * 18) * 0.08;
      else b.rig.body.rotation.z = 0;
    }
  }

  /* ============ Визуальное обновление ============ */

  function updateVisuals(dt, now) {
    animateDecor(now);
    // Нажатия клавиш
    var hadPresses = presses.length > 0;
    for (var i = presses.length - 1; i >= 0; i--) {
      var p = presses[i];
      p.t += dt;
      var slot = ((p.r % VISIBLE) + VISIBLE) % VISIBLE;
      if (slotRow[slot] !== p.r) { presses.splice(i, 1); continue; }
      var row = rows.get(p.r);
      if (!row || row.type[p.lane] < 1) { presses.splice(i, 1); continue; }
      var dur = 0.3;
      var done = p.t >= dur;
      var dip = done ? 0 : Math.sin(Math.PI * p.t / dur) * 0.14;
      var id = slot * LANES + p.lane;

      dummy.position.set(laneX(p.lane), -dip, p.r + 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      keysMesh.setMatrixAt(id, dummy.matrix);
      dummy.position.set(laneX(p.lane), KEY_H + 0.012 - dip, p.r + 0.5);
      dummy.updateMatrix();
      lettersMesh.setMatrixAt(id, dummy.matrix);

      if (done) presses.splice(i, 1);
    }
    if (hadPresses) {
      keysMesh.instanceMatrix.needsUpdate = true;
      lettersMesh.instanceMatrix.needsUpdate = true;
    }

    // Конфеты
    for (var c = activeCandies.length - 1; c >= 0; c--) {
      var cd = activeCandies[c];
      if (!cd.mesh.visible || cd.row < backWallZ - 20) {
        cd.mesh.visible = false;
        activeCandies.splice(c, 1);
        continue;
      }
      cd.mesh.rotation.y += dt * 2.4;
      cd.mesh.position.y = KEY_H + 0.75 + Math.sin(now * 0.003 + cd.row) * 0.12;
    }

    // Частицы
    for (var s = 0; s < PARTICLE_POOL; s++) {
      var sp = particlePool[s];
      if (!sp.visible) continue;
      var u = sp.userData;
      u.life += dt;
      if (u.life >= u.maxLife) { sp.visible = false; continue; }
      u.vy += u.grav * dt;
      sp.position.x += u.vx * dt;
      sp.position.y += u.vy * dt;
      sp.position.z += u.vz * dt;
      sp.material.opacity = 1 - u.life / u.maxLife;
      sp.material.rotation += (u.spin || 0) * dt;
    }

    // Ловушки и монстры
    for (var e = 0; e < entities.length; e++) {
      var en = entities[e];

      // Ловушки с собственным мешем (роллеры, маятники, пилы)
      if (en.own) {
        var nearOwn = en.z > pz - 28 && en.z < pz + 44;
        en.own.visible = nearOwn;
        if (!nearOwn) { en.curX = 9999; en.curZ = 9999; continue; }
        if (en.kind === 'roller') {
          en.curZ = en.z0 - ((nowSec * en.speed + en.phase) % en.span);
          en.curX = en.laneX;
          en.own.position.set(en.curX, KEY_H + 0.85, en.curZ);
          en.own.rotation.x -= dt * en.speed * 1.3;
        } else if (en.kind === 'saw') {
          en.curX = Math.sin(nowSec * en.speed + en.phase) * en.amp;
          en.own.position.set(en.curX, KEY_H + 0.85, en.z);
          en.own.rotation.z += dt * 9;
        } else if (en.kind === 'pendulum') {
          var ang = Math.sin(nowSec * en.speed + en.phase) * en.amp;
          en.own.rotation.z = ang;
          en.curX = Math.sin(ang) * en.len;
          en.curBallY = KEY_H + 3.6 - Math.cos(ang) * en.len;
        }
        continue;
      }

      var inView = en.z > pz - 22 && en.z < pz + 38;
      if (!inView) {
        if (en.mesh) { en.mesh.obj.visible = false; en.mesh = null; }
        en.curX = 9999;
        continue;
      }
      if (!en.mesh) {
        var pool = en.kind === 'piston' ? pistonPool : monsterPool;
        for (var pm = 0; pm < pool.length; pm++) {
          var candidate = pool[pm];
          var used = false;
          for (var e2 = 0; e2 < entities.length; e2++) {
            if (entities[e2].mesh === candidate) { used = true; break; }
          }
          if (!used) { en.mesh = candidate; break; }
        }
        if (en.mesh) en.mesh.obj.visible = true;
      }
      if (en.kind === 'piston') {
        en.curX = Math.sin(nowSec * en.speed + en.phase) * 8.6;
        if (en.mesh) en.mesh.obj.position.set(en.curX, KEY_H + 0.82, en.z);
      } else {
        en.curX = (en.cx || 0) + Math.sin(nowSec * en.speed + en.phase) * en.amp;
        if (en.mesh) {
          en.mesh.obj.position.set(en.curX, KEY_H, en.z);
          var dir = Math.cos(nowSec * en.speed + en.phase) > 0 ? 1 : -1;
          en.mesh.obj.rotation.y = dir * Math.PI / 2;
          // анимация: топот, взмахи лап, жующая челюсть
          var mp = en.mesh.m;
          mp.phase += dt * (4 + en.speed * 3);
          var sw = Math.sin(mp.phase);
          mp.legL.rotation.x = sw * 0.55;
          mp.legR.rotation.x = -sw * 0.55;
          mp.armL.rotation.x = -sw * 0.45;
          mp.armR.rotation.x = sw * 0.45;
          mp.jaw.rotation.x = 0.12 + Math.abs(Math.sin(nowSec * 5 + mp.phase)) * 0.45;
          en.mesh.obj.rotation.z = sw * 0.05;
        }
      }
    }

    // Створки выбранных дверей уезжают в пол
    for (var dwv = 0; dwv < doorways.length; dwv++) {
      var opts = doorways[dwv].opts;
      for (var op = 0; op < opts.length; op++) {
        var targetY = opts[op].open ? KEY_H + 1.28 - 2.85 : KEY_H + 1.28;
        var pnl = opts[op].panel;
        pnl.position.y += (targetY - pnl.position.y) * Math.min(1, dt * 4);
      }
    }

    updateSpikes();
    updateBots(dt);

    // Персонаж игрока
    var moveLen = Math.sqrt(moveVX * moveVX + moveVZ * moveVZ);
    if (state === 'play' && moveLen > 0.3) {
      var targetYaw = Math.atan2(moveVX, moveVZ);
      var dyaw = targetYaw - yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      yaw += dyaw * Math.min(1, dt * 12);
    }
    playerGroup.position.set(px, py, pz);
    playerChar.body.rotation.y = yaw;

    if (state === 'play') {
      playerChar.setMode(!grounded ? 'air' : (moveLen > 0.3 ? 'run' : 'idle'));
      playerChar.update(dt, moveLen);
      // Взмах рукой при атаке (руки лежат в playerChar.ch)
      if (attackAnimT > 0 && playerChar.ch) {
        var sw = Math.sin((0.28 - attackAnimT) / 0.28 * Math.PI);
        playerChar.ch.armR.rotation.x = -1.9 * sw;
        playerChar.ch.armL.rotation.x = -0.5 * sw;
      }
      playerChar.body.visible = invulnT > 0 ? (Math.floor(now * 0.012) % 2 === 0) : true;
    } else {
      playerChar.update(dt, 0);
      playerChar.body.visible = true;
    }
    updateAura(dt, now);

    // NPC-продавцы: лёгкое дыхание и покачивание рук
    if (pz < HUB_LEN + 8) {
      for (var vn = 0; vn < vendorNpcs.length; vn++) {
        var npc = vendorNpcs[vn];
        npc.phase += dt;
        var sway = Math.sin(npc.phase * 1.8) * 0.07;
        if (npc.id !== 'gift') { // у именинника руки заняты подарком
          npc.ch.armL.rotation.x = sway;
          npc.ch.armR.rotation.x = -sway;
        }
        npc.ch.body.position.y = Math.abs(Math.sin(npc.phase * 1.2)) * 0.02;
      }
    }

    // Тень игрока
    var shadow = playerGroup.getObjectByName('shadow');
    if (shadow) {
      var gy = solidGroundY(px, pz);
      shadow.visible = gy > -Infinity && state === 'play';
      shadow.position.y = gy - py + 0.02;
    }

    // Питомец: парит рядом с игроком, смотрит в ту же сторону
    if (petObj) {
      var ptx = px - Math.sin(yaw) * 0.7 - Math.cos(yaw) * 0.65;
      var ptz = pz - Math.cos(yaw) * 0.7 + Math.sin(yaw) * 0.65;
      var pty = Math.max(py, KEY_H) + 0.85 + Math.sin(now * 0.004) * 0.1;
      var pg = petObj.group;
      pg.position.x += (ptx - pg.position.x) * Math.min(1, dt * 5);
      pg.position.y += (pty - pg.position.y) * Math.min(1, dt * 5);
      pg.position.z += (ptz - pg.position.z) * Math.min(1, dt * 5);
      var pdy = yaw - pg.rotation.y;
      while (pdy > Math.PI) pdy -= Math.PI * 2;
      while (pdy < -Math.PI) pdy += Math.PI * 2;
      pg.rotation.y += pdy * Math.min(1, dt * 6);
      // взмахи крыльев дракона, виляние хвоста
      for (var pw = 0; pw < petObj.parts.wings.length; pw++) {
        petObj.parts.wings[pw].rotation.z = (pw === 0 ? -1 : 1) * (0.35 + Math.sin(now * 0.014) * 0.55);
      }
      if (petObj.parts.tail) petObj.parts.tail.rotation.y = Math.sin(now * 0.006) * 0.45;
    }

    // Вендорные эмодзи
    for (var vk in vendorSprites) {
      vendorSprites[vk].position.y = KEY_H + 3.2 + Math.sin(now * 0.0025 + vk.length) * 0.02;
    }

    // Орбитальная камера (как в Roblox)
    var look = Input.consumeLook();
    camYaw -= look.dx * 0.0052;
    camPitch = Math.max(0.06, Math.min(1.25, camPitch + look.dy * 0.0042));
    camDist = Math.max(4, Math.min(14, camDist + Input.consumeZoom() * 0.008));

    followX += (px - followX) * Math.min(1, dt * 10);
    followY += (py - followY) * Math.min(1, dt * 10);
    followZ += (pz - followZ) * Math.min(1, dt * 10);

    var lookY = followY + 1.5;
    var cp = Math.cos(camPitch), spitch = Math.sin(camPitch);
    camera.position.set(
      followX - Math.sin(camYaw) * cp * camDist,
      Math.max(0.45, lookY + spitch * camDist),
      followZ - Math.cos(camYaw) * cp * camDist
    );
    camera.lookAt(followX, lookY, followZ);

    // Окружение следует за игроком
    var zc = pz + 8;
    liquidMesh.position.z = zc;
    deckMesh.position.z = zc;
    if (skyMesh) skyMesh.position.set(px, 0, pz);
    if (worldScenery) worldScenery.position.z = pz;

    // Глянцевая рябь на шоколадной реке
    if (liquidBase) {
      var lp = liquidMesh.geometry.attributes.position;
      for (var vi = 0; vi < lp.count; vi++) {
        var bx = liquidBase[vi * 3], by = liquidBase[vi * 3 + 1];
        lp.setZ(vi, Math.sin(bx * 0.5 + now * 0.0011) * 0.12 + Math.cos(by * 0.35 + now * 0.0009) * 0.1);
      }
      lp.needsUpdate = true;
    }

    // Солнце и его тень следуют за игроком
    if (sunLight) {
      sunLight.position.set(px + 9, 16, pz + 6);
      if (SHADOWS && sunLight.target) sunLight.target.position.set(px, 0, pz);
    }

    // Плавающие искры-боке
    for (var sk = 0; sk < sparkles.length; sk++) {
      var spr = sparkles[sk];
      var u = spr.userData;
      u.oz -= u.drift * dt;
      u.sway += u.swaySpeed * dt;
      var wz = pz + u.oz;
      if (wz < pz - 34) { u.oz += 74; u.ox = (Math.random() - 0.5) * 24; u.oy = 1 + Math.random() * 6; }
      spr.position.set(px + u.ox + Math.sin(u.sway) * 1.2, u.oy + Math.sin(u.sway * 0.7) * 0.5, pz + u.oz);
      spr.material.opacity = 0.16 + 0.17 * (0.5 + 0.5 * Math.sin(u.sway * 1.3));
    }

    bakeVisible();
  }

  /* ============ Цикл ============ */

  /* ============ Парк конфет (tycoon) ============ */

  var ATTRACTIONS = [
    { key: 'atCart',     emoji: '🍦', cost: 400,    pop: 2 },
    { key: 'atBalloon',  emoji: '🎈', cost: 900,    pop: 3 },
    { key: 'atLolli',    emoji: '🍭', cost: 1800,   pop: 5 },
    { key: 'atStall',    emoji: '🍬', cost: 3200,   pop: 7 },
    { key: 'atCarousel', emoji: '🎠', cost: 5500,   pop: 11 },
    { key: 'atTeacups',  emoji: '🫖', cost: 9000,   pop: 15 },
    { key: 'atBumper',   emoji: '🚗', cost: 14000,  pop: 20 },
    { key: 'atChocoFt',  emoji: '⛲', cost: 22000,  pop: 26 },
    { key: 'atGinger',   emoji: '🏠', cost: 34000,  pop: 34 },
    { key: 'atCupcake',  emoji: '🧁', cost: 50000,  pop: 44 },
    { key: 'atSwingR',   emoji: '🌀', cost: 75000,  pop: 58 },
    { key: 'atFerris',   emoji: '🎡', cost: 110000, pop: 75 },
    { key: 'atCoaster',  emoji: '🎢', cost: 160000, pop: 95 },
    { key: 'atBigTop',   emoji: '🎪', cost: 230000, pop: 120 },
    { key: 'atGrand',    emoji: '🏰', cost: 350000, pop: 160 }
  ];

  var parkPaints = {}, parkBatchTints = {};
  function pMat(c) {
    if (!parkPaints[c]) { parkPaints[c] = toyMaterial(c); parkPaints[c].userData.parkPaint = true; }
    return parkPaints[c];
  }

  // Retain glossy candy paint while sharing rigid geometry. The common batching
  // helper bakes linear tint colors; moving cabins, flags and bobbing props stay out.
  function batchParkParts(group, keep) {
    var children = group.children.slice();
    for (var c = 0; c < children.length; c++) if (children[c].isGroup) batchParkParts(children[c], keep);
    var changed = [], casts = false, receives = false;
    for (var i = 0; i < group.children.length; i++) {
      var m = group.children[i], mat = m.material;
      if (!m.isMesh || m.children.length || (keep && keep.indexOf(m) >= 0) || !mat || !mat.userData.parkPaint || mat.vertexColors) continue;
      var key = mat.color.getHex();
      if (!parkBatchTints[key]) parkBatchTints[key] = new THREE.MeshLambertMaterial({ color: mat.color });
      changed.push({ mesh: m, material: mat }); m.material = parkBatchTints[key];
      casts = casts || m.castShadow; receives = receives || m.receiveShadow;
    }
    if (changed.length > 1) {
      batchRigidParts(group, keep);
      var baked = group.children[group.children.length - 1];
      if (baked.name === 'rigid-parts') {
        baked.material.dispose(); baked.material = toyMaterial(0xffffff); baked.material.vertexColors = true;
        baked.castShadow = casts; baked.receiveShadow = receives;
      }
    }
    for (var j = 0; j < changed.length; j++) changed[j].mesh.material = changed[j].material;
  }

  function parkBox(group, w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pMat(color));
    m.position.set(x || 0, y || 0, z || 0); group.add(m); return m;
  }

  function parkOutline(w, d, width) {
    var shape = new THREE.Shape(); shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d / 2); shape.lineTo(-w / 2, d / 2); shape.closePath();
    var hole = new THREE.Path(); hole.moveTo(-w / 2 + width, -d / 2 + width); hole.lineTo(-w / 2 + width, d / 2 - width); hole.lineTo(w / 2 - width, d / 2 - width); hole.lineTo(w / 2 - width, -d / 2 + width); hole.closePath(); shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape);
  }

  function addParkRoof(group, radius, height, y, color, segments) {
    for (var i = 0; i < segments; i++) {
      var wedge = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 3, 1, false, i / segments * Math.PI * 2, Math.PI * 2 / segments), pMat(i % 2 ? color : 0xfff1d9));
      wedge.position.y = y; group.add(wedge);
    }
  }

  // Модель аттракциона по индексу. Возвращает { group, rotor, axis }
  function buildAttractionModel(i) {
    var g = new THREE.Group();
    g.userData.bobbing = [];
    g.userData.cabins = [];
    g.userData.spinners = [];
    g.userData.fountain = [];
    var rotor = null, axis = 'y';
    var C = CANDY_COLORS;
    function box(w, h, d, c, x, y, z) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pMat(c)); m.position.set(x || 0, y || 0, z || 0); g.add(m); return m; }
    function cyl(rt, rb, h, c, x, y, z, s) { var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s || 12), pMat(c)); m.position.set(x || 0, y || 0, z || 0); g.add(m); return m; }
    function sph(r, c, x, y, z) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), pMat(c)); m.position.set(x || 0, y || 0, z || 0); g.add(m); return m; }
    function cone(r, h, c, x, y, z) { var m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), pMat(c)); m.position.set(x || 0, y || 0, z || 0); g.add(m); return m; }
    var w, s, a;

    if (i === 0) { // тележка мороженого
      box(1.8, 1.0, 1.1, 0xfff2f8, 0, 0.7, 0);
      box(1.84, 0.3, 1.12, 0xff6b9d, 0, 0.95, 0);
      var cn = cone(0.26, 0.5, 0xe0b27a, 0, 2.65, 0); cn.rotation.x = Math.PI;
      sph(0.29, 0xff9ecf, 0, 2.95, 0); sph(0.24, 0x9fe0b0, 0, 3.22, 0);
      for (w = -1; w <= 1; w += 2) { var wh = cyl(0.32, 0.32, 0.16, 0x5c2c12, w * 0.7, 0.3, 0.6, 12); wh.rotation.z = Math.PI / 2; }
      for (s = -1; s <= 1; s += 2) {
        box(0.075, 1.42, 0.075, 0x709e98, s * 0.91, 1.6, -0.49);
        box(0.1, 0.11, 0.85, 0x709e98, s * 0.6, 1.0, -0.94);
      }
      for (var aw = 0; aw < 7; aw++) { var stripeCanopy = box(0.32, 0.13, 1.55, aw % 2 ? 0xef9ea8 : 0xffefd5, -0.96 + aw * 0.32, 2.39, 0.04); stripeCanopy.rotation.x = -0.1; }
      box(2.3, 0.18, 0.12, 0x6da59c, 0, 2.26, 0.79);
      for (var scoop = 0; scoop < 3; scoop++) { cyl(0.18, 0.18, 0.09, 0xffefd5, -0.58 + scoop * 0.58, 1.13, 0.3, 10); sph(0.14, C[scoop], -0.58 + scoop * 0.58, 1.21, 0.3); }
    } else if (i === 1) { // стойка с шарами
      cyl(0.09, 0.09, 2.6, 0x8a5a2a, 0, 1.3, 0);
      box(1.0, 0.4, 1.0, 0xff7ec1, 0, 0.2, 0);
      for (var b = 0; b < 7; b++) {
        a = b / 7 * Math.PI * 2;
        var bl = sph(0.4, C[b % C.length], Math.cos(a) * 0.8, 2.5 + (b % 3) * 0.25, Math.sin(a) * 0.8);
        bl.scale.y = 1.25; g.userData.bobbing.push({ obj: bl, y: bl.position.y, phase: b });
        cyl(0.012, 0.012, 1.25, 0xfff4e7, Math.cos(a) * 0.8, 1.7, Math.sin(a) * 0.8, 4);
      }
      box(1.7, 0.72, 0.9, 0x82bfae, 0, 0.54, 0.1); box(1.83, 0.12, 1.02, 0xffefd5, 0, 0.97, 0.1);
      for (s = -1; s <= 1; s += 2) { var wheel = cyl(0.24, 0.24, 0.12, 0x5b4b53, s * 0.74, 0.25, 0.58, 10); wheel.rotation.z = Math.PI / 2; }
      for (var ribbon = 0; ribbon < 5; ribbon++) box(0.1, 0.42, 0.06, C[ribbon], -0.56 + ribbon * 0.28, 0.61, 0.58);
    } else if (i === 2) { // леденцовое дерево
      cyl(0.18, 0.24, 1.8, 0x8a5a2a, 0, 0.9, 0);
      var top = sph(1.1, 0x7ed957, 0, 2.4, 0); top.scale.y = 0.85;
      for (var l = 0; l < 6; l++) { a = l / 6 * Math.PI * 2; cyl(0.04, 0.04, 0.7, 0xffffff, Math.cos(a) * 0.9, 2.6, Math.sin(a) * 0.9, 6); sph(0.24, C[l % C.length], Math.cos(a) * 0.9, 3.0, Math.sin(a) * 0.9); }
      for (var ll = 0; ll < 3; ll++) {
        var disc = cyl(0.4, 0.4, 0.15, C[(ll + 3) % C.length], -0.8 + ll * 0.8, 2.72 + (ll % 2) * 0.5, -0.84, 16); disc.rotation.x = Math.PI / 2;
        var swirl = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.065, 5, 14), pMat(0xfff4e0)); swirl.position.copy(disc.position); swirl.position.z -= 0.09; g.add(swirl);
      }
      for (var band = 0; band < 4; band++) cyl(0.22, 0.23, 0.12, 0xffe4b7, 0, 0.37 + band * 0.38, 0, 9);
    } else if (i === 3) { // конфетная лавка
      box(2.0, 0.9, 1.2, 0xffc44d, 0, 0.45, 0);
      box(2.1, 0.16, 1.3, 0x7b3f1d, 0, 0.95, 0);
      for (s = -1; s <= 1; s += 2) cyl(0.06, 0.06, 2.4, 0x7b3f1d, s * 0.9, 1.2, -0.5, 6);
      var can = box(2.3, 0.14, 1.6, 0xffffff, 0, 2.45, -0.1); can.rotation.x = 0.2;
      var can2 = box(2.3, 0.12, 0.5, 0xff6b9d, 0, 2.3, 0.6); can2.rotation.x = 0.4;
      for (var j = 0; j < 4; j++) sph(0.2, C[j % C.length], -0.7 + j * 0.45, 1.15, 0.55);
      for (var scallop = 0; scallop < 7; scallop++) box(0.3, 0.22, 0.07, scallop % 2 ? 0xffe3b5 : 0xef91a7, -0.9 + scallop * 0.3, 2.2, 0.79);
      for (var jar = 0; jar < 3; jar++) { cyl(0.16, 0.16, 0.4, C[jar + 2], -0.66 + jar * 0.66, 1.27, -0.2, 9); cyl(0.19, 0.19, 0.07, 0xffefd5, -0.66 + jar * 0.66, 1.51, -0.2, 9); }
      for (var panel = 0; panel < 5; panel++) box(0.07, 0.72, 0.05, 0xe39b60, -0.8 + panel * 0.4, 0.48, 0.625);
    } else if (i === 4) { // карусель
      cyl(2.4, 2.6, 0.3, 0xffd9ec, 0, 0.15, 0, 20);
      cyl(0.2, 0.2, 3.0, 0xffffff, 0, 1.6, 0, 10);
      addParkRoof(g, 2.6, 1.2, 3.4, 0xe594ae, 12); sph(0.18, 0xf2c26c, 0, 4.13, 0);
      for (var bulb = 0; bulb < 12; bulb++) { a = bulb / 12 * Math.PI * 2; sph(0.12, 0xffe3a2, Math.cos(a) * 2.43, 2.83, Math.sin(a) * 2.43); }
      rotor = new THREE.Group(); g.add(rotor);
      for (var h = 0; h < 6; h++) {
        a = h / 6 * Math.PI * 2;
        var pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), pMat(0xffd700));
        pl.position.set(Math.cos(a) * 1.9, 1.1, Math.sin(a) * 1.9); rotor.add(pl);
        var pony = new THREE.Group(), ponyMat = pMat(C[h % C.length]);
        var hr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.75), ponyMat); pony.add(hr);
        var neck = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.55, 0.24), ponyMat); neck.position.set(0, 0.3, 0.3); pony.add(neck);
        var snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.21, 0.42), pMat(0xffefde)); snout.position.set(0, 0.5, 0.4); pony.add(snout);
        var seat = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.1, 0.38), pMat(0x735244)); seat.position.y = 0.22; pony.add(seat);
        for (var hoof = -1; hoof <= 1; hoof += 2) {
          parkBox(pony, 0.13, 0.35, 0.12, 0xffeed5, hoof * 0.13, -0.26, 0.24);
          parkBox(pony, 0.13, 0.35, 0.12, 0xffeed5, hoof * 0.13, -0.26, -0.24);
          parkBox(pony, 0.075, 0.2, 0.1, C[h % C.length], hoof * 0.1, 0.68, 0.26);
        }
        parkBox(pony, 0.05, 0.055, 0.06, 0x54464b, 0.16, 0.5, 0.48);
        pony.position.set(Math.cos(a) * 1.9, 0.7, Math.sin(a) * 1.9); pony.rotation.y = -a; rotor.add(pony);
        g.userData.bobbing.push({ obj: pony, y: 0.7, phase: h * 1.05 });
      }
    } else if (i === 5) { // чашки
      cyl(2.4, 2.6, 0.3, 0xa8d9e6, 0, 0.15, 0, 20);
      rotor = new THREE.Group(); g.add(rotor);
      for (var t = 0; t < 5; t++) {
        a = t / 5 * Math.PI * 2; var cup = new THREE.Group();
        var bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.38, 0.6, 14), pMat(C[t % C.length])); cup.add(bowl);
        var inside = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.035, 14), pMat(0x8c6b6a)); inside.position.y = 0.305; cup.add(inside);
        var lip = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.055, 5, 16), pMat(0xfff4dd)); lip.rotation.x = Math.PI / 2; lip.position.y = 0.33; cup.add(lip);
        var hd = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 6, 12), pMat(0xfff4dd)); hd.position.set(0.56, 0.02, 0); cup.add(hd);
        var saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.58, 0.09, 14), pMat(0xfff4dd)); saucer.position.y = -0.29; cup.add(saucer);
        cup.position.set(Math.cos(a) * 1.56, 0.65, Math.sin(a) * 1.56); rotor.add(cup); g.userData.spinners.push(cup);
      }
      sph(0.48, 0xf2c47a, 0, 0.93, 0); cyl(0.22, 0.3, 0.14, 0xffefd5, 0, 1.34, 0, 12); sph(0.09, 0xe895a5, 0, 1.48, 0);
      var spout = cone(0.17, 0.65, 0xf2c47a, 0.5, 1.02, 0); spout.rotation.z = -1.1;
      var teaHandle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.075, 6, 12), pMat(0xffefd5)); teaHandle.position.set(-0.46, 1.02, 0); g.add(teaHandle);
    } else if (i === 6) { // машинки
      box(4.6, 0.2, 4.6, 0x333340, 0, 0.1, 0);
      rotor = new THREE.Group(); rotor.position.y = 0.45; g.add(rotor);
      for (var c2 = 0; c2 < 4; c2++) {
        a = c2 / 4 * Math.PI * 2 + 0.4; var car = new THREE.Group();
        parkBox(car, 0.85, 0.35, 1.16, C[c2 % C.length], 0, 0, 0);
        parkBox(car, 0.58, 0.18, 0.45, 0x4c4e60, 0, 0.22, -0.16); parkBox(car, 0.6, 0.34, 0.12, 0xffe8c6, 0, 0.39, -0.37);
        parkBox(car, 0.035, 1.2, 0.035, 0x708d94, 0, 0.8, -0.48);
        for (var light = -1; light <= 1; light += 2) parkBox(car, 0.15, 0.11, 0.05, 0xffebaf, light * 0.25, 0.02, 0.603);
        var bm = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 6, 14), pMat(0x3a3e4d)); bm.rotation.x = Math.PI / 2; bm.scale.y = 1.25; bm.position.y = -0.14; car.add(bm);
        car.position.set(Math.cos(a) * 1.32, 0, Math.sin(a) * 1.32); car.rotation.y = -a; rotor.add(car);
      }
      for (s = -1; s <= 1; s += 2) { box(4.7, 0.15, 0.1, 0x9dcbbb, 0, 0.54, s * 2.28); box(0.1, 0.15, 4.7, 0x9dcbbb, s * 2.28, 0.54, 0); }
      for (var laneMark = -1; laneMark <= 1; laneMark += 2) box(3.8, 0.012, 0.045, 0xdccfc0, 0, 0.205, laneMark * 0.7);
    } else if (i === 7) { // шоколадный фонтан
      cyl(2.0, 2.2, 0.5, 0xe8a0b8, 0, 0.25, 0, 20);
      cyl(1.6, 1.6, 0.2, 0x3a1c0a, 0, 0.5, 0, 20);
      cyl(0.4, 0.5, 1.6, 0xd9a05e, 0, 1.2, 0, 12);
      var tiers = [1.0, 0.7, 0.45];
      for (var ti = 0; ti < 3; ti++) {
        cyl(tiers[ti], tiers[ti] * 0.8, 0.2, 0x4a2410, 0, 1.9 + ti * 0.6, 0, 14);
        cyl(tiers[ti] * 0.78, tiers[ti] * 0.87, 0.52, 0x694334, 0, 1.61 + ti * 0.6, 0, 14);
      }
      sph(0.3, 0xff4d6d, 0, 3.4, 0);
      for (var drip = 0; drip < 8; drip++) {
        a = drip / 8 * Math.PI * 2; var drop = sph(0.08, 0xc28a61, Math.cos(a) * 1.05, 1.1 + (drip % 3) * 0.3, Math.sin(a) * 1.05);
        drop.scale.y = 1.8; g.userData.fountain.push({ obj: drop, phase: drip / 8 });
      }
      var basinLip = new THREE.Mesh(new THREE.TorusGeometry(1.94, 0.11, 6, 24), pMat(0xffe4c6)); basinLip.rotation.x = Math.PI / 2; basinLip.position.y = 0.55; g.add(basinLip);
    } else if (i === 8) { // пряничный домик
      box(2.6, 1.8, 2.6, 0xb5713a, 0, 0.9, 0);
      for (s = -1; s <= 1; s += 2) { var roof = box(1.82, 0.23, 3.05, 0xffefd5, s * 0.66, 2.12, 0); roof.rotation.z = -s * 0.52; }
      box(0.42, 0.85, 0.43, 0xc38268, 0.65, 2.47, -0.6); box(0.54, 0.14, 0.53, 0xffefd5, 0.65, 2.93, -0.6);
      box(0.7, 1.1, 0.1, 0x5c2c12, 0, 0.55, 1.31);
      for (var gx = -1; gx <= 1; gx += 2) box(0.6, 0.6, 0.1, 0x9fe0ff, gx * 0.8, 1.1, 1.31);
      for (var dd = 0; dd < 8; dd++) sph(0.14, C[dd % C.length], -1.2 + dd * 0.34, 1.85, 1.3);
      for (var win = -1; win <= 1; win += 2) { box(0.68, 0.075, 0.08, 0xffefd5, win * 0.8, 1.1, 1.4); box(0.075, 0.68, 0.08, 0xffefd5, win * 0.8, 1.1, 1.4); }
      for (var brick = 0; brick < 5; brick++) box(0.22, 0.1, 0.12, 0xffefd5, -1.12 + brick * 0.56, 0.22, 1.34);
      sph(0.055, 0xeec478, 0.23, 0.57, 1.4);
    } else if (i === 9) { // кекс-башня
      cyl(2.2, 2.6, 1.2, 0xfff0f5, 0, 0.6, 0, 20);
      for (var p2 = 0; p2 < 16; p2++) { a = p2 / 16 * Math.PI * 2; box(0.15, 1.2, 0.15, 0xffb8dd, Math.cos(a) * 2.3, 0.6, Math.sin(a) * 2.3); }
      var cream = sph(1.98, 0xffdfbc, 0, 1.57, 0); cream.scale.y = 0.58;
      var frosting = sph(1.35, 0xf5a9c1, 0, 2.27, 0); frosting.scale.y = 0.62;
      var swirlTop = sph(0.72, 0xffdfbc, 0, 2.98, 0); swirlTop.scale.y = 0.7;
      sph(0.28, 0xdb5d78, 0, 3.56, 0);
      for (var sprinkle = 0; sprinkle < 12; sprinkle++) { a = sprinkle / 12 * Math.PI * 2; var chip = box(0.18, 0.06, 0.07, C[sprinkle % C.length], Math.cos(a) * 1.45, 2.21 + Math.sin(a * 3) * 0.04, Math.sin(a) * 1.45); chip.rotation.z = a; }
      box(0.72, 1.02, 0.08, 0x855d67, 0, 0.57, -2.58); box(0.91, 0.12, 0.45, 0xffe6bf, 0, 1.14, -2.59);
      for (var step = 0; step < 2; step++) box(0.98 + step * 0.12, 0.1, 0.31, 0xf1ce9e, 0, 0.18 - step * 0.05, -2.62 - step * 0.16);
    } else if (i === 10) { // карусель-цепочки
      cyl(1.4, 1.6, 0.3, 0xffd9ec, 0, 0.15, 0, 16);
      cyl(0.3, 0.3, 4.0, 0xffffff, 0, 2.1, 0, 10);
      addParkRoof(g, 2.2, 1.0, 4.4, 0x83bcab, 10); sph(0.19, 0xf1c97e, 0, 5.02, 0);
      rotor = new THREE.Group(); rotor.position.y = 3.6; g.add(rotor);
      for (var sw = 0; sw < 8; sw++) {
        a = sw / 8 * Math.PI * 2; var seatRig = new THREE.Group();
        for (var chain = -1; chain <= 1; chain += 2) parkBox(seatRig, 0.026, 1.6, 0.026, 0xc6d1cd, chain * 0.17, -0.8, 0);
        parkBox(seatRig, 0.48, 0.12, 0.43, C[sw % C.length], 0, -1.57, 0);
        parkBox(seatRig, 0.48, 0.36, 0.09, C[sw % C.length], 0, -1.39, -0.2);
        seatRig.position.set(Math.cos(a) * 1.65, 0, Math.sin(a) * 1.65); seatRig.rotation.y = -a; seatRig.rotation.z = 0.17; rotor.add(seatRig);
      }
      for (var jewel = 0; jewel < 8; jewel++) { a = jewel / 8 * Math.PI * 2; sph(0.1, 0xffe1a0, Math.cos(a) * 2.04, 3.96, Math.sin(a) * 2.04); }
    } else if (i === 11) { // колесо обозрения
      for (s = -1; s <= 1; s += 2) { var leg = cyl(0.15, 0.15, 5.4, 0xff6b9d, s * 1.4, 2.7, 0, 8); leg.rotation.z = s * 0.25; }
      rotor = new THREE.Group(); rotor.position.y = 4.6; g.add(rotor); axis = 'z';
      var rim = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.12, 8, 32), pMat(0xffffff)); rotor.add(rim);
      var rimBack = new THREE.Mesh(new THREE.TorusGeometry(2.83, 0.07, 6, 32), pMat(0x83c1b0)); rimBack.position.z = -0.2; rotor.add(rimBack);
      var axle = cyl(0.29, 0.29, 0.7, 0xf5c677, 0, 4.6, 0, 12); axle.rotation.x = Math.PI / 2;
      for (var sp = 0; sp < 8; sp++) {
        a = sp / 8 * Math.PI * 2;
        if (sp < 4) { var spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.0, 6), pMat(0xffd700)); spoke.rotation.z = a; rotor.add(spoke); }
        var cab = new THREE.Group();
        var cabBody = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.72), pMat(C[sp % C.length])); cabBody.position.y = -0.25; cab.add(cabBody);
        var cabRoof = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.8), pMat(0xfff7e9)); cabRoof.position.y = 0.27; cab.add(cabRoof);
        for (var cp = -1; cp <= 1; cp += 2) { var rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.06), pMat(0xfff7e9)); rail.position.set(cp * 0.33, 0.05, 0.32); cab.add(rail); }
        parkBox(cab, 0.62, 0.055, 0.06, 0xfff0d6, 0, 0.02, -0.34);
        parkBox(cab, 0.5, 0.09, 0.44, 0x7d6978, 0, -0.03, 0);
        cab.position.set(Math.cos(a) * 3.0, Math.sin(a) * 3.0, 0); rotor.add(cab); g.userData.cabins.push(cab);
      }
    } else if (i === 12) { // мини-горка
      box(4.8, 0.2, 4.35, 0x92bba6, 0, 0.1, 0);
      for (var railSide = -1; railSide <= 1; railSide += 2) {
        var points = [];
        for (var point = 0; point < 24; point++) { a = point / 24 * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(a) * (2.0 + railSide * 0.17), 1.55 + Math.sin(a * 2) * 0.43, Math.sin(a) * (1.8 + railSide * 0.17))); }
        var curve = new THREE.CatmullRomCurve3(points, true);
        var track = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.065, 5, true), pMat(railSide < 0 ? 0xffe3be : 0xe58b9e)); g.add(track);
      }
      for (var pp = 0; pp < 12; pp++) { a = pp / 12 * Math.PI * 2; var height = 1.55 + Math.sin(a * 2) * 0.43;
        cyl(0.07, 0.1, height, 0xffefd5, Math.cos(a) * 2.0, height / 2, Math.sin(a) * 1.8, 6);
        var sleeper = box(0.58, 0.09, 0.13, 0xc99872, Math.cos(a) * 2.0, height - 0.03, Math.sin(a) * 1.8); sleeper.rotation.y = -a;
      }
      rotor = new THREE.Group(); g.add(rotor); g.userData.coasterCars = [];
      for (var train = 0; train < 2; train++) {
        var carC = new THREE.Group(); parkBox(carC, 0.51, 0.29, 0.63, train ? 0xf1b478 : 0xe795a9, 0, 0.12, 0);
        parkBox(carC, 0.38, 0.09, 0.37, 0x755965, 0, 0.28, -0.05); parkBox(carC, 0.4, 0.3, 0.08, 0xffead0, 0, 0.41, -0.28);
        for (s = -1; s <= 1; s += 2) parkBox(carC, 0.07, 0.12, 0.48, 0x5f5968, s * 0.24, -0.03, 0);
        rotor.add(carC); g.userData.coasterCars.push(carC);
      }
    } else if (i === 13) { // цирковой шатёр
      cyl(2.3, 2.3, 2.0, 0xfff0db, 0, 1.0, 0, 24);
      for (var st2 = 0; st2 < 12; st2++) { a = st2 / 12 * Math.PI * 2; var strp = box(0.42, 1.9, 0.07, 0xe89dab, Math.cos(a) * 2.3, 1.0, Math.sin(a) * 2.3); strp.rotation.y = -a + Math.PI / 2; }
      addParkRoof(g, 3.0, 2.1, 3.0, 0xe89dab, 12); sph(0.24, 0xf2c371, 0, 4.18, 0);
      box(1.1, 1.4, 0.1, 0x655269, 0, 0.7, 2.31);
      for (s = -1; s <= 1; s += 2) { var curtain = box(0.39, 1.47, 0.14, 0xc67086, s * 0.58, 0.75, 2.35); curtain.rotation.z = s * 0.14; }
      for (var tentLight = 0; tentLight < 12; tentLight++) { a = tentLight / 12 * Math.PI * 2; sph(0.13, 0xffd992, Math.cos(a) * 2.8, 1.99, Math.sin(a) * 2.8); }
    } else { // грандиозный замок
      for (var tw = -1; tw <= 1; tw += 2) { cyl(0.7, 0.8, 4.0, 0xffd9ec, tw * 2.0, 2.0, 0, 12); cone(0.9, 1.4, 0xff6b9d, tw * 2.0, 4.7, 0); }
      cyl(1.0, 1.1, 5.0, 0xffe0ea, 0, 2.5, 0, 12); cone(1.3, 2.0, 0xe0489a, 0, 6.0, 0);
      box(3.6, 3.0, 1.2, 0xffd9ec, 0, 1.5, 0.6);
      box(1.0, 1.8, 0.2, 0x5c2c12, 0, 0.9, 1.31);
      sph(0.3, 0xffd700, 0, 7.2, 0);
      for (var tower = -1; tower <= 1; tower += 2) {
        for (var tier = 0; tier < 3; tier++) cyl(0.74, 0.74, 0.11, 0xfff0d8, tower * 2, 0.8 + tier * 1.25, 0, 12);
        box(0.37, 0.65, 0.075, 0x81b6c0, tower * 2, 2.6, 0.71);
        box(0.43, 0.065, 0.1, 0xfff0d8, tower * 2, 2.52, 0.76);
      }
      for (var tooth = 0; tooth < 7; tooth++) box(0.33, 0.35, 0.5, 0xfff0d8, -1.5 + tooth * 0.5, 3.08, 1.0);
      box(1.27, 0.12, 1.11, 0xeac79a, 0, 0.12, 1.79);
      for (var doorBand = 0; doorBand < 3; doorBand++) box(0.87, 0.09, 0.04, 0xf4d399, 0, 0.39 + doorBand * 0.48, 1.435);
    }

    // Every attraction sits on a finished toy diorama base with a little marquee.
    var art = ROOM_ART[i % ROOM_ART.length], baseRadius = i > 12 ? 2.6 : 2.3;
    var base = new THREE.Mesh(new THREE.CylinderGeometry(baseRadius, baseRadius + 0.12, 0.13, 24), pMat(0xfff0d6));
    base.position.y = 0.04; base.receiveShadow = true; g.add(base);
    var trim = new THREE.Mesh(new THREE.TorusGeometry(baseRadius, 0.065, 5, 28), pMat(art.accent));
    trim.rotation.x = Math.PI / 2; trim.position.y = 0.12; g.add(trim);
    var marquee = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), pMat(art.dark));
    pole.position.y = 0.75; marquee.add(pole);
    var pennant = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.52, 3), pMat(art.accent));
    pennant.rotation.z = -Math.PI / 2; pennant.position.set(0.2, 1.45, 0); marquee.add(pennant);
    marquee.position.set(-baseRadius + 0.15, 0, baseRadius * 0.68); g.add(marquee);
    g.userData.flag = pennant;
    var moving = [pennant];
    for (var bi = 0; bi < g.userData.bobbing.length; bi++) moving.push(g.userData.bobbing[bi].obj);
    for (var flow = 0; flow < g.userData.fountain.length; flow++) moving.push(g.userData.fountain[flow].obj);
    batchParkParts(g, moving);
    if (i === 0 || i === 3 || i === 8 || i === 13 || i === 14) g.rotation.y = Math.PI;
    castShadows(g);
    return { group: g, rotor: rotor, axis: axis };
  }

  var parkPlanTextures = {};
  function parkPlanTexture(index, available) {
    var key = index + ':' + available;
    if (parkPlanTextures[key]) return parkPlanTextures[key];
    var c = document.createElement('canvas'); c.width = 512; c.height = 256;
    var ctx = c.getContext('2d'), at = ATTRACTIONS[index];
    ctx.fillStyle = available ? '#fff0cc' : '#e9f1ed'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = available ? '#348c80' : '#647f88'; ctx.fillRect(0, 0, 512, 57);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.font = 'bold 30px Rubik, Arial';
    ctx.fillText(available ? 'READY TO BUILD' : 'FUTURE ATTRACTION ' + (index + 1), 256, 39);
    var name = I18N.t(at.key); ctx.fillStyle = '#513d4a'; ctx.font = 'bold 39px Rubik, Arial';
    if (ctx.measureText(name).width > 474) ctx.font = 'bold 31px Rubik, Arial';
    ctx.fillText(name, 256, 119);
    ctx.font = available ? 'bold 34px Rubik, Arial' : 'bold 28px Rubik, Arial'; ctx.fillStyle = available ? '#b56c37' : '#6c838a';
    ctx.fillText(available ? at.cost.toLocaleString('en-US') + ' CANDIES' : 'Build the previous attraction', 256, 175);
    ctx.font = '24px Rubik, Arial'; ctx.fillText(available ? 'Walk up to the sign' : 'Your next park project', 256, 222);
    parkPlanTextures[key] = colorCanvasTexture(c); return parkPlanTextures[key];
  }

  function makeParkSign(plot) {
    var grp = new THREE.Group();
    for (var side = -1; side <= 1; side += 2) {
      parkBox(grp, 0.12, 1.55, 0.12, 0x629b92, side * 0.82, 0.79, 0);
      parkBox(grp, 0.29, 0.12, 0.4, 0xfff0d6, side * 0.82, 0.12, 0);
    }
    var board = parkBox(grp, 2.54, 1.38, 0.18, 0x629b92, 0, 1.69, 0); board.material = board.material.clone();
    var label = new THREE.Mesh(new THREE.PlaneGeometry(2.34, 1.17), new THREE.MeshBasicMaterial({ map: plot.index >= parkBuilt ? parkPlanTexture(plot.index, plot.index === parkBuilt) : null }));
    label.position.set(0, 1.69, -0.101); label.rotation.y = Math.PI; grp.add(label);
    // Leave the middle of each front opening clear, including the arrival spawn.
    grp.position.set(plot.x + 1.42, PARK_Y, plot.z - 2.82); grp.scale.set(0.86, 0.9, 1);
    plot.label = label; plot.board = board;
    batchParkParts(grp, [board]); castShadows(grp); return grp;
  }

  function makeParkConstruction(plot) {
    var g = new THREE.Group(), ink = 0xd8ece7, blue = 0x76a2aa;
    parkBox(g, 4.55, 0.08, 4.55, blue, 0, 0.23, 0);
    for (var grid = -2; grid <= 2; grid++) {
      parkBox(g, 4.3, 0.012, 0.024, ink, 0, 0.278, grid * 0.85);
      parkBox(g, 0.024, 0.012, 4.3, ink, grid * 0.85, 0.279, 0);
    }
    // Small white architectural plan: foundations, footprint and a central model.
    var width = plot.index % 3 === 0 ? 1.65 : 1.15, height = 0.25 + (plot.index % 4) * 0.18;
    parkBox(g, width, height, 1.35, ink, 0, 0.28 + height / 2, 0);
    if (plot.index >= 4) {
      var footprint = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.055, 4, 20), pMat(ink)); footprint.rotation.x = Math.PI / 2; footprint.position.y = 0.33; g.add(footprint);
      parkBox(g, 0.14, 1.1, 0.14, ink, 0, 0.85, 0);
    }
    for (var side = -1; side <= 1; side += 2) {
      for (var back = -1; back <= 1; back += 2) {
        parkBox(g, 0.17, 0.86, 0.17, 0xffefd3, side * 2.35, 0.53, back * 2.35);
        parkBox(g, 0.23, 0.1, 0.23, 0xe8977d, side * 2.35, 0.99, back * 2.35);
      }
      parkBox(g, 0.07, 0.12, 4.6, 0xffefd3, side * 2.35, 0.73, 0);
    }
    parkBox(g, 4.6, 0.12, 0.07, 0xffefd3, 0, 0.73, 2.35);
    for (var stack = 0; stack < 3; stack++) parkBox(g, 1.0, 0.1, 0.37, 0xc7976c, 1.42, 0.36 + stack * 0.11, 1.63);
    var crate = parkBox(g, 0.52, 0.45, 0.52, 0xe0b57e, -1.45, 0.49, 1.55); crate.rotation.y = 0.16;
    parkBox(g, 0.6, 0.06, 0.59, 0xffefd3, -1.45, 0.75, 1.55);
    g.position.set(plot.x, PARK_Y, plot.z); batchParkParts(g); castShadows(g); return g;
  }

  function refreshPlotSigns() {
    for (var i = 0; i < park.plots.length; i++) {
      var pl = park.plots[i], at = ATTRACTIONS[i];
      if (i < parkBuilt) {
        pl.sign.visible = false;
        if (pl.construction) pl.construction.visible = false;
        if (pl.rim) { pl.rim.material.color.setHex(0x82bfaa); pl.rim.scale.set(1, 1, 1); }
        continue;
      }
      pl.sign.visible = true;
      if (i === parkBuilt) {
        pl.label.material.map = parkPlanTexture(i, true);
        pl.board.material.color.setHex(0x4b9c8d);
        if (pl.rim) pl.rim.material.color.setHex(0xffd23f);   // следующий — золотой
      } else {
        pl.label.material.map = parkPlanTexture(i, false);
        pl.board.material.color.setHex(0x92acaf);
        if (pl.rim) pl.rim.material.color.setHex(0xb3cbc4);
      }
    }
  }

  function placeAttraction(idx) {
    var pl = park.plots[idx];
    if (pl.built) return;
    var m = buildAttractionModel(idx);
    m.group.position.set(pl.x, PARK_Y + 0.2, pl.z);
    park.group.add(m.group);
    pl.model = m.group; pl.rotor = m.rotor; pl.axis = m.axis; pl.built = true;
    if (pl.construction) pl.construction.visible = false;
    if (pl.pad) pl.pad.material.color.setHex(0xead1a8);
    if (pl.label) pl.label.material.map = null;
    // A completed plot never needs its planning board again.
    for (var state = 0; state < 2; state++) { var planKey = idx + ':' + !!state; if (parkPlanTextures[planKey]) { parkPlanTextures[planKey].dispose(); delete parkPlanTextures[planKey]; } }
  }

  function recomputePopularity() {
    var s = 0;
    for (var i = 0; i < parkBuilt; i++) s += ATTRACTIONS[i].pop;
    parkPopularity = s;
  }

  function pickVisitorTarget(v) {
    var built = [];
    for (var i = 0; i < park.plots.length; i++) if (park.plots[i].built) built.push(park.plots[i]);
    if (built.length && Math.random() < 0.7) {
      var p = built[(Math.random() * built.length) | 0];
      v.tx = p.x + (Math.random() - 0.5) * 4;
      v.tz = p.z - 2.6 - Math.random() * 1.4;
    } else {
      var a = Math.random() * Math.PI * 2, r = Math.random() * 18;
      v.tx = Math.cos(a) * r; v.tz = (PARK_Z0 + 22) + Math.sin(a) * r;
    }
  }

  function makeVisitor() {
    var hairRoll = Math.random();
    var ch = createCharacter({
      skin: BOT_SKINS[(Math.random() * BOT_SKINS.length) | 0],
      shirt: BOT_SHIRTS[(Math.random() * BOT_SHIRTS.length) | 0],
      front: Math.random() < 0.4 ? BOT_SHIRTS[(Math.random() * BOT_SHIRTS.length) | 0] : undefined,
      pants: BOT_PANTS[(Math.random() * BOT_PANTS.length) | 0],
      shoe: BOT_SHOES[(Math.random() * BOT_SHOES.length) | 0],
      hair: hairRoll < 0.35 ? 'flat' : hairRoll < 0.6 ? 'side' : hairRoll < 0.85 ? 'long' : 'spiky',
      hairColor: BOT_HAIRS[(Math.random() * BOT_HAIRS.length) | 0]
    });
    if (Math.random() < 0.3) addBackpack(ch, BOT_SHIRTS[(Math.random() * BOT_SHIRTS.length) | 0]);
    park.group.add(ch.group);
    var v = { ch: ch, x: 0, z: PARK_Z0 + 22, tx: 0, tz: PARK_Z0 + 22, yaw: 0, phase: Math.random() * 6, speed: 1.4 + Math.random() * 1.1, waitT: Math.random() * 3 };
    pickVisitorTarget(v);
    v.x = v.tx; v.z = v.tz;
    ch.group.position.set(v.x, PARK_Y, v.z);
    park.visitors.push(v);
    return v;
  }

  function ensureVisitors() {
    var target = parkBuilt <= 0 ? 0 : Math.min(14, parkBuilt + 2);
    while (park.visitors.length < target) makeVisitor();
  }

  function addParkTree(pg, x, z) {
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 8), pMat(0x9a6a3a));
    trunk.position.y = 1.2; g.add(trunk);
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), pMat(0x74cf5a));
    canopy.position.y = 3.0; canopy.scale.y = 0.9; g.add(canopy);
    var canopy2 = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), pMat(0x8fe06a));
    canopy2.position.set(0.6, 3.5, 0.3); g.add(canopy2);
    for (var i = 0; i < 7; i++) {
      var a = i / 7 * Math.PI * 2;
      var berry = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), pMat(CANDY_COLORS[i % CANDY_COLORS.length]));
      berry.position.set(Math.cos(a) * 1.2, 3.0 + Math.sin(a * 2) * 0.5, Math.sin(a) * 1.2); g.add(berry);
    }
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 5, 16), pMat(0xffead0)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.14; g.add(ring);
    g.position.set(x, PARK_Y, z); batchParkParts(g); castShadows(g); pg.add(g);
  }

  function addCandyLamp(pg, x, z) {
    var g = new THREE.Group();
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.2, 8), pMat(0xffffff));
    post.position.y = 1.6; g.add(post);
    for (var s = 0; s < 5; s++) {
      var st = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.26, 8), pMat(0xff5a6e));
      st.position.y = 0.5 + s * 0.62; st.rotation.x = 0.5; g.add(st);
    }
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xfff2a0, emissive: 0xffe066, emissiveIntensity: 0.7 }));
    bulb.position.set(0, 3.4, 0); g.add(bulb);
    if (!glowTex) glowTex = makeGlowTexture();
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe680, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.set(1.3, 1.3, 1); glow.position.set(0, 3.4, 0); g.add(glow);
    parkBox(g, 0.42, 0.16, 0.42, 0x679e98, 0, 0.1, 0);
    g.position.set(x, PARK_Y, z); batchParkParts(g); castShadows(g); pg.add(g);
  }

  function addFlowerBed(pg, x, z) {
    var g = new THREE.Group();
    var soil = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.35, 12), pMat(0x8a5a3a));
    soil.position.y = 0.17; g.add(soil);
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2, r = i % 3 ? 0.66 : 0.33;
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), pMat(0x4faf4f));
      stem.position.set(Math.cos(a) * r, 0.55, Math.sin(a) * r); g.add(stem);
      var fl = new THREE.Mesh(new THREE.SphereGeometry(0.21, 7, 5), pMat(CANDY_COLORS[i % CANDY_COLORS.length]));
      fl.position.set(Math.cos(a) * r, 0.85, Math.sin(a) * r); g.add(fl);
    }
    var border = new THREE.Mesh(new THREE.TorusGeometry(1.01, 0.095, 5, 16), pMat(0xfff0d6)); border.rotation.x = Math.PI / 2; border.position.y = 0.36; g.add(border);
    g.position.set(x, PARK_Y, z); batchParkParts(g); pg.add(g);
  }

  function addParkBench(pg, x, z, angle) {
    var g = new THREE.Group();
    for (var slat = 0; slat < 3; slat++) parkBox(g, 2.2, 0.12, 0.21, 0xcfa579, 0, 0.62, -0.24 + slat * 0.24);
    parkBox(g, 2.2, 0.19, 0.12, 0x75afa1, 0, 1.16, 0.38);
    parkBox(g, 2.2, 0.19, 0.12, 0x75afa1, 0, 0.91, 0.38);
    for (var s = -1; s <= 1; s += 2) { parkBox(g, 0.14, 0.58, 0.68, 0x566b76, s * 0.85, 0.3, 0); parkBox(g, 0.11, 0.7, 0.11, 0x566b76, s * 0.85, 0.92, 0.36); }
    g.position.set(x, PARK_Y, z); g.rotation.y = angle; batchParkParts(g); castShadows(g); pg.add(g);
  }

  function addParkRailings(pg, cz) {
    var g = new THREE.Group();
    for (var section = 0; section < 28; section++) {
      var a = section / 28 * Math.PI * 2;
      if (Math.sin(a) < -0.92) continue; // open arrival promenade
      var panel = new THREE.Group();
      for (var side = -1; side <= 1; side += 2) { parkBox(panel, 0.12, 1.03, 0.12, 0xffecd4, side * 2.38, 0.53, 0); parkBox(panel, 0.2, 0.12, 0.2, 0xe79691, side * 2.38, 1.08, 0); }
      parkBox(panel, 4.76, 0.13, 0.09, 0x7ea89d, 0, 0.87, 0); parkBox(panel, 4.76, 0.1, 0.08, 0x7ea89d, 0, 0.38, 0);
      panel.position.set(Math.cos(a) * 25.5, PARK_Y, cz + Math.sin(a) * 25.5); panel.rotation.y = -a + Math.PI / 2; g.add(panel);
    }
    batchParkParts(g); pg.add(g);
  }

  function buildParkBackdrop(pg, cz) {
    // далёкие конфетные холмы (в тумане — создают глубину)
    var hillColors = [0xffd0e0, 0xffe4b8, 0xd4f0d4, 0xe4d4ff, 0xffc8dc, 0xd0ecff];
    for (var i = 0; i < 11; i++) {
      var a = i / 11 * Math.PI * 2 + 0.2, r = 44 + Math.random() * 12;
      var hill = new THREE.Mesh(new THREE.SphereGeometry(11 + Math.random() * 9, 16, 12),
        new THREE.MeshLambertMaterial({ color: hillColors[i % hillColors.length] }));
      hill.scale.y = 0.5;
      hill.position.set(Math.cos(a) * r, PARK_Y - 4 + Math.random() * 2, cz + Math.sin(a) * r);
      pg.add(hill);
    }
    // облака
    for (var c = 0; c < 14; c++) {
      var cloud = new THREE.Group();
      var n = 3 + (Math.random() * 3 | 0);
      for (var k = 0; k < n; k++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random() * 1.3, 10, 8), pMat(0xffffff));
        puff.position.set((k - n / 2) * 1.7, Math.random() * 0.7, Math.random() * 1.3); puff.scale.y = 0.7; cloud.add(puff);
      }
      var ca = Math.random() * Math.PI * 2, cr = 28 + Math.random() * 22;
      cloud.position.set(Math.cos(ca) * cr, 12 + Math.random() * 9, cz + Math.sin(ca) * cr); batchParkParts(cloud); pg.add(cloud);
    }
    // мягкое солнце (небольшое и неяркое, чтобы не пересвечивать сцену)
    if (!glowTex) glowTex = makeGlowTexture();
    var sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0c0, transparent: true, opacity: 0.4, blending: THREE.NormalBlending, depthWrite: false, fog: false }));
    sun.scale.set(12, 12, 1); sun.position.set(-40, 40, cz + 52); pg.add(sun);
  }

  function buildParkIfNeeded() {
    if (park) return;
    park = { group: new THREE.Group(), plots: [], visitors: [] };
    var pg = park.group;
    var cz = PARK_Z0 + 22;

    // земля: тёмная кайма + светлая лужайка
    var ground = new THREE.Mesh(new THREE.CylinderGeometry(33, 33, 2.0, 52), pMat(0x74bca7));
    ground.position.set(0, PARK_Y - 1.0, cz); ground.receiveShadow = true; pg.add(ground);
    var lawn = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 2.02, 52), pMat(0xb6dcc6));
    lawn.position.set(0, PARK_Y - 0.98, cz); lawn.receiveShadow = true; pg.add(lawn);

    // Streets pass between plots; no painted path runs through a ride's collider.
    var arrival = parkBox(pg, 6.0, 0.12, 8.4, 0xefcdad, 0, PARK_Y + 0.02, PARK_Z0 + 3.8); arrival.receiveShadow = true;
    var rowsZ = [PARK_Z0 + 12, PARK_Z0 + 22, PARK_Z0 + 32];
    for (var cp = 0; cp < 4; cp++) {
      var streetZ = PARK_Z0 + 7 + cp * 10;
      var cross = parkBox(pg, 39, 0.12, 3.6, 0xefcdad, 0, PARK_Y + 0.03, streetZ); cross.receiveShadow = true;
      for (var edge = -1; edge <= 1; edge += 2) parkBox(pg, 39, 0.045, 0.09, 0xfff2d9, 0, PARK_Y + 0.105, streetZ + edge * 1.73);
      for (var stone = -9; stone <= 9; stone++) parkBox(pg, 0.035, 0.015, 3.4, 0xd0ab91, stone * 2, PARK_Y + 0.1, streetZ);
    }
    for (var lane = 0; lane < 6; lane++) {
      var walk = parkBox(pg, 1.55, 0.1, 30, 0xf6e0be, -17.5 + lane * 7, PARK_Y + 0.075, cz); walk.receiveShadow = true;
    }
    for (var arrow = 0; arrow < 5; arrow++) {
      var way = parkBox(pg, 0.55, 0.018, 0.13, 0x699f90, -2.8 - arrow * 2.1, PARK_Y + 0.111, PARK_Z0 + 6.5); way.rotation.y = -0.55;
      var way2 = parkBox(pg, 0.55, 0.018, 0.13, 0x699f90, -2.8 - arrow * 2.1, PARK_Y + 0.112, PARK_Z0 + 6.22); way2.rotation.y = 0.55;
    }

    // ворота-выход (арка с вывеской)
    var gate = new THREE.Group();
    for (var gs = -1; gs <= 1; gs += 2) {
      var gp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 3.4, 12), pMat(0xff7ec1));
      gp.position.set(gs * 1.8, PARK_Y + 1.7, 0); gate.add(gp);
      for (var gsp = 0; gsp < 4; gsp++) { var band = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 12), pMat(0xffffff)); band.position.set(gs * 1.8, 0.6 + gsp * 0.85, 0); gate.add(band); }
    }
    parkBox(gate, 4.6, 0.7, 0.8, 0x639e94, 0, PARK_Y + 3.6, 0);
    parkBox(gate, 4.85, 0.14, 0.97, 0xffeed5, 0, PARK_Y + 4.02, 0);
    for (var cap = 0; cap < 9; cap++) { var bead = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 5), pMat(cap % 2 ? 0xefab9f : 0xffe0a1)); bead.position.set(-1.9 + cap * 0.47, 4.17, 0); gate.add(bead); }
    var gspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeNameTexture('CANDY GARDENS'), transparent: true, depthWrite: false })); gspr.scale.set(3.55, 0.76, 1); gspr.position.set(0, PARK_Y + 3.62, -0.45); gate.add(gspr);
    var exitName = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeNameTexture('EXIT TO HUB'), transparent: true, depthWrite: false })); exitName.scale.set(2.0, 0.43, 1); exitName.position.set(0, PARK_Y + 2.98, 0); gate.add(exitName);
    for (var boothSide = -1; boothSide <= 1; boothSide += 2) {
      parkBox(gate, 1.7, 1.4, 1.4, 0xeaa99c, boothSide * 3.3, 0.7, 0.4);
      parkBox(gate, 1.55, 0.8, 0.04, 0x4c777b, boothSide * 3.3, 1.04, -0.32);
      parkBox(gate, 1.9, 0.12, 1.64, 0xffe9c5, boothSide * 3.3, 1.46, 0.4);
      parkBox(gate, 0.08, 0.8, 0.09, 0xffe9c5, boothSide * 3.3, 1.04, -0.36);
    }
    gate.position.set(0, 0, PARK_Z0 + 1.5); batchParkParts(gate); castShadows(gate); pg.add(gate);

    // живая изгородь по периметру
    for (var h = 0; h < 70; h++) {
      var ha = h / 70 * Math.PI * 2;
      var bush = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 7), pMat(h % 3 ? 0x5aab5a : 0x4f9a4f));
      bush.scale.y = 0.8; bush.position.set(Math.cos(ha) * 31, PARK_Y + 0.4, cz + Math.sin(ha) * 31);
      pg.add(bush);
    }
    // деревья, фонари, клумбы по внешнему кольцу
    for (var tt = 0; tt < 12; tt++) { var ta = tt / 12 * Math.PI * 2 + 0.26; addParkTree(pg, Math.cos(ta) * 28, cz + Math.sin(ta) * 28); }
    for (var lp = 0; lp < 8; lp++) { var la = lp / 8 * Math.PI * 2 + 0.4; addCandyLamp(pg, Math.cos(la) * 22, cz + Math.sin(la) * 22); }
    for (var fb = 0; fb < 10; fb++) { var fa2 = fb / 10 * Math.PI * 2 + 0.15, fr = 23.8; addFlowerBed(pg, Math.cos(fa2) * fr, cz + Math.sin(fa2) * fr); }
    addParkRailings(pg, cz);
    for (var bs = -1; bs <= 1; bs += 2) { addParkBench(pg, bs * 25, cz - 4, bs * Math.PI / 2); addParkBench(pg, bs * 25, cz + 4, bs * Math.PI / 2); }

    buildParkBackdrop(pg, cz);

    // плоты
    var cols = [-14, -7, 0, 7, 14];
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 5; c++) {
        var plot = { index: r * 5 + c, x: cols[c], z: rowsZ[r], built: false, model: null, rotor: null, axis: 'y', sign: null, pad: null, rim: null };
        var pad = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.14, 5.35), pMat(0xe6d9bd).clone());
        pad.position.set(plot.x, PARK_Y + 0.1, plot.z); pad.receiveShadow = true; pg.add(pad); plot.pad = pad;
        var rim = new THREE.Mesh(parkOutline(5.38, 5.38, 0.12), pMat(0xb3cbc4).clone());
        rim.rotation.x = -Math.PI / 2; rim.position.set(plot.x, PARK_Y + 0.178, plot.z); pg.add(rim); plot.rim = rim;
        plot.construction = plot.index >= parkBuilt ? makeParkConstruction(plot) : null; if (plot.construction) pg.add(plot.construction);
        plot.sign = makeParkSign(plot); pg.add(plot.sign);
        park.plots.push(plot);
      }
    }

    // The static ground, shrubs and paths use one glossy vertex-colored batch;
    // individual stateful plot frames and boards retain their material handles.
    var retained = [];
    for (var keep = 0; keep < park.plots.length; keep++) retained.push(park.plots[keep].pad, park.plots[keep].rim, park.plots[keep].board);
    batchParkParts(pg, retained);
    pg.visible = false;
    scene.add(pg);

    for (var bi = 0; bi < parkBuilt; bi++) placeAttraction(bi);
    recomputePopularity();
    refreshPlotSigns();
  }

  function tryBuild(idx, sponsored) {
    if (idx !== parkBuilt || idx >= ATTRACTIONS.length) return false;
    var at = ATTRACTIONS[idx];
    if (!sponsored && coins < at.cost) { GameAudio.deny(); if (api.onParkBuild) api.onParkBuild(false); return false; }
    if (!sponsored) { coins -= at.cost; if (api.onCoinsChange) api.onCoinsChange(coins); }
    placeAttraction(idx);
    parkBuilt++;
    recomputePopularity();
    refreshPlotSigns();
    ensureVisitors();
    GameAudio.buy();
    markSave(); if (api.onSave) api.onSave(getSave());
    nearPlot = -2;
    if (api.onParkPrompt) api.onParkPrompt(null);
    if (api.onParkBuild) api.onParkBuild(true, at, parkBuilt, parkPopularity);
    if (api.onParkStats) api.onParkStats(parkBuilt, parkPopularity);
    return true;
  }

  function updateParkBuild() {
    var idx = parkBuilt, near = -1;
    if (idx < park.plots.length) {
      var pl = park.plots[idx];
      var dx = px - pl.x, dz = pz - pl.z;
      if (dx * dx + dz * dz < 4.2 * 4.2) near = idx;
    }
    if (near !== nearPlot) {
      nearPlot = near;
      if (api.onParkPrompt) {
        if (near >= 0) { var at = ATTRACTIONS[near]; api.onParkPrompt({ emoji: at.emoji, name: I18N.t(at.key), cost: at.cost, idx: near }); }
        else api.onParkPrompt(null);
      }
    }
    if (buildQueued) { buildQueued = false; if (near >= 0) tryBuild(near); }
  }

  function resolveParkColliders() {
    var pr = 0.4;
    for (var i = 0; i < park.plots.length; i++) {
      var pl = park.plots[i];
      if (!pl.built) continue;
      var dx = px - pl.x, dz = pz - pl.z, d2 = dx * dx + dz * dz, R = 2.3 + pr;
      if (d2 < R * R && d2 > 0.0001) { var d = Math.sqrt(d2); px = pl.x + dx / d * R; pz = pl.z + dz / d * R; }
    }
  }

  function updateVisitors(dt) {
    for (var i = 0; i < park.visitors.length; i++) {
      var v = park.visitors[i];
      if (v.waitT > 0) { v.waitT -= dt; }
      else {
        var dx = v.tx - v.x, dz = v.tz - v.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.4) { v.waitT = 1 + Math.random() * 3; pickVisitorTarget(v); }
        else { v.x += dx / d * v.speed * dt; v.z += dz / d * v.speed * dt; v.yaw = Math.atan2(dx, dz); }
      }
      v.phase += (v.waitT > 0 ? 1.5 : v.speed * 1.9) * dt;
      v.ch.group.position.set(v.x, PARK_Y, v.z);
      v.ch.body.rotation.y = v.yaw;
      animateRun(v.ch, v.phase, v.waitT <= 0, false);
    }
  }

  function updateParkPlayer(dt, now) {
    var moveLen = Math.sqrt(moveVX * moveVX + moveVZ * moveVZ);
    if (moveLen > 0.3) {
      var ty = Math.atan2(moveVX, moveVZ), dy = ty - yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      yaw += dy * Math.min(1, dt * 12);
    }
    playerGroup.position.set(px, py, pz);
    playerChar.body.rotation.y = yaw;
    playerChar.setMode(!grounded ? 'air' : (moveLen > 0.3 ? 'run' : 'idle'));
    playerChar.update(dt, moveLen);
    playerChar.body.visible = true;
    updateAura(dt, now);
    if (Input.consumeAttack && Input.consumeAttack()) { attackAnimT = 0.28; if (GameAudio.attack) GameAudio.attack(); }
    if (attackAnimT > 0 && playerChar.ch) {
      var asw = Math.sin((0.28 - attackAnimT) / 0.28 * Math.PI);
      playerChar.ch.armR.rotation.x = -1.9 * asw;
    }
    var shadow = playerGroup.getObjectByName('shadow');
    if (shadow) { shadow.visible = true; shadow.position.y = PARK_Y - py + 0.02; }
    if (petObj) {
      var ptx = px - Math.sin(yaw) * 0.7 - Math.cos(yaw) * 0.65;
      var ptz = pz - Math.cos(yaw) * 0.7 + Math.sin(yaw) * 0.65;
      var pty = Math.max(py, PARK_Y) + 0.85 + Math.sin(now * 0.004) * 0.1;
      var pgp = petObj.group;
      pgp.position.x += (ptx - pgp.position.x) * Math.min(1, dt * 5);
      pgp.position.y += (pty - pgp.position.y) * Math.min(1, dt * 5);
      pgp.position.z += (ptz - pgp.position.z) * Math.min(1, dt * 5);
    }
    // орбитальная камера
    var look = Input.consumeLook();
    camYaw -= look.dx * 0.0052;
    camPitch = Math.max(0.06, Math.min(1.25, camPitch + look.dy * 0.0042));
    camDist = Math.max(4, Math.min(16, camDist + Input.consumeZoom() * 0.008));
    followX += (px - followX) * Math.min(1, dt * 10);
    followY += (py - followY) * Math.min(1, dt * 10);
    followZ += (pz - followZ) * Math.min(1, dt * 10);
    var lookY = followY + 1.5, cp = Math.cos(camPitch), spi = Math.sin(camPitch);
    camera.position.set(followX - Math.sin(camYaw) * cp * camDist, Math.max(0.45, lookY + spi * camDist), followZ - Math.cos(camYaw) * cp * camDist);
    camera.lookAt(followX, lookY, followZ);
    if (skyMesh) skyMesh.position.set(px, 0, pz);
    if (sunLight) { sunLight.position.set(px + 9, PARK_Y + 16, pz + 6); if (sunLight.target) sunLight.target.position.set(px, PARK_Y, pz); }
  }

  function updatePark(dt, now) {
    if (attackCd > 0) attackCd -= dt;
    if (attackAnimT > 0) attackAnimT -= dt;

    var mv = Input.getMove();
    var syaw = Math.sin(camYaw), cyaw = Math.cos(camYaw);
    var sp = moveSpeed();
    moveVX = (-mv.x * cyaw + mv.z * syaw) * sp;
    moveVZ = (mv.x * syaw + mv.z * cyaw) * sp;
    px += moveVX * dt; pz += moveVZ * dt;

    var cxp = px, czp = pz - (PARK_Z0 + 22), rr = Math.sqrt(cxp * cxp + czp * czp);
    if (rr > 24) { px = cxp / rr * 24; pz = (PARK_Z0 + 22) + czp / rr * 24; }

    vy -= GRAVITY * dt; py += vy * dt;
    if (py <= PARK_Y) { py = PARK_Y; vy = 0; grounded = true; coyoteT = 0.1; }
    else { grounded = false; coyoteT -= dt; }
    if (Input.consumeJump() && (grounded || coyoteT > 0)) { vy = jumpV(); grounded = false; GameAudio.jump(); }

    resolveParkColliders();

    var edx = px, edz = pz - (PARK_Z0 + 1.5);
    if (edx * edx + edz * edz < 2.6 * 2.6) { leavePark(); return; }

    updateParkBuild();
    updateVisitors(dt);
    for (var i = 0; i < park.plots.length; i++) {
      var pl = park.plots[i];
      if (pl.rotor) { if (pl.axis === 'z') pl.rotor.rotation.z += dt * 0.35; else pl.rotor.rotation.y += dt * 0.5; }
      if (pl.model) {
        var details = pl.model.userData;
        if (details.flag) details.flag.rotation.x = Math.sin(now * 0.0025 + i) * 0.16;
        for (var bp = 0; bp < details.bobbing.length; bp++) {
          var bob = details.bobbing[bp]; bob.obj.position.y = bob.y + Math.sin(now * 0.002 + bob.phase) * 0.12;
        }
        for (var ci = 0; ci < details.cabins.length; ci++) details.cabins[ci].rotation.z = -pl.rotor.rotation.z;
        for (var spin = 0; spin < details.spinners.length; spin++) details.spinners[spin].rotation.y += dt * (spin % 2 ? -0.55 : 0.7);
        for (var stream = 0; stream < details.fountain.length; stream++) { var drop = details.fountain[stream]; drop.obj.position.y = 1.92 - ((now * 0.00065 + drop.phase) % 1) * 1.2; }
        if (details.coasterCars) {
          pl.rotor.rotation.y = 0;
          for (var train = 0; train < details.coasterCars.length; train++) {
            var ca = now * 0.00065 - train * 0.42, car = details.coasterCars[train];
            car.position.set(Math.cos(ca) * 2, 1.63 + Math.sin(ca * 2) * 0.43, Math.sin(ca) * 1.8);
            car.rotation.y = Math.atan2(-Math.sin(ca) * 2, Math.cos(ca) * 1.8);
            car.rotation.x = -Math.atan2(Math.cos(ca * 2) * 0.86, Math.sqrt(4 * Math.sin(ca) * Math.sin(ca) + 3.24 * Math.cos(ca) * Math.cos(ca)));
          }
        }
      }
    }
    // подсветка следующего доступного плота
    var np = park.plots[parkBuilt];
    if (np && np.rim) { var ps = 1 + Math.sin(now * 0.0035) * 0.022; np.rim.scale.set(ps, ps, 1); }
    updateParkPlayer(dt, now);
  }

  function enterPark() {
    if (typeof CharacterEffects !== 'undefined') CharacterEffects.clear();
    mode = 'park';
    buildParkIfNeeded();
    park.group.visible = true;
    ensureVisitors();
    px = 0; py = PARK_Y; pz = PARK_Z0 + 9; vy = 0; grounded = true; yaw = 0;
    followX = 0; followY = PARK_Y; followZ = PARK_Z0 + 9; camYaw = 0; camDist = 7;
    invulnT = 0; attackAnimT = 0; buildQueued = false; nearPlot = -2;
    if (petObj) petObj.group.position.set(px - 1, PARK_Y + 0.85, pz - 1);
    Input.reset();
    state = 'play';
    markSave();
    if (api.onModeChange) api.onModeChange('park');
    if (api.onParkStats) api.onParkStats(parkBuilt, parkPopularity);
    if (api.onParkPrompt) api.onParkPrompt(null);
  }

  function leavePark() {
    mode = 'obby';
    if (park) park.group.visible = false;
    if (api.onParkPrompt) api.onParkPrompt(null);
    buildWorld();
    yaw = 0; invulnT = 0; state = 'play';
    Input.reset();
    if (api.onModeChange) api.onModeChange('obby');
  }

  function addParkGate() {
    var g = new THREE.Group();
    var mint = toyMaterial(0x83c6b5), cream = decorShared.white, cocoa = toyMaterial(0x715246);
    for (var s = -1; s <= 1; s += 2) {
      var pil = sweetBox(0.28, 2.8, 0.34, mint, 0.055); pil.position.set(s * 1.5, KEY_H + 1.4, 0); g.add(pil);
      var foot = sweetBox(0.54, 0.18, 0.58, cream, 0.05); foot.position.set(s * 1.5, KEY_H + 0.09, 0); g.add(foot);
      for (var b = 0; b < 3; b++) {
        var band = sweetBox(0.31, 0.14, 0.37, cream, 0.025); band.position.set(s * 1.5, KEY_H + 0.65 + b * 0.75, 0); g.add(band);
      }
    }
    var arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.15, 6, 22, Math.PI), mint);
    arch.position.y = KEY_H + 2.8; g.add(arch);
    var inner = new THREE.Mesh(new THREE.TorusGeometry(1.31, 0.055, 5, 22, Math.PI), cream);
    inner.position.y = KEY_H + 2.8; g.add(inner);
    var sign = sweetBox(2.45, 0.58, 0.22, cocoa, 0.06); sign.position.set(0, KEY_H + 3.12, 0); g.add(sign);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeEmojiTexture('🎡'), transparent: true })); spr.scale.set(0.86, 0.86, 1); spr.position.set(0, KEY_H + 4.12, -0.18); g.add(spr);
    var nm = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeNameTexture(I18N.t('parkGate')), transparent: true, depthWrite: false })); nm.scale.set(2.15, 0.48, 1); nm.position.set(0, KEY_H + 3.12, -0.19); g.add(nm);
    g.position.set(hubParkGate.x, 0, hubParkGate.z);
    castShadows(g);
    scene.add(g);
    decorations.push(g);
  }

  function updateCharacterEffects(dt) {
    if (typeof CharacterEffects === 'undefined' || typeof Collections === 'undefined' || !playerChar) return;
    if (state !== 'play' || attackAnimT > 0) CharacterEffects.stopEmote();
    CharacterEffects.update({ dt: dt, scene: scene, player: playerGroup, rig: playerChar.ch,
      x: px, y: py, z: pz, grounded: grounded, trail: Collections.active('trails'), now: nowSec });
  }

  function frame(now) {
    frameId = 0;
    if (pauseCount > 0) return;
    frameId = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
    lastNow = now;
    nowSec += dt;
    now = nowSec * 1000;
    if (state === 'play') {
      if (boostT + shieldT + sprintT + jumpBoostT + powerT + parkBoostT > 0) markSave();
      var previousBoost = Math.ceil(boostT);
      boostT = Math.max(0, boostT - dt);
      if (Math.ceil(boostT) !== previousBoost && api.onBoostTick) api.onBoostTick(Math.ceil(boostT));
      shieldT = Math.max(0, shieldT - dt); sprintT = Math.max(0, sprintT - dt);
      jumpBoostT = Math.max(0, jumpBoostT - dt); powerT = Math.max(0, powerT - dt); parkBoostT = Math.max(0, parkBoostT - dt);
    }

    // Пассивный доход парка (идёт всегда, пока популярность > 0)
    if (parkPopularity > 0 && state !== 'dead') {
      parkIncomeAcc += parkPopularity * dt * PARK_INCOME_RATE * (parkBoostT > 0 ? 2 : 1);
      if (parkIncomeAcc >= 1) {
        var gained = Math.floor(parkIncomeAcc);
        parkIncomeAcc -= gained;
        addCoins(gained);
      }
    }

    // Shared autosave covers both the obby and the park, including reward timers.
    saveTimer -= dt;
    if (saveDirty && saveTimer <= 0) {
      saveDirty = false; saveTimer = 2;
      if (api.onSave) api.onSave(getSave());
    }
    if (mode === 'park') {
      if (state === 'play') updatePark(dt, now);
      updateCharacterEffects(dt);
      renderer.render(scene, camera);
      return;
    }

    if (state === 'play') updatePlay(dt);
    else updateDead(dt);

    // updatePlay мог переключить режим в парк (вход через портал) —
    // тогда обби-визуал не трогаем, иначе стены/пол «уедут» в парк
    if (mode === 'park') { renderer.render(scene, camera); return; }

    updateVisuals(dt, now);
    updateCharacterEffects(dt);
    renderer.render(scene, camera);
  }

  // Quotes refer to one exact candy purchase. No candy is credited temporarily:
  // successful reward videos grant only the quoted object, level or next plot.
  var purchaseQuote = null, purchaseQuoteSerial = 0;
  function purchaseState(kind, id) {
    id = String(id);
    if (kind === 'upgrade') {
      var st = Game.getVendorState(id);
      if (!st || st.kind !== 'upgrade' || st.price === null) return null;
      var names = { speed: 'vSpeed', jump: 'vJump', income: 'vIncome', hp: 'vHp', attack: 'vAttack' };
      return { kind: kind, id: id, price: st.price, revision: st.level,
        title: I18N.t(names[id]) + ' · уровень ' + (st.level + 1) };
    }
    if (kind === 'park') {
      var index = Number(id);
      if (mode !== 'park' || !park || !Number.isInteger(index) || index !== parkBuilt || index >= ATTRACTIONS.length) return null;
      var plot = park.plots[index];
      if (!plot || Math.hypot(px - plot.x, pz - plot.z) >= 4.2) return null;
      return { kind: kind, id: id, price: ATTRACTIONS[index].cost, revision: parkBuilt, title: I18N.t(ATTRACTIONS[index].key) };
    }
    if (['skins', 'pets', 'trails', 'emotes'].indexOf(kind) < 0) return null;
    var entries = Game.getCollection(kind), item = null;
    for (var i = 0; i < entries.length; i++) if (entries[i].id === id) { item = entries[i]; break; }
    if (!item || item.owned || item.unlockType !== 'candies' || !(item.price > 0)) return null;
    return { kind: kind, id: id, price: item.price, revision: 'unowned', title: item.name || I18N.t(item.nameKey) };
  }
  function grantUpgradeLevel(id) {
    if (id === 'speed') upSpeed++;
    else if (id === 'jump') upJump++;
    else if (id === 'income') upIncome++;
    else if (id === 'attack') upAtk++;
    else if (id === 'hp') {
      upHp++; hp = maxHpVal();
      if (api.onHpChange) api.onHpChange(hp, maxHpVal());
    }
    markSave();
  }

  /* ============ Публичный API ============ */

  return {
    get state() { return state; },
    get coins() { return coins; },
    get earned() { return earned; },
    get room() { return roomNum; },
    get boostLeft() { return Math.max(0, Math.ceil(boostT)); },
    get inHub() { return pz < HUB_LEN + 2; },
    get paused() { return pauseCount > 0; },

    set onCoinsChange(fn) { api.onCoinsChange = fn; },
    set onRoomEnter(fn) { api.onRoomEnter = fn; },
    set onRoomComplete(fn) { api.onRoomComplete = fn; },
    set onDeath(fn) { api.onDeath = fn; },
    set onVendorNear(fn) { api.onVendorNear = fn; },
    set onBoostTick(fn) { api.onBoostTick = fn; },
    set onSave(fn) { api.onSave = fn; },
    set onHpChange(fn) { api.onHpChange = fn; },
    set onArenaClear(fn) { api.onArenaClear = fn; },
    set onModeChange(fn) { api.onModeChange = fn; },
    set onParkStats(fn) { api.onParkStats = fn; },
    set onParkPrompt(fn) { api.onParkPrompt = fn; },
    set onParkBuild(fn) { api.onParkBuild = fn; },
    get hp() { return hp; },
    get maxHp() { return maxHpVal(); },
    get inPark() { return mode === 'park'; },
    get parkPopularity() { return parkPopularity; },
    get parkBuilt() { return parkBuilt; },
    requestParkBuild: function () { if (mode === 'park') buildQueued = true; },
    leavePark: function () { if (mode === 'park') leavePark(); },

    getPurchaseOffer: function (kind, id) {
      if (state !== 'play' || pauseReasons.platform || pauseReasons.ad) return null;
      var offer = purchaseState(kind, id);
      if (!offer || coins >= offer.price) return null;
      offer.token = ++purchaseQuoteSerial;
      purchaseQuote = Object.freeze(offer);
      return purchaseQuote;
    },
    cancelPurchaseOffer: function (quote) { if (purchaseQuote === quote) purchaseQuote = null; },
    fulfillPurchaseAd: function (quote) {
      if (!quote || purchaseQuote !== quote) return false;
      purchaseQuote = null; // consume before callbacks or any state mutation
      if (state !== 'play' || pauseReasons.platform || pauseReasons.ad) return false;
      var current = purchaseState(quote.kind, quote.id);
      if (!current || current.price !== quote.price || current.revision !== quote.revision) return false;
      if (quote.kind === 'upgrade') grantUpgradeLevel(quote.id);
      else if (quote.kind === 'park') return tryBuild(Number(quote.id), true);
      else if (quote.kind === 'skins') { ownedSkins[quote.id] = true; setSkin(quote.id); }
      else if (quote.kind === 'pets') { petsOwned[quote.id] = true; this.setPet(quote.id); }
      else if (!Collections.buy(quote.kind, quote.id, quote.price)) return false;
      markSave(); if (api.onSave) api.onSave(getSave());
      return true;
    },

    /* --- Скины (открываются за просмотр рекламы) --- */
    getDailyGifts: function () { return DailyGifts.status(); },
    claimDailyGift: function () {
      if (state !== 'play' || pauseReasons.platform || pauseReasons.ad) return null;
      var reward = DailyGifts.claim();
      if (!reward) return null;
      if (reward.type === 'skin') {
        ownedSkins[reward.skinId] = true;
        if (typeof CharacterEffects !== 'undefined') CharacterEffects.clear();
        setSkin(reward.skinId);
      } else addCoins(reward.amount);
      markSave();
      if (api.onSave) api.onSave(getSave());
      return reward;
    },
    getCollection: function (type) {
      if (type === 'skins') return this.getSkins();
      if (type === 'pets') return this.getPets ? this.getPets() : [];
      return Collections.list(type, coins);
    },
    buyCollection: function (type, id) {
      if (type === 'skins') return this.buySkin(id);
      if (type === 'pets') return this.buyPet(id);
      var purchase = Collections.buy(type, id, coins);
      if (!purchase) return false;
      coins -= purchase.price; markSave();
      if (api.onCoinsChange) api.onCoinsChange(coins);
      if (api.onSave) api.onSave(getSave());
      return true;
    },
    addCollectionAd: function (type, id) {
      if (type === 'skins') return this.addSkinAd(id);
      if (type === 'pets') return this.addPetAd(id);
      var result = Collections.addAd(type, id);
      if (result) { markSave(); if (api.onSave) api.onSave(getSave()); }
      return result;
    },
    equipCollection: function (type, id) {
      if (typeof CharacterEffects !== 'undefined') CharacterEffects.clear();
      if (type === 'skins') return this.equipSkin(id);
      if (type === 'pets') { if (id && !petsOwned[id]) return false; this.setPet(id); }
      else if (!Collections.equip(type, id)) return false;
      markSave(); if (api.onSave) api.onSave(getSave()); return true;
    },
    playEmote: function () {
      var id = Collections.active('emotes');
      if (!id || state !== 'play' || !grounded || typeof CharacterEffects === 'undefined') return false;
      CharacterEffects.playEmote(id); return true;
    },
    getSkins: function () {
      return SKINS.map(function (s) {
        return {
          id: s.id, nameKey: s.nameKey, aura: s.aura, preview: 'assets/skins/' + s.id + '.png',
          unlockType: AD_OUTFITS[s.id] ? 'ad' : s.id === 'default' ? 'free' : 'candies',
          adsNeed: AD_OUTFITS[s.id] || 0, adsDone: Math.min(AD_OUTFITS[s.id] || 0, skinAdProgress[s.id] | 0),
          price: AD_OUTFITS[s.id] ? null : s.ads * 250, afford: !AD_OUTFITS[s.id] && coins >= s.ads * 250,
          owned: !!ownedSkins[s.id], active: activeSkin === s.id
        };
      });
    },
    getDailySkin: function () {
      return { id: DAILY_SKIN.id, name: DAILY_SKIN.name, preview: 'assets/skins/' + DAILY_SKIN.id + '.png',
        owned: !!ownedSkins[DAILY_SKIN.id], active: activeSkin === DAILY_SKIN.id };
    },
    ownsSkin: function (id) { return !!ownedSkins[id]; },
    buySkin: function (id) {
      if (id === DAILY_SKIN.id) return false;
      var sk = skinById(id), price = sk.ads * 250;
      if (sk.id !== id || AD_OUTFITS[id] || ownedSkins[id] || coins < price) return false;
      coins -= price; ownedSkins[id] = true; setSkin(id);
      if (api.onCoinsChange) api.onCoinsChange(coins);
      if (api.onSave) api.onSave(getSave());
      return true;
    },
    // Засчитать один просмотренный ролик. Возвращает {done, need, unlocked}
    addSkinAd: function (id) {
      var sk = skinById(id);
      var need = AD_OUTFITS[id];
      if (sk.id !== id || !need || ownedSkins[id]) return null;
      var done = Math.min(need, (skinAdProgress[id] | 0) + 1);
      skinAdProgress[id] = done;
      var unlocked = done >= need;
      if (unlocked) { ownedSkins[id] = true; setSkin(id); }
      markSave();
      if (api.onSave) api.onSave(getSave());
      return { done: done, need: need, unlocked: unlocked };
    },
    equipSkin: function (id) { if (ownedSkins[id]) { setSkin(id); if (api.onSave) api.onSave(getSave()); return true; } return false; },
    get activeSkin() { return activeSkin; },

    preloadArt: function () {
      var fonts = document.fonts ? Promise.all([
        document.fonts.load('400 24px "Lilita One"'), document.fonts.load('800 16px "Rubik"')
      ]) : Promise.resolve();
      var atlas = iconAtlas ? Promise.resolve() : new Promise(function (resolve, reject) {
        var image = new Image();
        image.onload = function () { iconAtlas = image; resolve(); };
        image.onerror = function () { reject(new Error('Game icon atlas did not load')); };
        image.src = 'assets/ui/game-icons.png';
      });
      return Promise.all([fonts, atlas]);
    },

    init: function (canvas, save) {
      applySave(save);

      var mob = isMobileDevice();
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mob, powerPreference: 'high-performance' });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mob ? 1.6 : 2));
      renderer.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight), false);
      // На слабых/мобильных устройствах тени и часть эффектов отключаем ради плавности
      if (mob && Math.min(window.innerWidth, window.innerHeight) < 520) {
        SHADOWS = false;
        SPARKLE_COUNT = 20;
      }
      if (SHADOWS) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(62, Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight), 0.1, 90);
      camera.position.set(0, 4.7, -5);

      initDecorShared();
      buildEnvironment();
      buildFloor();
      buildPlayer();
      buildPools();
      buildVendorStands();
      buildWorld();
      buildBots();
      this.setPet(petActive);

      state = 'play';
      if (api.onCoinsChange) api.onCoinsChange(coins);
      this.resize();
      updateVisuals(0, nowSec * 1000);
      renderer.render(scene, camera);
      if (!pauseCount && !frameId) frameId = requestAnimationFrame(frame);
    },

    resize: function () {
      if (!renderer || pauseReasons.platform || pauseReasons.ad) return;
      // visualViewport точнее на мобильных (учитывает адресную строку/клавиатуру)
      var vv = window.visualViewport;
      var w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
      var h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileDevice() ? 1.6 : 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // на узких/портретных экранах расширяем поле зрения, чтобы было видно больше
      camera.fov = camera.aspect < 1 ? 74 : (camera.aspect < 1.5 ? 66 : 62);
      camera.updateProjectionMatrix();
      // Resizing clears the canvas even when gameplay is manually paused.
      // Repaint its static scene once; do not advance simulation or SDK pauses.
      if (pauseCount > 0 && scene) renderer.render(scene, camera);
    },

    /* --- Вендоры --- */

    getVendorState: function (id) {
      if (id === 'speed' || id === 'jump' || id === 'income' || id === 'hp' || id === 'attack') {
        var lvl = id === 'speed' ? upSpeed : id === 'jump' ? upJump : id === 'income' ? upIncome : id === 'hp' ? upHp : upAtk;
        var price = lvl >= UP_MAX ? null : upPrice(id, lvl);
        return { kind: 'upgrade', id: id, level: lvl, max: UP_MAX, price: price, afford: price !== null && coins >= price };
      }
      if (id === 'pets') {
        var list = [];
        for (var i = 0; i < PET_ORDER.length; i++) {
          var pid = PET_ORDER[i];
          var pet = PETS[pid];
          list.push({
            id: pid, name: pet.name, emoji: pet.emoji, nameKey: pet.nameKey, mult: pet.mult, price: pet.price,
            preview: 'assets/pets/' + pid + '.png', unlockType: pet.ads ? 'ad' : 'candies',
            adsNeed: pet.ads, adsDone: Math.min(pet.ads, petAdProgress[pid] | 0),
            owned: !!petsOwned[pid], equipped: petActive === pid, afford: !pet.ads && coins >= pet.price
          });
        }
        return { kind: 'pets', list: list };
      }
      if (id === 'gift') return { kind: 'gift', amount: giftAmount() };
      return null;
    },

    buyUpgrade: function (id) {
      var st = this.getVendorState(id);
      if (!st || st.kind !== 'upgrade' || st.price === null || coins < st.price) return false;
      coins -= st.price;
      grantUpgradeLevel(id);
      if (api.onCoinsChange) api.onCoinsChange(coins);
      markSave();
      return true;
    },

    getPets: function () {
      return PET_ORDER.map(function (pid) {
        var pet = PETS[pid];
        return { id: pid, name: pet.name, desc: pet.mult + '× candy income while equipped.', mult: pet.mult,
          preview: 'assets/pets/' + pid + '.png', unlockType: pet.ads ? 'ad' : 'candies', price: pet.price,
          adsNeed: pet.ads, adsDone: Math.min(pet.ads, petAdProgress[pid] | 0),
          owned: !!petsOwned[pid], active: petActive === pid, afford: !pet.ads && coins >= pet.price };
      });
    },

    // Called only by the host-confirmed rewarded-ad flow in main.js.
    addPetAd: function (pid) {
      var pet = PETS[pid];
      if (!pet || !pet.ads || petsOwned[pid]) return null;
      var done = Math.min(pet.ads, (petAdProgress[pid] | 0) + 1);
      petAdProgress[pid] = done;
      var unlocked = done >= pet.ads;
      if (unlocked) { petsOwned[pid] = true; this.setPet(pid); }
      markSave();
      return { done: done, need: pet.ads, unlocked: unlocked };
    },

    buyPet: function (pid) {
      var pet = PETS[pid];
      if (!pet || pet.ads || typeof pet.price !== 'number' || petsOwned[pid] || coins < pet.price) return false;
      coins -= pet.price;
      petsOwned[pid] = true;
      this.setPet(pid);
      if (api.onCoinsChange) api.onCoinsChange(coins);
      markSave();
      return true;
    },

    setPet: function (pid) {
      if (pid && (!PETS[pid] || !petsOwned[pid])) return false;
      petActive = pid || null;
      if (petObj) { releaseWorldProp(petObj.group); petObj = null; }
      if (petActive) {
        petObj = createPetModel(petActive);
        petObj.group.position.set(px - 1, (mode === 'park' ? PARK_Y : KEY_H) + 0.85, pz - 1);
        scene.add(petObj.group);
      }
      markSave();
      return true;
    },

    claimGift: function () {
      addCoins(giftAmount(), px, KEY_H + 1.4, pz);
    },

    getRewardOffers: function () {
      var timers = { boost: boostT, shield: shieldT, sprint: sprintT, jump: jumpBoostT, power: powerT, park: parkBoostT };
      return [
        { id: 'gift', icon: 'gift', title: 'Доставка конфет', desc: giftAmount() + ' конфет на улучшения, питомцев или наряды.', active: false },
        { id: 'boost', icon: 'candy', title: 'Двойные конфеты', desc: 'Вдвое больше конфет на 90 секунд.', active: boostT > 0 },
        { id: 'heal', icon: 'heart', title: 'Полное здоровье', desc: 'Мгновенно восстанавливает здоровье.', active: hp >= maxHpVal() },
        { id: 'shield', icon: 'heart', title: 'Конфетный щит', desc: 'Защита от ловушек и врагов на 60 секунд. Падения всё равно считаются.', active: shieldT > 0 },
        { id: 'sprint', icon: 'sprint', title: 'Ускорение', desc: 'Бег на 20% быстрее в течение 90 секунд.', active: sprintT > 0 },
        { id: 'jump', icon: 'jump', title: 'Пружинные кеды', desc: 'Прыжок на 12% сильнее в течение 60 секунд.', active: jumpBoostT > 0 },
        { id: 'power', icon: 'attack', title: 'Силовые перчатки', desc: 'Двойной урон в течение 90 секунд.', active: powerT > 0 },
        { id: 'park', icon: 'gift', title: 'Парковый ажиотаж', desc: 'Двойной доход парка на 120 секунд. Сначала построй аттракцион.', active: parkBoostT > 0 || parkPopularity <= 0 }
      ].map(function (offer) { offer.remaining = Math.ceil(timers[offer.id] || 0); return offer; });
    },
    applyReward: function (id) {
      if (id === 'gift') addCoins(giftAmount());
      else if (id === 'boost') { boostT = 90; if (api.onBoostTick) api.onBoostTick(90); }
      else if (id === 'heal') { hp = maxHpVal(); if (api.onHpChange) api.onHpChange(hp, maxHpVal()); }
      else if (id === 'shield') shieldT = 60;
      else if (id === 'sprint') sprintT = 90;
      else if (id === 'jump') jumpBoostT = 60;
      else if (id === 'power') powerT = 90;
      else if (id === 'park' && parkPopularity > 0) parkBoostT = 120;
      else return false;
      markSave(); return true;
    },
    activateBoost: function (seconds) {
      boostT = seconds; markSave();
      if (api.onBoostTick) api.onBoostTick(Math.ceil(boostT));
    },

    /* --- Смерть / возрождение --- */

    reviveOnSpot: function () {
      if (state !== 'dead') return;
      px = lastSafe.x; pz = lastSafe.z;
      py = KEY_H + 0.1; vy = 0;
      invulnT = 2.5;
      hp = maxHpVal();
      if (api.onHpChange) api.onHpChange(hp, maxHpVal());
      playerChar.body.rotation.x = 0;
      lastTileR = -999; lastTileL = -999;
      Input.reset();
      state = 'play';
      this.setPaused('death', false);
    },

    restartRoom: function () {
      if (state !== 'dead') return;
      px = respawn.x; pz = respawn.z;
      py = KEY_H + 0.1; vy = 0;
      invulnT = 1.5;
      hp = maxHpVal();
      if (api.onHpChange) api.onHpChange(hp, maxHpVal());
      playerChar.body.rotation.x = 0;
      lastTileR = -999; lastTileL = -999;
      lastSafe = { x: respawn.x, z: respawn.z };
      Input.reset();
      state = 'play';
      this.setPaused('death', false);
    },

    goHub: function () {
      buildWorld();
      playerChar.body.rotation.x = 0;
      yaw = 0;
      invulnT = 0;
      Input.reset();
      state = 'play';
      this.setPaused('death', false);
      if (api.onVendorNear && nearVendorId) { nearVendorId = null; api.onVendorNear(null); }
    },

    // Смерть: возврат в хаб + сброс счётчика комнат на 1 (прогресс апгрейдов/конфет сохраняется)
    deathToHub: function () {
      roomNum = 1;
      buildWorld();
      playerChar.body.rotation.x = 0;
      yaw = 0;
      invulnT = 0;
      Input.reset();
      state = 'play';
      this.setPaused('death', false);
      markSave();
      if (api.onSave) api.onSave(getSave());
      if (api.onVendorNear && nearVendorId) { nearVendorId = null; api.onVendorNear(null); }
    },

    getSave: getSave,

    /* --- Дебаг: список комнат и телепорт (только локально) --- */
    getTemplates: function () {
      return TEMPLATES.map(function (t) { return { nameKey: t.nameKey, emoji: t.emoji }; });
    },
    debugRoom: function (ti) { if (ti >= 0 && ti < TEMPLATES.length) debugRoom(ti); },

    /* --- Пауза: 'user' | 'blur' | 'ad' --- */
    setPaused: function (reason, on) {
      var was = !!pauseReasons[reason];
      if (on && !was) { pauseReasons[reason] = true; pauseCount++; }
      else if (!on && was) { delete pauseReasons[reason]; pauseCount--; }
      if (pauseCount > 0) {
        GameAudio.suspend();
        Input.reset();
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
      } else {
        lastNow = performance.now();
        GameAudio.resume();
        if (renderer && !frameId) frameId = requestAnimationFrame(frame);
      }
    },
    isPausedBy: function (reason) { return !!pauseReasons[reason]; }
  };
})();
