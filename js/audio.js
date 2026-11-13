'use strict';
/* =====================================================================
   AUDIO v3
   - Clips grabados (carpeta /audio) con efecto de lejanía: filtro,
     volumen y paneo según la distancia, más un eco de valle.
   - Cola de voces sintetizadas (narrador, radio, ingeniera): cada frase
     termina antes de empezar la siguiente; cada personaje usa una voz
     distinta cuando el navegador tiene varias.
   - Sin subtítulos.
   ===================================================================== */

// Duraciones de respaldo (s); se reemplazan por las reales al decodificar
const CLIPS = { chamo_saludo: 7.3, deivis_oro: 8.9, deivis_agua: 5.5, chamo_plan: 28.3, catire_plan: 12.4,
  combate1: 6.5, combate2: 9.4, combate3: 8.0, combate4: 9.9, combate5: 9.1, combate6: 13.3 };
const COMBAT_CLIPS = ['combate1', 'combate2', 'combate3', 'combate4', 'combate5', 'combate6'];
const clipBuf = {}, activeClips = [];
let clipsRequested = false, lastCombatClip = '';

function loadClips() {
  if (clipsRequested || !AC) return;
  clipsRequested = true;
  for (const n in CLIPS) {
    fetch('audio/' + n + '.ogg')
      .then(r => { if (!r.ok) throw new Error('http'); return r.arrayBuffer(); })
      .then(b => AC.decodeAudioData(b))
      .then(buf => { clipBuf[n] = buf; CLIPS[n] = buf.duration; })
      .catch(() => { clipBuf[n] = null; });        // p. ej. abierto con doble clic: se usa <audio>
  }
}
function clipDur(n) { return CLIPS[n]; }

// Reproduce un clip. o.ent = personaje del que sale el sonido; o.far = oído de lejos (binoculares)
function playClip(name, o) {
  o = o || {};
  if (!AC) return CLIPS[name];
  const buf = clipBuf[name], base = o.vol || 1.6;
  if (!buf) {                                        // respaldo sin efectos
    try {
      const el = new Audio('audio/' + name + '.ogg'); el.volume = o.far ? 0.7 : 0.95;
      const p = el.play(); if (p && p.catch) p.catch(() => {});
      activeClips.push({ el, name, ent: o.ent || null, base, combat: !!o.combat, end: AC.currentTime + CLIPS[name] });
    } catch (e) { /* sin audio */ }
    return CLIPS[name];
  }
  const src = AC.createBufferSource(); src.buffer = buf;
  const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = o.far ? 240 : 90;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.far ? 2600 : 8000;
  const g = AC.createGain(); g.gain.value = base * (o.far ? 0.95 : 1);
  const pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
  // Eco del valle
  const dl = AC.createDelay(1); dl.delayTime.value = o.far ? 0.33 : 0.24;
  const wet = AC.createBiquadFilter(); wet.type = 'lowpass'; wet.frequency.value = 1300;
  const fb = AC.createGain(); fb.gain.value = o.far ? 0.3 : 0.2;
  const echo = AC.createGain(); echo.gain.value = o.far ? 0.4 : 0.22;
  src.connect(hp); hp.connect(lp); lp.connect(g);
  if (pan) { g.connect(pan); pan.connect(master); } else g.connect(master);
  g.connect(dl); dl.connect(wet); wet.connect(fb); fb.connect(dl); wet.connect(echo); echo.connect(master);
  const c = { src, g, lp, pan, echo, name, ent: o.ent || null, base, combat: !!o.combat, far: !!o.far, end: AC.currentTime + buf.duration };
  src.onended = () => { const i = activeClips.indexOf(c); if (i >= 0) activeClips.splice(i, 1); setTimeout(() => { try { echo.disconnect(); fb.disconnect(); } catch (e) { /* ya */ } }, 2500); };
  src.start();
  activeClips.push(c);
  return buf.duration;
}
// Ajusta volumen, filtro y paneo de cada clip según dónde está quien habla
function updateClips() {
  if (!AC) return;
  for (let i = activeClips.length - 1; i >= 0; i--) {
    const c = activeClips[i];
    if (c.el) { if (AC.currentTime > c.end) activeClips.splice(i, 1); continue; }
    if (!c.ent || c.far) continue;
    const dx = c.ent.pos.x - player.pos.x, dz = c.ent.pos.z - player.pos.z, dist = Math.hypot(dx, dz);
    let vol = c.base * clamp(1.25 - dist / 95, 0.16, 1);
    if (c.ent.alive === false) { c.base *= 0.9; if (c.base < 0.03) { try { c.src.stop(); } catch (e) { /* ya */ } continue; } }
    c.g.gain.value = vol;
    c.lp.frequency.value = clamp(9000 - dist * 85, 1100, 9000);
    if (c.pan) { const yaw = camera.rotation.y; c.pan.pan.value = clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / (dist + 4), -0.85, 0.85); }
  }
}
function stopClips() {
  for (const c of activeClips) { try { if (c.el) c.el.pause(); else c.src.stop(); } catch (e) { /* ya */ } }
  activeClips.length = 0;
}

// Motor de vehículo sintetizado (v = 0..1)
let engNodes = null;
function engine(v) {
  if (!AC) return;
  if (!engNodes) {
    if (v <= 0) return;
    const o1 = AC.createOscillator(), o2 = AC.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
    const n = AC.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const nf = AC.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 420; nf.Q.value = 0.6;
    const ng = AC.createGain(); ng.gain.value = 0.5;
    const g = AC.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); n.connect(nf); nf.connect(ng); ng.connect(g); f.connect(g); g.connect(master);
    o1.start(); o2.start(); n.start();
    engNodes = { o1, o2, g };
  }
  engNodes.g.gain.value = v * 0.16;
  engNodes.o1.frequency.value = 48 + v * 55; engNodes.o2.frequency.value = 24 + v * 27.5;
}

/* ---------------- Voces sintetizadas en cola ---------------- */
const VOICE = {
  narr:  { langs: ['es-MX', 'es-US', 'es-ES', 'es-CO', 'es'], male: true,  pitch: 0.82, rate: 0.96, vol: 1 },
  radio: { langs: ['es-CO', 'es-MX', 'es-US', 'es-ES', 'es'], male: true,  pitch: 1.02, rate: 1.12, vol: 0.6 },
  eng:   { langs: ['es-CO', 'es-VE', 'es-MX', 'es-US', 'es'], male: false, pitch: 1.18, rate: 1.06, vol: 1 }
};
const MALE_RE = /gonzalo|jorge|raul|pablo|alvaro|diego|carlos|emilio|sebasti|tomas|male|hombre|david/i;
const FEMALE_RE = /salome|dalia|sabina|paulina|helena|laura|elvira|paola|elena|ximena|female|mujer|google/i;
let voiceMap = null;
const VQ = { q: [], cur: null };

function loadVoices() {
  if (!VO.ok) return;
  VO.voices = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
  voiceMap = null;
}
// Asigna una voz distinta a cada rol siempre que el navegador tenga suficientes
function assignVoices() {
  voiceMap = {};
  const used = [];
  for (const role of ['eng', 'radio', 'narr']) {
    const R = VOICE[role]; let best = null, score = -1;
    for (const v of VO.voices) {
      const lang = v.lang.replace('_', '-').toLowerCase();
      let s = 0;
      const li = R.langs.findIndex(l => lang.startsWith(l.toLowerCase())); s += li < 0 ? 0 : (R.langs.length - li);
      if ((R.male ? MALE_RE : FEMALE_RE).test(v.name)) s += 6;
      if ((R.male ? FEMALE_RE : MALE_RE).test(v.name)) s -= 4;
      if (/natural|online|neural/i.test(v.name)) s += 3;
      if (used.includes(v)) s -= 9;
      if (s > score) { score = s; best = v; }
    }
    voiceMap[role] = best; if (best) used.push(best);
  }
}
function subtitle() { /* sin subtítulos por decisión de diseño */ }

let radioBedNodes = null;
function radioBed(on) {
  if (!AC) return;
  if (on && !radioBedNodes) {
    const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2300; f.Q.value = 1.4;
    const g = AC.createGain(); g.gain.value = 0.045;
    src.connect(f); f.connect(g); g.connect(master); src.start(0, Math.random());
    radioBedNodes = { src, g };
  } else if (!on && radioBedNodes) {
    try { radioBedNodes.src.stop(); } catch (e) { /* ya */ }
    radioBedNodes.g.disconnect(); radioBedNodes = null;
  }
}
// Encola una línea; se parte en frases cortas para que el navegador no las corte
function speak(role, text, o) {
  o = o || {};
  if (role === 'enemy' || !VO.ok || !VOICE[role]) return;
  if (o.interrupt) shutUp();
  if (VQ.q.length > 10) return;
  const parts = text.match(/[^.!?…]+[.!?…]*/g) || [text];
  parts.forEach((p, i) => { p = p.trim(); if (p) VQ.q.push({ role, text: p, o, first: i === 0, last: i === parts.length - 1 }); });
  pumpVoice();
}
function pumpVoice() {
  if (VQ.cur || !VQ.q.length) return;
  if (!voiceMap) assignVoices();
  const j = VQ.q.shift(); VQ.cur = j;
  const R = VOICE[j.role], v = voiceMap[j.role];
  let pitch = R.pitch, rate = R.rate;
  if (j.o.emo === 'miedo') { pitch += 0.2; rate += 0.16; }
  else if (j.o.emo === 'urgente') { pitch += 0.1; rate += 0.1; }
  else if (j.o.emo === 'firme') { pitch -= 0.06; rate -= 0.05; }
  const fin = () => {
    if (VQ.cur !== j) return;
    VQ.cur = null;
    if (j.role === 'radio' && j.last) { radioBed(false); SFX.radioEnd(); }
    setTimeout(pumpVoice, j.role === 'radio' ? 90 : 160);
  };
  try {
    const u = new SpeechSynthesisUtterance(j.text.replace(/[¡¿]/g, ''));
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = R.langs[0];
    u.pitch = clamp(pitch + (Math.random() - 0.5) * 0.05, 0.1, 2); u.rate = rate; u.volume = R.vol;
    u.onend = fin; u.onerror = fin;
    if (j.role === 'radio' && j.first) { SFX.radio(); radioBed(true); }
    speechSynthesis.speak(u);
    setTimeout(fin, 2800 + j.text.length * 120);       // por si el navegador no avisa del final
  } catch (e) { fin(); }
}
function radio(text, delay) {
  setTimeout(() => { if (['playing', 'intro', 'ph'].includes(G.state)) speak('radio', text); }, (delay || 0) * 1000);
}
function shutUp() {
  VQ.q.length = 0; VQ.cur = null; radioBed(false);
  if (VO.ok) try { speechSynthesis.cancel(); } catch (e) { /* nada */ }
}
if (VO.ok) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

/* ---------------- Gritos de los hostiles = grabaciones ---------------- */
function bark(kind, e, force) {
  if (!e || !AC) return;
  const dist = e.pos.distanceTo(player.pos);
  if (kind === 'death') { SFX.shout(dist); return; }
  if (kind === 'idle') return;
  const n = activeClips.filter(c => c.combat).length;
  if (!force && (barkCd > 0 || n >= 2)) return;
  if (n >= 3) return;
  let name; do { name = COMBAT_CLIPS[Math.floor(Math.random() * COMBAT_CLIPS.length)]; } while (name === lastCombatClip);
  lastCombatClip = name;
  playClip(name, { ent: e, combat: true });
  barkCd = 4 + Math.random() * 6;
  if (kind === 'alert') setTimeout(() => {                     // un segundo hostil se suma casi a la vez
    const o = enemies.find(x => x.alive && x !== e && x.state === 'combat');
    if (o && G.state === 'playing') bark('combat', o, true);
  }, 1500);
}

// Al crear el audio, pedir también los clips
const _initAudioBase = initAudio;
initAudio = function () { _initAudioBase(); loadClips(); };
