/* Original toy trails and emotes. A fixed mesh pool is reused throughout a run;
   the host calls update after the character's ordinary animation. */
var CharacterEffects = (function () {
  'use strict';
  var CAPACITY = 72, pool = [], geometries = null, host = null, cursor = 0;
  var tracking = false, lastX = 0, lastY = 0, lastZ = 0, carry = 0, serial = 0;
  var lastRig = null, lastBaseYaw = 0, emote = null, seed = 943087;
  var durations = { wave: 2.5, cheer: 2.6, shuffle: 3, spin: 2.5, robot: 2.8, victory: 2.7 };
  var styles = {
    mint:     { colors: [0x69dfba, 0xcaffdf, 0x39bca2], size: .17, life: 1.05, density: 5.0, rise: .17 },
    peach:    { colors: [0xffb178, 0xffd5a4, 0xf7939e], size: .18, life: 1.10, density: 4.8, rise: .22 },
    cocoa:    { colors: [0x75432e, 0xbd8550, 0x442c2b], size: .17, life: .95, density: 5.0, rise: .15 },
    bubbles:  { colors: [0xafe8ff, 0xf2cbef, 0xb7f3dc], size: .21, life: 1.35, density: 4.0, rise: .55 },
    rainbow:  { colors: [0xff819c, 0xffbe76, 0xffe79a, 0x91e4bf, 0x8bc9f5, 0xb8a1ec], size: .22, life: 1.10, density: 7.0, rise: .04 },
    stardust: { colors: [0xffdd83, 0xfff6ce, 0xb9a1ef], size: .19, life: 1.25, density: 4.8, rise: .37 },
    frost:    { colors: [0xa8e7ff, 0xeffcff, 0x7dc8ed], size: .19, life: 1.10, density: 4.7, rise: .28 },
    hearts:   { colors: [0xff7f9f, 0xffb9c8, 0xeaa1ce], size: .21, life: 1.35, density: 4.3, rise: .43 }
  };
  function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function starGeometry(points, inner) {
    var shape = new THREE.Shape();
    for (var i = 0; i < points * 2; i++) {
      var a = Math.PI / 2 + i / (points * 2) * Math.PI * 2, r = i % 2 ? inner : 1;
      if (!i) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    var geo = new THREE.ExtrudeGeometry(shape, { depth: .18, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .08, bevelThickness: .05 });
    geo.center(); return geo;
  }
  function heartGeometry() {
    var s = new THREE.Shape(); s.moveTo(0, -.86);
    s.bezierCurveTo(-.26, -.58, -1.02, -.05, -.98, .42);
    s.bezierCurveTo(-.94, 1.0, -.27, 1.15, 0, .61);
    s.bezierCurveTo(.27, 1.15, .94, 1.0, .98, .42);
    s.bezierCurveTo(1.02, -.05, .26, -.58, 0, -.86);
    var geo = new THREE.ExtrudeGeometry(s, { depth: .2, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .08, bevelThickness: .07, curveSegments: 6 });
    geo.center(); return geo;
  }
  function ensurePool(scene) {
    if (!geometries) {
      geometries = { pearl: new THREE.SphereGeometry(1, 10, 7), ring: new THREE.TorusGeometry(.75, .22, 5, 12),
        chunk: new THREE.BoxGeometry(1.35, 1.15, 1.35), star: starGeometry(5, .44),
        snow: starGeometry(6, .23), crystal: new THREE.OctahedronGeometry(1, 0), heart: heartGeometry() };
      for (var i = 0; i < CAPACITY; i++) {
        var mat = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 65,
          transparent: true, opacity: 0, depthWrite: false });
        var mesh = new THREE.Mesh(geometries.pearl, mat); mesh.name = 'character-trail-particle'; mesh.visible = false; mesh.renderOrder = 2;
        var glint = new THREE.Mesh(geometries.pearl, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .65, depthWrite: false }));
        glint.position.set(-.36, .42, .7); glint.scale.set(.2, .12, .09); glint.visible = false; mesh.add(glint);
        pool.push({ mesh: mesh, glint: glint, age: 0, life: 1, size: 0, vx: 0, vy: 0, vz: 0, spin: 0, style: '', phase: 0 });
      }
    }
    if (host !== scene) {
      for (var n = 0; n < pool.length; n++) { if (pool[n].mesh.parent) pool[n].mesh.parent.remove(pool[n].mesh); scene.add(pool[n].mesh); }
      host = scene; clearParticles(); tracking = false;
    }
  }
  function clearParticles() {
    for (var i = 0; i < pool.length; i++) pool[i].mesh.visible = false;
    carry = 0; cursor = 0;
  }
  function restorePose() {
    if (!lastRig) return;
    var r = lastRig;
    r.armL.rotation.set(0, 0, 0); r.armR.rotation.set(0, 0, 0);
    r.legL.rotation.set(0, 0, 0); r.legR.rotation.set(0, 0, 0);
    r.body.rotation.set(0, lastBaseYaw, 0); r.body.position.set(0, 0, 0);
  }
  function stopEmote() { if (emote) restorePose(); emote = null; }
  function clear() { clearParticles(); stopEmote(); tracking = false; }
  function playEmote(id) {
    if (!durations[id]) return false;
    stopEmote(); emote = { id: id, time: 0, duration: durations[id] }; return true;
  }
  function animateEmote(rig, dt) {
    if (!emote || !rig) return;
    lastBaseYaw = rig.body.rotation.y;
    emote.time += dt;
    if (emote.time >= emote.duration) { stopEmote(); return; }
    var t = emote.time, w = ease(t / .22) * ease((emote.duration - t) / .32);
    var axL = 0, axR = 0, azL = -.06, azR = .06, lxL = 0, lxR = 0, lzL = 0, lzR = 0;
    var bx = 0, by = 0, bz = 0, rx = 0, rz = 0, turn = 0;
    switch (emote.id) {
      case 'wave':
        azR = 2.35 + Math.sin(t * 13) * .24; axR = -.35; azL = -.18;
        rz = -.075; by = Math.sin(t * 4) * .018; break;
      case 'cheer':
        azL = -2.5 - Math.sin(t * 9) * .16; azR = 2.5 + Math.sin(t * 9) * .16;
        axL = axR = -.18; by = Math.abs(Math.sin(t * 7)) * .15;
        lxL = Math.sin(t * 7) * .18; lxR = -lxL; lzL = -.11; lzR = .11; break;
      case 'shuffle':
        var step = Math.sin(t * 11); bx = step * .15; by = Math.abs(Math.cos(t * 11)) * .065;
        lxL = step * .62; lxR = -step * .62; axL = -step * .72; axR = step * .72;
        azL = -.32; azR = .32; turn = Math.sin(t * 5.5) * .19; rz = -step * .045; break;
      case 'spin':
        turn = Math.PI * 2 * ease(t / 1.95); azL = -1.14; azR = 1.14;
        axL = .12; axR = -.12; by = Math.sin(Math.min(1, t / 1.95) * Math.PI) * .16;
        lxL = .15; lxR = -.15; break;
      case 'robot':
        var beat = Math.floor(t * 6) % 4, pulse = beat < 2 ? 1 : -1;
        axL = pulse * 1.05; axR = -pulse * 1.05; azL = -.8; azR = .8;
        lxL = beat % 2 ? .32 : -.32; lxR = -lxL; turn = pulse * .24; rz = pulse * .055; by = .02; break;
      case 'victory':
        azR = 2.85; axR = -.2; azL = -.62; axL = -.62;
        by = Math.max(0, Math.sin((t - .15) * 5)) * .21; turn = Math.sin(t * 2.5) * .13;
        lxL = -.15; lxR = .22; rz = -.10; break;
    }
    rig.armL.rotation.set(axL * w, 0, azL * w); rig.armR.rotation.set(axR * w, 0, azR * w);
    rig.legL.rotation.set(lxL * w, 0, lzL * w); rig.legR.rotation.set(lxR * w, 0, lzR * w);
    rig.body.position.set(bx * w, by * w, bz * w);
    rig.body.rotation.x = rx * w; rig.body.rotation.z = rz * w;
    rig.body.rotation.y = lastBaseYaw + (emote.id === 'spin' ? turn : turn * w);
  }
  function spawn(id, style, x, y, z, dx, dz) {
    var p = pool[cursor]; cursor = (cursor + 1) % CAPACITY; serial++;
    var mesh = p.mesh, kind = serial % 3, side = serial % 2 ? -1 : 1;
    var jitter = (random() - .5) * .09;
    mesh.position.set(x + dz * side * .2 + jitter, y + .055 + random() * .08, z - dx * side * .2 + jitter);
    mesh.rotation.set(random() * .4, random() * Math.PI, random() * Math.PI);
    mesh.material.color.setHex(style.colors[serial % style.colors.length]);
    mesh.material.opacity = id === 'bubbles' ? .4 : .93;
    mesh.material.shininess = id === 'cocoa' ? 36 : 85;
    p.glint.visible = id === 'bubbles' || id === 'peach';
    p.age = 0; p.life = style.life * (.85 + random() * .3); p.size = style.size * (.76 + random() * .42);
    p.vx = (random() - .5) * .1; p.vz = (random() - .5) * .1; p.vy = style.rise;
    p.spin = (random() - .5) * 2.0; p.phase = random() * Math.PI * 2; p.style = id;
    mesh.geometry = geometries.pearl;
    if (id === 'mint') { mesh.geometry = kind === 0 ? geometries.ring : geometries.pearl; mesh.rotation.x = Math.PI / 2; }
    else if (id === 'cocoa') mesh.geometry = kind === 0 ? geometries.crystal : geometries.chunk;
    else if (id === 'stardust') mesh.geometry = kind === 0 ? geometries.crystal : geometries.star;
    else if (id === 'frost') mesh.geometry = kind === 0 ? geometries.crystal : geometries.snow;
    else if (id === 'hearts') { mesh.geometry = geometries.heart; mesh.rotation.set(-.15, Math.atan2(dx, dz), side * .22); }
    else if (id === 'rainbow') { mesh.position.set(x, y + .07, z); mesh.rotation.set(0, Math.atan2(dx, dz), 0); }
    if (id === 'rainbow') mesh.scale.set(p.size * 1.76, p.size * .166, p.size * .756);
    else if (id === 'mint') mesh.scale.set(p.size * .72, p.size * .331, p.size * .72);
    else mesh.scale.setScalar(p.size * .72);
    mesh.visible = true;
  }
  function updateParticles(dt) {
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i], m = p.mesh; if (!m.visible) continue;
      p.age += dt; var life = p.age / p.life;
      if (life >= 1) { m.visible = false; continue; }
      var fade = 1 - ease((life - .35) / .65), grow = .72 + .28 * ease(life / .16);
      var s = p.size * grow * (.55 + .45 * fade);
      m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
      m.rotation.z += p.spin * dt;
      if (p.style === 'rainbow') m.scale.set(s * 2.45, s * .23, s * 1.05);
      else if (p.style === 'mint') m.scale.set(s, s * .46, s);
      else m.scale.setScalar(s);
      m.material.opacity = fade * (p.style === 'bubbles' ? .42 : .93);
      if (p.style === 'stardust' || p.style === 'frost') m.material.opacity *= .82 + .18 * Math.sin(p.age * 12 + p.phase);
      p.glint.material.opacity = fade * .78;
    }
  }
  function update(ctx) {
    if (!ctx || !ctx.scene || !ctx.player) return;
    var id = typeof ctx.trail === 'string' ? ctx.trail : ctx.trail && ctx.trail.id, style = styles[id];
    // New players and emote-only sessions do not allocate the trail pool.
    if (style || pool.length) ensurePool(ctx.scene);
    var dt = Math.max(0, Math.min(.05, ctx.dt || 0));
    if (lastRig !== ctx.rig) {
      // An outfit can change while the shop pauses RAF. Keep an emote queued
      // there for its first frame on the new rig; cancel an old running pose.
      if (emote && emote.time > 0) stopEmote();
      lastRig = ctx.rig; tracking = false;
    }
    var x = ctx.x, y = ctx.y, z = ctx.z;
    if (!tracking) { lastX = x; lastY = y; lastZ = z; tracking = true; }
    var dx = x - lastX, dz = z - lastZ, distance = Math.hypot(dx, dz), teleport = distance > 3 || Math.abs(y - lastY) > 3;
    if (teleport) { clearParticles(); stopEmote(); }
    var moving = !teleport && distance > Math.max(.003, dt * .22);
    if (emote && (moving || !ctx.grounded)) { lastBaseYaw = ctx.rig.body.rotation.y; stopEmote(); }
    animateEmote(ctx.rig, dt);
    updateParticles(dt);
    if (moving && style) {
      carry += distance * style.density;
      var count = Math.min(10, Math.floor(carry)); carry -= count;
      var ux = dx / distance, uz = dz / distance;
      for (var n = 0; n < count; n++) {
        var u = (n + .5) / count;
        spawn(id, style, lastX + dx * u, lastY + (y - lastY) * u, lastZ + dz * u, ux, uz);
      }
    } else if (!moving || !style) carry = 0;
    lastX = x; lastY = y; lastZ = z;
  }
  return { update: update, playEmote: playEmote, stopEmote: stopEmote, clear: clear };
})();
