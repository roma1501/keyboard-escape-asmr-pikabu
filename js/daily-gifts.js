/* Seven permanent daily gifts. The host applies each returned reward and saves
   this state together with the game economy; this module performs no I/O. */
'use strict';
var DailyGifts = (function () {
  var DAY = 86400000, MAX_TIME = 8640000000000000;
  var rewards = [
    { day: 1, type: 'candies', amount: 100 },
    { day: 2, type: 'candies', amount: 200 },
    { day: 3, type: 'candies', amount: 300 },
    { day: 4, type: 'candies', amount: 450 },
    { day: 5, type: 'candies', amount: 650 },
    { day: 6, type: 'candies', amount: 900 },
    { day: 7, type: 'skin', skinId: 'skin_daily_crown', name: 'Владыка рассвета' }
  ];
  var claimed = 0, lastClaimDay = -1;
  function copy(reward) { return Object.assign({}, reward); }
  function utcDay(now) {
    if (now === undefined) now = Date.now();
    return typeof now === 'number' && Number.isFinite(now) && now >= 0 && now < MAX_TIME ? Math.floor(now / DAY) : null;
  }
  function load(data) {
    if (data === null || data === undefined) { claimed = 0; lastClaimDay = -1; return; }
    var record = typeof data === 'object' && !Array.isArray(data) ? data : {};
    var count = record.claimed;
    claimed = typeof count === 'number' && !Number.isNaN(count) ? Math.max(0, Math.min(7, Math.floor(count))) : 0;
    var date = record.lastClaimDay;
    var validDate = Number.isInteger(date) && date >= 0 && date < MAX_TIME / DAY;
    var pristine = record.v === 1 && count === 0 && date === -1;
    // Missing legacy data starts fresh. A malformed existing record waits until
    // tomorrow instead of immediately issuing a possible duplicate gift.
    var impossible = claimed > 0 && (!validDate || date < claimed - 1);
    if (pristine) lastClaimDay = -1;
    else if (record.v === 1 && validDate && !impossible) lastClaimDay = date;
    else lastClaimDay = utcDay();
  }
  function status(now) {
    var day = utcDay(now), completed = claimed === rewards.length;
    var available = !completed && day !== null && day > lastClaimDay;
    return { claimed: claimed, available: available, completed: completed,
      nextAt: completed || available || day === null ? null : (lastClaimDay + 1) * DAY,
      rewards: rewards.map(copy) };
  }
  return {
    load: load,
    save: function () { return { v: 1, claimed: claimed, lastClaimDay: lastClaimDay }; },
    status: status,
    claim: function (now) {
      var day = utcDay(now);
      if (claimed >= rewards.length || day === null || day <= lastClaimDay) return null;
      var reward = rewards[claimed];
      // Advance before returning so repeated clicks cannot grant the same gift.
      claimed++; lastClaimDay = day;
      return copy(reward);
    }
  };
})();
