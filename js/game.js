'use strict';
/* =====================================================================
   OPERACIÓN SANTURBÁN: CERO TOLERANCIA  — v2
   FPS 3D en un solo archivo. Three.js r147 + Web Audio + Web Speech.
   1) Config  2) Terreno  3) Audio y voces  4) Render  5) Mundo
   6) Partículas  7) Personajes  8) Armas  9) Misión/trama  10) Jugador
   11) HUD/inteligencia  12) Intro  13) Bucle principal
   ===================================================================== */

if (typeof THREE === 'undefined' || !THREE.PointerLockControls) {
  document.getElementById('loadError').style.display = 'block';
  document.getElementById('startBtn').disabled = true;
  throw new Error('Three.js no disponible');
}

/* ============================ 1) CONFIG ============================ */
const CFG = { FOV: 75, WALK: 4.6, RUN: 7.8, GRAVITY: 9.8, C4_TIME: 30, FOG: 0.0075, WATER_Y: -0.55 };
const STANCES = {
  stand:  { eye: 1.7,  speed: 1,    det: 1,    sway: 1,    name: 'DE PIE' },
  crouch: { eye: 1.12, speed: 0.55, det: 0.6,  sway: 0.6,  name: 'AGACHADO' },
  prone:  { eye: 0.42, speed: 0.22, det: 0.35, sway: 0.28, name: 'CUERPO A TIERRA' }
};
const WEAPONS = [
  { id: 'sniper', name: 'M24 SWS · SUPRESOR · 4x–8x', mag: 5, reserve: 30, cd: 1.25, reload: 2.7, speed: 240, body: 150, head: 500,
    zoom: [4, 8], scope: true, auto: false, spread: 0.035, ads: 0, recoil: 0.04 },
  { id: 'rifle', name: 'GALIL ACE 23 · SUPRESOR · HOLO', mag: 30, reserve: 120, cd: 0.095, reload: 2.2, speed: 210, body: 40, head: 130,
    zoom: [1.6], scope: false, auto: true, spread: 0.035, ads: 0.004, recoil: 0.011 },
  { id: 'pistol', name: 'PISTOLA CÓRDOVA 9 mm · SUPRESOR', mag: 15, reserve: 45, cd: 0.17, reload: 1.5, speed: 160, body: 34, head: 110,
    zoom: [1.25], scope: false, auto: false, spread: 0.02, ads: 0.006, recoil: 0.016 }
];
const KIT_NAMES = { sniper: 'Tirador de precisión', assault: 'Asalto', recon: 'Reconocimiento' };
const HILL = { x: 0, z: 118 }, SPAWN = { x: 0, z: 114 }, EXTRACT = { x: 9, z: 111 };
const TABLE = { x: 4, z: 26 }, LAB = { x: 11, z: 33.5 }, ENG = { x: -14, z: 29.5 };
const TOWER = { x: -36, z: 42, h: 5.2 }, ANT = { x: 31, z: 44 };
const SITES = [
  { id: 'c4a', name: 'Tanques de cianuro', x: -26, z: 12 },
  { id: 'c4b', name: 'Molino de trituración', x: 22, z: 30 },
  { id: 'c4c', name: 'Entrada del socavón', x: 60, z: 32 }
];
const BOUNDS = { minX: -170, maxX: 170, minZ: -55, maxZ: 170 };

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rng = mulberry32(3800);
let T = 0;                                  // reloj de mundo (animaciones ambientales)

/* ============================ 2) TERRENO ============================ */
function riverZ(x) { return 7 * Math.sin(x * 0.028); }
function terrainH(x, z) {
  const dv = Math.max(0, Math.abs(z - 22) - 42);
  let h = 0.0042 * dv * dv;
  const dx = x - HILL.x, dz = z - HILL.z;
  h += 26 * Math.exp(-(dx * dx + dz * dz) / 1764);
  const de = Math.max(0, x - 58);
  h += 0.022 * de * de * clamp((z - 10) / 12, 0, 1);
  const amp = 0.15 + Math.min(1, dv / 50) * 1.1;
  h += amp * (Math.sin(x * 0.13) * Math.cos(z * 0.11) + 0.45 * Math.sin(x * 0.31 + z * 0.27));
  const dr = z - riverZ(x);
  h -= 1.7 * Math.exp(-(dr * dr) / 22);
  return Math.min(h, 90);
}
function hasLOS(a, b) {
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    if (terrainH(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) > a.y + (b.y - a.y) * t + 0.15) return false;
  }
  return true;
}

function onRoad(x, z) { return x < -13 && x > -180 && Math.abs(z - 48) < 4.2; }
// Corredor de vision desde el puesto de observacion hacia el campamento
function inView(x, z) { const d = 114 - z; return d > 1 && d < 46 && x > -d * 0.5 - 2.5 && x < d * 0.12 + 2.5; }

/* ============================ 3) AUDIO PROCEDURAL Y VOCES ============================ */
let AC = null, master = null, noiseBuf = null, alarmNodes = null, riverGain = null, droneGain = null;

function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  master = AC.createGain(); master.gain.value = 0.7; master.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
}
function noiseBurst(o) {
  if (!AC) return;
  const t = AC.currentTime + (o.delay || 0);
  const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = AC.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.7;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random()); src.stop(t + o.dur + 0.05);
}
function tone(o) {
  if (!AC) return;
  const t = AC.currentTime + (o.delay || 0);
  const osc = AC.createOscillator(); osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + o.dur + 0.05);
}
const SFX = {
  shot(id) {
    if (id === 'sniper') {
      noiseBurst({ freq: 2200, freqEnd: 350, dur: 0.26, vol: 0.7, type: 'bandpass', q: 0.7 });
      tone({ type: 'triangle', f0: 150, f1: 45, dur: 0.16, vol: 0.5 });
      noiseBurst({ freq: 900, freqEnd: 200, dur: 0.7, vol: 0.12, delay: 0.08 });                       // eco en el valle
      noiseBurst({ freq: 4500, dur: 0.05, vol: 0.14, type: 'highpass', delay: 0.42 });                 // cerrojo atrás
      noiseBurst({ freq: 3800, dur: 0.06, vol: 0.16, type: 'highpass', delay: 0.72 });                 // cerrojo adelante
    } else if (id === 'rifle') {
      noiseBurst({ freq: 3000, freqEnd: 600, dur: 0.11, vol: 0.42, type: 'bandpass', q: 0.9 });
      tone({ type: 'triangle', f0: 190, f1: 70, dur: 0.07, vol: 0.28 });
      noiseBurst({ freq: 6000, dur: 0.03, vol: 0.1, type: 'highpass', delay: 0.04 });
    } else {
      noiseBurst({ freq: 3400, freqEnd: 800, dur: 0.09, vol: 0.34, type: 'bandpass', q: 1 });
      tone({ type: 'triangle', f0: 240, f1: 90, dur: 0.06, vol: 0.22 });
    }
  },
  enemyShot(dist) {
    const v = clamp(1.2 - dist / 140, 0.12, 0.9);
    noiseBurst({ freq: 3500, freqEnd: 300, dur: 0.26, vol: 0.7 * v });
    tone({ type: 'square', f0: 220, f1: 50, dur: 0.1, vol: 0.22 * v });
  },
  whiz() { noiseBurst({ freq: 5000, freqEnd: 1500, dur: 0.12, vol: 0.2, type: 'bandpass', q: 6 }); },
  dry() { tone({ type: 'square', f0: 900, dur: 0.03, vol: 0.12 }); },
  reload(t) {
    noiseBurst({ freq: 3000, dur: 0.05, vol: 0.2, type: 'highpass' });
    tone({ type: 'square', f0: 320, dur: 0.04, vol: 0.12, delay: t * 0.3 });
    noiseBurst({ freq: 2200, dur: 0.07, vol: 0.28, type: 'bandpass', delay: t * 0.82 });
    tone({ type: 'square', f0: 480, dur: 0.05, vol: 0.14, delay: t * 0.88 });
  },
  swap() { noiseBurst({ freq: 1800, dur: 0.09, vol: 0.14, type: 'bandpass' }); noiseBurst({ freq: 3200, dur: 0.04, vol: 0.12, type: 'highpass', delay: 0.2 }); },
  step(v, wet) { noiseBurst({ freq: wet ? 1400 : 420, freqEnd: wet ? 500 : 160, dur: wet ? 0.16 : 0.09, vol: v, type: wet ? 'bandpass' : 'lowpass' }); },
  land() { noiseBurst({ freq: 300, freqEnd: 90, dur: 0.16, vol: 0.4 }); },
  hit() { tone({ type: 'sine', f0: 1500, f1: 900, dur: 0.07, vol: 0.2 }); },
  hurt() { noiseBurst({ freq: 500, dur: 0.18, vol: 0.5 }); tone({ type: 'sawtooth', f0: 140, f1: 70, dur: 0.22, vol: 0.22 }); },
  heartbeat() { tone({ f0: 62, f1: 38, dur: 0.14, vol: 0.75 }); tone({ f0: 55, f1: 34, dur: 0.16, vol: 0.55, delay: 0.19 }); },
  beep(f) { tone({ type: 'square', f0: f || 1300, dur: 0.09, vol: 0.14 }); },
  pickup() { [660, 880, 1320].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.2, delay: i * 0.09 })); },
  camera() { noiseBurst({ freq: 5000, dur: 0.04, vol: 0.25, type: 'highpass' }); noiseBurst({ freq: 3000, dur: 0.06, vol: 0.2, type: 'highpass', delay: 0.09 }); },
  heal() { noiseBurst({ freq: 2500, dur: 0.3, vol: 0.12, type: 'bandpass' }); tone({ f0: 520, f1: 780, dur: 0.4, vol: 0.12, delay: 2.2 }); },
  radio() {                                     // "squelch" de radio táctico
    tone({ type: 'square', f0: 1750, dur: 0.05, vol: 0.09 });
    noiseBurst({ freq: 2600, dur: 0.16, vol: 0.14, type: 'bandpass', q: 2, delay: 0.05 });
  },
  radioEnd() { noiseBurst({ freq: 2400, dur: 0.1, vol: 0.12, type: 'bandpass', q: 2 }); tone({ type: 'square', f0: 1300, dur: 0.04, vol: 0.07, delay: 0.1 }); },
  shout(dist) {                                 // grito sintético (formantes) por si no hay voz TTS
    const v = clamp(1.1 - dist / 130, 0.1, 0.6);
    if (!AC) return;
    const t = AC.currentTime, osc = AC.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, t); osc.frequency.linearRampToValueAtTime(260, t + 0.12); osc.frequency.linearRampToValueAtTime(170, t + 0.42);
    const f1 = AC.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 780; f1.Q.value = 5;
    const f2 = AC.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1250; f2.Q.value = 6;
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(f1); osc.connect(f2); f1.connect(g); f2.connect(g); g.connect(master); osc.start(t); osc.stop(t + 0.5);
  },
  alert() { tone({ type: 'sawtooth', f0: 300, f1: 620, dur: 0.5, vol: 0.2 }); },
  spark() { noiseBurst({ freq: 7000, dur: 0.25, vol: 0.35, type: 'highpass' }); tone({ type: 'sawtooth', f0: 2200, f1: 200, dur: 0.3, vol: 0.2 }); },
  explosion(delay) {
    noiseBurst({ freq: 2400, freqEnd: 40, dur: 3.2, vol: 1.6, delay });
    noiseBurst({ freq: 6000, freqEnd: 300, dur: 0.5, vol: 0.8, type: 'bandpass', delay });
    tone({ f0: 95, f1: 22, dur: 2.4, vol: 1.3, delay });
  },
  victory() { [392, 523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.6, vol: 0.22, delay: i * 0.18 })); }
};
// Ambiente: viento con ráfagas, murmullo del río (según distancia) y dron de tensión
function startAmbience() {
  const mk = (type, freq, q, gain) => {
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = AC.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master); src.start(0, Math.random());
    return { f, g };
  };
  const wind = mk('bandpass', 420, 0.5, 0.1);
  const lfo = AC.createOscillator(); lfo.frequency.value = 0.13; const lg = AC.createGain(); lg.gain.value = 0.07;
  const lfo2 = AC.createOscillator(); lfo2.frequency.value = 0.07; const lg2 = AC.createGain(); lg2.gain.value = 180;
  lfo.connect(lg); lg.connect(wind.g.gain); lfo2.connect(lg2); lg2.connect(wind.f.frequency); lfo.start(); lfo2.start();
  riverGain = mk('highpass', 1800, 0.4, 0).g;
  const o1 = AC.createOscillator(), o2 = AC.createOscillator(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.6;
  const df = AC.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 160;
  droneGain = AC.createGain(); droneGain.gain.value = 0.03;
  o1.connect(df); o2.connect(df); df.connect(droneGain); droneGain.connect(master); o1.start(); o2.start();
}
function startAlarm() {
  if (!AC || alarmNodes) return;
  const osc = AC.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 720;
  const lfo = AC.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 2.2;
  const lg = AC.createGain(); lg.gain.value = 190;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
  const g = AC.createGain(); g.gain.value = 0.07;
  lfo.connect(lg); lg.connect(osc.frequency); osc.connect(f); f.connect(g); g.connect(master);
  osc.start(); lfo.start(); alarmNodes = { osc, lfo, g };
}
function stopAlarm() {
  if (!alarmNodes) return;
  try { alarmNodes.osc.stop(); alarmNodes.lfo.stop(); } catch (e) { /* ya detenida */ }
  alarmNodes.g.disconnect(); alarmNodes = null;
}

/* ---- Voces (Web Speech API) + subtítulos ---- */
const VO = { ok: 'speechSynthesis' in window, voices: [], cache: {} };
const ROLES = {
  //         idiomas preferidos (en orden)                              nombres preferidos                      tono  vel.
  enemy: { langs: ['es-VE', 'es-DO', 'es-PR', 'es-CU', 'es-PA', 'es-CO', 'es-MX', 'es-US', 'es'], names: /sebasti|male|hombre|jorge|gonzalo|pablo|raul|alvaro|diego|carlos|emilio/i, pitch: 0.75, rate: 1.18, tag: 'HOSTIL', cls: 'enemy' },
  radio: { langs: ['es-CO', 'es-MX', 'es-US', 'es-419', 'es'], names: /gonzalo|jorge|raul|pablo|alvaro|male|diego|carlos/i, pitch: 0.9, rate: 1.08, tag: 'HALCÓN', cls: 'radio' },
  narr:  { langs: ['es-CO', 'es-MX', 'es-US', 'es-419', 'es'], names: /salome|dalia|sabina|paulina|helena|laura|elvira|female|google/i, pitch: 1.0, rate: 0.98, tag: '', cls: 'narr' },
  eng:   { langs: ['es-CO', 'es-MX', 'es-US', 'es'], names: /salome|dalia|sabina|paulina|helena|laura|elvira|female|google/i, pitch: 1.2, rate: 1.05, tag: 'ING. DANIELA', cls: 'eng' }
};
function loadVoices() {
  if (!VO.ok) return;
  VO.voices = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
  VO.cache = {};
}
if (VO.ok) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice(role) {
  if (role in VO.cache) return VO.cache[role];
  const R = ROLES[role]; let best = null;
  for (const lang of R.langs) {
    const c = VO.voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase()));
    if (c.length) { best = c.find(v => R.names.test(v.name)) || c[0]; break; }
  }
  return (VO.cache[role] = best);
}
let subT = 0;
function subtitle(role, text, tag) {
  const R = ROLES[role], s = $('subs'), label = tag || R.tag;
  s.className = R.cls;
  s.innerHTML = (label ? `<b>${label}:</b>` : '') + text;
  s.style.opacity = 1; subT = 1.8 + text.length * 0.065;
}
// Habla una línea con la voz del rol; siempre muestra el subtítulo
function speak(role, text, o) {
  o = o || {};
  subtitle(role, text, o.tag);
  if (!VO.ok) return;
  try {
    if (o.interrupt) speechSynthesis.cancel();
    else if (role === 'enemy' && (speechSynthesis.pending)) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[¡!]/g, m => m === '¡' ? '' : '!'));
    const R = ROLES[role], v = pickVoice(role);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = R.langs[0];
    u.pitch = R.pitch; u.rate = R.rate; u.volume = o.vol == null ? 1 : o.vol;
    speechSynthesis.speak(u);
  } catch (e) { /* sin voz: queda el subtítulo */ }
}
function radio(text, delay) {
  setTimeout(() => {
    if (G.state !== 'playing' && G.state !== 'intro') return;
    SFX.radio(); setTimeout(() => speak('radio', text), 230);
    setTimeout(() => SFX.radioEnd(), 1500 + text.length * 62);
  }, (delay || 0) * 1000);
}
function shutUp() { if (VO.ok) try { speechSynthesis.cancel(); } catch (e) { /* nada */ } }

// Frases de los hostiles (acento venezolano si el navegador tiene voz es-VE)
const BARKS = {
  alert: ['¡Ey, tú, coño de la madre! ¿Qué haces ahí, mardito?', '¡Epa! ¡Coño de la madre, nos cayó el ejército! ¡Plomo, plomo!', '¡Verga, chamo, hay un francotirador en el cerro!'],
  combat: ['¡Plomo con ese carajo, nojoda!', '¡No lo dejen escapar, mardita sea!', '¡Chamo, por allá va, dale, dale!', '¡Sal de ahí, mardito, que te vi!', '¡Cuidao con la cabeza, pana, que ese no falla!', '¡Coño, cúbranme, que voy a recargar!', '¡Te vas a morir de frío aquí arriba, sapo!'],
  death: ['¡Ay, coño, me dieron!', '¡Mardición!', '¡Verga, chamo...!'],
  idle: ['Chamo, este frío está arrecho, vale.', 'Apúrate con ese cianuro, que Deivis sube hoy.', 'Échale más mercurio a esa vaina, pues.', 'Qué ladilla este páramo, pana. Puro frailejón.', 'Mira, y ¿a la ingeniera ya le dieron comida?'],
  reinf: ['¡Llegó Deivis, mardito! ¡Ahora sí te jodiste!', '¡Rodéenlo, que no llegue al cerro!']
};
let barkCd = 0;
function bark(kind, e, force) {
  if (!force && barkCd > 0) return;
  const list = BARKS[kind], line = list[Math.floor(Math.random() * list.length)];
  const dist = e ? e.pos.distanceTo(player.pos) : 30;
  if (kind !== 'idle') SFX.shout(dist);
  speak('enemy', line, { interrupt: kind === 'alert', vol: clamp(1.25 - dist / 130, 0.35, 1), tag: e && e.kind === 'op' ? 'MINERO' : (e && e.kind === 'boss' ? 'DEIVIS' : 'GUARDIA') });
  barkCd = kind === 'idle' ? 14 : 6;
}

/* ============================ 4) RENDER ============================ */
THREE.ColorManagement.legacyMode = false;                 // flujo de color lineal correcto
const FOG_COLOR = 0x93a1ab;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(FOG_COLOR);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_COLOR, CFG.FOG);
const camera = new THREE.PerspectiveCamera(CFG.FOV, window.innerWidth / window.innerHeight, 0.06, 900);
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xc4d8ea, 0x5d5848, 0.85));
const sun = new THREE.DirectionalLight(0xfff0d6, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 420 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(-90, 150, 60);

const controls = new THREE.PointerLockControls(camera, document.body);
function lockPointer() {
  try { const p = document.body.requestPointerLock(); if (p && p.catch) p.catch(() => showMessage('NO SE PUDO CAPTURAR EL RATÓN — HAZ CLIC DE NUEVO', 3)); }
  catch (e) { /* navegador sin Pointer Lock */ }
}

function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}
const softTex = canvasTex(64, (g) => {
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
});
const waterTex = canvasTex(128, (g) => {
  g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 110; i++) { const v = 150 + Math.floor(rng() * 105);
    g.fillStyle = `rgba(${v},${v},${v},${0.25 + rng() * 0.4})`; g.fillRect(rng() * 128, rng() * 128, 12 + rng() * 40, 1 + rng() * 2.5); }
}, true);
const groundTex = canvasTex(256, (g, s) => {             // grano de suelo: tierra, gravilla y líquenes
  g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5200; i++) { const v = 150 + Math.floor(rng() * 105), r = rng() * 2.2;
    g.fillStyle = `rgba(${v},${v - rng() * 14},${v - rng() * 26},${0.3 + rng() * 0.5})`; g.fillRect(rng() * s, rng() * s, r, r); }
  for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(${90 + rng() * 60},${95 + rng() * 60},${80 + rng() * 40},.22)`;
    g.beginPath(); g.arc(rng() * s, rng() * s, 4 + rng() * 14, 0, 6.3); g.fill(); }
}, true);
groundTex.repeat.set(90, 90);
const grassTex = canvasTex(64, (g) => {
  for (let i = 0; i < 13; i++) { const x = 4 + rng() * 56, tip = 4 + rng() * 30, lean = (rng() - 0.5) * 16, v = 190 + rng() * 65;
    g.fillStyle = `rgb(${v},${v},${v * 0.85})`; g.beginPath(); g.moveTo(x - 2.2, 64); g.lineTo(x + 2.2, 64); g.lineTo(x + lean, tip); g.fill(); }
});

/* ============================ 5) MUNDO ESTÁTICO ============================ */
const colliders = [];                 // {x,z,r,y,h}: bloquean al jugador y a las balas
const siteGroups = {};
let millDrum = null, millDrum2 = null, goldGroup = null, flareGroup = null, flareLight = null, antennaGroup = null, skyDome = null;
const toxicPatches = [];
const particles = [], debris = [], emitters = [], tracers = [], flashes = [], rings = [];
let flareEmitter = null;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

const matCache = {};
const M = (color, extra) => {
  const key = color + JSON.stringify(extra || 0);
  return matCache[key] || (matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0 }, extra || {})));
};
const MB = (color, extra) => new THREE.MeshBasicMaterial(Object.assign({ color }, extra || {}));
function addAt(mesh, x, y, z, parent) { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; (parent || scene).add(mesh); return mesh; }
function addCol(x, z, r, h) { colliders.push({ x, z, r, y: terrainH(x, z), h: h || 2 }); }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 10);

function buildSky() {
  const g = new THREE.SphereGeometry(700, 24, 14), p = g.attributes.position, col = new Float32Array(p.count * 3);
  const top = new THREE.Color(0x6f8aa6), hor = new THREE.Color(FOG_COLOR), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 700, 0, 1); c.copy(hor).lerp(top, Math.pow(t, 0.7)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  skyDome = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(skyDome);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xfff2d8, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
  glow.scale.setScalar(260); glow.position.copy(SUN_OFF).normalize().multiplyScalar(600); skyDome.add(glow);
}

function buildTerrain() {
  const SIZE = 480, SEG = 200, CZ = 50;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color(), c2 = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i) + CZ, h = terrainH(x, z);
    pos.setY(i, h); pos.setZ(i, z);
    const dr = Math.abs(z - riverZ(x));
    const slope = Math.abs(terrainH(x + 1.5, z) - h) + Math.abs(terrainH(x, z + 1.5) - h);
    c.setHex(h > 62 ? 0xb9bfc4 : (h > 9 ? 0x6a6d4b : 0x77744a));                       // escarcha / pajonal
    c.lerp(c2.setHex(0x6d6c69), clamp((slope - 0.75) * 1.6, 0, 1));                    // roca en pendientes
    if (x > -42 && x < 42 && z > 8 && z < 52) c.lerp(c2.setHex(0x5a4f3d), 0.75);       // suelo pisado
    if (dr < 9) c.lerp(c2.setHex(0x40392d), clamp((9 - dr) / 3.5, 0, 1));
    if (onRoad(x, z)) c.lerp(c2.setHex(0x54493a), 0.85);              // barro del cauce
    const patch = 0.86 + 0.14 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) + (rng() - 0.5) * 0.12;
    colors[i * 3] = c.r * patch; colors[i * 3 + 1] = c.g * patch; colors[i * 3 + 2] = c.b * patch;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTex, bumpMap: groundTex, bumpScale: 0.06, roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true; scene.add(mesh);
}

function buildRiver() {
  const pts = [], uvs = [], cols = [], idx = [];
  const clean = new THREE.Color(0x3d5a66), toxic = new THREE.Color(0x6fae35), silver = new THREE.Color(0x9fbfae), c = new THREE.Color();
  let n = 0;
  for (let x = -240; x <= 240; x += 3) {
    const zc = riverZ(x), t = clamp((x + 18) / 22, 0, 1);
    c.copy(clean).lerp(toxic, t); if (t > 0) c.lerp(silver, 0.25 + 0.25 * Math.sin(x * 0.4));
    for (const s of [-1, 1]) { pts.push(x, CFG.WATER_Y, zc + s * 6.5); uvs.push(x / 22, s > 0 ? 1 : 0); cols.push(c.r, c.g, c.b); }
    if (n > 0) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    n++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: waterTex, vertexColors: true, transparent: true, opacity: 0.88, roughness: 0.12, metalness: 0.35, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m);
}

function buildVegetation() {
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const inCamp = (x, z) => x > -42 && x < 42 && z > 6 && z < 52;
  const freeSpot = (x, z) => !onRoad(x, z) && !inView(x, z) && Math.abs(z - riverZ(x)) > 8 && !inCamp(x, z) && Math.hypot(x - 61, z - 32) > 9 && Math.hypot(x - SPAWN.x, z - SPAWN.z) > 2.5;
  const inst = (geo, mat, n, shadow) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = !!shadow; m.receiveShadow = true; scene.add(m); return m; };
  const put = (m, i, x, y, z, sx, sy, sz, ry, rx) => { dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx || 0, ry || 0, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); };

  // --- Frailejones (Espeletia): tronco con hojas secas, roseta plateada y flores ---
  const N = 760;
  const trunks = inst(cyl(0.13, 0.2, 1, 7), M(0x4b3b29), N, true);
  const skirts = inst(cyl(0.2, 0.3, 1, 7), M(0x6e5f45), N, true);
  const cg = new THREE.SphereGeometry(0.52, 12, 8); cg.scale(1, 0.5, 1);
  const crowns = inst(cg, M(0xaebfa0, { }), N, true);
  const cg2 = new THREE.ConeGeometry(0.36, 0.7, 12); cg2.rotateX(Math.PI);
  const inner = inst(cg2, M(0xc9d6bd, { }), N, false);
  const flowers = inst(new THREE.SphereGeometry(0.11, 6, 5), M(0xe9c93a), N * 2, false);
  let i = 0, f = 0, guard = 0;
  while (i < N && guard++ < 9000) {
    const x = -175 + rng() * 350, z = -52 + rng() * 225;
    if (!freeSpot(x, z)) continue;
    const h = terrainH(x, z); if (h > 62) continue;
    const s = 0.7 + rng() * 0.9, th = (0.4 + rng() * rng() * 2.2) * s, ry = rng() * 6.28;
    put(trunks, i, x, h + th / 2, z, s, th, s, ry);
    put(skirts, i, x, h + th * 0.72, z, s, th * 0.55, s, ry);
    put(crowns, i, x, h + th + 0.2 * s, z, s, s, s, ry);
    put(inner, i, x, h + th + 0.38 * s, z, s, s, s, ry + 0.5);
    if (rng() < 0.6) for (let k = 0; k < 2; k++) put(flowers, f++, x + (rng() - 0.5) * 0.5 * s, h + th + 0.72 * s + rng() * 0.2, z + (rng() - 0.5) * 0.5 * s, s, s, s);
    addCol(x, z, 0.2 * s, th + 0.4);
    i++;
  }
  trunks.count = skirts.count = crowns.count = inner.count = i; flowers.count = f;

  // --- Pajonal: macollas de pasto con textura alfa (dos planos cruzados) ---
  const pg = new THREE.PlaneGeometry(1, 1); pg.translate(0, 0.5, 0);
  const nrm = pg.attributes.normal; for (let k = 0; k < nrm.count; k++) nrm.setXYZ(k, 0, 1, 0);
  const GN = 9500, grass = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ map: grassTex, alphaTest: 0.45, side: THREE.DoubleSide }), GN * 2);
  let gi = 0; guard = 0;
  while (gi < GN * 2 && guard++ < 60000) {
    const x = -120 + rng() * 240, z = -30 + rng() * 175;
    if (Math.abs(z - riverZ(x)) < 6.5 || onRoad(x, z)) continue;
    if (inCamp(x, z) && rng() < 0.82) continue;
    const h = terrainH(x, z); if (h > 55) continue;
    const w = 0.8 + rng() * 1.1, hh = 0.35 + rng() * 0.6, ry = rng() * 3.14;
    col.setHSL(0.14 + rng() * 0.08, 0.3 + rng() * 0.2, 0.22 + rng() * 0.13);
    for (let k = 0; k < 2; k++) { put(grass, gi, x, h - 0.03, z, w, hh, w, ry + k * 1.57); grass.setColorAt(gi, col); gi++; }
  }
  grass.count = gi; grass.receiveShadow = true; scene.add(grass);

  // --- Arbustos, cojines de musgo y rocas ---
  const SN = 340, shrubs = inst(blobGeo(1, 0.14, 4.2), M(0x47562f, { }), SN, true);
  const moss = inst(new THREE.SphereGeometry(1, 8, 5, 0, 6.3, 0, 1.5), M(0x6f8a3a), 200, false);
  let si = 0, mi = 0; guard = 0;
  while (si < SN && guard++ < 5000) {
    const x = -170 + rng() * 340, z = -50 + rng() * 220; if (!freeSpot(x, z)) continue;
    const h = terrainH(x, z); if (h > 58) continue;
    const s = 0.4 + rng() * 0.8;
    put(shrubs, si++, x, h + s * 0.45, z, s * (1 + rng() * 0.6), s * 0.75, s * (1 + rng() * 0.6), rng() * 6);
    if (mi < 200 && rng() < 0.6) { const mx = x + 2 + rng() * 5, mz = z + rng() * 5; if (freeSpot(mx, mz)) { const ms = 0.3 + rng() * 0.6; put(moss, mi++, mx, terrainH(mx, mz) - 0.05, mz, ms, ms * 0.45, ms); } }
  }
  shrubs.count = si; moss.count = mi;
  const R = 230, rocks = inst(blobGeo(2, 0.17, 1.7), M(0x707275, { roughness: 1 }), R, true);
  let r = 0; guard = 0;
  while (r < R && guard++ < 4000) {
    const x = -175 + rng() * 350, z = -52 + rng() * 225;
    if (inCamp(x, z) || onRoad(x, z) || inView(x, z) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6) continue;
    const s = 0.3 + rng() * rng() * 2.6;
    put(rocks, r++, x, terrainH(x, z) + s * 0.18, z, s * (0.8 + rng() * 0.6), s * (0.5 + rng() * 0.5), s, rng() * 3, rng() * 3);
    if (s > 0.9 && Math.abs(z - riverZ(x)) > 7) addCol(x, z, s * 0.75, s * 0.7);
  }
  rocks.count = r;

  // --- Árboles de páramo (colorados / Polylepis) cerca del río y laderas bajas ---
  const TN = 46, bark = M(0x7a3d24), leaf = M(0x35482a, { });
  const t1 = inst(cyl(0.14, 0.24, 1, 6), bark, TN * 2, true), canopy = inst(blobGeo(1, 0.16, 7.7), leaf, TN * 3, true);
  let ti = 0, ci = 0, tn = 0; guard = 0;
  while (tn < TN && guard++ < 3000) {
    const x = -165 + rng() * 330, z = rng() < 0.5 ? (-34 + rng() * 22) : (54 + rng() * 26);
    if (!freeSpot(x, z) || (x > -40 && x < 10 && z > 50)) continue;
    const h = terrainH(x, z), th = 2 + rng() * 1.8, lean = (rng() - 0.5) * 0.5;
    put(t1, ti++, x, h + th / 2, z, 1, th, 1, rng() * 6, lean);
    put(t1, ti++, x + 0.3, h + th * 0.95, z + lean * 2, 0.6, th * 0.6, 0.6, rng() * 6, -lean * 2 + 0.4);
    for (let k = 0; k < 3; k++) { const cs = 0.9 + rng() * 0.8; put(canopy, ci++, x + (rng() - 0.5) * 1.8, h + th + 0.4 + rng() * 0.9, z + (rng() - 0.5) * 1.8, cs * 1.25, cs * 0.75, cs * 1.25, rng() * 6); }
    addCol(x, z, 0.35, th); tn++;
  }
  t1.count = ti; canopy.count = ci;
}

function buildCamp() {
  const olive = M(0x4a5632, { roughness: 0.95 }), rust = M(0x7a4a2a, { metalness: 0.4, roughness: 0.75 });
  const steel = M(0x5a6066, { metalness: 0.6, roughness: 0.5 }), wood = M(0x5a4226), dark = M(0x1c1c1c);

  // --- Carpas militares ---
  [[-18, 34, 0.3], [-5, 43, -0.2], [13, 45, 0.12]].forEach(([x, z, ry]) => {
    const g = new THREE.CylinderGeometry(2.0, 2.0, 6.5, 20, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); g.scale(1, 1.12, 1);
    const tent = addAt(new THREE.Mesh(g, M(0x4a5632, { roughness: 0.95, side: THREE.DoubleSide })), x, terrainH(x, z) - 0.06, z); tent.rotation.y = ry;
    for (const o of [-1.7, 1.7]) addCol(x + Math.cos(ry) * o, z - Math.sin(ry) * o, 2.0, 2.3);
  });

  // --- Molinos de bolas ---
  const makeMill = (x, z, s) => {
    const grp = new THREE.Group(); grp.position.set(x, terrainH(x, z), z); grp.scale.setScalar(s); scene.add(grp);
    addAt(new THREE.Mesh(box(4.4, 0.3, 2.6), steel), 0, 0.15, 0, grp);
    for (const sx of [-1.9, 1.9]) addAt(new THREE.Mesh(box(0.3, 1.7, 2.2), steel), sx, 0.95, 0, grp);
    const dg = cyl(1.15, 1.15, 3.3, 10); dg.rotateZ(Math.PI / 2);
    const drum = addAt(new THREE.Mesh(dg, rust), 0, 1.65, 0, grp);
    for (let k = 0; k < 6; k++) { const rib = new THREE.Mesh(box(3.2, 0.1, 0.2), steel); const a = k * Math.PI / 3;
      rib.position.set(0, Math.cos(a) * 1.15, Math.sin(a) * 1.15); rib.rotation.x = a; rib.castShadow = true; drum.add(rib); }
    addAt(new THREE.Mesh(box(0.9, 0.9, 0.9), M(0x2e5d3a, { metalness: 0.3 })), 2.7, 0.6, 0, grp);
    const hopper = new THREE.ConeGeometry(0.8, 1, 14); hopper.rotateX(Math.PI);
    addAt(new THREE.Mesh(hopper, steel), -2.2, 2.6, 0, grp);
    addAt(new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 8, 0, 6.3, 0, 1.3), M(0x6a6660, { })), -4.4, 0.5, 0.4, grp);   // pila de mineral
    addCol(x, z, 2.3 * s, 2.9 * s);
    return { grp, drum };
  };
  const m1 = makeMill(22, 30, 1); millDrum = m1.drum; siteGroups.c4b = m1.grp;
  millDrum2 = makeMill(29, 21, 0.65).drum;

  // --- Tanques de cianuro (lixiviación) ---
  {
    const s = SITES[0], grp = new THREE.Group(); grp.position.set(s.x, terrainH(s.x, s.z), s.z); scene.add(grp);
    for (const ox of [-1.7, 1.7]) {
      addAt(new THREE.Mesh(cyl(1.45, 1.45, 3.6, 16), M(0xc9cfc4, { metalness: 0.3, roughness: 0.6 })), ox, 1.8, 0, grp);
      addAt(new THREE.Mesh(cyl(1.48, 1.48, 0.5, 16), M(0xe2c21f)), ox, 2.4, 0, grp);
      addAt(new THREE.Mesh(cyl(1.49, 1.49, 0.16, 16), dark), ox, 2.4, 0, grp);
      addAt(new THREE.Mesh(cyl(0.5, 1.45, 0.4, 16), steel), ox, 3.8, 0, grp);
      addAt(new THREE.Mesh(box(0.08, 3.6, 0.5), steel), ox, 1.8, 1.5, grp);                    // escalera
    }
    const pipe = cyl(0.14, 0.14, 7, 6); pipe.rotateX(Math.PI / 2);
    addAt(new THREE.Mesh(pipe, steel), 0, 0.35, -3.6, grp);
    for (let k = 0; k < 5; k++) addAt(new THREE.Mesh(box(0.8, 0.28, 0.5), M(0xd8d2c2)), 3.8 + (k % 2) * 0.3, 0.14 + Math.floor(k / 2) * 0.28, 0.6 + (k % 2) * 0.55, grp);  // sacos de cal
    siteGroups.c4a = grp; addCol(s.x - 1.7, s.z, 1.7, 4); addCol(s.x + 1.7, s.z, 1.7, 4);
  }

  // --- Entrada del socavón ---
  {
    const s = SITES[2], grp = new THREE.Group(), y = terrainH(s.x + 1, s.z); grp.position.set(s.x + 1, y, s.z); scene.add(grp);
    for (const oz of [-1.6, 1.6]) addAt(new THREE.Mesh(box(0.35, 3, 0.35), wood), 0, 1.5, oz, grp);
    addAt(new THREE.Mesh(box(0.4, 0.35, 3.9), wood), 0, 3.1, 0, grp);
    const hole = new THREE.Mesh(box(7, 2.9, 2.9), MB(0x020202)); hole.position.set(3.6, 1.45, 0); grp.add(hole);
    for (const oz of [-0.5, 0.5]) addAt(new THREE.Mesh(box(9, 0.08, 0.08), steel), -1.5, 0.06, oz, grp);
    for (let k = 0; k < 8; k++) addAt(new THREE.Mesh(box(0.16, 0.06, 1.5), wood), -5.5 + k * 1.1, 0.03, 0, grp);
    addAt(new THREE.Mesh(box(1.4, 0.8, 1.1), rust), -3.6, 0.6, 0, grp);
    addCol(s.x - 2.6, s.z, 0.9, 1.2);
    siteGroups.c4c = grp;
    const rockMat = M(0x5f6163, { });
    [[2.5, 3.6, -2.6, 2.4], [2.8, 3.9, 2.5, 2.2], [3.5, 4.6, 0, 2.6], [5.5, 4.2, -2.2, 3], [5.8, 4.4, 2.4, 3.1], [1.6, 1.2, -3.2, 1.5], [1.7, 1.1, 3.3, 1.4]]
      .forEach(([ox, oy, oz, sc]) => { const rk = addAt(new THREE.Mesh(blobGeo(2, 0.17, 2.9), rockMat), s.x + 1 + ox, y + oy, s.z + oz);
        rk.scale.set(sc, sc * 0.8, sc); rk.rotation.set(ox, oy, oz); });
  }

  // --- Retortas humeantes (quema de amalgama) ---
  [[-9, 24], [-5, 19.5]].forEach(([x, z]) => {
    const y = terrainH(x, z);
    addAt(new THREE.Mesh(box(1.2, 0.8, 1.2), M(0x6e3b28)), x, y + 0.4, z);
    addAt(new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9), M(0x2b2b2b, { metalness: 0.5, roughness: 0.6 })), x, y + 1.0, z);
    addAt(new THREE.Mesh(cyl(0.09, 0.09, 1.3, 6), steel), x + 0.3, y + 1.8, z);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), MB(0xff6a1a)); ember.position.set(x, y + 0.45, z + 0.5); scene.add(ember);
    const fl = new THREE.PointLight(0xff7a2a, 2.5, 7); fl.position.set(x, y + 0.6, z + 0.9); scene.add(fl);
    emitters.push({ pos: new THREE.Vector3(x + 0.3, y + 2.5, z), color: 0xa2a29a, rate: 5, acc: 0, size: 0.7, active: true });
    addCol(x, z, 0.9, 1.6);
  });

  // --- Tambores de químicos ---
  const drumGeo = cyl(0.42, 0.42, 1.15, 12), drumCols = [0x2a5fa8, 0xb33a2a, 0xd4b21f, 0x2f7d4a];
  [[10, 19], [11, 19.8], [10.2, 20.9], [15, 24], [16, 23.6], [-21, 16], [-22.2, 15.6], [-30, 15], [-12, 36.5], [-11, 37.4],
   [26, 36], [27, 35.4], [6, 39], [-28, 22], [33, 27], [18, 39], [-2, 33], [-1.2, 33.9]].forEach(([x, z], i) => {
    const d = addAt(new THREE.Mesh(drumGeo, M(drumCols[i % 4], { metalness: 0.35, roughness: 0.6 })), x, terrainH(x, z) + 0.57, z);
    if (i % 5 === 4) { d.rotation.z = Math.PI / 2; d.position.y -= 0.15; }
    addCol(x, z, 0.55, 1.2);
  });
  // Cajas y sacos
  [[2, 36, 0.3], [3.2, 36.4, 1.1], [-24, 30, 0.2], [18, 20, 0.7], [-3, 15, 0.1]].forEach(([x, z, r], i) => {
    const c = addAt(new THREE.Mesh(box(1.1, 0.8 + (i % 2) * 0.3, 0.9), wood), x, terrainH(x, z) + 0.45, z); c.rotation.y = r; addCol(x, z, 0.75, 1.1);
  });

  // --- Mesa del oro bajo toldo ---
  const canopy = (cx, cz, w, d, color) => {
    const y = terrainH(cx, cz);
    for (const [ox, oz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) addAt(new THREE.Mesh(cyl(0.05, 0.05, 2.7, 5), steel), cx + ox, y + 1.35, cz + oz);
    addAt(new THREE.Mesh(box(w + 0.4, 0.06, d + 0.4), M(color)), cx, y + 2.72, cz);
    return y;
  };
  const tableAt = (cx, cz, y) => {
    addAt(new THREE.Mesh(box(2.6, 0.1, 1.3), wood), cx, y + 0.95, cz);
    for (const [ox, oz] of [[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]]) addAt(new THREE.Mesh(box(0.1, 0.95, 0.1), wood), cx + ox, y + 0.47, cz + oz);
    addCol(cx, cz, 1.25, 1.1);
  };
  {
    const y = canopy(TABLE.x, TABLE.z, 3.6, 2.4, 0x2c4a6e); tableAt(TABLE.x, TABLE.z, y);
    goldGroup = new THREE.Group(); goldGroup.position.set(TABLE.x, y + 1.0, TABLE.z); scene.add(goldGroup);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc531, metalness: 1, roughness: 0.28, emissive: 0x6a4300, emissiveIntensity: 0.8 });
    [[-0.7, 0, -0.2, 0.2], [-0.35, 0, 0.15, -0.3], [0, 0, -0.15, 0.1], [-0.5, 0.12, 0, 0.6], [-0.15, 0.12, 0, -0.1]].forEach(([ox, oy, oz, r]) => {
      addAt(new THREE.Mesh(cyl(0.17, 0.2, 0.11, 12), goldMat), ox, 0.06 + oy, oz, goldGroup).rotation.y = r; });
    addAt(new THREE.Mesh(box(0.5, 0.04, 0.35), M(0x333333)), 0.7, 0.02, 0.1, goldGroup);                              // balanza
    const gl = new THREE.PointLight(0xffc040, 3, 9); gl.position.set(-0.3, 0.7, 0); goldGroup.add(gl);
  }
  // --- Laboratorio: computador + tablero con diagrama de cianuración ---
  {
    const y = canopy(LAB.x, LAB.z, 4.6, 3, 0x6e2c2c); tableAt(LAB.x - 0.6, LAB.z, y);
    addAt(new THREE.Mesh(box(0.5, 0.03, 0.34), dark), LAB.x - 1, y + 1.02, LAB.z);
    const scr = new THREE.Mesh(box(0.5, 0.32, 0.02), MB(0x7fd0ff)); scr.position.set(LAB.x - 1, y + 1.19, LAB.z - 0.18); scr.rotation.x = -0.2; scene.add(scr);
    const sl = new THREE.PointLight(0x7fd0ff, 1.5, 5); sl.position.set(LAB.x - 1, y + 1.4, LAB.z + 0.3); scene.add(sl);
    for (let k = 0; k < 5; k++) addAt(new THREE.Mesh(cyl(0.05, 0.07, 0.2 + (k % 3) * 0.06, 8), M([0x9dff5a, 0xdfe8ee, 0x5ab0ff][k % 3], { transparent: true, opacity: 0.8 })), LAB.x - 0.3 + k * 0.17, y + 1.1, LAB.z + 0.25);
    // Tablero (textura dibujada con el diagrama real)
    const bt = canvasTex(512, (g) => {
      g.fillStyle = '#f2f2ea'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#1a2a5a'; g.font = 'bold 30px sans-serif'; g.fillText('CIANURACIÓN', 20, 44);
      g.font = '22px sans-serif'; ['MOLIENDA', 'NaCN  pH 10.5', 'ZINC', 'FUNDICIÓN'].forEach((t, i) => { g.strokeStyle = '#1a2a5a'; g.lineWidth = 3; g.strokeRect(30, 70 + i * 82, 230, 54); g.fillText(t, 42, 105 + i * 82); if (i < 3) { g.beginPath(); g.moveTo(145, 124 + i * 82); g.lineTo(145, 152 + i * 82); g.stroke(); } });
      g.fillStyle = '#a01818'; g.font = 'bold 21px sans-serif'; g.fillText('4Au + 8NaCN + O₂ + 2H₂O', 20, 420); g.fillText('→ 4Na[Au(CN)₂] + 4NaOH', 20, 450); g.fillText('¡pH < 9 = HCN ☠!', 290, 120);
      g.fillStyle = '#b08a00'; g.font = 'bold 26px sans-serif'; g.fillText('Au ✔', 300, 340);
    });
    const bx = LAB.x + 1.9, bz = LAB.z - 1.1;
    const board = new THREE.Mesh(box(1.7, 1.25, 0.05), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 })); board.position.set(bx, y + 1.45, bz); board.rotation.y = -0.5; board.castShadow = true; scene.add(board);
    for (const o of [-0.7, 0.7]) addAt(new THREE.Mesh(box(0.06, 2.1, 0.06), wood), bx + Math.cos(0.5) * o, y + 1.05, bz + Math.sin(0.5) * o);
    addCol(bx, bz, 0.8, 2);
  }

  // --- Torre de vigilancia ---
  {
    const y = terrainH(TOWER.x, TOWER.z), H = TOWER.h;
    for (const [ox, oz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) {
      addAt(new THREE.Mesh(box(0.2, H + 2.2, 0.2), wood), TOWER.x + ox, y + (H + 2.2) / 2, TOWER.z + oz);
    }
    addAt(new THREE.Mesh(box(3.1, 0.18, 3.1), wood), TOWER.x, y + H - 0.1, TOWER.z);
    addAt(new THREE.Mesh(box(3.6, 0.12, 3.6), M(0x4a4f52, { metalness: 0.5 })), TOWER.x, y + H + 2.25, TOWER.z);
    for (const [ox, oz, w, d] of [[0, -1.4, 3, 0.08], [-1.4, 0, 0.08, 3], [1.4, 0, 0.08, 3]]) addAt(new THREE.Mesh(box(w, 0.7, d), wood), TOWER.x + ox, y + H + 0.45, TOWER.z + oz);
    for (let k = 0; k < 9; k++) addAt(new THREE.Mesh(box(0.6, 0.06, 0.08), wood), TOWER.x, y + 0.5 + k * 0.55, TOWER.z + 1.45);
    for (const o of [-0.3, 0.3]) addAt(new THREE.Mesh(box(0.07, H, 0.07), wood), TOWER.x + o, y + H / 2, TOWER.z + 1.45);
    addCol(TOWER.x, TOWER.z, 1.9, 0.01);
  }
  // --- Antena de radio (se puede destruir de un disparo) ---
  {
    const y = terrainH(ANT.x, ANT.z);
    antennaGroup = new THREE.Group(); antennaGroup.position.set(ANT.x, y, ANT.z); scene.add(antennaGroup);
    addAt(new THREE.Mesh(cyl(0.05, 0.09, 9, 6), steel), 0, 4.5, 0, antennaGroup);
    for (let k = 0; k < 3; k++) addAt(new THREE.Mesh(box(1.4 - k * 0.35, 0.04, 0.04), steel), 0, 7 + k * 0.7, 0, antennaGroup);
    const dish = addAt(new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 6, 0, 6.3, 0, 1.1), M(0xd0d4d6, { side: THREE.DoubleSide, metalness: 0.4 })), 0.2, 5.6, 0.3, antennaGroup); dish.rotation.x = 1.9;
    addAt(new THREE.Mesh(box(1, 1.2, 0.6), M(0x3c4a3a, { metalness: 0.4 })), 0.9, 0.6, 0, antennaGroup);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), MB(0x4dff6a)); led.position.set(0.9, 1.05, 0.32); antennaGroup.add(led);
    antennaGroup.userData.led = led;
    addCol(ANT.x + 0.9, ANT.z, 0.8, 0.01);
  }

  // --- Bengala verde de extracción ---
  {
    const y = terrainH(EXTRACT.x, EXTRACT.z);
    flareGroup = new THREE.Group(); flareGroup.position.set(EXTRACT.x, y, EXTRACT.z); scene.add(flareGroup);
    addAt(new THREE.Mesh(cyl(0.05, 0.05, 0.4, 6), M(0xaa2222)), 0, 0.2, 0, flareGroup);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), MB(0x6dff8a)); tip.position.y = 0.48; flareGroup.add(tip);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.05, 6, 48), MB(0x4dff7a, { transparent: true, opacity: 0.3 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.5; flareGroup.add(ring);
    flareLight = new THREE.PointLight(0x55ff77, 6, 40); flareLight.position.y = 1.2; flareGroup.add(flareLight);
    flareEmitter = { pos: new THREE.Vector3(EXTRACT.x, y + 0.6, EXTRACT.z), color: 0x4dff6a, rate: 9, acc: 0, size: 1.1, active: false, rise: 3.2 };
    emitters.push(flareEmitter);
    flareGroup.visible = false;
  }
}

/* ============================ 6) PARTÍCULAS ============================ */
function spawnParticle(pos, vel, life, size, color, o) {
  o = o || {};
  const mat = new THREE.SpriteMaterial({ map: softTex, color, transparent: true, opacity: o.opacity || 0.8, depthWrite: false,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
  const s = new THREE.Sprite(mat);
  s.position.copy(pos); s.scale.setScalar(size); scene.add(s);
  particles.push({ s, vel: vel.clone(), life, max: life, grow: o.grow || 0, grav: o.grav || 0, op: mat.opacity, drag: o.drag || 0 });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); particles.splice(i, 1); continue; }
    p.vel.y -= p.grav * dt;
    if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
    p.s.position.addScaledVector(p.vel, dt);
    if (p.grow) p.s.scale.addScalar(p.grow * dt);
    p.s.material.opacity = p.op * (p.life / p.max);
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life -= dt; d.vel.y -= 14 * dt;
    d.m.position.addScaledVector(d.vel, dt);
    d.m.rotation.x += d.spin * dt; d.m.rotation.z += d.spin * 0.7 * dt;
    const gy = terrainH(d.m.position.x, d.m.position.z) + (d.r || 0.15);
    if (d.m.position.y < gy) { d.m.position.y = gy; d.vel.set(0, 0, 0); d.spin = 0; }
    if (d.life <= 0) { scene.remove(d.m); debris.splice(i, 1); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.life -= dt;
    if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); tracers.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {                         // ondas expansivas
    const r = rings[i]; r.life -= dt; r.m.scale.addScalar(dt * 55); r.m.material.opacity = Math.max(0, r.life / 0.9) * 0.6;
    if (r.life <= 0) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]; f.life -= dt; f.light.intensity = Math.max(0, f.pow * f.life / f.max);
    if (f.life <= 0) { scene.remove(f.light); flashes.splice(i, 1); }
  }
  for (const e of emitters) {
    if (!e.active) continue;
    e.acc += e.rate * dt;
    while (e.acc >= 1) { e.acc -= 1;
      _v.set(0.5 + Math.random() * 0.5, e.rise || 1.5, (Math.random() - 0.5) * 0.4);
      spawnParticle(e.pos, _v, 3.2, e.size, e.color, { grow: 0.9, opacity: 0.5 });
      if (e.fire) { _v.set((Math.random() - 0.5), 2 + Math.random() * 2, (Math.random() - 0.5)); spawnParticle(e.pos, _v, 0.7, 2.2, 0xff7a18, { add: true, grow: -1.5, opacity: 0.9 }); }
    }
  }
}
const debrisGeo = box(0.4, 0.25, 0.3), debrisMat = new THREE.MeshStandardMaterial({ color: 0x2b2622 });
const shellGeo = cyl(0.008, 0.008, 0.035, 5), shellMat = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.9, roughness: 0.3 });
function explodeAt(x, y, z) {
  const c = new THREE.Vector3(x, y + 1.5, z);
  for (let i = 0; i < 50; i++) { _v.set(Math.random() - 0.5, Math.random() * 0.9 + 0.15, Math.random() - 0.5).normalize().multiplyScalar(5 + Math.random() * 16);
    spawnParticle(c, _v, 0.9 + Math.random() * 1.1, 3 + Math.random() * 4, i % 3 ? 0xff7a18 : 0xffe07a, { add: true, grow: 7, drag: 1.6, opacity: 1 }); }
  for (let i = 0; i < 28; i++) { _v.set((Math.random() - 0.5) * 7, 3 + Math.random() * 8, (Math.random() - 0.5) * 7);
    spawnParticle(c, _v, 4 + Math.random() * 4, 4 + Math.random() * 4, 0x242424, { grow: 3.2, drag: 0.5, opacity: 0.85 }); }
  for (let i = 0; i < 34; i++) { _v.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize().multiplyScalar(14 + Math.random() * 22);
    spawnParticle(c, _v, 1.2 + Math.random(), 0.5, 0xffd060, { add: true, grav: 12, opacity: 1 }); }
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(debrisGeo, debrisMat); m.castShadow = true;
    m.position.copy(c); m.scale.setScalar(0.5 + Math.random() * 1.6); scene.add(m);
    debris.push({ m, vel: new THREE.Vector3((Math.random() - 0.5) * 26, 8 + Math.random() * 16, (Math.random() - 0.5) * 26), spin: 4 + Math.random() * 8, life: 9 }); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), MB(0xffe2b0, { transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.6, z); scene.add(ring); rings.push({ m: ring, life: 0.9 });
  const light = new THREE.PointLight(0xffa040, 60, 180); light.position.copy(c).y += 4; scene.add(light);
  flashes.push({ light, life: 1.3, max: 1.3, pow: 60 });
}
function dustPuff(pos, color, n) {
  for (let i = 0; i < (n || 4); i++) { _v.set((Math.random() - 0.5) * 1.6, 1 + Math.random() * 1.6, (Math.random() - 0.5) * 1.6);
    spawnParticle(pos, _v, 0.7, 0.35, color || 0x8a8270, { grow: 1.4, opacity: 0.7 }); }
}
let mist = null;
function buildMist() {
  const N = 600, arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { arr[i * 3] = (Math.random() - 0.5) * 60; arr[i * 3 + 1] = Math.random() * 22 - 4; arr[i * 3 + 2] = (Math.random() - 0.5) * 60; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  mist = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xeef5fa, size: 0.12, transparent: true, opacity: 0.5, depthWrite: false }));
  mist.frustumCulled = false; scene.add(mist);
}
function updateMist(dt) {
  const a = mist.geometry.attributes.position, p = camera.position;
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i) + 2.6 * dt, y = a.getY(i) - 0.5 * dt, z = a.getZ(i) + 0.8 * dt;
    if (x - p.x > 30) x -= 60; else if (x - p.x < -30) x += 60;
    if (z - p.z > 30) z -= 60; else if (z - p.z < -30) z += 60;
    if (y - p.y > 11) y -= 22; else if (y - p.y < -11) y += 22;
    a.setXYZ(i, x, y, z);
  }
  a.needsUpdate = true;
}

/* ============================ 7) PERSONAJES ============================ */
const enemies = [], pourProps = [];
let engineer = null;
const STYLES = {
  op:    { vest: 0xff7a1a, cloth: 0x3b4a63, pants: 0x2f3542, helmet: 0xf2d21b, boots: 0x1b1b1b, band: true },
  guard: { vest: 0x20261f, cloth: 0x445238, pants: 0x3a4630, helmet: 0x2c3a26, boots: 0x15130f, pack: true },
  boss:  { vest: 0x3a2a1e, cloth: 0x1a1a1a, pants: 0x1a1a1a, helmet: 0x8a1c1c, boots: 0x15130f, pack: false },
  civ:   { vest: 0xe9ece8, cloth: 0xe9ece8, pants: 0x34405a, helmet: null, boots: 0x3a2a1e }
};
// Extremidad articulada: grupo-pivote con el segmento colgando hacia -Y
function limb(len, r, mat) {
  const p = new THREE.Group(), m = new THREE.Mesh(cyl(r, r * 0.82, len, 7), mat);
  m.position.y = -len / 2; m.castShadow = true; p.add(m); return p;
}
// Humanoide con cadera, torso, cabeza, brazos (brazo+antebrazo) y piernas (muslo+pantorrilla). Frente = +Z
function makeHumanoid(style) {
  const S = STYLES[style], root = new THREE.Group(); root.rotation.order = 'YXZ';
  const vest = M(S.vest), cloth = M(S.cloth), pants = M(S.pants), skin = M(0xb98a66), boots = M(S.boots);
  const part = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const hips = new THREE.Group(); hips.position.y = 0.9; root.add(hips);
  part(box(0.34, 0.2, 0.22), pants, 0, 0, 0, hips);
  const mkLeg = sx => { const leg = limb(0.44, 0.085, pants); leg.position.set(sx, -0.04, 0); hips.add(leg);
    const shin = limb(0.42, 0.07, pants); shin.position.y = -0.44; leg.add(shin);
    part(box(0.11, 0.1, 0.27), boots, 0, -0.44, 0.05, shin); return [leg, shin]; };
  const [legL, shinL] = mkLeg(-0.1), [legR, shinR] = mkLeg(0.1);
  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
  part(box(0.4, 0.5, 0.23), cloth, 0, 0.27, 0, torso);
  part(box(0.45, 0.38, 0.28), vest, 0, 0.3, 0, torso);
  if (S.band) part(box(0.46, 0.06, 0.29), M(0xe8e8e8), 0, 0.28, 0, torso);
  if (S.pack) { part(box(0.3, 0.36, 0.14), M(0x2d3528), 0, 0.3, -0.2, torso); for (const sx of [-0.12, 0, 0.12]) part(box(0.09, 0.13, 0.06), M(0x2d3528), sx, 0.2, 0.17, torso); }
  const head = new THREE.Group(); head.position.y = 0.56; torso.add(head);
  part(cyl(0.05, 0.06, 0.08, 6), skin, 0, 0.02, 0, head);
  const skull = part(new THREE.SphereGeometry(0.115, 12, 10), skin, 0, 0.16, 0, head); skull.scale.set(1, 1.15, 1.05);
  part(box(0.04, 0.05, 0.04), skin, 0, 0.14, 0.115, head);                                             // nariz
  if (S.helmet != null) part(new THREE.SphereGeometry(0.15, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), M(S.helmet, { roughness: 0.5 }), 0, 0.19, 0, head);
  else { const hair = part(new THREE.SphereGeometry(0.125, 10, 8), M(0x1c120c), 0, 0.2, -0.02, head); hair.scale.set(1, 0.9, 1.1); part(box(0.1, 0.22, 0.06), M(0x1c120c), 0, 0.02, -0.12, head); }
  if (style === 'guard' || style === 'boss') part(box(0.2, 0.1, 0.03), M(0x15181a), 0, 0.12, 0.1, head);    // pasamontañas / gafas
  const mkArm = sx => { const arm = limb(0.3, 0.06, cloth); arm.position.set(sx, 0.48, 0); torso.add(arm);
    const fore = limb(0.27, 0.05, style === 'op' ? skin : cloth); fore.position.y = -0.3; arm.add(fore);
    part(new THREE.SphereGeometry(0.05, 6, 5), skin, 0, -0.3, 0, fore); return [arm, fore]; };
  const [armL, foreL] = mkArm(-0.27), [armR, foreR] = mkArm(0.27);
  const gun = new THREE.Group(); gun.position.set(0.14, 0.33, 0.28); torso.add(gun);
  const gm = M(0x111214, { metalness: 0.6, roughness: 0.5 });
  if (style === 'op') part(box(0.04, 0.1, 0.2), gm, 0, 0, 0.06, gun);
  else { part(box(0.05, 0.08, 0.62), gm, 0, 0, 0.12, gun); part(box(0.035, 0.18, 0.07), gm, 0, -0.11, 0.14, gun); part(box(0.045, 0.1, 0.2), M(0x5a4226), 0, -0.02, -0.26, gun); }
  root.userData = { hips, torso, head, armL, armR, foreL, foreR, legL, legR, shinL, shinR, gun };
  return root;
}
function spawnEnemy(kind, x, z, o) {
  o = o || {};
  const style = o.style || (kind === 'op' ? 'op' : (kind === 'boss' ? 'boss' : 'guard'));
  const mesh = makeHumanoid(style); if (kind === 'boss') mesh.scale.setScalar(1.08);
  const pos = new THREE.Vector3(x, o.y != null ? o.y : terrainH(x, z), z);
  mesh.position.copy(pos); scene.add(mesh);
  const e = { kind, mesh, pos, alive: true, hp: o.hp || 100, dieT: 0, seed: Math.random() * 10, walk: 0, flinch: 0,
    state: o.combat ? 'combat' : 'idle', patrol: o.patrol || null, patrolI: 0, fixed: !!o.fixed,
    speed: o.speed || (kind === 'op' ? 2.4 : 3.3), stopDist: o.stopDist || (kind === 'op' ? 55 : 40),
    range: kind === 'op' ? 70 : 160, fireCd: 1 + Math.random() * 1.5, burst: 0, burstCd: 0,
    required: !o.extra, extra: !!o.extra, hasGun: kind !== 'op', dieDir: 1 };
  mesh.userData.gun.visible = e.hasGun || e.state === 'combat';
  mesh.rotation.y = o.faceY || 0;
  enemies.push(e); return e;
}
function spawnInitialEnemies() {
  // 3 operarios vertiendo barriles al río
  [-14, -2, 10].forEach((x, i) => {
    const zr = riverZ(x);
    spawnEnemy('op', x, zr + 6.2, { faceY: Math.PI });
    const y = terrainH(x + 0.9, zr + 5.1), isHg = i === 1;
    const barrel = addAt(new THREE.Mesh(cyl(0.42, 0.42, 1.15, 12), M(isHg ? 0x8a8f96 : 0xd4b21f, { metalness: 0.4 })), x + 0.9, y + 0.62, zr + 5.1); barrel.rotation.x = -1.0;
    const liquid = MB(isHg ? 0xdfe8ee : 0x9dff3a, { transparent: true, opacity: 0.9 });
    const stream = new THREE.Mesh(cyl(0.09, 0.16, 2.2, 6), liquid); stream.position.set(x + 0.9, y + 0.15, zr + 3.9); stream.rotation.x = -0.95; scene.add(stream);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(2.4, 16), MB(isHg ? 0xcfdde2 : 0xa6ff3a, { transparent: true, opacity: 0.7 }));
    patch.rotation.x = -Math.PI / 2; patch.position.set(x + 1.6, CFG.WATER_Y + 0.03, zr + 2.2); patch.scale.set(1.8, 1, 1); scene.add(patch);
    pourProps.push(barrel, stream, patch); toxicPatches.push(patch);
  });
  spawnEnemy('guard', -28, 16, { patrol: [[-28, 16], [24, 15]] });
  spawnEnemy('guard', 20, 38, { patrol: [[20, 38], [-4, 37]] });
  spawnEnemy('tower', TOWER.x, TOWER.z, { y: terrainH(TOWER.x, TOWER.z) + TOWER.h, fixed: true, faceY: 2.2 });   // vigía
  spawnEnemy('guard', ENG.x + 4, ENG.z + 1.5, { faceY: 0.4 });                                                   // custodios de la rehén
  spawnEnemy('guard', ENG.x - 1.5, ENG.z - 4, { faceY: -0.6 });
  // Ingeniera secuestrada, sentada y atada
  const m = makeHumanoid('civ'); m.userData.gun.visible = false;
  const p = new THREE.Vector3(ENG.x, terrainH(ENG.x, ENG.z), ENG.z); m.position.copy(p); m.rotation.y = 0.9; scene.add(m);
  const crate = addAt(new THREE.Mesh(box(0.5, 0.45, 0.5), M(0x5a4226)), ENG.x - 0.12, p.y + 0.22, ENG.z - 0.16); pourProps.push(crate);
  engineer = { mesh: m, pos: p, seated: true, free: false, walk: 0, kind: 'civ', state: 'idle', seed: 1, arrived: false };
}
function spawnReinforcements(withBoss) {
  [[-120, 18], [-124, 25], [-117, 31]].forEach(([x, z]) => spawnEnemy('guard', x, z, { combat: true, extra: true, speed: 5.2, stopDist: 26, hp: 140 }));
  if (withBoss) spawnEnemy('boss', -128, 22, { combat: true, extra: true, speed: 4.6, stopDist: 30, hp: 260 });
}
function addAlert(v) {
  if (G.alerted || G.state !== 'playing') return;
  G.alertLevel += v * (G.kit === 'recon' ? 0.65 : 1);
  if (G.alertLevel >= 100) setAlerted();
}
function setAlerted() {
  if (G.alerted) return;
  G.alerted = true; G.everAlerted = true; G.alertLevel = 100;
  SFX.alert();
  let near = null, nd = 1e9;
  for (const e of enemies) if (e.alive) { e.state = 'combat'; e.mesh.userData.gun.visible = true; e.fireCd = 1.2 + Math.random();
    const d = e.pos.distanceTo(player.pos); if (d < nd) { nd = d; near = e; } }
  if (!near) return;
  showMessage('¡DETECTADO!', 2.5);
  bark('alert', near, true);
  radio('¡Cóndor, lo detectaron! Fuego a discreción. Muévase, no se quede quieto.', 3.2);
  if (G.antenna && G.phase === 1) after(11, () => {
    if (!G.antenna || G.missionOver) return;
    spawnReinforcements(false);
    radio('Interceptamos una llamada por la antena. Vienen refuerzos por el oeste del valle.');
  });
}
function enemyShoot(e, dist) {
  SFX.enemyShot(dist);
  const from = _v.copy(e.pos); from.y += 1.4;
  let p = e.kind === 'tower' ? 0.3 : clamp(0.6 - dist / 120, 0.06, 0.5);
  if (e.kind === 'op') p *= 0.55;
  if (e.burst > 0) p *= 0.55;
  if (player.sprinting) p *= 0.6;
  p *= 0.55 + 0.45 * STANCES[player.stance].det;                       // agachado / tendido = blanco más pequeño
  const hit = Math.random() < p, to = _v2.copy(player.pos);
  if (hit) to.y -= 0.3; else { to.x += (Math.random() - 0.5) * 3; to.y += (Math.random() - 0.3) * 2; to.z += (Math.random() - 0.5) * 3; if (Math.random() < 0.5) SFX.whiz(); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]), new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.8 }));
  scene.add(l); tracers.push({ l, life: 0.06 });
  spawnParticle(from, _v3.set(0, 0.3, 0), 0.06, 0.7, 0xffc060, { add: true, opacity: 1 });       // fogonazo
  if (hit) damagePlayer((e.kind === 'op' ? 6 : (e.kind === 'boss' ? 14 : 9)) + Math.random() * 5);
}
const damp = (o, ax, target, k) => { o.rotation[ax] += (target - o.rotation[ax]) * k; };
// Pose procedural: caminar, apuntar, trabajar, vigilar, sentado
function poseHumanoid(e, dt, moving, spd) {
  const u = e.mesh.userData, k = Math.min(1, dt * 10);
  let la = 0.05, ra = 0.05, lf = -0.2, rf = -0.2, ll = 0, rl = 0, ls = 0, rs = 0, lean = 0, gunX = 0.9, laz = 0, raz = 0, hy = 0, hipY = 0.9;
  if (moving) {
    e.walk += dt * spd * 2.1;
    const s = Math.sin(e.walk), c = Math.cos(e.walk), a = Math.min(0.8, 0.28 + spd * 0.09);
    ll = -s * a; rl = s * a; ls = Math.max(0, c) * a * 1.4; rs = Math.max(0, -c) * a * 1.4; la = s * a * 0.6; ra = -s * a * 0.6;
    lean = spd > 3 ? 0.16 : 0.04; hipY = 0.9 - Math.abs(c) * 0.03;
  }
  if (e.seated) { ll = rl = -1.5; ls = rs = 1.5; la = ra = 0.6; lf = rf = -0.3; hipY = 0.5; lean = 0.12; hy = Math.sin(T * 0.4) * 0.3; }
  else if (e.state === 'combat') { ra = -1.38; rf = -0.2; la = -1.15; lf = -0.55; laz = 0.5; gunX = 0; lean = 0.1;
    if (!moving) { ll = -0.3; rl = 0.22; ls = 0.28; rs = 0.3; hipY = 0.84; } }
  else if (e.kind === 'op') { const r = Math.sin(T * 2.2 + e.seed) * 0.16; la = ra = -0.95 + r; lf = rf = -0.5; lean = 0.3 + r * 0.3; hy = Math.sin(T * 0.3 + e.seed) * 0.25; }
  else if (e.hasGun) { ra = -0.5; rf = -0.95; la = -0.62; lf = -0.9; laz = 0.38; if (!moving) hy = Math.sin(T * 0.45 + e.seed) * 0.8; }
  if (e.flinch > 0) { e.flinch -= dt; lean -= 0.4 * e.flinch; }
  damp(u.armL, 'x', la, k); damp(u.armR, 'x', ra, k); damp(u.foreL, 'x', lf, k); damp(u.foreR, 'x', rf, k);
  damp(u.armL, 'z', laz, k); damp(u.armR, 'z', raz, k);
  damp(u.legL, 'x', ll, k); damp(u.legR, 'x', rl, k); damp(u.shinL, 'x', ls, k); damp(u.shinR, 'x', rs, k);
  damp(u.torso, 'x', lean, k); damp(u.gun, 'x', gunX, k); damp(u.head, 'y', hy, k * 0.4);
  u.hips.position.y += (hipY - u.hips.position.y) * k;
}
function poseDeath(e, dt) {
  if (e.dieT >= 1) return;
  e.dieT = Math.min(1, e.dieT + dt * 1.5);
  const t = e.dieT, ease = t < 0.75 ? Math.pow(t / 0.75, 2) : 1 + Math.sin((t - 0.75) * 12.6) * 0.03 * (1 - t) * 4, u = e.mesh.userData;
  e.mesh.rotation.x = -e.dieDir * ease * Math.PI / 2;
  e.mesh.position.y = e.pos.y + 0.13 * ease;
  u.hips.position.y = 0.9 - 0.25 * Math.sin(Math.min(1, t * 1.6) * Math.PI) ;
  const k = Math.min(1, dt * 7);
  damp(u.armL, 'z', -1.1, k); damp(u.armR, 'z', 1.2, k); damp(u.armL, 'x', -0.4, k); damp(u.armR, 'x', 0.3, k);
  damp(u.legL, 'x', -0.25, k); damp(u.legR, 'x', 0.15, k); damp(u.shinL, 'x', 0.6, k); damp(u.shinR, 'x', 0.2, k);
  damp(u.head, 'y', 0.7, k); damp(u.torso, 'x', -0.1, k); damp(u.gun, 'x', 1.4, k);
}
function updateEnemies(dt) {
  const eye = player.pos, st = STANCES[player.stance];
  barkCd -= dt;
  let idleNear = null;
  for (const e of enemies) {
    if (!e.alive) { poseDeath(e, dt); continue; }
    if (e.scripted) continue;
    const dx = eye.x - e.pos.x, dz = eye.z - e.pos.z, dist = Math.hypot(dx, dz);
    let mx = 0, mz = 0, spd = 0;
    _v.copy(e.pos); _v.y += 1.5;
    if (e.state !== 'combat') {
      if (e.patrol) {
        const t = e.patrol[e.patrolI], tx = t[0] - e.pos.x, tz = t[1] - e.pos.z, td = Math.hypot(tx, tz);
        if (td < 1) e.patrolI = (e.patrolI + 1) % e.patrol.length; else { mx = tx / td; mz = tz / td; spd = 1.4; }
      }
      const range = (e.kind === 'tower' ? 60 : 40) * st.det * (keys.ControlLeft ? 0.85 : 1);
      if (dist < range && hasLOS(_v, eye)) addAlert((30 + (range - dist) * 4) * dt);
      if (player.sprinting && dist < 24) addAlert(30 * dt);            // pasos a la carrera
      if (dist < 55 && (!idleNear || dist < idleNear.d)) idleNear = { e, d: dist };
    } else {
      let dy = Math.atan2(dx, dz) - e.mesh.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      e.mesh.rotation.y += dy * Math.min(1, dt * 7);
      if (!e.fixed) {
        if (dist > e.stopDist) { mx = dx / dist; mz = dz / dist; spd = e.speed; }
        else { const s = Math.sin(T * 0.7 + e.seed * 3); if (Math.abs(s) > 0.45) { mx = dz / dist * Math.sign(s); mz = -dx / dist * Math.sign(s); spd = 1.6; } }   // se mueve lateralmente
      }
      e.fireCd -= dt;
      if (e.burst > 0) { e.burstCd -= dt; if (e.burstCd <= 0) { e.burst--; e.burstCd = 0.13; if (!G.missionOver && hasLOS(_v, eye)) enemyShoot(e, dist); } }
      else if (e.fireCd <= 0 && dist < e.range) {
        e.fireCd = (e.kind === 'op' ? 2.0 : (e.kind === 'tower' ? 2.6 : 1.6)) + Math.random() * 1.2;
        if (!G.missionOver && G.state === 'playing' && hasLOS(_v, eye)) { enemyShoot(e, dist); if (e.kind === 'guard' || e.kind === 'boss') { e.burst = 2; e.burstCd = 0.13; }
          if (Math.random() < 0.25) bark('combat', e); }
      }
    }
    if (spd > 0) {
      e.pos.x += mx * spd * dt; e.pos.z += mz * spd * dt; e.pos.y = terrainH(e.pos.x, e.pos.z);
      if (e.state !== 'combat') { let dy = Math.atan2(mx, mz) - e.mesh.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.mesh.rotation.y += dy * Math.min(1, dt * 5); }
    }
    poseHumanoid(e, dt, spd > 0, spd);
    e.mesh.position.copy(e.pos);
  }
  if (idleNear && !G.alerted && G.state === 'playing' && barkCd <= 0 && Math.random() < dt * 0.25) bark('idle', idleNear.e);
  if (!G.alerted) G.alertLevel = Math.max(0, G.alertLevel - 3 * dt);
  // Ingeniera: corre a la extracción una vez liberada
  if (engineer) {
    let spd = 0;
    if (engineer.free && !engineer.arrived) {
      const tx = engineer.tx - engineer.pos.x, tz = engineer.tz - engineer.pos.z, td = Math.hypot(tx, tz);
      if (td < 1.2) { engineer.arrived = true; engineer.mesh.rotation.y = Math.PI; }
      else { spd = 5.4; engineer.pos.x += tx / td * spd * dt; engineer.pos.z += tz / td * spd * dt; engineer.pos.y = terrainH(engineer.pos.x, engineer.pos.z); engineer.mesh.rotation.y = Math.atan2(tx, tz); }
    }
    poseHumanoid(engineer, dt, spd > 0, spd); engineer.mesh.position.copy(engineer.pos);
  }
}
function killEnemy(e, headshot) {
  e.alive = false; G.kills++; if (headshot) G.headshots++;
  _v.subVectors(player.pos, e.pos); e.dieDir = Math.cos(Math.atan2(_v.x, _v.z) - e.mesh.rotation.y) > 0 ? 1 : -1;   // cae alejándose del disparo
  if (Math.random() < 0.35 && e.pos.distanceTo(player.pos) < 70) bark('death', e);
  if (e.required) {
    G.phaseKills++;
    if (!G.alerted) for (const o of enemies) if (o.alive && o.pos.distanceTo(e.pos) < 14) { addAlert(30); break; }
    if (G.phaseKills === 1 && !G.alerted) radio('Blanco abajo. Buen disparo, Cóndor. Continúe.', 0.6);
    renderObjectives();
    if (G.phaseKills >= G.required && G.phase === 1) startPhase2();
  }
  if (e.kind === 'boss') radio('Confirmado: alias Deivis, neutralizado. Esa red se queda sin cabeza.', 0.8);
  showHitmarker(true);
  if (headshot) showMessage('DISPARO A LA CABEZA', 1.2);
}

/* ============================ 8) ARMAS Y BALÍSTICA ============================ */
const bullets = [];
const bulletGeo = box(0.022, 0.022, 1.4), bulletMat = MB(0xfff0b0);
const guns = [];
let muzzleFlash = null;

function buildGuns() {
  const dk = new THREE.MeshStandardMaterial({ color: 0x3a4045, metalness: 0.25, roughness: 0.5, fog: false });
  const bl = new THREE.MeshStandardMaterial({ color: 0x1c1f22, metalness: 0.25, roughness: 0.42, fog: false });
  const tan = new THREE.MeshStandardMaterial({ color: 0x5d5a45, roughness: 0.8, fog: false });
  const glove = new THREE.MeshStandardMaterial({ color: 0x2b3026, roughness: 0.9, fog: false });
  const P = (geo, mat, x, y, z, g, rx) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; g.add(m); return m; };
  const tube = (r1, r2, len) => { const g = cyl(r1, r2, len, 12); g.rotateX(Math.PI / 2); return g; };
  const hands = (g, zFront, zBack) => { P(box(0.07, 0.07, 0.11), glove, -0.01, -0.06, zFront, g); P(box(0.065, 0.1, 0.07), glove, 0, -0.1, zBack, g);
    const arm = P(tube(0.045, 0.055, 0.5), glove, 0.1, -0.16, zBack + 0.28, g); arm.rotation.y = -0.3; arm.rotation.x = 0.25; };
  // 1) M24 de cerrojo
  let g = new THREE.Group();
  P(box(0.055, 0.075, 0.62), tan, 0, -0.01, 0.05, g); P(box(0.05, 0.1, 0.3), tan, 0, -0.03, 0.45, g);
  P(tube(0.014, 0.016, 0.6), bl, 0, 0.025, -0.5, g); P(tube(0.027, 0.027, 0.26), bl, 0, 0.025, -0.9, g);
  P(tube(0.026, 0.026, 0.34), bl, 0, 0.095, 0.0, g); P(tube(0.036, 0.03, 0.08), bl, 0, 0.095, -0.2, g); P(tube(0.03, 0.036, 0.07), bl, 0, 0.095, 0.2, g);
  P(box(0.02, 0.03, 0.03), bl, 0, 0.06, -0.08, g); P(box(0.02, 0.03, 0.03), bl, 0, 0.06, 0.1, g);
  P(box(0.015, 0.015, 0.07), dk, 0.045, 0.03, 0.14, g); P(new THREE.SphereGeometry(0.014, 6, 5), bl, 0.06, 0.02, 0.17, g);         // cerrojo
  for (const sx of [-0.05, 0.05]) { const leg = P(box(0.012, 0.16, 0.012), bl, sx, -0.09, -0.3, g); leg.rotation.z = sx * 5; }      // bípode
  hands(g, -0.12, 0.2); g.userData = { hip: [0.24, -0.23, -0.52], ads: [0, -0.1, -0.3], muzzle: -1.05 }; guns.push(g);
  // 2) Galil ACE
  g = new THREE.Group();
  P(box(0.055, 0.085, 0.42), dk, 0, 0, 0, g); P(box(0.05, 0.06, 0.26), bl, 0, 0.005, -0.33, g);
  P(tube(0.013, 0.013, 0.2), bl, 0, 0.012, -0.55, g); P(tube(0.027, 0.027, 0.2), bl, 0, 0.012, -0.72, g);
  const mag = P(box(0.036, 0.2, 0.07), bl, 0, -0.13, -0.05, g); mag.rotation.x = 0.25;
  P(box(0.04, 0.1, 0.05), dk, 0, -0.085, 0.12, g); P(box(0.035, 0.06, 0.26), dk, 0, -0.005, 0.33, g); P(box(0.04, 0.11, 0.04), dk, 0, -0.02, 0.46, g);
  P(box(0.05, 0.012, 0.07), bl, 0, 0.05, -0.02, g); P(box(0.006, 0.045, 0.06), bl, -0.024, 0.075, -0.02, g); P(box(0.006, 0.045, 0.06), bl, 0.024, 0.075, -0.02, g); P(box(0.054, 0.006, 0.06), bl, 0, 0.098, -0.02, g);
  hands(g, -0.3, 0.12); g.userData = { hip: [0.22, -0.2, -0.42], ads: [0, -0.078, -0.3], muzzle: -0.84 }; guns.push(g);
  // 3) Pistola Córdova
  g = new THREE.Group();
  P(box(0.034, 0.045, 0.2), bl, 0, 0.02, 0, g); P(box(0.032, 0.03, 0.17), dk, 0, -0.012, 0.01, g);
  const grip = P(box(0.032, 0.12, 0.05), dk, 0, -0.075, 0.07, g); grip.rotation.x = -0.2;
  P(tube(0.02, 0.02, 0.17), bl, 0, 0.02, -0.18, g); P(box(0.008, 0.012, 0.01), bl, 0, 0.05, 0.085, g); P(box(0.006, 0.012, 0.008), bl, 0, 0.05, -0.09, g);
  P(box(0.075, 0.09, 0.08), glove, 0, -0.08, 0.075, g); const arm = P(tube(0.045, 0.055, 0.5), glove, 0.06, -0.14, 0.36, g); arm.rotation.y = -0.2; arm.rotation.x = 0.2;
  g.userData = { hip: [0.2, -0.19, -0.42], ads: [0, -0.062, -0.34], muzzle: -0.3 }; guns.push(g);
  for (const gg of guns) { gg.visible = false; camera.add(gg); gg.traverse(o => { o.frustumCulled = false; }); }
  muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, depthTest: false }));
  muzzleFlash.scale.setScalar(0.16); camera.add(muzzleFlash);
}
const curW = () => WEAPONS[player.weapon];
function scopedFov() { const w = curW(); return 2 * Math.atan(Math.tan(CFG.FOV * Math.PI / 360) / w.zoom[Math.min(player.zoomI, w.zoom.length - 1)]) * 180 / Math.PI; }

function fire() {
  const w = curW();
  if (player.reloading || player.fireCd > 0 || player.busy > 0 || player.healing > 0 || G.missionOver) return;
  if (player.ammo[player.weapon] <= 0) { SFX.dry(); showMessage('CARGADOR VACÍO — [R] PARA RECARGAR', 1.5); player.fireCd = 0.3; return; }
  player.ammo[player.weapon]--; G.shots++; player.fireCd = w.cd;
  SFX.shot(w.id);
  let ox, oy;
  if (player.ads > 0.8) { const sp = w.scope ? 0 : w.ads; ox = player.sway.x + (Math.random() - 0.5) * sp * 2; oy = player.sway.y + (Math.random() - 0.5) * sp * 2; }
  else { const sp = w.spread * (player.moving ? 1.6 : 1) * (player.stance === 'stand' ? 1 : 0.6); ox = (Math.random() - 0.5) * sp; oy = (Math.random() - 0.5) * sp; }
  const dir = new THREE.Vector3(ox, oy, -1).normalize().applyQuaternion(camera.quaternion);
  const m = new THREE.Mesh(bulletGeo, bulletMat); m.visible = false; scene.add(m);
  bullets.push({ pos: camera.position.clone(), vel: dir.multiplyScalar(w.speed), life: 3, m, travelled: 0, w });
  // Retroceso real de cámara + animación del arma + fogonazo + casquillo
  const kick = w.recoil * (player.stance === 'prone' ? 0.5 : (player.stance === 'crouch' ? 0.75 : 1));
  camera.rotation.x = Math.min(1.5, camera.rotation.x + kick); camera.rotation.y += (Math.random() - 0.5) * kick * 0.5;
  player.recoilBack += kick * 0.6; player.gunKick = 1;
  muzzleFlash.material.opacity = 0.9; muzzleFlash.material.rotation = Math.random() * 6;
  const sh = new THREE.Mesh(shellGeo, shellMat); sh.position.copy(camera.position).add(_v.set(0.2, -0.12, -0.3).applyQuaternion(camera.quaternion)); scene.add(sh);
  debris.push({ m: sh, vel: _v.set(2 + Math.random(), 2 + Math.random(), 0.3).applyQuaternion(camera.quaternion).clone(), spin: 20, life: 2.5, r: 0.01 });
  // El sonido suprimido aún se oye de cerca
  for (const e of enemies) if (e.alive && e.state !== 'combat' && e.pos.distanceTo(player.pos) < (w.id === 'sniper' ? 30 : 22)) { addAlert(35); break; }
  updateAmmoHUD();
  if (player.ammo[player.weapon] === 0 && player.reserve[player.weapon] > 0) showMessage('[R] RECARGAR', 1.5);
}
function reload() {
  const i = player.weapon, w = curW();
  if (player.reloading || player.ammo[i] >= w.mag || player.reserve[i] <= 0 || G.missionOver || player.busy > 0) return;
  player.reloading = true; player.reloadT = w.reload; SFX.reload(w.reload); updateAmmoHUD();
}
function switchWeapon(i) {
  if (i === player.weapon || i < 0 || i > 2 || player.healing > 0) return;
  player.weapon = i; player.reloading = false; player.busy = 0.45; player.zoomI = 0;
  setADS(false); SFX.swap();
  guns.forEach((g, k) => { g.visible = k === i; });
  updateAmmoHUD();
}
function removeBullet(i) { scene.remove(bullets[i].m); bullets.splice(i, 1); }
function destroyAntenna() {
  if (!G.antenna) return;
  G.antenna = false; SFX.spark();
  antennaGroup.userData.led.visible = false; antennaGroup.userData.fall = 0.001;
  _v.set(ANT.x + 0.9, terrainH(ANT.x, ANT.z) + 1, ANT.z);
  for (let i = 0; i < 14; i++) spawnParticle(_v, _v2.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(7), 0.6, 0.25, 0xfff0a0, { add: true, grav: 9, opacity: 1 });
  showMessage('ANTENA DE RADIO DESTRUIDA', 2.5);
  radio('Antena fuera de servicio. Ya no pueden pedir refuerzos. Bien pensado.', 0.8);
  renderObjectives();
}
// Proyectiles con gravedad: sub-pasos de 0,4 m contra enemigos, estructuras y terreno
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i], sp = b.w.speed;
    const steps = Math.max(1, Math.ceil(sp * dt / 0.4)), h = dt / steps;
    let done = false;
    for (let s = 0; s < steps && !done; s++) {
      b.vel.y -= CFG.GRAVITY * h; b.pos.addScaledVector(b.vel, h); b.travelled += sp * h;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = b.pos.x - e.pos.x, dz = b.pos.z - e.pos.z, dy = b.pos.y - e.pos.y, hd = dx * dx + dz * dz;
        if (hd > 0.3 || dy < 0 || dy > 1.92) continue;
        const head = hd + (dy - 1.74) * (dy - 1.74) < 0.045;
        if (head || (hd < 0.105 && dy < 1.6)) {
          G.hits++; SFX.hit(); dustPuff(b.pos, 0x8a2a22, 5);
          e.hp -= head ? b.w.head : b.w.body; e.flinch = 0.35;
          if (e.hp <= 0) killEnemy(e, head); else { showHitmarker(false); if (!G.alerted) setAlerted(); }
          done = true; break;
        }
      }
      if (done) break;
      if (engineer && !G.missionOver) {                             // ¡cuidado con la rehén!
        const dx = b.pos.x - engineer.pos.x, dz = b.pos.z - engineer.pos.z, dy = b.pos.y - engineer.pos.y;
        if (dx * dx + dz * dz < 0.1 && dy > 0 && dy < (engineer.seated ? 1.35 : 1.85)) { lose('Abatiste a la ingeniera Daniela Rangel. Las bajas civiles son inaceptables: misión abortada.'); return; }
      }
      if (G.antenna) { const ax = b.pos.x - ANT.x - 0.9, az = b.pos.z - ANT.z, ay = b.pos.y - antennaGroup.position.y;
        if ((ax * ax + az * az < 0.6 && ay < 1.4 && ay > 0) || ((b.pos.x - ANT.x) ** 2 + az * az < 0.12 && ay < 9 && ay > 0)) { destroyAntenna(); done = true; break; } }
      for (const c of colliders) {
        const dx = b.pos.x - c.x, dz = b.pos.z - c.z;
        if (dx * dx + dz * dz < c.r * c.r && b.pos.y < c.y + c.h && b.pos.y > c.y - 0.5) { dustPuff(b.pos, 0x9a9488, 3); done = true; break; }
      }
      if (done) break;
      const th = terrainH(b.pos.x, b.pos.z);
      if (b.pos.y <= th || b.pos.y <= CFG.WATER_Y - 0.3) {
        b.pos.y = Math.max(th, CFG.WATER_Y) + 0.05;
        dustPuff(b.pos, b.pos.y < 0 ? 0xbfe0d0 : 0x8a8270, 5);
        if (!G.alerted) for (const e of enemies) if (e.alive && e.pos.distanceTo(b.pos) < 6) { addAlert(45); if (!G.alerted) showMessage('¡IMPACTO CERCANO! EL ENEMIGO SOSPECHA', 1.6); break; }
        done = true;
      }
    }
    b.life -= dt;
    if (done || b.life <= 0) { removeBullet(i); continue; }
    b.m.visible = b.travelled > 4; b.m.position.copy(b.pos); b.m.lookAt(_v.copy(b.pos).add(b.vel));
  }
}

/* ============================ 9) MISIÓN Y TRAMA ============================ */
const G = {
  state: 'menu', next: 'playing', kit: 'sniper',
  phase: 1, time: 0, kills: 0, headshots: 0, phaseKills: 0, required: 8, shots: 0, hits: 0,
  alerted: false, everAlerted: false, alertLevel: 0, antenna: true,
  inter: [], intel: {}, c4Count: 0, countdown: -1, detonated: false, missionOver: false, beepT: 0, timers: [], lowHpWarned: false
};
const c4Markers = {}, c4Meshes = [];
let scorchMarks = [];
function after(sec, fn) { G.timers.push({ t: G.time + sec, fn }); }
const done = id => { const it = G.inter.find(i => i.id === id); return !!(it && it.done); };

function buildC4Markers() {
  for (const s of SITES) {
    const g = new THREE.Group(); g.position.set(s.x, terrainH(s.x, s.z), s.z);
    const holo = MB(0x3df2ff, { transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 26, 10, 1, true), holo); beam.position.y = 13; g.add(beam);
    const ringMat = MB(0x6ff8ff, { transparent: true, opacity: 0.85, fog: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.07, 6, 40), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.4; g.add(ring);
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), ringMat); dia.position.y = 5.2; g.add(dia);
    g.userData = { ring, dia }; g.visible = false; scene.add(g); c4Markers[s.id] = g;
  }
}
function buildInteractables() {
  G.inter = [
    { id: 'water', phase: 2, x: -7, z: riverZ(-7) + 5.6, r: 3.2, req: true, wp: 'MUESTRA', label: '[F] ANALIZAR EL AGUA DEL RÍO CON EL KIT DE CAMPO', act: () => openIntel('water') },
    { id: 'gold', phase: 2, x: TABLE.x, z: TABLE.z, r: 3.4, req: true, wp: 'ORO', label: '[F] ASEGURAR LAS TORTAS DE ORO', act: secureGold },
    { id: 'laptop', phase: 2, x: LAB.x - 1, z: LAB.z + 0.6, r: 2.6, req: true, wp: 'COMPUTADOR', label: '[F] COPIAR DATOS DEL COMPUTADOR', act: () => openIntel('laptop') },
    { id: 'eng', phase: 2, x: ENG.x, z: ENG.z, r: 2.8, req: true, wp: 'REHÉN', label: '[F] LIBERAR A LA INGENIERA', act: freeEngineer },
    { id: 'board', phase: 2, x: LAB.x + 1.6, z: LAB.z - 0.2, r: 2.3, wp: 'DIAGRAMA', label: '[F] FOTOGRAFIAR EL DIAGRAMA DE CIANURACIÓN', act: () => openIntel('board') },
    { id: 'retort', phase: 2, x: -9, z: 24, r: 3, wp: 'RETORTA', label: '[F] DOCUMENTAR LA RETORTA DE MERCURIO', act: () => openIntel('retort') }
  ].concat(SITES.map(s => ({ id: s.id, phase: 3, x: s.x, z: s.z, r: 5.2, req: true, wp: 'C4', label: '[F] COLOCAR C4 — ' + s.name.toUpperCase(), act: () => placeC4(s) })));
}
function startPhase2() {
  G.phase = 2; G.alertLevel = 0; G.alerted = true;      // ya no queda nadie a quien alertar
  $('stealth').style.display = 'none'; SFX.pickup();
  showMessage('ZONA DESPEJADA — BAJA AL CAMPAMENTO', 4);
  radio('Zona despejada. Baje al campamento. Necesitamos pruebas: el oro, el computador, una muestra del río, y saque de ahí a la ingeniera.', 1.2);
  renderObjectives();
}
function checkPhase2() {
  if (G.phase !== 2 || !['water', 'gold', 'laptop', 'eng', 'ph'].every(done)) return;
  G.phase = 3; SFX.pickup();
  for (const s of SITES) c4Markers[s.id].visible = true;
  flareGroup.visible = true; flareEmitter.active = true;
  showMessage('PRUEBAS ASEGURADAS — COLOCA 3 CARGAS DE C4', 4);
  radio('Tenemos lo necesario para la Fiscalía. Ahora destruya la planta: una carga en los tanques de cianuro, otra en el molino y la última en el socavón.', 2.5);
  renderObjectives();
}
function secureGold() {
  goldGroup.visible = false; SFX.pickup();
  showMessage('4,2 kg DE ORO INCAUTADOS', 2.5);
  radio('Oro asegurado. Eso vale más de mil quinientos millones de pesos que ya no financian a esa red.', 0.5);
}
function freeEngineer() {
  engineer.seated = false; engineer.free = true; SFX.pickup();
  speak('eng', '¡Gracias a Dios! Me obligaban a preparar el cianuro. Si el pH baja de diez se libera ácido cianhídrico, un gas que mata en minutos. ¡Y ellos lo botan al río!', { interrupt: true });
  showMessage('INGENIERA LIBERADA — SE DIRIGE A LA EXTRACCIÓN', 3);
  after(11, () => speak('eng', 'El mercurio es peor: no se degrada. Las bacterias lo vuelven metilmercurio y termina en los peces... y en la gente. Voy hacia la bengala verde.'));
}
function placeC4(site) {
  G.c4Count++; c4Markers[site.id].visible = false;
  const dx = player.pos.x - site.x, dz = player.pos.z - site.z, d = Math.hypot(dx, dz) || 1, x = site.x + dx / d * 2.4, z = site.z + dz / d * 2.4;
  const g = new THREE.Group(); g.position.set(x, terrainH(x, z) + 0.12, z); g.rotation.y = Math.atan2(dx, dz);
  addAt(new THREE.Mesh(box(0.42, 0.2, 0.28), M(0x8a7d55)), 0, 0, 0, g);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), MB(0xff2a1f)); led.position.set(0.12, 0.13, 0); g.add(led);
  g.userData.led = led; scene.add(g); c4Meshes.push(g);
  SFX.beep(900); setTimeout(() => SFX.beep(1400), 140);
  renderObjectives();
  if (G.c4Count >= 3) armCountdown(); else { showMessage(`C4 COLOCADO (${G.c4Count}/3)`, 2); if (G.c4Count === 1) radio('Primera carga lista. Faltan dos.', 0.4); }
}
function armCountdown() {
  G.countdown = CFG.C4_TIME; $('timer').style.display = 'block';
  startAlarm(); spawnReinforcements(true);
  showMessage('¡CARGAS ARMADAS! CORRE A LA BENGALA VERDE Y PULSA [G]', 5);
  radio('¡Cargas armadas! Convoy hostil entrando al valle: es alias Deivis. ¡Muévase a la bengala verde, ya!', 0.3);
  after(7, () => { const b = enemies.find(e => e.alive && e.kind === 'boss'); if (b) bark('reinf', b, true); });
  renderObjectives();
}
function inExtraction() { return Math.hypot(player.pos.x - EXTRACT.x, player.pos.z - EXTRACT.z) < 9; }
function tryDetonate() {
  if (G.phase !== 3 || G.c4Count < 3) { showMessage('PRIMERO COLOCA LAS 3 CARGAS DE C4', 1.8); return; }
  if (G.detonated) return;
  if (!inExtraction()) { showMessage('LLEGA A LA BENGALA VERDE PARA DETONAR A SALVO', 1.8); return; }
  detonate(true);
}
function detonate(safe) {
  G.detonated = true; G.missionOver = true; G.countdown = -1;
  $('timer').style.display = 'none'; stopAlarm();
  SITES.forEach((s, i) => {
    SFX.explosion(i * 0.4);
    after(i * 0.4, () => {
      const y = terrainH(s.x, s.z);
      explodeAt(s.x, y, s.z); siteGroups[s.id].visible = false;
      const sc = new THREE.Mesh(new THREE.CircleGeometry(7, 18), MB(0x0c0b0a, { transparent: true, opacity: 0.8 }));
      sc.rotation.x = -Math.PI / 2; sc.position.set(s.x, y + 0.25, s.z); scene.add(sc); scorchMarks.push(sc);
      emitters.push({ pos: new THREE.Vector3(s.x, y + 1, s.z), color: 0x1e1e1e, rate: 7, acc: 0, size: 4, active: true, rise: 4, temp: true, fire: true });
      player.shake = 1.6; flashScreen(0.85);
      for (const e of enemies) if (e.alive && Math.hypot(e.pos.x - s.x, e.pos.z - s.z) < 28) { e.alive = false; G.kills++; }
    });
  });
  for (const m of c4Meshes) m.visible = false;
  renderObjectives();
  if (safe) { after(2.6, () => radio('Detonación confirmada. Excelente trabajo, Cóndor. El páramo se lo agradece. Helicóptero en camino.')); after(7.5, win); }
  else after(1.6, () => lose('Las cargas detonaron antes de que alcanzaras la zona de extracción.'));
}
function win() {
  if (G.state !== 'playing') return;
  G.state = 'won'; SFX.victory();
  showEnd(true, 'MISIÓN CUMPLIDA: ECOSISTEMA PROTEGIDO Y ORO INCAUTADO',
    'La planta ilegal fue destruida, el vertimiento de cianuro y mercurio se detuvo, la ingeniera Daniela Rangel está a salvo y las pruebas van camino a la Fiscalía. El páramo respira de nuevo.');
}
function lose(reason) {
  if (!['playing', 'reading', 'ph'].includes(G.state)) return;
  G.state = 'dead'; G.missionOver = true; stopAlarm();
  showEnd(false, 'OPERADOR CAÍDO', reason);
}
function showEnd(won, title, text) {
  shutUp();
  const acc = G.shots ? Math.round(G.hits / G.shots * 100) : 0, mm = Math.floor(G.time / 60), ss = Math.floor(G.time % 60);
  const nIntel = Object.keys(G.intel).length;
  const rank = !won ? '—' : (!G.everAlerted && nIntel === 4 ? 'FANTASMA DEL PÁRAMO' : (!G.everAlerted ? 'SOMBRA' : (nIntel === 4 ? 'INVESTIGADOR' : 'OPERADOR')));
  $('end').className = 'screen ' + (won ? 'win' : 'lose');
  $('endTitle').textContent = title; $('endText').textContent = text;
  $('stats').innerHTML =
    `<span>Tiempo de misión</span><b>${mm}:${String(ss).padStart(2, '0')}</b>` +
    `<span>Precisión</span><b>${acc}% (${G.hits}/${G.shots})</b>` +
    `<span>Hostiles neutralizados</span><b>${G.kills} (${G.headshots} a la cabeza)</b>` +
    `<span>Inteligencia química recopilada</span><b>${nIntel}/4</b>` +
    `<span>Detectado</span><b>${G.everAlerted ? 'Sí' : 'No'}</b>` +
    `<span>Salud restante</span><b>${Math.max(0, Math.round(player.health))}%</b>` +
    `<span>Especialidad</span><b>${KIT_NAMES[G.kit]}</b>` +
    `<span>Calificación</span><b>${rank}</b>`;
  $('end').style.display = 'flex'; $('hud').style.display = 'none'; $('intel').style.display = 'none'; $('ph').style.display = 'none'; $('subs').style.opacity = 0;
  setADS(false); controls.unlock();
}
function resetMission() {
  shutUp();
  for (const e of enemies) scene.remove(e.mesh); enemies.length = 0;
  if (engineer) scene.remove(engineer.mesh); engineer = null;
  for (const p of pourProps) scene.remove(p); pourProps.length = 0; toxicPatches.length = 0;
  for (let i = bullets.length - 1; i >= 0; i--) removeBullet(i);
  for (const p of particles) { scene.remove(p.s); p.s.material.dispose(); } particles.length = 0;
  for (const d of debris) scene.remove(d.m); debris.length = 0;
  for (const t of tracers) scene.remove(t.l); tracers.length = 0;
  for (const f of flashes) scene.remove(f.light); flashes.length = 0;
  for (const r of rings) scene.remove(r.m); rings.length = 0;
  for (const m of c4Meshes) scene.remove(m); c4Meshes.length = 0;
  for (const s of scorchMarks) scene.remove(s); scorchMarks = [];
  for (let i = emitters.length - 1; i >= 0; i--) if (emitters[i].temp) emitters.splice(i, 1);
  for (const id in siteGroups) siteGroups[id].visible = true;
  for (const id in c4Markers) c4Markers[id].visible = false;
  goldGroup.visible = true; flareGroup.visible = false; flareEmitter.active = false;
  antennaGroup.rotation.set(0, 0, 0); antennaGroup.userData.fall = 0; antennaGroup.userData.led.visible = true;
  stopAlarm();
  Object.assign(G, { phase: 1, time: 0, kills: 0, headshots: 0, phaseKills: 0, shots: 0, hits: 0, alerted: false, everAlerted: false, alertLevel: 0, antenna: true,
    intel: {}, intelDone: false, c4Count: 0, countdown: -1, detonated: false, missionOver: false, beepT: 0, timers: [], lowHpWarned: false });
  Object.assign(player, { health: 100, stamina: 100, exhausted: false, weapon: G.kit === 'assault' ? 1 : 0, zoomI: 0,
    ammo: WEAPONS.map(w => w.mag), reserve: WEAPONS.map(w => w.reserve), medkits: G.kit === 'recon' ? 3 : 2,
    reloading: false, reloadT: 0, fireCd: 0, busy: 0, healing: 0, adsOn: false, ads: 0, gunKick: 0, recoilBack: 0, shake: 0, lastDamage: -99, heartT: 0,
    sprinting: false, moving: false, walkPhase: 0, staminaDelay: 0, stance: 'stand', eye: 1.7, vy: 0, jumpY: 0, onGround: true, lean: 0, stepAcc: 0 });
  if (G.kit === 'sniper') player.reserve[0] += 20;
  if (G.kit === 'assault') player.reserve[1] += 90;
  player.vel.set(0, 0); player.sway.set(0, 0);
  player.pos.set(SPAWN.x, terrainH(SPAWN.x, SPAWN.z) + 1.7, SPAWN.z);
  camera.position.copy(player.pos); camera.rotation.set(-0.33, 0, 0);
  camera.fov = CFG.FOV; camera.updateProjectionMatrix();
  for (const k in keys) keys[k] = false; mouseDown = false;
  spawnInitialEnemies(); buildInteractables();
  guns.forEach((g, k) => { g.visible = k === player.weapon; });
  setADS(false);
  $('stealth').style.display = 'block'; $('timer').style.display = 'none'; $('damage').style.opacity = 0; $('prompt').style.display = 'none';
  updateAmmoHUD(); renderObjectives();
}
function beginGameplay() {
  G.state = 'playing'; document.body.classList.remove('cine'); $('cine').style.display = 'none'; $('hud').style.display = 'block';
  camera.position.copy(player.pos); camera.rotation.set(-0.33, 0, 0); camera.fov = CFG.FOV; camera.updateProjectionMatrix();
  shutUp();
  showMessage('FASE 1 — NEUTRALIZA A LOS 8 HOSTILES SIN SER DETECTADO', 5);
  radio('Cóndor, aquí Halcón. Tiene luz verde. Empiece por el vigía de la torre, al oeste. Si dispara a la antena de radio, no podrán pedir refuerzos.', 1);
}

/* ============================ 10) JUGADOR ============================ */
const keys = {};
let mouseDown = false;
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector2(), sway: new THREE.Vector2(),
  health: 100, stamina: 100, weapon: 0, ammo: [5, 30, 15], reserve: [30, 120, 45], stance: 'stand', eye: 1.7, medkits: 2
};
let interactTarget = null;

function damagePlayer(d) {
  if (G.state !== 'playing' || G.missionOver) return;
  if (G.kit === 'assault') d *= 0.7;
  player.health -= d; player.lastDamage = G.time;
  SFX.hurt(); $('damage').style.opacity = 0.9; player.shake = Math.max(player.shake, 0.25);
  if (player.health <= 0) { player.health = 0; lose('Fuiste abatido por los guardias del campamento ilegal.'); return; }
  if (player.health < 35 && !G.lowHpWarned && player.medkits > 0) { G.lowHpWarned = true; radio('Cóndor, está herido. Cúbrase y use el botiquín: tecla cuatro.'); }
}
function setADS(on) {
  player.adsOn = on;
  const w = curW(), scoped = on && w.scope;
  $('scope').style.display = scoped ? 'block' : 'none';
  $('crosshair').style.display = scoped ? 'none' : 'block';
  $('crosshair').className = on && !w.scope ? 'dot' : '';
  controls.pointerSpeed = on ? (w.scope ? (player.zoomI ? 0.16 : 0.3) : 0.7) : 1.0;
  if (scoped) layoutDropMarks();
}
function setStance(s) {
  if (player.stance === s) s = 'stand';
  player.stance = s; $('stanceTxt').textContent = STANCES[s].name;
}
function useMedkit() {
  if (player.medkits <= 0 || player.health >= 100 || player.healing > 0) { if (player.medkits <= 0) showMessage('SIN BOTIQUINES', 1.5); return; }
  player.medkits--; player.healing = 2.6; setADS(false); SFX.heal(); showMessage('APLICANDO BOTIQUÍN…', 2.4);
  $('medTxt').textContent = '✚ ' + player.medkits;
}
function updatePlayer(dt) {
  const st = STANCES[player.stance], w = curW();
  // ---- Movimiento ----
  let ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const moving = ix !== 0 || iz !== 0; player.moving = moving;
  if (ix && iz) { ix *= 0.7071; iz *= 0.7071; }
  const shift = keys.ShiftLeft || keys.ShiftRight, scoped = player.adsOn && w.scope;
  if (shift && moving && iz > 0 && !player.adsOn && player.stance !== 'stand' && !player.exhausted) setStance('stand');     // como en PUBG: correr te levanta
  player.sprinting = shift && moving && iz > 0 && !player.adsOn && player.stance === 'stand' && !player.exhausted && player.stamina > 0 && player.healing <= 0;
  let speed = (player.sprinting ? CFG.RUN : (keys.ControlLeft ? CFG.WALK * 0.45 : CFG.WALK)) * STANCES[player.stance].speed;
  if (player.adsOn) speed *= 0.5;
  if (player.healing > 0) speed *= 0.4;
  if (player.pos.y - player.eye - player.jumpY < CFG.WATER_Y) speed *= 0.65;
  const k = Math.min(1, dt * (player.onGround ? 10 : 2));
  player.vel.x = lerp(player.vel.x, ix * speed, k); player.vel.y = lerp(player.vel.y, iz * speed, k);
  camera.position.copy(player.pos); camera.rotation.z = 0;
  controls.moveRight(player.vel.x * dt); controls.moveForward(player.vel.y * dt);
  let px = clamp(camera.position.x, BOUNDS.minX, BOUNDS.maxX), pz = clamp(camera.position.z, BOUNDS.minZ, BOUNDS.maxZ);
  for (const c of colliders) {
    const dx = px - c.x, dz = pz - c.z, d = Math.hypot(dx, dz), r = c.r + 0.4;
    if (d < r && d > 0.0001) { px = c.x + dx / d * r; pz = c.z + dz / d * r; }
  }
  // ---- Salto, postura y altura de ojos ----
  if (!player.onGround) { player.vy -= 16 * dt; player.jumpY += player.vy * dt;
    if (player.jumpY <= 0) { player.jumpY = 0; player.vy = 0; player.onGround = true; SFX.land(); player.shake = Math.max(player.shake, 0.08); } }
  player.eye = lerp(player.eye, STANCES[player.stance].eye, Math.min(1, dt * 9));
  const ground = Math.max(terrainH(px, pz), CFG.WATER_Y - 0.75), tgt = ground + player.eye + player.jumpY;
  player.pos.set(px, player.onGround ? lerp(player.pos.y, tgt, Math.min(1, dt * 16)) : tgt, pz);
  // Pasos
  if (moving && player.onGround) {
    const sp = Math.hypot(player.vel.x, player.vel.y);
    player.stepAcc += sp * dt; player.walkPhase += dt * (4 + sp * 1.1);
    if (player.stepAcc > (player.sprinting ? 2.3 : 1.7)) { player.stepAcc = 0; SFX.step(clamp(sp / 26, 0.03, 0.34), ground < CFG.WATER_Y + 0.1); }
  }
  // ---- Estamina (sprint y contener la respiración) ----
  const holdBreath = scoped && shift && player.stamina > 2;
  if (player.sprinting || holdBreath) {
    player.stamina = Math.max(0, player.stamina - (player.sprinting ? 15 : 11) * (G.kit === 'recon' ? 0.75 : 1) * dt); player.staminaDelay = 0.9;
    if (player.stamina <= 0 && player.sprinting) { player.exhausted = true; showMessage('SIN ALIENTO — LA ALTURA TE PASA FACTURA', 1.8); }
  } else {
    player.staminaDelay -= dt;
    if (player.staminaDelay <= 0) player.stamina = Math.min(100, player.stamina + (moving ? 6 : 10) * (player.pos.y > 20 ? 0.75 : 1) * dt);
    if (player.exhausted && player.stamina > 25) player.exhausted = false;
  }
  if (player.stamina < 35) { player.heartT -= dt; if (player.heartT <= 0) { SFX.heartbeat(); player.heartT = lerp(0.48, 1.0, player.stamina / 35); } }
  $('cold').style.opacity = clamp((40 - player.stamina) / 40, 0, 1) * 0.8;
  // ---- Salud ----
  if (player.healing > 0) { player.healing -= dt; if (player.healing <= 0) { player.health = Math.min(100, player.health + 60); G.lowHpWarned = false; SFX.pickup(); } }
  if (G.time - player.lastDamage > 7 && player.health < 50) player.health = Math.min(50, player.health + 1.5 * dt);
  // ---- Arma ----
  player.fireCd = Math.max(0, player.fireCd - dt); player.busy = Math.max(0, player.busy - dt);
  if (mouseDown && w.auto) fire();
  if (player.reloading) { player.reloadT -= dt;
    if (player.reloadT <= 0) { const i = player.weapon, n = Math.min(w.mag - player.ammo[i], player.reserve[i]); player.ammo[i] += n; player.reserve[i] -= n; player.reloading = false; updateAmmoHUD(); } }
  if (player.recoilBack > 0) { const r = Math.min(player.recoilBack, dt * 0.22); player.recoilBack -= r; camera.rotation.x -= r; }      // recuperación del retroceso
  player.gunKick = Math.max(0, player.gunKick - dt * 7);
  player.ads = lerp(player.ads, player.adsOn && !player.reloading && player.busy <= 0 ? 1 : 0, Math.min(1, dt * 12));
  const g = guns[player.weapon], ud = g.userData, a = player.ads, bob = moving && player.onGround ? 1 - a * 0.85 : 0;
  const low = (player.reloading ? 0.16 : 0) + player.busy * 0.6 + (player.healing > 0 ? 0.3 : 0) + (player.sprinting ? 0.05 : 0);
  g.position.set(lerp(ud.hip[0], ud.ads[0], a) + Math.sin(player.walkPhase * 0.5) * 0.007 * bob,
    lerp(ud.hip[1], ud.ads[1], a) + Math.abs(Math.sin(player.walkPhase * 0.5)) * 0.012 * bob - low + Math.sin(T * 1.6) * 0.0015,
    lerp(ud.hip[2], ud.ads[2], a) + player.gunKick * 0.06);
  g.rotation.set(player.gunKick * 0.05 - low * 2.2, player.sprinting ? 0.35 : 0, player.sprinting ? 0.15 : 0);
  g.visible = !(scoped && a > 0.85);
  muzzleFlash.position.set(g.position.x, g.position.y + 0.02, g.position.z + ud.muzzle);
  muzzleFlash.material.opacity = Math.max(0, muzzleFlash.material.opacity - dt * 22);
  // ---- Zoom y vaivén de la mira ----
  const targetFov = player.adsOn ? scopedFov() : (player.sprinting ? CFG.FOV + 5 : CFG.FOV);
  if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 12)); camera.updateProjectionMatrix(); }
  if (player.adsOn) {
    let amp = (0.0012 + (1 - player.stamina / 100) * 0.005 + (moving ? 0.004 : 0)) * STANCES[player.stance].sway * (G.kit === 'sniper' ? 0.6 : 1);
    if (holdBreath) amp *= 0.15;
    player.sway.set(Math.sin(T * 0.9) * amp + Math.sin(T * 2.3) * amp * 0.4, Math.cos(T * 1.15) * amp);
    if (scoped) { const pxRad = (window.innerHeight / 2) / Math.tan(camera.fov * Math.PI / 360);
      $('reticle').style.transform = `translate(${(player.sway.x * pxRad).toFixed(1)}px, ${(-player.sway.y * pxRad).toFixed(1)}px)`; }
  } else player.sway.set(0, 0);
  // ---- Inclinarse (Q/E), cabeceo y temblor ----
  player.lean = lerp(player.lean, (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0), Math.min(1, dt * 9));
  camera.position.copy(player.pos);
  if (Math.abs(player.lean) > 0.01) { _v.set(1, 0, 0).applyAxisAngle(_v2.set(0, 1, 0), camera.rotation.y); camera.position.addScaledVector(_v, player.lean * 0.5); camera.position.y -= Math.abs(player.lean) * 0.08; }
  camera.rotation.z = -player.lean * 0.17;
  if (moving && player.onGround && !player.adsOn) camera.position.y += Math.sin(player.walkPhase) * (player.sprinting ? 0.035 : 0.018);
  if (player.shake > 0) { const s = player.shake * 0.35;
    camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.position.z += (Math.random() - 0.5) * s;
    player.shake = Math.max(0, player.shake - dt * 0.55); }
  // ---- Interacción ----
  interactTarget = null;
  if (!G.missionOver) {
    let bd = 1e9;
    for (const it of G.inter) { if (it.done || G.phase < it.phase || (it.need && !it.need())) continue; const d = Math.hypot(px - it.x, pz - it.z); if (d < it.r && d < bd) { bd = d; interactTarget = it; } }
    if (!interactTarget && G.c4Count >= 3 && !G.detonated && inExtraction()) interactTarget = { det: true, label: '[G] DETONAR EL CAMPAMENTO' };
  }
  const pr = $('prompt');
  if (interactTarget) { if (pr.textContent !== interactTarget.label) pr.textContent = interactTarget.label; pr.style.display = 'block'; } else pr.style.display = 'none';
  // Audio ambiental dependiente de la posición
  if (riverGain) riverGain.gain.value = clamp(0.1 - Math.abs(pz - riverZ(px)) / 350, 0, 0.1);
  if (droneGain) droneGain.gain.value = lerp(droneGain.gain.value, (G.alerted && G.phase === 1) || G.countdown >= 0 ? 0.09 : 0.03, dt);
}
function interact() {
  const it = interactTarget; if (!it || it.det) return;
  if (it.manual) { it.act(); return; }
  it.done = true; it.act(); renderObjectives(); checkPhase2();
}

/* ---- Entrada ---- */
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (G.state === 'intro') { if (e.code === 'Space' || e.code === 'Enter') beginGameplay(); return; }
  if (G.state === 'reading') { if (['KeyF', 'Space', 'Enter'].includes(e.code)) closeIntel(); return; }
  if (G.state === 'ph') { phKey(e.code); return; }
  if (G.state !== 'playing') return;
  switch (e.code) {
    case 'KeyF': interact(); break;
    case 'KeyR': reload(); break;
    case 'KeyG': tryDetonate(); break;
    case 'KeyC': setStance('crouch'); break;
    case 'KeyZ': setStance('prone'); break;
    case 'Space': if (player.stance !== 'stand') setStance('stand'); else if (player.onGround && player.stamina > 8) { player.vy = 5.6; player.onGround = false; player.jumpY = 0.01; player.stamina -= 8; player.staminaDelay = 0.9; } break;
    case 'Digit1': switchWeapon(0); break;
    case 'Digit2': switchWeapon(1); break;
    case 'Digit3': switchWeapon(2); break;
    case 'Digit4': useMedkit(); break;
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousedown', e => {
  if (G.state === 'reading') { closeIntel(); return; }
  if (G.state !== 'playing' || !controls.isLocked) return;
  if (e.button === 0) { mouseDown = true; fire(); }
  else if (e.button === 2 && player.healing <= 0) setADS(!player.adsOn);
});
document.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });
document.addEventListener('wheel', e => {
  if (G.state !== 'playing') return;
  const w = curW();
  if (player.adsOn && w.scope) { player.zoomI = e.deltaY < 0 ? 1 : 0; setADS(true); }
  else switchWeapon((player.weapon + (e.deltaY > 0 ? 1 : 2)) % 3);
}, { passive: true });
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });

controls.addEventListener('lock', () => {
  for (const id of ['menu', 'loadout', 'pause', 'end']) $(id).style.display = 'none';
  if (AC && AC.state === 'suspended') AC.resume();
  if (G.next === 'intro') startIntro();
  else if (G.next === 'reading' || G.next === 'ph') { G.state = G.next; $('hud').style.display = 'block'; }
  else if (G.next === 'start') beginGameplay();
  else { G.state = 'playing'; $('hud').style.display = 'block'; }
});
controls.addEventListener('unlock', () => {
  if (!['playing', 'intro', 'reading', 'ph'].includes(G.state)) return;
  G.next = G.state === 'intro' ? 'intro' : G.state; G.state = 'paused';
  for (const k in keys) keys[k] = false; mouseDown = false;
  shutUp(); $('pause').style.display = 'flex';
  if (AC) AC.suspend();
  const b = $('resumeBtn'); b.disabled = true; setTimeout(() => { b.disabled = false; }, 1300);   // Chrome exige ~1 s tras ESC
});
document.addEventListener('pointerlockerror', () => { if (G.state !== 'paused') showMessage('NO SE PUDO CAPTURAR EL RATÓN — HAZ CLIC DE NUEVO', 3); });

$('startBtn').addEventListener('click', () => { initAudio(); loadVoices(); $('menu').style.display = 'none'; $('loadout').style.display = 'flex'; G.state = 'loadout'; });
document.querySelectorAll('.kit').forEach(el => el.addEventListener('click', () => {
  G.kit = el.dataset.kit; initAudio(); resetMission(); G.state = 'loadout'; G.next = 'intro'; lockPointer();
}));
$('resumeBtn').addEventListener('click', () => { lockPointer(); });
$('restartBtn').addEventListener('click', () => { initAudio(); resetMission(); G.state = 'loadout'; G.next = 'start'; lockPointer(); $('restartBtn').blur(); });

/* ============================ 11) HUD E INTELIGENCIA ============================ */
const OBJECTIVES = [
  { phase: 1, text: () => `Neutralizar a los hostiles del campamento (${Math.min(G.required, G.phaseKills)}/${G.required})`, done: () => G.phaseKills >= G.required },
  { phase: 1, opt: true, text: () => 'Opcional: destruir la antena de radio de un disparo', done: () => !G.antenna },
  { phase: 2, text: () => 'Analizar el agua del río [F]', done: () => done('water') },
  { phase: 2, text: () => 'Asegurar las tortas de oro [F]', done: () => done('gold') },
  { phase: 2, text: () => 'Copiar los datos del computador [F]', done: () => done('laptop') },
  { phase: 2, text: () => 'Liberar a la ingeniera Daniela Rangel [F]', done: () => done('eng') },
  { phase: 2, opt: true, text: () => `Opcional: documentar el proceso químico (${(done('board') ? 1 : 0) + (done('retort') ? 1 : 0)}/2)`, done: () => done('board') && done('retort') },
  { phase: 3, text: () => `Colocar C4: tanques, molino y socavón (${G.c4Count}/3)`, done: () => G.c4Count >= 3 },
  { phase: 3, text: () => 'Llegar a la bengala verde y detonar [G]', done: () => G.detonated, need: () => G.c4Count >= 3 }
];
const PHASE_TITLES = ['', 'FASE 1 · INFILTRACIÓN Y FRANCOTIRADOR', 'FASE 2 · ASALTO, PRUEBAS Y RESCATE', 'FASE 3 · SABOTAJE CON C4 Y EXTRACCIÓN'];
function renderObjectives() {
  $('phaseTitle').textContent = PHASE_TITLES[G.phase];
  $('objList').innerHTML = OBJECTIVES.filter(o => o.phase <= G.phase && (!o.need || o.need()) && !(o.phase < G.phase && o.opt && !o.done()) && !(o.phase < G.phase - 1))
    .map(o => `<li class="${o.done() ? 'done' : ''}${o.opt ? ' opt' : ''}">${o.text()}</li>`).join('');
}
let msgTimer = 0, hitT = 0, flashT = 0;
function showMessage(text, secs) { const m = $('message'); m.textContent = text; m.style.opacity = 1; msgTimer = secs || 2; }
function showHitmarker(kill) { const h = $('hitmarker'); h.className = kill ? 'kill' : ''; h.style.opacity = 1; hitT = kill ? 0.45 : 0.2; h.style.transform = kill ? 'scale(1.5)' : 'scale(1)'; }
function flashScreen(v) { flashT = v; }
function updateAmmoHUD() {
  const i = player.weapon;
  $('weaponName').textContent = WEAPONS[i].name;
  $('ammoCount').innerHTML = `${player.ammo[i]} <small>/ ${player.reserve[i]}</small>`;
  $('ammoState').textContent = player.reloading ? 'RECARGANDO…' : (player.ammo[i] === 0 ? 'VACÍO — [R]' : (WEAPONS[i].auto ? 'AUTOMÁTICO' : (WEAPONS[i].scope ? 'CERROJO' : 'SEMIAUTOMÁTICA')));
  for (let k = 0; k < 3; k++) $('slot' + k).className = k === i ? 'on' : '';
  $('medTxt').textContent = '✚ ' + player.medkits;
}
function layoutDropMarks() {
  const w = curW(), pxRad = (window.innerHeight / 2) / Math.tan(scopedFov() * Math.PI / 360);
  let html = '';
  for (const d of [50, 100, 150, 200]) {
    const y = CFG.GRAVITY * d / (2 * w.speed * w.speed) * pxRad, wd = 34 - d * 0.09;
    html += `<div class="drop" style="top:${y.toFixed(1)}px;left:${(-wd / 2).toFixed(1)}px;width:${wd.toFixed(1)}px"><span>${d}</span></div>`;
  }
  $('dropMarks').innerHTML = html;
}
let rangeT = 0;
const _dir = new THREE.Vector3();
function updateRangefinder(dt) {
  rangeT -= dt; if (rangeT > 0) return; rangeT = 0.15;
  camera.getWorldDirection(_dir);
  const o = camera.position; let found = -1;
  for (let s = 2; s < 340; s += 1.5) { const x = o.x + _dir.x * s, y = o.y + _dir.y * s, z = o.z + _dir.z * s; if (y <= terrainH(x, z) || y <= CFG.WATER_Y) { found = s; break; } }
  for (const e of enemies) { if (!e.alive) continue; _v.copy(e.pos); _v.y += 1.1; _v.sub(o); const t = _v.dot(_dir);
    if (t > 2 && (found < 0 || t < found + 3) && _v.lengthSq() - t * t < 1.2) found = t; }
  if (found < 0) { $('rangeInfo').textContent = `${curW().zoom[player.zoomI]}x · DIST ---`; return; }
  const tof = found / curW().speed, drop = 0.5 * CFG.GRAVITY * tof * tof;
  $('rangeInfo').textContent = `${curW().zoom[player.zoomI]}x · DIST ${found.toFixed(0)} m · CAÍDA ${drop.toFixed(2)} m · VUELO ${tof.toFixed(2)} s`;
}
// Marcadores de objetivo proyectados en pantalla
const wpEls = [];
for (let i = 0; i < 7; i++) { const d = document.createElement('div'); d.className = 'waypoint'; $('wps').appendChild(d); wpEls.push(d); }
function activeTargets() {
  const list = [];
  if (G.detonated) return list;
  if (G.c4Count >= 3) { list.push({ x: EXTRACT.x, z: EXTRACT.z, h: 2.5, label: 'EXTRACCIÓN', ext: true }); return list; }
  for (const it of G.inter) if (!it.done && G.phase >= it.phase && (!it.need || it.need())) list.push({ x: it.x, z: it.z, h: it.phase === 3 ? 5 : 2.4, label: it.wp, opt: !it.req });
  if (G.phase === 1 && G.antenna) list.push({ x: ANT.x + 0.9, z: ANT.z, h: 1.6, label: 'ANTENA', opt: true });
  return list;
}
function updateWaypoints() {
  const list = activeTargets(), W = window.innerWidth, H = window.innerHeight;
  for (let i = 0; i < wpEls.length; i++) {
    const el = wpEls[i], w = list[i];
    if (!w) { el.style.display = 'none'; continue; }
    _v.set(w.x, terrainH(w.x, w.z) + w.h, w.z);
    const dist = Math.hypot(w.x - player.pos.x, w.z - player.pos.z);
    _v.project(camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) { el.style.display = 'none'; continue; }
    el.style.display = 'block'; el.className = 'waypoint' + (w.ext ? ' ext' : '') + (w.opt ? ' opt' : '');
    el.style.left = ((_v.x * 0.5 + 0.5) * W).toFixed(0) + 'px'; el.style.top = ((-_v.y * 0.5 + 0.5) * H).toFixed(0) + 'px';
    el.textContent = `${w.label} ${dist.toFixed(0)} m`;
  }
}
// Minimapa táctico (enlace satelital): norte arriba, centrado en el jugador
const mm = $('minimap').getContext('2d'); let mmT = 0;
function updateMinimap(dt) {
  mmT -= dt; if (mmT > 0) return; mmT = 0.1;
  const S = 150, sc = 0.62, px = player.pos.x, pz = player.pos.z, X = x => S / 2 + (x - px) * sc, Y = z => S / 2 + (z - pz) * sc;
  mm.clearRect(0, 0, S, S);
  mm.strokeStyle = 'rgba(110,200,120,.75)'; mm.lineWidth = 7; mm.beginPath();
  for (let x = px - 130; x <= px + 130; x += 8) { const a = X(x), b = Y(riverZ(x)); if (x === px - 130) mm.moveTo(a, b); else mm.lineTo(a, b); } mm.stroke();
  mm.fillStyle = 'rgba(180,160,110,.35)'; mm.fillRect(X(-42), Y(8), 84 * sc, 44 * sc);
  for (const t of activeTargets()) { mm.fillStyle = t.ext ? '#6dff8a' : (t.opt ? '#c9d6dd' : '#6ff3ff'); const a = clamp(X(t.x), 4, S - 4), b = clamp(Y(t.z), 4, S - 4);
    mm.beginPath(); mm.moveTo(a, b - 4); mm.lineTo(a + 4, b); mm.lineTo(a, b + 4); mm.lineTo(a - 4, b); mm.fill(); }
  mm.fillStyle = '#ff4a3d'; for (const e of enemies) if (e.alive) { mm.beginPath(); mm.arc(X(e.pos.x), Y(e.pos.z), 2.4, 0, 6.3); mm.fill(); }
  if (engineer) { mm.fillStyle = '#b6ff9a'; mm.beginPath(); mm.arc(X(engineer.pos.x), Y(engineer.pos.z), 2.6, 0, 6.3); mm.fill(); }
  const yaw = camera.rotation.y; mm.save(); mm.translate(S / 2, S / 2); mm.rotate(-yaw);
  mm.fillStyle = 'rgba(255,255,255,.12)'; mm.beginPath(); mm.moveTo(0, 0); mm.arc(0, 0, 46, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); mm.fill();
  mm.fillStyle = '#fff'; mm.beginPath(); mm.moveTo(0, -6); mm.lineTo(4, 5); mm.lineTo(0, 2.5); mm.lineTo(-4, 5); mm.fill(); mm.restore();
  mm.fillStyle = '#ffc94d'; mm.font = '10px monospace'; mm.fillText('N', S / 2 - 3, 10);
  const hd = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
  $('compass').textContent = `◄ ${String(Math.round(hd)).padStart(3, '0')}° ${['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(hd / 45) % 8]} ►`;
}
const hudCache = { h: -1, s: -1, a: -1, alt: -1 };
function updateHUD(dt) {
  const h = Math.round(player.health), s = Math.round(player.stamina);
  if (h !== hudCache.h) { hudCache.h = h; $('healthFill').style.width = h + '%'; $('healthTxt').textContent = h; }
  if (s !== hudCache.s) { hudCache.s = s; $('staminaFill').style.width = s + '%'; $('staminaTxt').textContent = s; $('staminaFill').style.background = player.exhausted ? '#c26a2f' : ''; }
  if (G.phase === 1) { const a = Math.round(clamp(G.alertLevel, 0, 100));
    if (a !== hudCache.a) { hudCache.a = a; $('stealthFill').style.width = a + '%'; $('stealthTxt').textContent = G.alerted ? '¡DETECTADO!' : (a > 55 ? 'SOSPECHA' : 'OCULTO'); } }
  const alt = Math.round(3800 + player.pos.y);
  if (alt !== hudCache.alt) { hudCache.alt = alt; $('envInfo').textContent = `ALT ${alt.toLocaleString('es-CO')} m · ${(-2 - player.pos.y * 0.05).toFixed(0)} °C · O₂ 64 %`; }
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('message').style.opacity = 0; }
  if (hitT > 0) { hitT -= dt; if (hitT <= 0) $('hitmarker').style.opacity = 0; }
  const dmg = $('damage'); if (dmg.style.opacity > 0) dmg.style.opacity = Math.max(0, dmg.style.opacity - dt * 1.4);
  if (flashT > 0) flashT = Math.max(0, flashT - dt * 1.3); $('flash').style.opacity = flashT;
  if (G.countdown >= 0) $('timerVal').textContent = G.countdown.toFixed(1);
  if (player.adsOn && curW().scope) updateRangefinder(dt);
  updateWaypoints(); updateMinimap(dt);
}

/* ---- Paneles de inteligencia: la química real detrás de la misión ---- */
function flowSVG(steps) {
  const w = 184, h = 62, gap = 26; let x = 4, out = '';
  steps.forEach((s, i) => {
    out += `<rect x="${x}" y="6" width="${w}" height="${h}" rx="6" fill="${s.c || '#1d2b33'}" stroke="#9fd8b5"/>` +
      `<text x="${x + w / 2}" y="31" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="monospace">${s.t}</text>` +
      `<text x="${x + w / 2}" y="51" text-anchor="middle" fill="#cfe9dc" font-size="10" font-family="monospace">${s.s}</text>`;
    if (i < steps.length - 1) out += `<path d="M${x + w + 3} 37 h${gap - 8} m0 0 l-6 -5 m6 5 l-6 5" stroke="#ffc94d" stroke-width="2" fill="none"/>`;
    x += w + gap;
  });
  return `<svg viewBox="0 0 ${x - gap + 4} 74" width="100%" style="margin:8px 0">${out}</svg>`;
}
const INTEL = {
  board: { say: 'Diagrama de cianuración. El cianuro de sodio disuelve el oro en presencia de oxígeno: es la ecuación de Elsner. Luego el oro se recupera con polvo de zinc. Sin control de pH, el cianuro se vuelve gas letal.',
    html: () => `<h2>DIAGRAMA DE PROCESO · CIANURACIÓN DEL ORO</h2>` +
      flowSVG([{ t: 'TRITURACIÓN', s: 'roca aurífera → grava' }, { t: 'MOLIENDA', s: 'molino de bolas · <75 µm' }, { t: 'LIXIVIACIÓN', s: 'NaCN · pH 10,5–11 · 24–48 h', c: '#3a4a1a' }, { t: 'PRECIPITACIÓN', s: 'polvo de zinc (Merrill-Crowe)' }, { t: 'FUNDICIÓN', s: 'torta de oro · 1 064 °C', c: '#5a4410' }]) +
      `<div class="eq"><small>ECUACIÓN DE ELSNER — DISOLUCIÓN DEL ORO</small>4 Au + 8 NaCN + O₂ + 2 H₂O → 4 Na[Au(CN)₂] + 4 NaOH</div>` +
      `<div class="eq"><small>MERRILL-CROWE — RECUPERACIÓN CON ZINC</small>2 Na[Au(CN)₂] + Zn → Na₂[Zn(CN)₄] + 2 Au↓</div>` +
      `<div class="eq danger"><small>PELIGRO — POR ESO SE AÑADE CAL (pKa del HCN = 9,2)</small>CN⁻ + H₂O ⇌ HCN↑ + OH⁻ &nbsp;·&nbsp; por debajo de pH 9,2 predomina el ácido cianhídrico, gas letal</div>` +
      `<div class="eq good"><small>LO QUE HACE UNA MINA LEGAL — DESTRUCCIÓN DEL CIANURO</small>CN⁻ + H₂O₂ → OCN⁻ + H₂O &nbsp;(el cianato es unas mil veces menos tóxico)</div>` +
      `<p>En minería formal las colas se detoxifican y se confinan en relaves impermeabilizados. Aquí salen por una tubería directo al río.</p>` },
  retort: { say: 'Retorta de amalgamación. El mercurio atrapa el oro formando una amalgama; al quemarla, el mercurio se evapora y el oro queda. Ese vapor y el mercurio que cae al río terminan como metilmercurio en los peces.',
    html: () => `<h2>RETORTA DE AMALGAMACIÓN · EL CICLO DEL MERCURIO</h2>` +
      flowSVG([{ t: 'AMALGAMA', s: 'Au + Hg → Au·Hg' }, { t: 'QUEMA', s: 'Hg hierve a 357 °C', c: '#5a2a10' }, { t: 'VAPOR Hg⁰', s: 'neurotóxico al inhalar', c: '#4a1a1a' }, { t: 'RÍO Y LODOS', s: 'bacterias → CH₃Hg⁺', c: '#3a4a1a' }, { t: 'PECES → GENTE', s: 'bioacumulación', c: '#4a1a1a' }]) +
      `<div class="eq"><small>AMALGAMACIÓN Y QUEMA</small>Au + Hg → Au·Hg (amalgama) &nbsp;—calor→&nbsp; Au + Hg⁰↑</div>` +
      `<div class="eq danger"><small>METILACIÓN EN SEDIMENTOS (BACTERIAS ANAEROBIAS)</small>Hg²⁺ → CH₃Hg⁺ &nbsp;·&nbsp; el metilmercurio atraviesa la placenta y daña el sistema nervioso (enfermedad de Minamata)</div>` +
      `<p>El mercurio es un elemento: <b>no se degrada</b>, solo cambia de forma y de lugar. Se estima que la minería artesanal libera entre 1 y 3 gramos de mercurio por cada gramo de oro.</p>` +
      `<p>Colombia prohibió el mercurio en la minería desde 2018 (Ley 1658 de 2013) y es parte del Convenio de Minamata.</p>` },
  water: { say: 'Muestra del río analizada. Cianuro libre casi cincuenta veces por encima del límite para agua potable, y mercurio dieciocho veces por encima. Esta agua baja hacia los acueductos.',
    html: () => `<h2>KIT DE CAMPO · MUESTRA DEL RÍO (AGUAS ABAJO DEL VERTIMIENTO)</h2>` +
      `<table><tr><th>Parámetro</th><th>Lectura</th><th>Límite agua potable*</th><th>Exceso</th></tr>` +
      `<tr><td>Cianuro libre (CN⁻)</td><td class="bad">2,4 mg/L</td><td>0,05 mg/L</td><td class="bad">48 ×</td></tr>` +
      `<tr><td>Mercurio total (Hg)</td><td class="bad">0,018 mg/L</td><td>0,001 mg/L</td><td class="bad">18 ×</td></tr>` +
      `<tr><td>pH</td><td class="bad">10,2</td><td>6,5 – 9,0</td><td class="bad">alcalino (cal + NaCN)</td></tr>` +
      `<tr><td>Oxígeno disuelto</td><td class="bad">3,1 mg/L</td><td>&gt; 5 mg/L (vida acuática)</td><td class="bad">hipoxia</td></tr></table>` +
      `<p>* Resolución 2115 de 2007 (Colombia). Lecturas simuladas para el juego; los límites son reales.</p>` +
      `<div class="eq danger"><small>¿POR QUÉ ES TAN TÓXICO EL CIANURO?</small>El CN⁻ bloquea la citocromo c oxidasa: las células no pueden usar el oxígeno aunque la sangre lo lleve.</div>` +
      `<p>Los páramos colombianos aportan cerca del 70 % del agua que consume el país. El complejo Santurbán-Berlín abastece a Bucaramanga, Cúcuta y decenas de municipios.</p>` },
  laptop: { say: 'Datos copiados. Registran seiscientos kilos de cianuro y treinta y cinco de mercurio al mes. Y un mensaje: alias Deivis sube hoy con un convoy a recoger el oro.',
    html: () => `<h2>COMPUTADOR DEL CAMPAMENTO · ARCHIVOS COPIADOS</h2>` +
      `<table><tr><th>Registro mensual</th><th>Cantidad</th><th>Nota</th></tr>` +
      `<tr><td>Oro fundido (“tortas”)</td><td>16,8 kg</td><td>4,2 kg por semana</td></tr>` +
      `<tr><td>Cianuro de sodio (NaCN)</td><td class="bad">600 kg</td><td>contrabando, sin registro</td></tr>` +
      `<tr><td>Mercurio (Hg)</td><td class="bad">35 kg</td><td>prohibido en minería desde 2018</td></tr>` +
      `<tr><td>Cal (CaO)</td><td>900 kg</td><td>para mantener pH &gt; 10,5</td></tr>` +
      `<tr><td>Colas vertidas al río</td><td class="bad">~40 m³/día</td><td>sin tratamiento</td></tr></table>` +
      `<div class="eq"><small>MENSAJE ENTRANTE — 05:42</small>“Deivis vuelve hoy con el convoy por las tortas. Desde que se fue Arciniegas nadie mide el pH del tanque 2: que la ingeniera lo arregle. Si aparece la tropa, llamen por la antena.”</div>` +
      `<p>Con estos registros la Fiscalía puede rastrear a los compradores del oro y a los proveedores del cianuro.</p>` }
};
function openIntel(id) {
  G.intel[id] = true; G.state = 'reading'; mouseDown = false; for (const k in keys) keys[k] = false;
  SFX.camera();
  $('intelBox').innerHTML = INTEL[id].html() + `<div class="hint">INTELIGENCIA ${Object.keys(G.intel).length}/4 · [F] / [ESPACIO] CERRAR</div>`;
  $('intel').style.display = 'flex'; $('prompt').style.display = 'none';
  speak('narr', INTEL[id].say, { interrupt: true, tag: 'ANÁLISIS' });
}
function closeIntel() {
  if (G.state !== 'reading') return;
  $('intel').style.display = 'none'; G.state = 'playing'; shutUp(); $('subs').style.opacity = 0; subT = 0;
  if (Object.keys(G.intel).length === 4 && !G.intelDone) { G.intelDone = true; radio('Inteligencia completa. Con esto cae toda la red, no solo este campamento.', 0.5); }
}

/* ============================ 12) INTRO CINEMÁTICA ============================ */
const INTRO = [
  { t: 0, dur: 9, loc: 'PÁRAMO DE SANTURBÁN\nSANTANDER, COLOMBIA · 05:47', from: [-95, 46, 78], to: [-55, 34, 64], look: [0, 0, 22],
    say: 'Páramo de Santurbán. A tres mil ochocientos metros de altura, este ecosistema regula el agua de más de dos millones de personas.' },
  { t: 9, dur: 8.5, loc: 'FRAILEJÓN · Espeletia\nCRECE ≈ 1 cm POR AÑO', from: [26, 0, 86, 2.4], to: [19, 0, 82, 1.6], look: [8, 0, 96, 1.2],
    say: 'Los frailejones atrapan la niebla y la sueltan gota a gota. Crecen apenas un centímetro por año: uno de dos metros lleva aquí dos siglos.' },
  { t: 17.5, dur: 9, loc: 'VERTIMIENTO ILEGAL\nNaCN + Hg → RÍO', from: [-10, 2.6, -7], to: [5, 2.0, -5], look: [-2, 0.6, 5],
    say: 'La minería ilegal disuelve el oro con cianuro de sodio y lo atrapa con mercurio. Lo que sobra va directo al río.' },
  { t: 26.5, dur: 8.5, loc: 'REHÉN CONFIRMADA\nING. QUÍMICA DANIELA RANGEL', from: [-4, 0, 22, 2.2], to: [-8, 0, 25, 1.8], look: [ENG.x, 0, ENG.z, 1],
    say: 'Tienen secuestrada a una ingeniera química para operar la planta. Y hoy llega su jefe, alias Deivis, a recoger el oro.' },
  { t: 35, dur: 7, loc: 'OPERACIÓN SANTURBÁN\nCERO TOLERANCIA', from: [3, 0, 124, 3.2], to: [0.5, 0, 117, 2], look: [0, 0, 20],
    say: 'Su misión, Cóndor: pruebas, rescate y destrucción total de la planta. Cero tolerancia.' }
];
let introT = 0, introI = -1;
function startIntro() {
  G.state = 'intro'; introT = 0; introI = -1;
  document.body.classList.add('cine'); $('cine').style.display = 'block'; $('hud').style.display = 'none';
  guns.forEach(g => { g.visible = false; });
}
function updateIntro(dt) {
  introT += dt;
  let seg = INTRO.length - 1; while (seg > 0 && INTRO[seg].t > introT) seg--;
  const s = INTRO[seg];
  if (seg !== introI) { introI = seg; $('cineLoc').textContent = s.loc; speak('narr', s.say, { interrupt: seg === 0 }); if (seg === INTRO.length - 1) SFX.radio(); }
  const k = clamp((introT - s.t) / s.dur, 0, 1), e = k * k * (3 - 2 * k);
  const P = (a, o) => { o.set(a[0], a.length > 3 ? terrainH(a[0], a[2]) + a[3] : a[1], a[2]); return o; };
  camera.position.lerpVectors(P(s.from, _v), P(s.to, _v2), e);
  camera.lookAt(P(s.look, _v3));
  if (Math.abs(camera.fov - 55) > 0.1) { camera.fov = 55; camera.updateProjectionMatrix(); }
  if (introT > INTRO[INTRO.length - 1].t + INTRO[INTRO.length - 1].dur) { guns.forEach((g, i) => { g.visible = i === player.weapon; }); beginGameplay(); }
}

/* ============================ 13) BUCLE PRINCIPAL ============================ */
function updateWorld(dt) {
  waterTex.offset.x -= dt * 0.12;
  if (millDrum && siteGroups.c4b.visible) millDrum.rotation.x += dt * 1.4;
  if (millDrum2) millDrum2.rotation.x += dt * 2;
  const pulse = 0.55 + Math.sin(T * 3) * 0.2;
  for (const p of toxicPatches) p.material.opacity = pulse;
  for (const id in c4Markers) { const g = c4Markers[id]; if (!g.visible) continue;
    g.userData.ring.rotation.z += dt * 1.5; g.userData.ring.scale.setScalar(1 + Math.sin(T * 4) * 0.08);
    g.userData.dia.rotation.y += dt * 2; g.userData.dia.position.y = 5.2 + Math.sin(T * 2.5) * 0.4; }
  if (flareGroup.visible) flareLight.intensity = 5 + Math.sin(T * 17) * 1.2 + Math.random();
  const au = antennaGroup.userData;
  if (au.fall > 0 && au.fall < 1) { au.fall = Math.min(1, au.fall + dt * 1.2); antennaGroup.rotation.z = -au.fall * au.fall * 1.25; }
  else if (G.antenna) au.led.visible = Math.sin(T * 6) > 0;
  // Sol y sombras siguen al jugador; el cielo sigue a la cámara
  sun.target.position.set(Math.round(camera.position.x / 4) * 4, 0, Math.round(camera.position.z / 4) * 4);
  sun.position.copy(sun.target.position).add(SUN_OFF);
  skyDome.position.copy(camera.position);
}
function updateMission(dt) {
  if (G.countdown >= 0) {
    G.countdown -= dt; G.beepT -= dt;
    if (G.beepT <= 0) { SFX.beep(G.countdown < 8 ? 1700 : 1300); G.beepT = G.countdown < 5 ? 0.16 : (G.countdown < 12 ? 0.4 : 1);
      for (const m of c4Meshes) m.userData.led.visible = !m.userData.led.visible; }
    if (G.countdown <= 0) { G.countdown = 0; $('timerVal').textContent = '0.0'; detonate(inExtraction()); }
  }
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.time >= G.timers[i].t) { const fn = G.timers[i].fn; G.timers.splice(i, 1); fn(); }
}
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (subT > 0 && G.state !== 'paused') { subT -= dt; if (subT <= 0) $('subs').style.opacity = 0; }
  if (G.state === 'playing') {
    T += dt; G.time += dt;
    updatePlayer(dt); updateEnemies(dt); updateBullets(dt); updateMission(dt);
    updateWorld(dt); updateParticles(dt); updateMist(dt); updateHUD(dt);
  } else if (G.state === 'intro') {
    T += dt; updateIntro(dt); updateEnemies(dt); updateWorld(dt); updateParticles(dt); updateMist(dt);
  } else if (G.state === 'menu' || G.state === 'loadout' || G.state === 'won') {
    T += dt; updateWorld(dt); updateParticles(dt); updateMist(dt);
    if (G.state !== 'won') { camera.rotation.y = Math.sin(performance.now() * 0.00008) * 0.25; updateEnemies(dt); }
  }
  renderer.render(scene, camera);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (player.adsOn && curW().scope) layoutDropMarks();
});

