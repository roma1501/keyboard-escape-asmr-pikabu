/* ===== Управление в стиле Roblox =====
 * ПК: WASD/стрелки — движение, Пробел — прыжок, зажать мышь — вращение камеры, колесо — зум.
 * Мобильные: джойстик — движение, свайп по экрану — камера, кнопка — прыжок.
 */
'use strict';

var Input = (function () {
  var keys = { up: false, down: false, left: false, right: false };
  var jumpQueuedAt = -1;
  var joyVec = { x: 0, z: 0 };
  var joyPointer = null;
  var joyBaseX = 0, joyBaseY = 0;
  var JOY_RADIUS = 60;

  // Вращение камеры (накопленные дельты за кадр)
  var lookPointer = null;
  var lookLastX = 0, lookLastY = 0;
  var lookDX = 0, lookDY = 0;
  var zoomDelta = 0;

  var onPauseKey = null;
  var onInteractKey = null;
  var attackQueued = false;
  var initialized = false;

  var joyZone, joyBase, joyKnob, jumpBtn, attackBtn, lookTarget;

  function keyHandler(e, down) {
    var target = e.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (typeof Platform !== 'undefined' && Platform.platformPaused) return;
    var code = e.code || ({ ' ': 'Space', 'w': 'KeyW', 'a': 'KeyA', 's': 'KeyS', 'd': 'KeyD', 'e': 'KeyE', 'f': 'KeyF', 'p': 'KeyP', 'j': 'KeyJ' })[String(e.key).toLowerCase()] || e.key;
    if (code === 'Escape' || code === 'KeyP') {
      if (down && !e.repeat && onPauseKey) onPauseKey();
      return; // Escape must remain available to the host page.
    }
    if (typeof Game !== 'undefined' && (Game.paused || Game.state !== 'play')) return;
    switch (code) {
      case 'ArrowUp': case 'KeyW': keys.up = down; e.preventDefault(); break;
      case 'ArrowDown': case 'KeyS': keys.down = down; e.preventDefault(); break;
      case 'ArrowLeft': case 'KeyA': keys.left = down; e.preventDefault(); break;
      case 'ArrowRight': case 'KeyD': keys.right = down; e.preventDefault(); break;
      case 'Space':
        if (down) jumpQueuedAt = performance.now();
        e.preventDefault();
        break;
      case 'KeyE':
        if (down && !e.repeat && onInteractKey) onInteractKey();
        break;
      case 'KeyF': case 'KeyJ': case 'Enter':
        if (down && !e.repeat) attackQueued = true;
        break;
      case 'Escape': case 'KeyP':
        if (down && onPauseKey) onPauseKey();
        break;
    }
  }

  /* --- Виртуальный джойстик --- */

  function joyStart(e) {
    if (blocked()) return;
    if (e.button > 0) return;
    if (joyPointer !== null) return;
    joyPointer = e.pointerId;
    joyBaseX = e.clientX;
    joyBaseY = e.clientY;
    joyBase.style.left = joyBaseX + 'px';
    joyBase.style.top = joyBaseY + 'px';
    joyBase.classList.remove('hidden');
    moveKnob(0, 0);
    try { joyZone.setPointerCapture(e.pointerId); } catch (err) {}
    // Keep mouse compatibility events: extra buttons can fire while left is held.
    if (e.pointerType !== 'mouse') e.preventDefault();
  }

  function joyMove(e) {
    if (e.pointerId !== joyPointer) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { joyEnd(e); return; }
    var dx = e.clientX - joyBaseX;
    var dy = e.clientY - joyBaseY;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > JOY_RADIUS) { dx = dx / len * JOY_RADIUS; dy = dy / len * JOY_RADIUS; }
    moveKnob(dx, dy);
    joyVec.x = dx / JOY_RADIUS;
    joyVec.z = -dy / JOY_RADIUS;
    e.preventDefault();
  }

  function joyEnd(e) {
    if (e.pointerId !== joyPointer) return;
    joyPointer = null;
    joyVec.x = 0; joyVec.z = 0;
    joyBase.classList.add('hidden');
  }

  function moveKnob(dx, dy) {
    joyKnob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
  }

  /* --- Вращение камеры (мышь / свайп по канвасу) --- */

  function lookStart(e) {
    if (blocked()) return;
    if (e.button > 0) return;
    focus();
    if (lookPointer !== null) return;
    lookPointer = e.pointerId;
    lookLastX = e.clientX;
    lookLastY = e.clientY;
    try { lookTarget.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.pointerType !== 'mouse') e.preventDefault();
  }

  function lookMove(e) {
    if (e.pointerId !== lookPointer) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { lookEnd(e); return; }
    lookDX += e.clientX - lookLastX;
    lookDY += e.clientY - lookLastY;
    lookLastX = e.clientX;
    lookLastY = e.clientY;
    e.preventDefault();
  }

  function lookEnd(e) {
    if (e.pointerId !== lookPointer) return;
    lookPointer = null;
  }

  function mouseAction(e) {
    if (blocked() || (e.button !== 1 && e.button !== 2)) return;
    var inPad = e.target === joyZone || (joyZone.contains && joyZone.contains(e.target));
    if (!inPad && e.target !== lookTarget && joyPointer === null && lookPointer === null) return;
    if (e.button === 2) jumpQueuedAt = performance.now();
    else attackQueued = true;
    e.preventDefault(); // No middle-button auto-scroll; context menu is disabled by main.
  }

  function init(opts) {
    if (initialized) return;
    initialized = true;
    // Capture on the document so stale button focus cannot swallow movement after reload.
    document.addEventListener('keydown', function (e) { keyHandler(e, true); }, true);
    document.addEventListener('keyup', function (e) { keyHandler(e, false); }, true);
    // mousedown fires for additional mouse buttons even during an active pointer drag.
    document.addEventListener('mousedown', mouseAction, true);

    joyZone = opts.joyZone;
    joyBase = opts.joyBase;
    joyKnob = opts.joyKnob;
    jumpBtn = opts.jumpBtn;
    attackBtn = opts.attackBtn;
    lookTarget = opts.lookTarget;
    lookTarget.setAttribute('tabindex', '0');

    joyZone.addEventListener('pointerdown', joyStart);
    joyZone.addEventListener('pointermove', joyMove);
    joyZone.addEventListener('pointerup', joyEnd);
    joyZone.addEventListener('pointercancel', joyEnd);
    joyZone.addEventListener('lostpointercapture', joyEnd);

    jumpBtn.addEventListener('pointerdown', function (e) {
      if (blocked()) return;
      jumpQueuedAt = performance.now();
      e.preventDefault();
    });

    if (attackBtn) {
      attackBtn.addEventListener('pointerdown', function (e) {
        if (blocked()) return;
        attackQueued = true;
        e.preventDefault();
      });
    }

    lookTarget.addEventListener('pointerdown', lookStart);
    lookTarget.addEventListener('pointermove', lookMove);
    lookTarget.addEventListener('pointerup', lookEnd);
    lookTarget.addEventListener('pointercancel', lookEnd);
    lookTarget.addEventListener('lostpointercapture', lookEnd);

    window.addEventListener('wheel', function (e) {
      if (blocked() || e.target !== lookTarget) return;
      zoomDelta += e.deltaY;
    }, { passive: true });
  }

  function blocked() {
    return (typeof Platform !== 'undefined' && Platform.platformPaused) ||
      (typeof Game !== 'undefined' && (Game.paused || Game.state !== 'play'));
  }
  function focus() {
    if (!lookTarget || (typeof Platform !== 'undefined' && Platform.platformPaused)) return;
    try { lookTarget.focus({ preventScroll: true }); } catch (error) { lookTarget.focus(); }
  }

  return {
    init: init,
    focus: focus,
    set onPauseKey(fn) { onPauseKey = fn; },
    set onInteractKey(fn) { onInteractKey = fn; },

    // Вектор движения {x, z} в осях экрана/джойстика, длина <= 1
    getMove: function () {
      var x = joyVec.x + (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      var z = joyVec.z + (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      var len = Math.sqrt(x * x + z * z);
      if (len > 1) { x /= len; z /= len; }
      return { x: x, z: z };
    },

    // Дельта вращения камеры (пиксели) с прошлого кадра
    consumeLook: function () {
      var d = { dx: lookDX, dy: lookDY };
      lookDX = 0; lookDY = 0;
      return d;
    },

    // Дельта зума (колесо мыши)
    consumeZoom: function () {
      var z = zoomDelta;
      zoomDelta = 0;
      return z;
    },

    // Прыжок с буфером 150 мс
    consumeJump: function () {
      if (jumpQueuedAt < 0) return false;
      var ok = performance.now() - jumpQueuedAt < 150;
      jumpQueuedAt = -1;
      return ok;
    },

    // Атака (F / J / Enter / кнопка)
    consumeAttack: function () {
      var a = attackQueued;
      attackQueued = false;
      return a;
    },

    reset: function () {
      keys.up = keys.down = keys.left = keys.right = false;
      joyVec.x = 0; joyVec.z = 0;
      jumpQueuedAt = -1;
      attackQueued = false;
      joyPointer = null;
      lookPointer = null;
      lookDX = 0; lookDY = 0;
      zoomDelta = 0;
      if (joyBase) joyBase.classList.add('hidden');
    }
  };
})();
