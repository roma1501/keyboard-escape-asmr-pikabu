/* Permanent trail and emote collections. Ad progress is granted only by main's
   completed-reward callback; this module never requests ads or stores data. */
'use strict';
var Collections = (function () {
  var catalogs = {
    trails: [
      { id: 'mint', name: 'Мятный поток', desc: 'Мягкие мятные жемчужины и кольца на каждом шагу.', price: 150 },
      { id: 'peach', name: 'Персиковая лента', desc: 'Тёплые коралловые искры с атласным блеском.', price: 300 },
      { id: 'cocoa', name: 'Шоколадная крошка', desc: 'За тобой сыплются кусочки шоколада.', price: 600 },
      { id: 'bubbles', name: 'Газировка', desc: 'Пастельные пузырьки поднимаются и лопаются.', price: 900 },
      { id: 'frost', name: 'Ледяные осколки', desc: 'Прохладный след из сверкающих льдинок.', ads: 1 },
      { id: 'rainbow', name: 'Радужный рывок', desc: 'Цветная лента для лучших забегов.', ads: 2 },
      { id: 'stardust', name: 'Звёздная пыль', desc: 'Созвездие крошечных золотых звёзд.', ads: 3 },
      { id: 'hearts', name: 'Конфетти из сердец', desc: 'Немного любви на клавиатуре.', ads: 5 }
    ],
    emotes: [
      { id: 'wave', name: 'Привет, друг!', desc: 'Радостно помахать рукой. Клавиша B или кнопка эмоции.', price: 150 },
      { id: 'cheer', name: 'Ура!', desc: 'Празднуй, подняв обе руки.', price: 300 },
      { id: 'shuffle', name: 'Конфетный танец', desc: 'Задорный танец на месте.', price: 500 },
      { id: 'spin', name: 'Сладкий оборот', desc: 'Игривый поворот и финальная поза.', ads: 2 },
      { id: 'robot', name: 'Игрушечный робот', desc: 'Механический танец с чёткими движениями рук.', ads: 3 },
      { id: 'victory', name: 'Поза победителя', desc: 'Прими торжественную позу чемпиона.', ads: 5 }
    ]
  };
  var owned = {}, progress = {}, equipped = {};
  function item(type, id) { return (catalogs[type] || []).filter(function (entry) { return entry.id === id; })[0]; }
  function load(save) {
    save = save || {}; owned = {}; progress = {}; equipped = {};
    Object.keys(catalogs).forEach(function (type) {
      owned[type] = {}; progress[type] = {};
      catalogs[type].forEach(function (entry) {
        owned[type][entry.id] = !!(save.owned && Array.isArray(save.owned[type]) && save.owned[type].indexOf(entry.id) >= 0);
        var count = save.ads && save.ads[type] ? save.ads[type][entry.id] : 0;
        progress[type][entry.id] = Math.max(0, Math.min(entry.ads || 0, Number(count) | 0));
        if (entry.ads && progress[type][entry.id] >= entry.ads) owned[type][entry.id] = true;
      });
      var active = save.active && save.active[type]; equipped[type] = active && owned[type][active] ? active : null;
    });
  }
  load(null);
  return {
    load: load,
    save: function () {
      var result = { v: 1, owned: {}, ads: {}, active: {} };
      Object.keys(catalogs).forEach(function (type) {
        result.owned[type] = Object.keys(owned[type]).filter(function (id) { return owned[type][id]; });
        result.ads[type] = Object.assign({}, progress[type]); result.active[type] = equipped[type];
      }); return result;
    },
    list: function (type, coins) {
      return (catalogs[type] || []).map(function (entry) {
        return { id: entry.id, name: entry.name, desc: entry.desc, preview: 'assets/' + type + '/' + entry.id + '.png',
          unlockType: entry.ads ? 'ad' : 'candies', price: entry.ads ? null : entry.price,
          adsNeed: entry.ads || 0, adsDone: progress[type][entry.id] || 0,
          owned: !!owned[type][entry.id], active: equipped[type] === entry.id, afford: !entry.ads && coins >= entry.price };
      });
    },
    active: function (type) { return equipped[type] || null; },
    buy: function (type, id, coins) {
      var entry = item(type, id);
      if (!entry || entry.ads || owned[type][id] || coins < entry.price) return null;
      owned[type][id] = true; equipped[type] = id; return { price: entry.price };
    },
    addAd: function (type, id) {
      var entry = item(type, id);
      if (!entry || !entry.ads || owned[type][id]) return null;
      var done = progress[type][id] = Math.min(entry.ads, progress[type][id] + 1);
      var unlocked = done >= entry.ads;
      if (unlocked) { owned[type][id] = true; equipped[type] = id; }
      return { done: done, need: entry.ads, unlocked: unlocked };
    },
    equip: function (type, id) {
      if (!catalogs[type] || (id !== null && !owned[type][id])) return false;
      equipped[type] = id; return true;
    }
  };
})();
