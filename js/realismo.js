'use strict';
/* =====================================================================
   REALISMO v4 — diseño, movimiento y lógica física
   1) Texturas de detalle (tela, madera, óxido, lona, roca)
   2) Vegetación: roseta de frailejón y pasto que se mece con el viento
   3) Colisiones y navegación: nadie atraviesa objetos ni personas
   4) Línea de visión que respeta carpas, tanques y vehículos
   5) Animación corporal: zancada ligada a la velocidad, torso, puntería
   6) Acciones con duración (cortar amarras, armar C4…) y arma con inercia
   7) Imagen: arma sin atravesar paredes, posproceso, montañas y nubes
   8) Ambientación del campamento
   ===================================================================== */

/* ---------------- 1) Texturas de detalle ---------------- */
const DETAIL = {};
function detailTextures() {
  if (DETAIL.gen) return;
  const speck = (g, s, n, lo, hi, a) => { for (let i = 0; i < n; i++) { const v = lo + rng() * (hi - lo) | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(rng() * s, rng() * s, 1 + rng() * 2, 1 + rng() * 2); } };
  DETAIL.gen = canvasTex(128, (g, s) => { g.fillStyle = '#f3f3f3'; g.fillRect(0, 0, s, s); speck(g, s, 1500, 195, 255, 0.5);
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(120,120,115,.07)'; g.beginPath(); g.arc(rng() * s, rng() * s, 8 + rng() * 22, 0, 6.3); g.fill(); } }, true);
  DETAIL.wood = canvasTex(128, (g, s) => { g.fillStyle = '#e9e4dc'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 150; i++) { const v = 140 + rng() * 100 | 0; g.fillStyle = `rgba(${v},${v * 0.92 | 0},${v * 0.8 | 0},.3)`; g.fillRect(rng() * s, 0, 1 + rng() * 2.5, s); }
    for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(70,50,30,.35)'; g.beginPath(); g.ellipse(rng() * s, rng() * s, 3 + rng() * 4, 6 + rng() * 8, 0, 0, 6.3); g.stroke(); } }, true);
  DETAIL.rust = canvasTex(128, (g, s) => { g.fillStyle = '#ececec'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${120 + rng() * 70 | 0},${80 + rng() * 50 | 0},${50 + rng() * 40 | 0},${0.1 + rng() * 0.2})`; g.beginPath(); g.arc(rng() * s, rng() * s, 3 + rng() * 16, 0, 6.3); g.fill(); }
    for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); const x = rng() * s, y = rng() * s; g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 30, y + (rng() - 0.5) * 8); g.stroke(); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(60,40,25,.22)'; g.fillRect(rng() * s, rng() * s, 2 + rng() * 3, 14 + rng() * 40); } }, true);       // chorreras
  DETAIL.canvas = canvasTex(128, (g, s) => { g.fillStyle = '#f0f0ee'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 3) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 32) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x, 0, 2, s); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 2, 0, 1, s); }       // costuras
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(70,60,40,.1)'; g.beginPath(); g.arc(rng() * s, rng() * s, 8 + rng() * 20, 0, 6.3); g.fill(); } }, true);
  DETAIL.cloth = canvasTex(64, (g, s) => { g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(i, 0, 1, s); g.fillRect(0, i, s, 1); } speck(g, s, 300, 200, 255, 0.35); }, true);
  DETAIL.cloth.repeat.set(4, 4);
  DETAIL.rock = canvasTex(128, (g, s) => { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s); speck(g, s, 2600, 140, 255, 0.45);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${130 + rng() * 60 | 0},${140 + rng() * 60 | 0},${95 + rng() * 40 | 0},.18)`; g.beginPath(); g.arc(rng() * s, rng() * s, 3 + rng() * 12, 0, 6.3); g.fill(); }      // líquenes
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(40,40,40,.3)'; g.beginPath(); let x = rng() * s, y = rng() * s; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 26; y += (rng() - 0.5) * 26; g.lineTo(x, y); } g.stroke(); } }, true);     // grietas
  DETAIL.rock.repeat.set(2, 2);
}
const DETAIL_MAP = { wood: [0x5a4226, 0x7a3d24, 0x4b3b29, 0x6e5f45], rust: [0x7a4a2a, 0x5a6066, 0xc9cfc4, 0x2a5fa8, 0xb33a2a, 0xd4b21f, 0x2f7d4a, 0x8a8f96, 0x2e5d3a, 0x4a4f52, 0x3c4a3a],
  canvas: [0x4a5632, 0x2c4a6e, 0x6e2c2c], rock: [0x707275, 0x5f6163, 0x6a6660],
  cloth: [0x3b4a63, 0x445238, 0x20261f, 0xff7a1a, 0x2f3542, 0x3a4630, 0x2d3528, 0xf4f4f0, 0xf2f2ee, 0x141414, 0x2a2f3a, 0x3a2a1e, 0x2b2b30, 0x4a5a3a, 0x34405a, 0xe9c9b0] };
function detailFor(color) {
  detailTextures();
  for (const k in DETAIL_MAP) if (DETAIL_MAP[k].includes(color)) return { map: DETAIL[k], bumpMap: DETAIL[k], bumpScale: k === 'rock' ? 0.05 : 0.012 };
  return { map: DETAIL.gen };
}

/* ---------------- 2) Vegetación ---------------- */
// Roseta de frailejón: tres coronas de hojas alargadas que caen hacia afuera
function rosetteGeo() {
  const pos = [], idx = []; let base = 0;
  const rings = [[11, 1.32, 0.66, 0], [9, 0.85, 0.6, 0.3], [6, 0.38, 0.5, 0.6]];        // nº hojas, inclinación, largo, desfase
  for (const [n, tilt, len, off] of rings) for (let i = 0; i < n; i++) {
    const a = off + i / n * 6.2832 + (rng() - 0.5) * 0.2, ca = Math.cos(a), sa = Math.sin(a), SEG = 4, L = len * (0.85 + rng() * 0.3);
    let r = 0.04, y = 0;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG, phi = tilt + t * t * 0.6;
      if (s) { r += Math.sin(phi) * L / SEG; y += Math.cos(phi) * L / SEG; }
      const w = 0.07 * Math.sin(Math.PI * (0.12 + 0.86 * t)) + 0.012, cup = w * 0.35;
      pos.push(ca * r - sa * w, y + cup, sa * r + ca * w, ca * r + sa * w, y + cup, sa * r - ca * w, ca * r, y, sa * r);
      if (s) { const b = base + (s - 1) * 3; idx.push(b, b + 2, b + 3, b + 2, b + 5, b + 3, b + 2, b + 1, b + 5, b + 1, b + 4, b + 5); }
    }
    base += (SEG + 1) * 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Pasto con viento: las puntas se mecen, la base queda fija
const WIND = { value: 0 };
function makeGrassMaterial(tex) {
  const m = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.3, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = WIND;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float gph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
        transformed.x += (sin(uWind * 1.6 + gph) + 0.5 * sin(uWind * 3.7 + gph * 1.7)) * 0.12 * uv.y * uv.y;
      #endif`);
    // Ilumina las dos caras por igual (si no, el reverso de cada hoja sale negro)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`);
  };
  return m;
}
// Hojas que dejan pasar la luz: el envés no queda negro al verlas desde abajo
function leafy(m) {
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), 0.72));`);
  };
  return m;
}
function blockedSpot(x, z, margin) {
  for (const c of colliders) { const dx = x - c.x, dz = z - c.z, r = c.r + margin; if (dx * dx + dz * dz < r * r) return true; }
  return false;
}

/* ---------------- 3) Colisiones y navegación ---------------- */
let _navCols = null, _bigCols = null, _navN = -1;
function navCols() {
  if (_navN !== colliders.length) { _navN = colliders.length; _navCols = colliders.filter(c => c.r >= 0.45); _bigCols = colliders.filter(c => c.h >= 1.6 && c.r >= 0.9); }
  return _navCols;
}
function bigCols() { navCols(); return _bigCols; }
const _chars = [];
// Personajes que ocupan espacio (vivos y en el suelo)
function solidCharacters() {
  _chars.length = 0;
  for (const e of enemies) if (e.alive && !e.fixed) _chars.push(e);
  if (engineer) _chars.push(engineer);
  if (typeof STORY !== 'undefined' && STORY.deivis && STORY.deivis.mesh.visible) _chars.push(STORY.deivis);
  return _chars;
}
// Avanza un personaje hacia (dx,dz) rodeando obstáculos y manteniendo distancia con los demás.
// Devuelve la velocidad real conseguida (para que la animación no "patine").
function navStep(a, dx, dz, spd, dt) {
  const x0 = a.pos.x, z0 = a.pos.z; let ax = 0, az = 0;
  for (const c of navCols()) {
    const ox = x0 - c.x, oz = z0 - c.z, R = c.r + 0.5, reach = R + 2.2, d2 = ox * ox + oz * oz;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2) || 0.01, nx = ox / d, nz = oz / d;
    if (nx * dx + nz * dz > 0.3) continue;                                    // ya quedó atrás
    const w = (reach - d) / 2.2;
    let tx = -nz, tz = nx; const dot = tx * dx + tz * dz;
    if (dot < -0.12 || (Math.abs(dot) <= 0.12 && a.seed % 2 < 1)) { tx = -tx; tz = -tz; }
    ax += (tx * 1.2 + nx * 0.6) * w; az += (tz * 1.2 + nz * 0.6) * w;
  }
  const chars = solidCharacters();
  for (const o of chars) {
    if (o === a) continue;
    const ox = x0 - o.pos.x, oz = z0 - o.pos.z, d2 = ox * ox + oz * oz;
    if (d2 > 2.6 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), w = (1.62 - d) / 1.62; ax += ox / d * w * 1.5; az += oz / d * w * 1.5;
  }
  let mx = dx + ax, mz = dz + az; const m = Math.hypot(mx, mz) || 1; mx /= m; mz /= m;
  const k = Math.min(1, dt * 9);
  a.navX = a.navX == null ? mx : lerp(a.navX, mx, k); a.navZ = a.navZ == null ? mz : lerp(a.navZ, mz, k);
  const n = Math.hypot(a.navX, a.navZ) || 1;
  let nx = x0 + a.navX / n * spd * dt, nz = z0 + a.navZ / n * spd * dt;
  for (const c of colliders) {                                                // nunca dentro de un objeto
    const ox = nx - c.x, oz = nz - c.z, R = c.r + 0.3, d2 = ox * ox + oz * oz;
    if (d2 < R * R && d2 > 1e-8) { const d = Math.sqrt(d2); nx = c.x + ox / d * R; nz = c.z + oz / d * R; }
  }
  for (const o of chars) {                                                    // ni dentro de otra persona
    if (o === a) continue;
    const ox = nx - o.pos.x, oz = nz - o.pos.z, d2 = ox * ox + oz * oz;
    if (d2 < 0.3 && d2 > 1e-8) { const d = Math.sqrt(d2); nx = o.pos.x + ox / d * 0.55; nz = o.pos.z + oz / d * 0.55; }
  }
  if (G.state === 'playing') { const ox = nx - player.pos.x, oz = nz - player.pos.z, d2 = ox * ox + oz * oz;
    if (d2 < 0.36 && d2 > 1e-8) { const d = Math.sqrt(d2); nx = player.pos.x + ox / d * 0.6; nz = player.pos.z + oz / d * 0.6; } }
  a.pos.x = nx; a.pos.z = nz; a.pos.y = terrainH(nx, nz);
  return Math.hypot(nx - x0, nz - z0) / Math.max(dt, 1e-4);
}

/* ---------------- 4) Línea de visión ---------------- */
// El terreno y los objetos grandes (carpas, tanques, molino, vehículos) tapan la vista y las balas enemigas
function hasLOS(a, b) {
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    if (terrainH(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) > a.y + (b.y - a.y) * t + 0.15) return false;
  }
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  for (const c of bigCols()) {
    const t = ((c.x - a.x) * dx + (c.z - a.z) * dz) / L2;
    if (t <= 0.03 || t >= 0.97) continue;
    const qx = a.x + dx * t - c.x, qz = a.z + dz * t - c.z;
    if (qx * qx + qz * qz < c.r * c.r * 0.8 && a.y + (b.y - a.y) * t < c.y + c.h) return false;
  }
  return true;
}

/* ---------------- 5) Animación corporal ---------------- */
function poseHumanoid(e, dt, moving, spd) {
  const u = e.mesh.userData, k = Math.min(1, dt * 12);
  if (moving) e.walk += dt * spd * 6.2832 / (1.3 + spd * 0.22);                // un ciclo = dos pasos; zancada según velocidad
  const g = e.gait = lerp(e.gait || 0, moving ? 1 : 0, Math.min(1, dt * 9));
  const run = moving ? clamp((spd - 2.4) / 2.4, 0, 1) : 0;
  const s = Math.sin(e.walk), c = Math.cos(e.walk);
  const A = lerp(0.42, 0.85, run) * g, B = lerp(0.8, 1.6, run) * g;
  let ll = -s * A - run * 0.12 * g, rl = s * A - run * 0.12 * g;
  let ls = Math.max(0, c) * B + (0.08 + run * 0.15) * g, rs = Math.max(0, -c) * B + (0.08 + run * 0.15) * g;
  let la = s * A * 0.75, ra = -s * A * 0.75;
  let lf = -0.18 - run * g - Math.max(0, s) * 0.25 * g, rf = -0.18 - run * g - Math.max(0, -s) * 0.25 * g;
  let laz = -0.06, raz = 0.06, lean = 0.03 * g + run * 0.2 * g, twist = -s * 0.13 * g, hipTwist = s * 0.08 * g;
  let hipY = 0.9 - (1 - Math.abs(c)) * 0.035 * g - run * 0.03 * g, hy = 0, gunX = 0.9;
  const breath = Math.sin(T * 1.5 + e.seed * 2);

  if (e.seated) { ll = rl = -1.5; ls = rs = 1.5; la = ra = 0.6; lf = rf = -0.3; laz = 0.25; raz = -0.25; hipY = 0.5; lean = 0.12 + breath * 0.02; twist = 0; hy = Math.sin(T * 0.4) * 0.3; }
  else if (e.state === 'combat') {
    const d = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
    const P = clamp(Math.atan2(player.pos.y - 0.3 - (e.pos.y + 1.4), d), -0.6, 0.8);     // apunta hacia arriba / abajo
    ra = -1.38 - P * 0.45; rf = -0.2; la = -1.15 - P * 0.45; lf = -0.55; laz = 0.5; raz = 0; gunX = -P * 0.25; lean = 0.1 - P * 0.45 + breath * 0.01; twist *= 0.3;
    if (!moving) { ll = -0.3; rl = 0.22; ls = 0.28; rs = 0.3; hipY = 0.84; }
    if (e.recoilT > 0) { e.recoilT -= dt; ra += 0.14; la += 0.1; lean -= 0.06; }
  }
  else if (e.kind === 'op') { const r = Math.sin(T * 2.2 + e.seed) * 0.16; la = ra = -0.95 + r; lf = rf = -0.5; lean = 0.3 + r * 0.3; hy = Math.sin(T * 0.3 + e.seed) * 0.25; laz = 0.15; raz = -0.15; }
  else if (e.hasGun) { ra = -0.5; rf = -0.95; la = -0.62; lf = -0.9; laz = 0.38; raz = 0; twist *= 0.5; lean += breath * 0.012; if (!moving) hy = Math.sin(T * 0.45 + e.seed) * 0.8; }
  else if (!moving) { lean = breath * 0.015; la = 0.04; ra = 0.04; }
  if (e.flinch > 0) { e.flinch -= dt; lean -= 0.4 * e.flinch; twist += 0.5 * e.flinch; }

  damp(u.armL, 'x', la, k); damp(u.armR, 'x', ra, k); damp(u.foreL, 'x', lf, k); damp(u.foreR, 'x', rf, k);
  damp(u.armL, 'z', laz, k); damp(u.armR, 'z', raz, k);
  damp(u.legL, 'x', ll, k); damp(u.legR, 'x', rl, k); damp(u.shinL, 'x', ls, k); damp(u.shinR, 'x', rs, k);
  damp(u.torso, 'x', lean, k); damp(u.torso, 'y', twist, k); damp(u.hips, 'y', hipTwist, k); damp(u.gun, 'x', gunX, k);
  damp(u.head, 'y', hy - twist * 0.7, k * 0.5); damp(u.head, 'x', 0, k * 0.5);
  u.hips.position.y += (hipY - u.hips.position.y) * k;
}

/* ---------------- 6) Acciones con duración y arma ---------------- */
const ACTIONS = { water: [1.7, 'TOMANDO MUESTRA DE AGUA', true], gold: [1.5, 'ASEGURANDO EL ORO', false], laptop: [2.3, 'COPIANDO DATOS', false],
  eng: [1.9, 'CORTANDO LAS AMARRAS', true], board: [0.8, 'FOTOGRAFIANDO', false], retort: [0.8, 'FOTOGRAFIANDO', false], c4: [2.3, 'ARMANDO CARGA DE C4', true] };
function interact() {
  const it = interactTarget;
  if (!it || it.det || player.acting) return;
  if (it.manual) { it.act(); return; }
  const A = ACTIONS[it.id] || ACTIONS.c4;
  player.acting = { t: 0, dur: A[0], label: A[1], kneel: A[2], it };
  setADS(false); SFX.swap();
}
function updateAction(dt) {
  const a = player.acting, el = $('actbar');
  if (!a) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  a.t += dt;
  el.style.display = 'block'; $('prompt').style.display = 'none';
  $('actFill').style.width = Math.min(100, a.t / a.dur * 100).toFixed(0) + '%'; $('actTxt').textContent = a.label + '…';
  if (Math.random() < dt * 5) SFX.step(0.05, false);
  if (a.t >= a.dur) {
    player.acting = null; el.style.display = 'none';
    const it = a.it; if (it.done) return;
    it.done = true; it.act(); renderObjectives(); checkPhase2();
  }
}
const GP = { yaw: 0, pitch: 0, sx: 0, sy: 0 };
// Inercia del arma al girar, animación de recarga y de cerrojo
function gunPolish(g, dt) {
  let dyaw = camera.rotation.y - GP.yaw, dp = camera.rotation.x - GP.pitch;
  dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); GP.yaw = camera.rotation.y; GP.pitch = camera.rotation.x;
  const amt = 1 - player.ads * 0.8, kk = Math.min(1, dt * 9), inv = 1 / Math.max(dt, 0.004);
  GP.sx = lerp(GP.sx, clamp(dyaw * inv * 0.012, -0.07, 0.07), kk); GP.sy = lerp(GP.sy, clamp(dp * inv * 0.012, -0.05, 0.05), kk);
  g.rotation.y -= GP.sx * amt; g.rotation.x -= GP.sy * amt; g.position.x -= GP.sx * 0.25 * amt; g.position.y -= GP.sy * 0.2 * amt;
  const w = curW();
  if (player.reloading) {
    const p = 1 - player.reloadT / w.reload, dip = Math.sin(Math.min(1, p * 1.1) * Math.PI);
    g.rotation.z += dip * 0.55; g.rotation.x += dip * 0.3; g.position.y -= dip * 0.05; g.position.x -= dip * 0.05;
  } else if (w.id === 'sniper' && player.fireCd > 0.22 && player.fireCd < 0.95) {
    const b = Math.sin((0.95 - player.fireCd) / 0.73 * Math.PI);
    g.rotation.z -= b * 0.24; g.position.z += b * 0.035; g.rotation.x += b * 0.05;
  }
}
const _sc = new THREE.Vector3(), _sd = new THREE.Vector3();
function shadowCenter() {
  if (G.state === 'intro' && typeof CINE !== 'undefined' && CINE.bino) return CINE.tgt;
  camera.getWorldDirection(_sd); _sd.y = 0; if (_sd.lengthSq() > 1e-6) _sd.normalize();
  return _sc.copy(camera.position).addScaledVector(_sd, 30);
}

/* ---------------- 7) Imagen ---------------- */
const POST = { on: false, rt: null, scene: null, cam: null, mat: null };
let gunScene = null, gunCam = null, backdrop = null, cloudTex = null, waterN = null;
function initImage() {
  // Escena propia del arma: se dibuja encima, así nunca atraviesa paredes ni objetos
  gunScene = new THREE.Scene(); gunCam = new THREE.PerspectiveCamera(CFG.FOV, window.innerWidth / window.innerHeight, 0.02, 10);
  gunScene.add(gunCam);
  gunScene.add(new THREE.HemisphereLight(0xc4d8ea, 0x5d5848, 0.95));
  const gl2 = new THREE.DirectionalLight(0xfff0d6, 1.5); gl2.position.copy(SUN_OFF); gunScene.add(gl2);
  for (const gg of guns) gunCam.add(gg);
  gunCam.add(muzzleFlash);
  // Agua con relieve animado
  waterN = canvasTex(128, (g, s) => {
    const h = new Float32Array(s * s);
    for (let i = 0; i < 16; i++) { const fx = (1 + rng() * 5 | 0), fy = (1 + rng() * 9 | 0), ph = rng() * 6.3, am = 0.4 + rng() * 0.6;
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) h[y * s + x] += Math.sin((x * fx + y * fy) / s * 6.2832 + ph) * am; }
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const dx = h[y * s + (x + 1) % s] - h[y * s + x], dy = h[((y + 1) % s) * s + x] - h[y * s + x], i = (y * s + x) * 4;
      img.data[i] = 128 + clamp(dx * 55, -127, 127); img.data[i + 1] = 128 + clamp(dy * 55, -127, 127); img.data[i + 2] = 255; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, true);
  waterN.encoding = THREE.LinearEncoding; waterN.repeat.set(14, 1.5);
  const river = scene.userData.river;
  if (river) { river.material.normalMap = waterN; river.material.normalScale = new THREE.Vector2(0.55, 0.55); river.material.roughness = 0.07; river.material.metalness = 0.55; river.material.needsUpdate = true; }
  // Posproceso: viñeta, gradación fría de páramo, grano y leve aberración en los bordes
  try {
    if (renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float')) {
      const pr = renderer.getPixelRatio();
      POST.rt = new THREE.WebGLRenderTarget(window.innerWidth * pr, window.innerHeight * pr, { samples: 4, type: THREE.HalfFloatType });
      POST.mat = new THREE.ShaderMaterial({
        uniforms: { tD: { value: POST.rt.texture }, uT: { value: 0 }, uVig: { value: 0.85 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `uniform sampler2D tD; uniform float uT; uniform float uVig; varying vec2 vUv;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uT) * 43758.5453); }
          void main(){
            vec2 d = vUv - 0.5; float r2 = dot(d, d);
            vec3 c; c.r = texture2D(tD, vUv + d * r2 * 0.010).r; c.g = texture2D(tD, vUv).g; c.b = texture2D(tD, vUv - d * r2 * 0.010).b;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, 1.1);
            c *= mix(vec3(0.93, 0.99, 1.07), vec3(1.05, 1.0, 0.94), smoothstep(0.0, 0.7, l));
            c *= 1.0 - r2 * uVig;
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
            gl_FragColor.rgb += (hash(vUv * 900.0) - 0.5) * 0.03;
          }`,
        depthTest: false, depthWrite: false
      });
      POST.scene = new THREE.Scene(); POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), POST.mat); quad.frustumCulled = false; POST.scene.add(quad);
      renderer.setRenderTarget(POST.rt);
      const gl = renderer.getContext(); POST.on = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      renderer.setRenderTarget(null);
    }
  } catch (e) { POST.on = false; }
  renderer.autoClear = false;
  window.addEventListener('resize', () => {
    gunCam.aspect = window.innerWidth / window.innerHeight; gunCam.updateProjectionMatrix();
    if (POST.rt) { const pr = renderer.getPixelRatio(); POST.rt.setSize(window.innerWidth * pr, window.innerHeight * pr); }
  });
}
// Dibuja el mundo, luego el arma encima y por último el posproceso
function renderFrame() {
  gunCam.quaternion.copy(camera.quaternion);
  if (Math.abs(gunCam.fov - camera.fov) > 0.01) { gunCam.fov = camera.fov; gunCam.updateProjectionMatrix(); }
  if (POST.on) {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(POST.rt); renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth(); renderer.render(gunScene, gunCam);
    renderer.setRenderTarget(null);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    POST.mat.uniforms.uT.value = T % 10;
    renderer.render(POST.scene, POST.cam);
  } else {
    renderer.clear(); renderer.render(scene, camera);
    renderer.clearDepth(); renderer.render(gunScene, gunCam);
  }
}
// Cordilleras lejanas en capas y un techo de nubes en movimiento
function buildBackdrop() {
  backdrop = new THREE.Group(); scene.add(backdrop);
  const hor = new THREE.Color(FOG_COLOR);
  const ring = (R, hMin, hMax, tint, seed) => {
    const N = 120, pos = [], col = [], idx = [], top = new THREE.Color(tint), c = new THREE.Color();
    for (let i = 0; i <= N; i++) {
      const a = i / N * 6.2832, n = 0.5 + 0.28 * Math.sin(a * 3 + seed) + 0.16 * Math.sin(a * 7.3 + seed * 2.1) + 0.1 * Math.sin(a * 17 + seed * 0.7) + 0.06 * Math.sin(a * 31 + seed);
      const h = hMin + (hMax - hMin) * clamp(n, 0, 1), x = Math.cos(a) * R, z = Math.sin(a) * R;
      pos.push(x, -30, z, x, h, z); c.copy(hor); col.push(c.r, c.g, c.b); c.copy(hor).lerp(top, 0.75); col.push(c.r, c.g, c.b);
      if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    backdrop.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })));
  };
  ring(560, 70, 190, 0x8695a2, 1.3); ring(450, 40, 130, 0x74838f, 4.1); ring(350, 20, 85, 0x65737d, 7.7);
  cloudTex = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) { const x = rng() * s, y = rng() * s, r = 18 + rng() * 46, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${0.16 + rng() * 0.2})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { g.setTransform(1, 0, 0, 1, ox, oy); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }, true);
  cloudTex.repeat.set(3, 3);
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ map: cloudTex, color: 0xe6edf2, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
  clouds.rotation.x = Math.PI / 2; clouds.position.y = 210; backdrop.add(clouds);
}
function updatePolish(dt) {
  WIND.value = T;
  if (backdrop) backdrop.position.set(camera.position.x, 0, camera.position.z);
  if (cloudTex) { cloudTex.offset.x += dt * 0.004; cloudTex.offset.y += dt * 0.0015; }
  if (waterN) { waterN.offset.x -= dt * 0.05; waterN.offset.y = Math.sin(T * 0.3) * 0.05; }
}

/* ---------------- 8) Ambientación del campamento ---------------- */
function dressCamp() {
  const steel = M(0x5a6066, { metalness: 0.6, roughness: 0.5 });
  // Retén de sacos de arena a la entrada y al pie de la torre
  const bagGeo = new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), bagM = M(0x8a8064, { roughness: 1 });
  const wall = (x0, z0, dx, dz, n, rows) => { for (let r = 0; r < rows; r++) for (let i = 0; i < n - (r % 2); i++) {
    const x = x0 + dx * (i + (r % 2) * 0.5), z = z0 + dz * (i + (r % 2) * 0.5);
    const b = addAt(new THREE.Mesh(bagGeo, bagM), x, terrainH(x, z) + 0.17 + r * 0.3, z); b.rotation.z = Math.PI / 2; b.rotation.y = Math.atan2(-dz, dx) + (rng() - 0.5) * 0.15; b.scale.set(1, 1, 1.25);
    if (r === 0) addCol(x, z, 0.42, 0.95); } };
  wall(-41, 42.4, 0, 0.62, 3, 3); wall(-41, 51.6, 0, 0.62, 3, 3); wall(-38.6, 39.3, 0.62, 0, 4, 2);
  // Postes de luz
  [[-6.4, 28.8], [16.5, 27.2], [-22.5, 20.4], [-21, 53.2]].forEach(([x, z]) => {
    const y = terrainH(x, z);
    addAt(new THREE.Mesh(cyl(0.05, 0.07, 3.6, 8), M(0x5a4226)), x, y + 1.8, z);
    addAt(new THREE.Mesh(box(0.5, 0.05, 0.05), steel), x + 0.2, y + 3.55, z);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), MB(0xffe6b0)); bulb.position.set(x + 0.42, y + 3.48, z); scene.add(bulb);
    const l = new THREE.PointLight(0xffd9a0, 5, 13); l.position.set(x + 0.42, y + 3.3, z); scene.add(l);
    addCol(x, z, 0.14, 3.6);
  });
  // Planta eléctrica con escape humeante
  { const x = 25.5, z = 41.6, y = terrainH(x, z);
    addAt(new THREE.Mesh(box(1.5, 0.85, 0.8), M(0x2e5d3a, { metalness: 0.3 })), x, y + 0.5, z);
    addAt(new THREE.Mesh(cyl(0.2, 0.2, 0.9, 12), M(0xb33a2a, { metalness: 0.35, roughness: 0.6 })), x - 0.2, y + 1.05, z).rotation.z = Math.PI / 2;
    addAt(new THREE.Mesh(cyl(0.04, 0.04, 0.6, 6), steel), x + 0.6, y + 1.2, z + 0.25);
    for (const ox of [-0.6, 0.6]) addAt(new THREE.Mesh(box(0.12, 0.1, 0.9), steel), x + ox, y + 0.05, z);
    emitters.push({ pos: new THREE.Vector3(x + 0.6, y + 1.55, z + 0.25), color: 0x55554f, rate: 3, acc: 0, size: 0.4, active: true, rise: 1.1 });
    addCol(x, z, 0.95, 1.2); }
  // Mangueras por el suelo
  const hose = pts => { const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], terrainH(p[0], p[1]) + 0.05, p[1])));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.05, 6), M(0x15181a, { roughness: 0.6 })); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
  hose([[20.5, 27.6], [19, 22], [20.5, 15], [18, 9], [18.6, riverZ(18.6) + 4.5]]);
  hose([[25.5, 40.9], [27, 42.3], [30.2, 43.2], [31.6, 43.6]]);
  hose([[-22.2, 14.6], [-18, 18.5], [-12, 20.5], [-6.2, 20.4]]);
  // Charcos
  const puddleM = new THREE.MeshStandardMaterial({ color: 0x2b2a25, roughness: 0.04, metalness: 0.7, transparent: true, opacity: 0.82 });
  [[2, 30.5, 1.4], [-15, 21, 1.1], [18.5, 34, 1.6], [-30, 48.6, 1.3], [-52, 47.4, 1.7], [8.5, 14.5, 1.2], [-3.5, 47.5, 1.0]].forEach(([x, z, r]) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 18), puddleM); p.rotation.x = -Math.PI / 2; p.rotation.z = rng() * 3; p.scale.set(1, 0.6 + rng() * 0.3, 1); p.position.set(x, terrainH(x, z) + 0.035, z); p.receiveShadow = true; scene.add(p); });
  // Huellas de llantas en el camino
  const trackM = new THREE.MeshBasicMaterial({ color: 0x2a231b, transparent: true, opacity: 0.4, depthWrite: false });
  for (const zc of [47.2, 48.8]) {
    const pos = [], idx = []; let n = 0;
    for (let x = -178; x <= -20; x += 2.5) { for (const o of [-0.16, 0.16]) pos.push(x, terrainH(x, zc + o) + 0.04, zc + o); if (n) { const b = (n - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } n++; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); scene.add(new THREE.Mesh(g, trackM));
  }
}

/* ---------------- Auditoría de solapes (para pruebas) ---------------- */
function auditOverlaps() {
  const n = G.campCols || 0, out = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = colliders[i], b = colliders[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < a.r + b.r - 0.35 && d > 0.9) out.push(`campo ${a.x.toFixed(1)},${a.z.toFixed(1)} r${a.r} <-> ${b.x.toFixed(1)},${b.z.toFixed(1)} r${b.r} d=${d.toFixed(2)}`);
  }
  for (let i = n; i < colliders.length; i++) for (let j = 0; j < n; j++) {
    const a = colliders[i], b = colliders[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (Math.abs(a.x) < 900 && Math.abs(b.x) < 900 && d < a.r + b.r - 0.1) out.push(`vegetación ${a.x.toFixed(1)},${a.z.toFixed(1)} <-> ${b.x.toFixed(1)},${b.z.toFixed(1)}`);
  }
  return out;
}
