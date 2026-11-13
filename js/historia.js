'use strict';
/* =====================================================================
   HISTORIA v3
   1) Reparto: el Chamo, el Catire, Deivis, Daniela
   2) Cinemática de apertura: sobrevuelo + reconocimiento con binoculares
      sincronizado con las grabaciones de /audio
   3) Misión de química: estabilizar el pH del tanque 2 (HCN)
   4) Guía de navegación: flecha al siguiente objetivo
   ===================================================================== */

const POSTS = { chamo: [ENG.x + 4, ENG.z + 1.5, 0.4], catire: [ENG.x - 1.5, ENG.z - 4, -0.6] };
const PARK = { pickup: [-27, 48.2], suv: [-17.5, 47.4] };
const STORY = { chamo: null, catire: null, deivis: null, pickup: null, suv: null, gas: null, tags: {} };

/* ---------------- 1) Reparto y utilería ---------------- */
function buildStoryProps() {
  STORY.pickup = makeVehicle('pickup', 0x8d9296); scene.add(STORY.pickup);
  STORY.suv = makeVehicle('suv', 0x08090a); scene.add(STORY.suv);
  addCol(PARK.pickup[0] - 1.2, PARK.pickup[1], 1.5, 1.8); addCol(PARK.pickup[0] + 1.3, PARK.pickup[1], 1.5, 1.8);
  const m = makeHumanoid('boss'); m.userData.gun.visible = false; m.visible = false; scene.add(m);
  STORY.deivis = { mesh: m, pos: new THREE.Vector3(), walk: 0, kind: 'civ', state: 'idle', seed: 2.2, hasGun: false, flinch: 0, path: null };
  // Haz de luz verde sobre la extracción: se ve desde todo el valle
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 80, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x4dff7a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 40; flareGroup.add(beam);
  // Estación de pH del tanque 2: medidor, cal, soda, carbonato y el bidón rojo
  const s = SITES[0], y = terrainH(s.x + 4.5, s.z + 2.6);
  const st = addAt(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.35), M(0x2a3b4a, { metalness: 0.4 })), s.x + 3.4, y + 0.55, s.z + 2.2);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.02), MB(0x7dffa0)); scr.position.set(0, 0.3, 0.19); st.add(scr);
  addAt(new THREE.Mesh(cyl(0.3, 0.3, 0.85, 14), M(0xc22a1e, { metalness: 0.3, roughness: 0.5 })), s.x + 5.6, y + 0.43, s.z + 1.2);     // bidón rojo (ácido)
  addAt(new THREE.Mesh(cyl(0.26, 0.26, 0.7, 14), M(0x2a5fa8, { metalness: 0.3 })), s.x + 5.9, y + 0.35, s.z + 2.3);                     // soda cáustica
  addAt(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 10), M(0xd9d4c6)), s.x + 5.2, y + 0.2, s.z + 3.3).rotation.z = Math.PI / 2;   // saco de carbonato
  for (const id of ['deivis', 'chamo', 'catire']) { const d = document.createElement('div'); d.className = 'tag'; $('tags').appendChild(d); STORY.tags[id] = d; }
  STORY.tags.deivis.textContent = PERSONAJES.jefe.etiqueta; STORY.tags.chamo.textContent = PERSONAJES.chamo.etiqueta; STORY.tags.catire.textContent = PERSONAJES.catire.etiqueta;
}

function spawnInitialEnemies() {
  // 3 operarios vertiendo barriles al río
  [-14, -2, 10].forEach((x, i) => {
    const zr = riverZ(x);
    spawnEnemy('op', x, zr + 6.2, { faceY: Math.PI });
    const y = terrainH(x + 0.9, zr + 5.1), isHg = i === 1;
    const barrel = addAt(new THREE.Mesh(cyl(0.42, 0.42, 1.15, 14), M(isHg ? 0x8a8f96 : 0xd4b21f, { metalness: 0.4 })), x + 0.9, y + 0.62, zr + 5.1); barrel.rotation.x = -1.0;
    const liquid = MB(isHg ? 0xdfe8ee : 0x9dff3a, { transparent: true, opacity: 0.9 });
    const stream = new THREE.Mesh(cyl(0.09, 0.16, 2.2, 8), liquid); stream.position.set(x + 0.9, y + 0.15, zr + 3.9); stream.rotation.x = -0.95; scene.add(stream);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), MB(isHg ? 0xcfdde2 : 0xa6ff3a, { transparent: true, opacity: 0.7 }));
    patch.rotation.x = -Math.PI / 2; patch.position.set(x + 1.6, CFG.WATER_Y + 0.03, zr + 2.2); patch.scale.set(1.8, 1, 1); scene.add(patch);
    pourProps.push(barrel, stream, patch); toxicPatches.push(patch);
  });
  spawnEnemy('guard', -28, 16, { patrol: [[-28, 16], [24, 15]] });
  spawnEnemy('guard', 20, 38, { patrol: [[20, 38], [-4, 37]] });
  spawnEnemy('tower', TOWER.x, TOWER.z, { y: terrainH(TOWER.x, TOWER.z) + TOWER.h, fixed: true, faceY: 2.2 });
  STORY.chamo = spawnEnemy('guard', POSTS.chamo[0], POSTS.chamo[1], { faceY: POSTS.chamo[2], style: 'chamo', hp: 140 });
  STORY.catire = spawnEnemy('guard', POSTS.catire[0], POSTS.catire[1], { faceY: POSTS.catire[2], style: 'catire' });
  // Ingeniera secuestrada, sentada y atada
  const m = makeHumanoid('civ'); m.userData.gun.visible = false;
  const p = new THREE.Vector3(ENG.x, terrainH(ENG.x, ENG.z), ENG.z); m.position.copy(p); m.rotation.y = 0.9; scene.add(m);
  const crate = addAt(new THREE.Mesh(box(0.5, 0.45, 0.5), M(0x5a4226)), ENG.x - 0.12, p.y + 0.22, ENG.z - 0.16); pourProps.push(crate);
  engineer = { mesh: m, pos: p, seated: true, free: false, walk: 0, kind: 'civ', state: 'idle', seed: 1, arrived: false, flinch: 0, tx: ENG.x, tz: ENG.z };
}

function buildInteractables() {
  const s = SITES[0];
  G.inter = [
    { id: 'water', phase: 2, x: -7, z: riverZ(-7) + 5.6, r: 3.2, req: true, wp: 'MUESTRA', nav: 'ANALIZA EL AGUA DEL RÍO', label: '[F] ANALIZAR EL AGUA DEL RÍO CON EL KIT DE CAMPO', act: () => openIntel('water') },
    { id: 'gold', phase: 2, x: TABLE.x, z: TABLE.z, r: 3.4, req: true, wp: 'ORO', nav: 'ASEGURA EL ORO', label: '[F] ASEGURAR LAS TORTAS DE ORO', act: secureGold },
    { id: 'laptop', phase: 2, x: LAB.x - 1, z: LAB.z + 0.6, r: 2.6, req: true, wp: 'COMPUTADOR', nav: 'COPIA LOS DATOS DEL COMPUTADOR', label: '[F] COPIAR DATOS DEL COMPUTADOR', act: () => openIntel('laptop') },
    { id: 'eng', phase: 2, x: ENG.x, z: ENG.z, r: 2.8, req: true, wp: 'REHÉN', nav: 'LIBERA A LA INGENIERA', label: '[F] LIBERAR A LA INGENIERA', act: freeEngineer },
    { id: 'ph', phase: 2, x: s.x + 3.6, z: s.z + 2.8, r: 4.2, req: true, manual: true, need: () => done('eng'), wp: 'TANQUE 2 · pH', nav: 'ESTABILIZA EL pH DEL TANQUE 2', label: '[F] ESTABILIZAR EL pH DEL TANQUE 2', act: openPh },
    { id: 'board', phase: 2, x: LAB.x + 1.6, z: LAB.z - 0.2, r: 2.3, wp: 'DIAGRAMA', label: '[F] FOTOGRAFIAR EL DIAGRAMA DE CIANURACIÓN', act: () => openIntel('board') },
    { id: 'retort', phase: 2, x: -9, z: 24, r: 3, wp: 'RETORTA', label: '[F] DOCUMENTAR LA RETORTA DE MERCURIO', act: () => openIntel('retort') }
  ].concat(SITES.map(st => ({ id: st.id, phase: 3, x: st.x, z: st.z, r: 5.2, req: true, wp: 'C4', nav: 'COLOCA C4: ' + st.name.toUpperCase(), label: '[F] COLOCAR C4 — ' + st.name.toUpperCase(), act: () => placeC4(st) })));
}
OBJECTIVES.splice(6, 0, { phase: 2, text: () => 'Estabilizar el pH del tanque 2 (meta: 10,5 – 11,5)', done: () => done('ph'), need: () => done('eng') });

/* ---------------- 2) Cinemática ---------------- */
const CINE = { segs: [], by: {}, cur: '', shot: '', eye: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 60, bino: false, flags: {}, dustT: 0, total: 0 };
let cardTok = 0;
function typeCard(text, hold) {
  const el = $('card'), tok = ++cardTok; let i = 0; el.textContent = '';
  if (!text) return;
  const iv = setInterval(() => {
    if (tok !== cardTok) { clearInterval(iv); return; }
    el.textContent = text.slice(0, ++i);
    if (i % 2 === 0) SFX.beep(2200 + (i % 5) * 60);
    if (i >= text.length) { clearInterval(iv); setTimeout(() => { if (tok === cardTok) el.textContent = ''; }, (hold || 3.5) * 1000); }
  }, 42);
}
function buildTimeline() {
  let t = 0; CINE.segs = []; CINE.by = {};
  const add = (name, len) => { const s = { name, t, len }; CINE.segs.push(s); CINE.by[name] = s; t += len; };
  add('fly1', 8.5); add('fly2', 8); add('pov', 4.5); add('arrive', 9.5); add('meet', 3.2);
  add('c1', clipDur('chamo_saludo') + 0.7); add('c2', clipDur('deivis_oro') + 0.7); add('c3', clipDur('deivis_agua') + 0.6); add('leave', 5);
  add('c4', clipDur('chamo_plan') + 0.7); add('c5', clipDur('catire_plan') + 1); add('brief', 8.5);
  CINE.total = t;
}
function setBino(on) { CINE.bino = on; $('bino').style.display = on ? 'block' : 'none'; if (!on) for (const k in STORY.tags) STORY.tags[k].style.display = 'none'; }

function startIntro() {
  G.state = 'intro'; introT = 0; CINE.cur = ''; CINE.shot = ''; CINE.flags = {};
  buildTimeline();
  document.body.classList.add('cine'); $('cine').style.display = 'block'; $('hud').style.display = 'none';
  guns.forEach(g => { g.visible = false; });
  CINE.eye.set(SPAWN.x, terrainH(SPAWN.x, SPAWN.z) + 1.7, SPAWN.z);
  for (const a of [STORY.chamo, STORY.catire]) { a.scripted = true; a.hasGun = false; a.mesh.userData.gun.visible = false; a.path = null; }
  STORY.deivis.mesh.visible = false; STORY.deivis.path = null;
  STORY.suv.visible = true; STORY.pickup.visible = true;
  placeVehicle(STORY.pickup, -150, PARK.pickup[1], 0, 0); placeVehicle(STORY.suv, -165, PARK.suv[1], 0, 0);
}
// Devuelve el mundo al estado de juego (fin o salto de la cinemática)
function endCinematic() {
  stopClips(); engine(0); setBino(false); cardTok++; $('card').textContent = '';
  for (const id of ['chamo', 'catire']) {
    const a = STORY[id]; if (!a) continue;
    a.scripted = false; a.hasGun = true; a.path = null;
    if (a.alive) { a.pos.set(POSTS[id][0], terrainH(POSTS[id][0], POSTS[id][1]), POSTS[id][1]); a.mesh.position.copy(a.pos); a.mesh.rotation.set(0, POSTS[id][2], 0); a.mesh.userData.gun.visible = true; }
  }
  if (STORY.deivis) STORY.deivis.mesh.visible = false;
  if (STORY.suv) STORY.suv.visible = false;
  if (STORY.pickup) placeVehicle(STORY.pickup, PARK.pickup[0], PARK.pickup[1], 0, 0);
}
function placeVehicle(v, x, z, rotY, dt) {
  const moved = Math.hypot(x - v.position.x, z - v.position.z);
  v.position.set(x, terrainH(x, z) + 0.02, z); v.rotation.y = rotY;
  if (dt > 0 && moved > 0.001) {
    for (const w of v.userData.wheels) w.rotation.z -= moved / 0.42;
    CINE.dustT -= dt;
    if (CINE.dustT <= 0 && moved / dt > 3) { CINE.dustT = 0.06;
      _v.set(x - Math.cos(rotY) * 2.6, v.position.y + 0.3, z + Math.sin(rotY) * 2.6);
      spawnParticle(_v, _v2.set((Math.random() - 0.5), 0.6 + Math.random(), (Math.random() - 0.5)), 2.2, 1.2, 0x9a8f7a, { grow: 1.8, opacity: 0.45 }); }
  }
  return dt > 0 ? moved / dt : 0;
}
// Mueve un actor por su lista de puntos; devuelve la velocidad actual
function stepActor(a, dt, spd) {
  if (!a.path || !a.path.length) return 0;
  const p = a.path[0], dx = p[0] - a.pos.x, dz = p[1] - a.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.25) { a.path.shift(); return a.path.length ? spd : 0; }
  a.pos.x += dx / d * spd * dt; a.pos.z += dz / d * spd * dt; a.pos.y = terrainH(a.pos.x, a.pos.z);
  let dy = Math.atan2(dx, dz) - a.mesh.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.mesh.rotation.y += dy * Math.min(1, dt * 6);
  return spd;
}
function faceActor(a, b, dt) {
  let dy = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z) - a.mesh.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  a.mesh.rotation.y += dy * Math.min(1, dt * 5);
}
// Gestos al hablar / escuchar
function talkPose(a, mode) {
  const u = a.mesh.userData, s = a.seed;
  if (mode === 'talk') {
    u.armR.rotation.x = -0.75 + Math.sin(T * 5.2 + s) * 0.32; u.foreR.rotation.x = -1.05 + Math.sin(T * 6.7 + s) * 0.35; u.armR.rotation.z = -0.15;
    u.armL.rotation.x = -0.25 + Math.sin(T * 3.1 + s) * 0.14; u.foreL.rotation.x = -0.7 + Math.cos(T * 4.3 + s) * 0.22;
    u.head.rotation.x = Math.sin(T * 7.5 + s) * 0.07; u.head.rotation.y = Math.sin(T * 2.1 + s) * 0.16; u.torso.rotation.x = 0.06 + Math.sin(T * 2.6 + s) * 0.03;
  } else if (mode === 'point') {
    u.armR.rotation.x = -1.35 + Math.sin(T * 8) * 0.08; u.foreR.rotation.x = -0.15; u.armL.rotation.x = 0.1; u.foreL.rotation.x = -0.4;
    u.head.rotation.x = Math.sin(T * 8.2) * 0.06; u.torso.rotation.x = 0.14;
  } else {                                                         // escucha: brazos cruzados, asiente
    u.armR.rotation.x = -0.5; u.foreR.rotation.x = -1.5; u.armR.rotation.z = -0.35; u.armL.rotation.x = -0.5; u.foreL.rotation.x = -1.5; u.armL.rotation.z = 0.35;
    u.head.rotation.x = Math.max(0, Math.sin(T * 1.7 + s)) * 0.1; u.head.rotation.y = Math.sin(T * 0.6 + s) * 0.2;
  }
}
function enterSeg(name) {
  const D = STORY.deivis;
  switch (name) {
    case 'fly1': typeCard('PÁRAMO DE SANTURBÁN\nSANTANDER, COLOMBIA\n05:47 · 3.800 m s. n. m.', 4);
      speak('narr', 'Páramo de Santurbán. Tres mil ochocientos metros de altura. De aquí baja el agua de más de dos millones de personas.', { interrupt: true }); break;
    case 'fly2': typeCard('MINERÍA ILEGAL DE ORO\nCIANURO DE SODIO + MERCURIO', 4);
      speak('narr', 'Una red ilegal saca oro con cianuro y mercurio. Lo que sobra, lo botan al río.'); break;
    case 'pov': typeCard('«CÓNDOR» · FUERZAS ESPECIALES\nPUESTO DE OBSERVACIÓN ALFA', 3);
      radio('Cóndor, aquí Halcón. Movimiento en la entrada oeste. Use los binoculares.'); break;
    case 'meet': D.mesh.visible = true; D.pos.set(PARK.suv[0] + 0.4, terrainH(PARK.suv[0], 49.3), 49.3); D.mesh.rotation.set(0, 0.6, 0); D.path = [[-14.9, 50.5]]; break;
    case 'c1': playClip('chamo_saludo', { far: true }); break;
    case 'c2': playClip('deivis_oro', { far: true }); break;
    case 'c3': playClip('deivis_agua', { far: true }); D.path = [[PARK.suv[0] + 0.4, 49.2]];
      STORY.catire.path = [[-12.5, 33], [-8.8, 36], [-9.4, 42.5], [-11.4, 52.0]]; break;
    case 'leave': D.mesh.visible = false; break;
    case 'c4': playClip('chamo_plan', { far: true }); break;
    case 'c5': playClip('catire_plan', { far: true }); break;
    case 'brief':
      radio('Ya los oyó, Cóndor. Deivis vuelve hoy por el oro, y su propia gente lo quiere tumbar. Aproveche esa grieta. Tiene luz verde.'); break;
  }
}
function updateIntro(dt) {
  introT += dt; const t = introT;
  if (t >= CINE.total) { beginGameplay(); return; }
  let s = CINE.segs[0]; for (const q of CINE.segs) if (t >= q.t) s = q;
  const k = clamp((t - s.t) / s.len, 0, 1), ease = x => x * x * (3 - 2 * x), by = CINE.by;
  if (s.name !== CINE.cur) { CINE.cur = s.name; enterSeg(s.name); }
  const ch = STORY.chamo, ca = STORY.catire, D = STORY.deivis, pk = STORY.pickup, sv = STORY.suv;

  // ---- Vehículos ----
  const A = by.arrive.t, Lv = by.leave.t;
  const v1 = placeVehicle(pk, lerp(-150, PARK.pickup[0], ease(clamp((t - A) / 6.5, 0, 1))), PARK.pickup[1], 0, dt);
  let v2;
  if (t < Lv) v2 = placeVehicle(sv, lerp(-165, PARK.suv[0], ease(clamp((t - A - 2.6) / 6.6, 0, 1))), PARK.suv[1], 0, dt);
  else { const q = clamp((t - Lv) / 5, 0, 1), turn = clamp(q * 3.4, 0, 1);
    v2 = placeVehicle(sv, PARK.suv[0] + Math.sin(turn * Math.PI) * 2.2 - ease(clamp((q - 0.22) / 0.78, 0, 1)) * 130, PARK.suv[1] + (1 - Math.cos(turn * Math.PI)) * 1.2, turn * Math.PI, dt); }
  const idle = t > A && t < Lv + 5 && sv.visible ? 0.1 : 0;
  engine(Math.max(idle, clamp(Math.max(v1, v2) / 24, 0, 0.75)));

  // ---- Actores ----
  if (t > A + 3 && !CINE.flags.chamoGo) { CINE.flags.chamoGo = true; ch.path = [[-9, 40], [-13, 51.2]]; }
  const sp = [stepActor(ch, dt, 2.5), stepActor(ca, dt, 2.9), D.mesh.visible ? stepActor(D, dt, 1.7) : 0];
  [ch, ca, D].forEach((a, i) => { if (a === D || a.alive) poseHumanoid(a, dt, sp[i] > 0, sp[i]); });
  const beforeLeave = t < Lv;
  if (!sp[0] && CINE.flags.chamoGo) { faceActor(ch, beforeLeave && D.mesh.visible ? D : ca, dt); talkPose(ch, s.name === 'c1' || s.name === 'c4' ? 'talk' : 'listen'); }
  if (!sp[1] && t > by.c4.t - 1) { faceActor(ca, ch, dt); talkPose(ca, s.name === 'c5' ? 'talk' : 'listen'); }
  if (D.mesh.visible) { if (!sp[2]) faceActor(D, ch, dt); if (s.name === 'c2') talkPose(D, k > 0.45 && k < 0.8 ? 'point' : 'talk'); else if (s.name === 'c3') talkPose(D, 'talk'); else if (s.name === 'c1') talkPose(D, 'listen'); }
  for (const a of [ch, ca, D]) a.mesh.position.copy(a.pos);

  // ---- Cámara ----
  const head = (a, o) => o.copy(a.pos).setY(a.pos.y + 1.55), mid = (a, b, o) => o.copy(a.pos).add(b.pos).multiplyScalar(0.5).setY(a.pos.y + 1.3);
  const tg = _v3; let fov = 60, shot = s.name, eyeSet = false;
  if (s.name === 'fly1') { camera.position.set(lerp(-112, -66, ease(k)), lerp(54, 37, ease(k)), lerp(86, 68, ease(k))); tg.set(-6, 2, 30); fov = 52; eyeSet = true; }
  else if (s.name === 'fly2') { const x = lerp(-11, 4.5, ease(k)); camera.position.set(x, terrainH(x, -6) + 2.9, -6.5); tg.set(-2, 0.7, 5); fov = 50; eyeSet = true; }
  else if (s.name === 'pov') { if (k < 0.55) { tg.set(-6, 2, 34); fov = 62; shot = 'pov-a'; } else { tg.set(-70, 1.5, 48); fov = 11; shot = 'pov-b'; } }
  else if (s.name === 'arrive') { if (t < A + 4.6) { tg.copy(pk.position).setY(pk.position.y + 1); shot = 'arr-a'; } else { tg.copy(sv.position).setY(sv.position.y + 1); shot = 'arr-b'; } fov = 8.5; }
  else if (s.name === 'meet') { head(D, tg); fov = 5.5; }
  else if (s.name === 'c1') { if (k < 0.5) { head(ch, tg); fov = 3.4; shot = 'c1-a'; } else { mid(ch, D, tg); fov = 5; shot = 'c1-b'; } }
  else if (s.name === 'c2') { if (k < 0.6) { head(D, tg); fov = 3.1; shot = 'c2-a'; } else { mid(ch, D, tg); fov = 5; shot = 'c2-b'; } }
  else if (s.name === 'c3') { head(D, tg); fov = 4.6; }
  else if (s.name === 'leave') { tg.copy(sv.position).setY(sv.position.y + 1); fov = 8.5; }
  else if (s.name === 'c4') {
    if (k < 0.27) { mid(ch, ca, tg); fov = 4.8; shot = 'c4-a'; }
    else if (k < 0.47) { tg.set(TABLE.x - 0.3, terrainH(TABLE.x, TABLE.z) + 1.1, TABLE.z); fov = 3.6; shot = 'c4-oro'; }
    else if (k < 0.62) { tg.copy(engineer.pos).setY(engineer.pos.y + 1.0); fov = 3.8; shot = 'c4-ing'; }
    else { head(ch, tg); fov = 3.2; shot = 'c4-d'; }
  }
  else if (s.name === 'c5') { if (k < 0.62) { head(ca, tg); fov = 3.2; shot = 'c5-a'; } else { mid(ch, ca, tg); fov = 4.8; shot = 'c5-b'; } }
  else { tg.set(-6, 2, 34); fov = 62; }
  const wantBino = t >= by.pov.t + by.pov.len * 0.55 && t < by.brief.t;
  if (wantBino !== CINE.bino) setBino(wantBino);
  if (shot !== CINE.shot) { CINE.shot = shot; CINE.tgt.copy(tg); CINE.fov = fov; }               // corte de plano
  else { CINE.tgt.lerp(tg, 1 - Math.exp(-dt * 4)); CINE.fov = lerp(CINE.fov, fov, Math.min(1, dt * 5)); }
  if (!eyeSet) camera.position.copy(CINE.eye);
  camera.lookAt(CINE.tgt);
  const shake = CINE.bino ? 0.0011 : 0.004;                                                      // pulso de quien sostiene los binoculares
  camera.rotation.x += Math.sin(T * 1.7) * shake + Math.sin(T * 4.1) * shake * 0.35; camera.rotation.y += Math.cos(T * 1.3) * shake;
  if (Math.abs(camera.fov - CINE.fov) > 0.01) { camera.fov = CINE.fov; camera.updateProjectionMatrix(); }

  // ---- Datos del visor y etiquetas de identificación ----
  if (CINE.bino) {
    const dist = camera.position.distanceTo(CINE.tgt);
    $('binoInfo').textContent = `${(75 / camera.fov).toFixed(0)}x · DIST ${dist.toFixed(0)} m · MIC DIRECCIONAL ${activeClips.length ? '▮▮▮▯' : '▯▯▯▯'}`;
    const show = { deivis: D.mesh.visible && t > by.meet.t + 1, chamo: t > by.c1.t + 0.5, catire: t > by.c4.t + 2 };
    const who = { deivis: D, chamo: ch, catire: ca };
    for (const id in STORY.tags) {
      const el = STORY.tags[id];
      if (!show[id]) { el.style.display = 'none'; continue; }
      _v.copy(who[id].pos).setY(who[id].pos.y + 2.0).project(camera);
      if (_v.z > 1 || Math.abs(_v.x) > 0.8 || Math.abs(_v.y) > 0.62) { el.style.display = 'none'; continue; }
      el.style.display = 'block'; el.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth).toFixed(0) + 'px'; el.style.top = ((-_v.y * 0.5 + 0.5) * window.innerHeight - 16).toFixed(0) + 'px';
    }
  }
}
function beginGameplay() {
  endCinematic();
  G.state = 'playing'; document.body.classList.remove('cine'); $('cine').style.display = 'none'; $('hud').style.display = 'block';
  camera.position.copy(player.pos); camera.rotation.set(-0.33, 0, 0); camera.fov = CFG.FOV; camera.updateProjectionMatrix();
  shutUp();
  guns.forEach((g, i) => { g.visible = i === player.weapon; });
  typeCard('OPERACIÓN SANTURBÁN\n«CERO TOLERANCIA»\nFASE 1 · INFILTRACIÓN', 3);
  showMessage('NEUTRALIZA A LOS 8 HOSTILES SIN SER DETECTADO', 5);
  radio('Cóndor, empiece por el vigía de la torre, al oeste. Si destruye la antena de radio, no podrán pedir refuerzos.', 1.2);
}
// Deivis vuelve con el convoy: su Toyota queda en la entrada del valle
const _spawnReinfBase = spawnReinforcements;
spawnReinforcements = function (withBoss) {
  _spawnReinfBase(withBoss);
  if (withBoss && STORY.suv) { STORY.suv.visible = true; placeVehicle(STORY.suv, -133, 25, 0.25, 0); }
};

/* ---------------- 3) Misión de química: pH del tanque 2 ---------------- */
const PH = { real: 8.4, shown: null, stale: false, mask: false, doses: 0, log: '', cls: '', solved: false, said: {}, closing: false };
const hcnFrac = pH => 1 / (1 + Math.pow(10, pH - 9.2));           // Henderson-Hasselbalch, pKa(HCN) = 9,2
const REAGENTS = {
  Digit1: { name: 'Cal hidratada, Ca(OH)₂', f: p => p + (12.4 - p) * 0.16, msg: 'Cal agregada. Se disuelve despacio: agita y mide.' },
  Digit2: { name: 'Soda cáustica, NaOH', f: p => p + (13.6 - p) * 0.4, msg: 'Soda agregada. Base fuerte: el pH salta rápido.' },
  Digit3: { name: 'Carbonato de sodio, Na₂CO₃', f: p => p + (10.7 - p) * 0.3, msg: 'Carbonato agregado. Amortigua, pero sube poco.' },
  Digit5: { name: 'Agua de proceso', f: p => p - (p - 7.5) * 0.06, msg: 'Agua agregada. Diluye y baja un poco el pH.' }
};
function phSay(key, text, emo) { if (PH.said[key]) return; PH.said[key] = 1; speak('eng', text, { emo: emo || 'firme' }); }
function freeEngineer() {
  engineer.seated = false; engineer.free = true; engineer.arrived = false;
  engineer.tx = SITES[0].x + 5.0; engineer.tz = SITES[0].z + 4.6;
  SFX.pickup();
  speak('eng', 'Gracias a Dios. Pensé que nadie vendría.', { emo: 'miedo' });
  speak('eng', 'Escúcheme, no se vaya. El tanque dos se está volviendo gas.', { emo: 'miedo' });
  speak('eng', 'Fue culpa de Arciniegas, el operador anterior. Nunca midió el pH.', { emo: 'urgente' });
  speak('eng', 'Venga conmigo a los tanques. Yo le voy diciendo qué hacer.', { emo: 'firme' });
  showMessage('DANIELA LIBERADA — SÍGUELA A LOS TANQUES DE CIANURO', 4.5);
}
function openPh() {
  G.state = 'ph'; mouseDown = false; for (const k in keys) keys[k] = false;
  setADS(false); $('prompt').style.display = 'none'; $('ph').style.display = 'flex';
  if (!PH.log) phLog('El tanque 2 burbujea. Hay un olor extraño en el aire.', '');
  renderPh();
  phSay('open', 'Primero, la mascarilla. Tecla P. Y póngase con el viento a la espalda.', 'urgente');
}
function closePh() {
  if (G.state !== 'ph') return;
  $('ph').style.display = 'none'; G.state = 'playing';
}
function phLog(text, cls) { PH.log = text; PH.cls = cls || ''; }
function phKey(code) {
  if (PH.closing) return;
  if (code === 'KeyF' || code === 'Space') { closePh(); return; }
  if (code === 'KeyP') {
    if (!PH.mask) { PH.mask = true; SFX.swap(); phLog('Mascarilla con filtro para gases ácidos puesta.', 'ok'); phSay('mask', 'Bien. Ahora mida el pH con el medidor. Tecla M.'); }
  } else if (code === 'KeyM') {
    PH.shown = Math.round(PH.real * 10) / 10; PH.stale = false; SFX.beep(1500);
    const p = PH.shown, pct = Math.round(hcnFrac(PH.real) * 100);
    if (p < 9.2) { phLog(`Lectura: pH ${p.toFixed(1)}. Cerca del ${pct} % del cianuro está como HCN gaseoso.`, 'bad');
      phSay('m1', 'Ocho coma cuatro. Por debajo de nueve coma dos, el cianuro se escapa como gas. Hay que subirlo con un reactivo alcalino.');
      phSay('m1b', 'Busque la cal hidratada, tecla uno. Y no toque el bidón rojo: es ácido.'); }
    else if (p < 10.5) { phLog(`Lectura: pH ${p.toFixed(1)}. Mejor, pero aún hay ${pct} % como HCN. Falta.`, ''); phSay('m2', 'Va subiendo. Siga de a poco, y mida cada vez.'); }
    else if (p <= 11.5) { phLog(`Lectura: pH ${p.toFixed(1)}. Dentro del rango de operación. Confirma con ENTER.`, 'ok'); phSay('m3', 'Eso es. Está en rango. Confirme con Enter.'); }
    else { phLog(`Lectura: pH ${p.toFixed(1)}. Te pasaste: desperdicias reactivo y el oro se disuelve peor.`, 'bad'); phSay('m4', 'Se pasó de once y medio. Agregue agua de proceso, tecla cinco, para bajarlo un poco.'); }
  } else if (REAGENTS[code]) {
    const r = REAGENTS[code]; PH.real = clamp(r.f(PH.real), 6, 13.6); PH.doses++; PH.stale = true; SFX.step(0.3, true);
    phLog(r.msg, '');
    if (code === 'Digit2') phSay('soda', 'Cuidado. La soda sube el pH muy rápido. Mida ya.', 'urgente');
    if (code === 'Digit3' && PH.real > 10.2) phSay('carb', 'El carbonato solo no alcanza. Con eso no llega a once.');
  } else if (code === 'Digit4') {                                  // el bidón rojo: ácido
    PH.real = Math.max(6, PH.real - 1.2); PH.doses++; PH.stale = true;
    player.health -= PH.mask ? 12 : 38; $('damage').style.opacity = 0.95; flashScreen(0.35); SFX.hurt(); SFX.spark();
    phLog('¡ÁCIDO! CN⁻ + H⁺ → HCN↑. Una nube de ácido cianhídrico sale del tanque.', 'bad');
    PH.said.acid = 0; phSay('acid', '¡No! ¡Eso es ácido! ¡Con ácido se libera todo el gas!', 'miedo');
    if (player.health <= 0) { player.health = 0; lose('Echaste ácido al tanque de cianuro: CN⁻ + H⁺ → HCN. El gas te mató en segundos.'); return; }
  } else if (code === 'Enter' || code === 'NumpadEnter') {
    if (PH.shown == null || PH.stale) phLog('Mide el pH [M] antes de confirmar: nunca se confirma a ojo.', 'bad');
    else if (PH.shown < 10.5 || PH.shown > 11.5) phLog('Fuera de rango. La meta es pH entre 10,5 y 11,5.', 'bad');
    else { phSolved(); return; }
  } else return;
  renderPh();
}
function phSolved() {
  PH.solved = true; PH.closing = true; SFX.pickup();
  const pct = (hcnFrac(PH.real) * 100).toFixed(1).replace('.', ',');
  phLog(`ESTABLE: pH ${PH.shown.toFixed(1)} con ${PH.doses} dosis. Solo ${pct} % queda como HCN. El resto sigue disuelto como CN⁻.`, 'ok');
  renderPh();
  if (STORY.gas) STORY.gas.active = false;
  speak('eng', 'Estable. A pH once, casi todo el cianuro queda disuelto, no en el aire. Así se opera bien.', { emo: 'firme' });
  speak('eng', 'Ahora sí. Me voy para la bengala verde. Gracias, Cóndor.', { emo: 'firme' });
  after(3.2, () => {
    PH.closing = false; $('ph').style.display = 'none'; G.state = 'playing';
    const it = G.inter.find(i => i.id === 'ph'); it.done = true;
    engineer.tx = EXTRACT.x - 2.5; engineer.tz = EXTRACT.z + 1.5; engineer.arrived = false;
    showMessage('TANQUE ESTABILIZADO — DANIELA VA HACIA LA EXTRACCIÓN', 3.5);
    renderObjectives(); checkPhase2();
  });
}
function renderPh() {
  const p = PH.shown, pos = v => clamp((v - 6) / 8 * 100, 0, 100);
  const cls = p == null ? '' : (p < 9.2 ? 'bad' : (p < 10.5 || p > 11.5 ? 'warn' : ''));
  const pct = p == null ? null : Math.round(hcnFrac(p) * 100);
  $('phBox').innerHTML =
    `<h2>TANQUE 2 DE LIXIVIACIÓN · CONTROL DE pH</h2><div class="row">` +
    `<div class="meter"><div style="color:#9fd8b5;letter-spacing:2px;font-size:11px">MEDIDOR DE CAMPO</div>` +
    `<div class="big ${cls}">${p == null ? '--,-' : p.toFixed(1).replace('.', ',')}</div>` +
    `<div style="font-size:11px;color:${PH.stale ? '#ffc94d' : '#8fa39c'}">${p == null ? 'sin lectura · pulsa [M]' : (PH.stale ? 'LECTURA VIEJA · vuelve a medir [M]' : 'lectura actual')}</div>` +
    `<div class="scale"><u style="left:${pos(10.5)}%;width:${pos(11.5) - pos(10.5)}%"></u>${p == null ? '' : `<i style="left:${pos(p)}%"></i>`}</div>` +
    `<div style="display:flex;justify-content:space-between;font-size:10px;color:#8fa39c"><span>6</span><span>9,2</span><span>meta</span><span>14</span></div>` +
    `<div style="margin-top:10px;font-size:11px;letter-spacing:1px">CIANURO COMO HCN (GAS): ${pct == null ? '?' : pct + ' %'}</div><div class="gbar"><div style="width:${pct == null ? 0 : pct}%"></div></div>` +
    `<div style="margin-top:8px;font-size:11px;color:${PH.mask ? '#7dffa0' : '#ff7a6b'}">MASCARILLA: ${PH.mask ? 'PUESTA' : 'SIN PROTECCIÓN'}</div>` +
    `<div style="font-size:11px;color:#8fa39c">Tanque: 12 m³ · NaCN 0,05 % · dosis: ${PH.doses}</div></div>` +
    `<div style="flex:1"><table><tr><th>Tecla</th><th>Acción</th><th>Qué es</th></tr>` +
    `<tr><td><b class="k">[P]</b></td><td>Ponerse la mascarilla</td><td>Filtro para gases ácidos</td></tr>` +
    `<tr><td><b class="k">[M]</b></td><td>Medir el pH</td><td>La lectura no cambia sola: hay que medir</td></tr>` +
    `<tr><td><b class="k">[1]</b></td><td>Cal hidratada · Ca(OH)₂</td><td>Base barata; se satura cerca de pH 12,4</td></tr>` +
    `<tr><td><b class="k">[2]</b></td><td>Soda cáustica · NaOH</td><td>Base fuerte; sube muy rápido</td></tr>` +
    `<tr><td><b class="k">[3]</b></td><td>Carbonato de sodio · Na₂CO₃</td><td>Base débil; amortigua cerca de pH 10,3</td></tr>` +
    `<tr><td><b class="k">[4]</b></td><td>Bidón rojo · HCl</td><td>?</td></tr>` +
    `<tr><td><b class="k">[5]</b></td><td>Agua de proceso</td><td>Diluye</td></tr>` +
    `<tr><td><b class="k">[ENTER]</b></td><td>Confirmar pH estable</td><td>Meta: 10,5 – 11,5</td></tr>` +
    `<tr><td><b class="k">[F]</b></td><td>Salir del panel</td><td></td></tr></table>` +
    `<div class="eq"><span style="color:#9fd8b5;font-size:11px;letter-spacing:1px">EQUILIBRIO · pKa = 9,2</span><br>HCN ⇌ H⁺ + CN⁻ &nbsp;&nbsp;·&nbsp;&nbsp; % HCN = 100 / (1 + 10^(pH − 9,2))</div>` +
    `<div class="log"><span class="${PH.cls}">${PH.log}</span></div></div></div>`;
}
function updatePh(dt) {
  // Sin mascarilla y con gas en el aire, la salud baja
  const f = hcnFrac(PH.real);
  if (!PH.mask && f > 0.15 && !PH.solved) {
    player.health -= 3.5 * f * dt; $('damage').style.opacity = 0.35 + Math.sin(T * 5) * 0.12;
    if (player.health <= 0) { player.health = 0; lose('Respiraste ácido cianhídrico sin mascarilla junto al tanque. El HCN bloquea la respiración celular.'); }
  }
  const dmg = $('damage'); if (PH.mask && dmg.style.opacity > 0) dmg.style.opacity = Math.max(0, dmg.style.opacity - dt);
}
function resetStory() {
  Object.assign(PH, { real: 8.4, shown: null, stale: false, mask: false, doses: 0, log: '', cls: '', solved: false, said: {}, closing: false });
  $('ph').style.display = 'none';
  const s = SITES[0];
  STORY.gas = { pos: new THREE.Vector3(s.x + 1.7, terrainH(s.x, s.z) + 4.1, s.z), color: 0xc9e05a, rate: 5, acc: 0, size: 1.3, active: true, rise: 0.9, temp: true };
  emitters.push(STORY.gas);
  endCinematic();
  $('nav').style.display = 'none';
}
const _resetMissionBase = resetMission;
resetMission = function () { _resetMissionBase(); resetStory(); };
const _showEndBase = showEnd;
showEnd = function (won, title, text) { stopClips(); engine(0); $('nav').style.display = 'none'; _showEndBase(won, title, text); };

/* ---------------- 4) Guía de navegación ---------------- */
let navT = 0;
function nextTarget() {
  if (G.detonated || G.missionOver) return null;
  if (G.c4Count >= 3) return { x: EXTRACT.x, z: EXTRACT.z, label: 'CORRE AL HAZ VERDE Y PULSA [G]', ext: true };
  if (G.phase === 1) {
    let best = null, bd = 1e9, n = 0;
    for (const e of enemies) if (e.alive && e.required) { n++; const d = e.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = e; } }
    return best ? { x: best.pos.x, z: best.pos.z, label: `HOSTILES RESTANTES: ${n}` } : null;
  }
  if (done('eng') && !done('ph')) { const it = G.inter.find(i => i.id === 'ph'); return { x: it.x, z: it.z, label: it.nav }; }
  let best = null, bd = 1e9;
  for (const it of G.inter) if (!it.done && it.req && G.phase >= it.phase && (!it.need || it.need())) {
    const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z); if (d < bd) { bd = d; best = it; } }
  return best ? { x: best.x, z: best.z, label: best.nav || best.wp } : null;
}
function updateNav(dt) {
  navT -= dt; if (navT > 0) return; navT = 0.08;
  const t = nextTarget(), el = $('nav');
  if (!t) { el.style.display = 'none'; return; }
  const dx = t.x - player.pos.x, dz = t.z - player.pos.z, yaw = camera.rotation.y;
  const fwd = -dx * Math.sin(yaw) - dz * Math.cos(yaw), right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  el.style.display = 'block'; el.className = t.ext ? 'ext' : '';
  $('navArrow').style.transform = `rotate(${Math.atan2(right, fwd).toFixed(2)}rad)`;
  $('navTxt').textContent = `${t.label} · ${Math.hypot(dx, dz).toFixed(0)} m`;
}
