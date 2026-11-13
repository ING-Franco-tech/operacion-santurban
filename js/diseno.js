'use strict';
/* =====================================================================
   DISEÑO v5 — geometrías suaves y ambiente
   1) Cajas con bordes redondeados
   2) Vehículos de carrocería curva (superficie continua): Kia rojo y camioneta
   3) Personajes con torso torneado y más detalle
   4) Vertimiento de cianuro y mercurio: chorro, salpicaduras, ondas y pluma río abajo
   5) Lluvia, relámpagos y truenos
   ===================================================================== */

/* ---------------- 1) Cajas suaves ---------------- */
function softBox(w, h, d) {
  const m = Math.min(w, h, d), b = Math.min(m * 0.14, 0.045);
  if (b < 0.004) return new THREE.BoxGeometry(w, h, d);
  const hw = w / 2 - b, hh = h / 2 - b, r = Math.min(b * 0.9, hw * 0.9, hh * 0.9), s = new THREE.Shape(), P = Math.PI;
  s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.absarc(hw - r, -hh + r, r, -P / 2, 0, false);
  s.lineTo(hw, hh - r); s.absarc(hw - r, hh - r, r, 0, P / 2, false);
  s.lineTo(-hw + r, hh); s.absarc(-hw + r, hh - r, r, P / 2, P, false);
  s.lineTo(-hw, -hh + r); s.absarc(-hw + r, -hh + r, r, P, P * 1.5, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

/* ---------------- 2) Vehículos de carrocería curva ---------------- */
// Cada vehículo se define por secciones a lo largo (x): piso, línea de cintura, techo, ancho y ancho del techo.
const CAR_SPECS = {
  suv: {                       // Kia rojo (SUV compacta)
    keys: [[-2.25, 0.55, 0.86, 0.96, 0.55, 0.45], [-2.1, 0.43, 1.02, 1.2, 0.86, 0.7], [-1.9, 0.36, 1.08, 1.62, 0.92, 0.66], [-1.5, 0.34, 1.08, 1.68, 0.925, 0.68],
      [-0.2, 0.34, 1.05, 1.68, 0.925, 0.69], [0.45, 0.34, 1.03, 1.6, 0.925, 0.68], [1.15, 0.34, 1.02, 1.1, 0.92, 0.74], [1.8, 0.36, 0.98, 1.04, 0.9, 0.72],
      [2.1, 0.43, 0.9, 0.95, 0.84, 0.62], [2.25, 0.55, 0.78, 0.83, 0.5, 0.36]],
    ws: [0.5, 1.16], rwz: [-2.1, -1.84], side: [-1.74, 0.48], pillars: [-0.6, -1.3], door: [-1.27, -0.63], wheelsX: [-1.32, 1.36], wheelR: 0.36, rails: true, badge: 'KIA'
  },
  pickup: {                    // camioneta de escolta con platón cubierto
    keys: [[-2.6, 0.6, 0.9, 0.95, 0.5, 0.42], [-2.45, 0.46, 1.05, 1.1, 0.86, 0.8], [-0.8, 0.42, 1.08, 1.12, 0.9, 0.84], [-0.55, 0.42, 1.08, 1.7, 0.9, 0.66],
      [0.3, 0.42, 1.06, 1.7, 0.9, 0.67], [0.62, 0.42, 1.05, 1.6, 0.9, 0.67], [1.3, 0.42, 1.04, 1.12, 0.9, 0.74], [2.1, 0.44, 1.0, 1.05, 0.88, 0.7],
      [2.45, 0.5, 0.92, 0.97, 0.8, 0.6], [2.6, 0.6, 0.8, 0.84, 0.5, 0.36]],
    ws: [0.66, 1.3], rwz: [-0.82, -0.56], side: [-0.5, 0.6], pillars: [-0.02], door: null, wheelsX: [-1.55, 1.6], wheelR: 0.38, rails: false, badge: ''
  }
};
function chaikinOpen(pts, it) {
  for (let k = 0; k < it; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    out.push(pts[pts.length - 1]); pts = out;
  }
  return pts;
}
// Media sección transversal (z >= 0), del centro del piso al centro del techo: [z, y]
function carHalf(s) {
  const cab = clamp((s.yr - s.yb) / 0.5, 0.15, 1), w = s.w, rw = s.rw;
  return chaikinOpen([[0, s.y0], [w * 0.78, s.y0], [w * 0.98, s.y0 + 0.11], [w, lerp(s.y0, s.yb, 0.5)], [w * 0.992, s.yb - 0.03], [w * 0.955, s.yb + 0.03],
    [lerp(w * 0.95, rw, 0.6), lerp(s.yb, s.yr, 0.6)], [rw, s.yr - 0.075 * cab], [rw * 0.7, s.yr - 0.012], [0, s.yr]], 2);
}
const CAR_COL = { clad: new THREE.Color(0x1a1b1d), glass: new THREE.Color(0x05080b), grille: new THREE.Color(0x0b0b0c), inside: new THREE.Color(0x040405) };
function carColor(S, paint, x, y, z, s, underDoor, xMax) {
  const az = Math.abs(z);
  if (y < s.y0 + 0.17) return CAR_COL.clad;                                                   // estribo y defensas plásticas
  for (const wx of S.wheelsX) if (az > s.w * 0.6 && Math.hypot(x - wx, y - S.wheelR) < S.wheelR + 0.17) return CAR_COL.clad;    // pasos de rueda
  if (x > xMax - 0.24 && y > s.y0 + 0.2 && y < s.yb - 0.06 && az < s.w * 0.62) return CAR_COL.grille;     // parrilla
  if (((x > S.ws[0] && x < S.ws[1]) || (x > S.rwz[0] && x < S.rwz[1])) && y > s.yb + 0.07 && az < s.rw * 0.94) return CAR_COL.glass;   // parabrisas y luneta
  if (x > S.side[0] && x < S.side[1] && s.yr - s.yb > 0.4 && y > s.yb + 0.075 && y < s.yr - 0.1 && az > s.rw * 0.9) {                 // ventanas laterales
    for (const p of S.pillars) if (Math.abs(x - p) < 0.05) return paint;
    return CAR_COL.glass;
  }
  return underDoor ? CAR_COL.inside : paint;
}
// kind: 'suv' (Kia rojo) | 'pickup'. Frente = +X. Misma interfaz que antes: ruedas, carrocería, puerta, stops.
function makeVehicle(kind, color) {
  const S = CAR_SPECS[kind], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const N = 60, xs = [], P = { y0: [], yb: [], yr: [], w: [], rw: [] }, names = ['y0', 'yb', 'yr', 'w', 'rw'];
  const xMin = S.keys[0][0], xMax = S.keys[S.keys.length - 1][0];
  for (let i = 0; i < N; i++) {
    const x = lerp(xMin, xMax, i / (N - 1)); xs.push(x);
    let k = 0; while (k < S.keys.length - 2 && x > S.keys[k + 1][0]) k++;
    const a = S.keys[k], b = S.keys[k + 1], t = clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
    names.forEach((n, q) => P[n].push(lerp(a[q + 1], b[q + 1], t)));
  }
  for (const n of names) for (let pass = 0; pass < 3; pass++) { const a = P[n].slice(); for (let i = 1; i < N - 1; i++) P[n][i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4; }
  const st = i => ({ y0: P.y0[i], yb: P.yb[i], yr: P.yr[i], w: P.w[i], rw: P.rw[i] });
  // Anillos de vértices: tapa trasera redondeada + secciones + tapa delantera
  const rings = [], ringSt = [];
  const mainRing = i => { const h = carHalf(st(i)), r = h.map(p => [xs[i], p[1], p[0]]); for (let j = h.length - 2; j >= 1; j--) r.push([xs[i], h[j][1], -h[j][0]]); return r; };
  const capRing = (i, f, off) => { const s = st(i), cy = (s.y0 + s.yr) / 2; return mainRing(i).map(p => [p[0] + off, cy + (p[1] - cy) * f, p[2] * f]); };
  rings.push(capRing(0, 0.42, -0.1), capRing(0, 0.74, -0.06)); ringSt.push(0, 0);
  for (let i = 0; i < N; i++) { rings.push(mainRing(i)); ringSt.push(i); }
  rings.push(capRing(N - 1, 0.74, 0.06), capRing(N - 1, 0.42, 0.1)); ringSt.push(N - 1, N - 1);
  const K = carHalf(st(0)).length, R = rings[0].length, paint = new THREE.Color(color);
  // Región de la puerta trasera derecha (queda oscura debajo; la puerta es una pieza aparte)
  let dr = null;
  if (S.door) {
    let ia = 0, ib = 0; for (let i = 0; i < N; i++) { if (xs[i] < S.door[0]) ia = i + 1; if (xs[i] <= S.door[1]) ib = i; }
    const mid = st(Math.round((ia + ib) / 2)), h = carHalf(mid); let ja = 0, jb = 0;
    for (let j = 0; j < K; j++) { if (h[j][1] < mid.y0 + 0.2) ja = j + 1; if (h[j][1] < mid.yr - 0.085) jb = j; }
    dr = { ia, ib, ja, jb };
  }
  const pos = [], col = [], uv = [], idx = [];
  rings.forEach((ring, ri) => ring.forEach((p, j) => {
    const i = ringSt[ri], inDoor = dr && ri >= dr.ia + 2 && ri <= dr.ib + 2 && j >= dr.ja && j <= dr.jb;
    const c = carColor(S, paint, p[0], p[1], p[2], st(i), inDoor, xMax);
    pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); uv.push(ri / rings.length, j / R);
  }));
  for (let ri = 0; ri < rings.length - 1; ri++) for (let j = 0; j < R; j++) {
    const a = ri * R + j, b = ri * R + (j + 1) % R, c = (ri + 1) * R + (j + 1) % R, d = (ri + 1) * R + j;
    idx.push(a, d, b, b, d, c);
  }
  for (const end of [0, rings.length - 1]) {                       // puntas
    const ring = rings[end], cy = ring.reduce((s, p) => s + p[1], 0) / R, ci = pos.length / 3;
    pos.push(ring[0][0] + (end ? 0.03 : -0.03), cy, 0); col.push(CAR_COL.clad.r, CAR_COL.clad.g, CAR_COL.clad.b); uv.push(end ? 1 : 0, 0.5);
    for (let j = 0; j < R; j++) { const a = end * R + j, b = end * R + (j + 1) % R; if (end) idx.push(a, ci, b); else idx.push(a, b, ci); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  // Si las normales salieron hacia adentro, se invierte el sentido de los triángulos
  const probe = (2 + Math.round(N / 2)) * R + Math.round(K * 0.35);
  if (geo.attributes.normal.getZ(probe) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); geo.computeVertexNormals(); }
  const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: kind === 'suv' ? 0.24 : 0.38 });
  const shell = new THREE.Mesh(geo, carMat); shell.castShadow = true; shell.receiveShadow = true; body.add(shell);
  const add = (geo2, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo2, mat); m.position.set(x, y, z); m.castShadow = true; (parent || body).add(m); return m; };
  const blackM = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.8 }), chrome = new THREE.MeshStandardMaterial({ color: 0xc2c6ca, metalness: 1, roughness: 0.22 });
  // Puerta: mismo trozo de superficie, con bisagra en el borde delantero
  let door = null;
  if (dr) {
    const hx = xs[dr.ib], hz = P.w[dr.ib], nrm = geo.attributes.normal, dp = [], dc = [], di = [], cols = dr.jb - dr.ja + 1;
    for (let ri = dr.ia + 2; ri <= dr.ib + 2; ri++) for (let j = dr.ja; j <= dr.jb; j++) {
      const v = ri * R + j, p = rings[ri][j], c = carColor(S, paint, p[0], p[1], p[2], st(ringSt[ri]), false, xMax);
      dp.push(p[0] + nrm.getX(v) * 0.016 - hx, p[1] + nrm.getY(v) * 0.016, p[2] + nrm.getZ(v) * 0.016 - hz); dc.push(c.r, c.g, c.b);
    }
    for (let a = 0; a < dr.ib - dr.ia; a++) for (let j = 0; j < cols - 1; j++) { const v = a * cols + j; di.push(v, v + cols, v + 1, v + 1, v + cols, v + cols + 1); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); dg.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3)); dg.setIndex(di); dg.computeVertexNormals();
    if (dg.attributes.normal.getZ(Math.floor(dp.length / 6)) < 0) { for (let i = 0; i < di.length; i += 3) { const t = di[i + 1]; di[i + 1] = di[i + 2]; di[i + 2] = t; } dg.setIndex(di); dg.computeVertexNormals(); }
    door = new THREE.Group(); door.position.set(hx, 0, hz); body.add(door);
    const dm = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.24, side: THREE.DoubleSide })); dm.castShadow = true; door.add(dm);
    add(new THREE.CapsuleGeometry(0.014, 0.12, 3, 8), chrome, -0.5, st(dr.ia).yb - 0.06, 0.03, door).rotation.z = Math.PI / 2;      // manija
  }
  // Luces
  const fs = st(N - 4), rs = st(3), stopMat = new THREE.MeshBasicMaterial({ color: 0x5a0d08 }), lampM = new THREE.MeshBasicMaterial({ color: 0xfff4d2 });
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.13, 14, 10), lampM, xMax - 0.3, fs.yb - 0.1, s * fs.w * 0.76).scale.set(1.1, 0.5, 1.5);
    add(new THREE.SphereGeometry(0.12, 14, 10), stopMat, xMin + 0.27, rs.yb - 0.03, s * rs.w * 0.8).scale.set(0.9, 0.55, 1.35);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 9, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff0cc, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.z = Math.PI / 2; beam.position.set(xMax + 4.4, fs.yb - 0.1, s * fs.w * 0.7); body.add(beam);
    add(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3 }), S.ws[1] - 0.2, st(N - 16).yb + 0.1, s * (st(N - 16).w + 0.09)).scale.set(0.8, 0.75, 1.25);    // retrovisor
  }
  if (S.rails) for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.02, 1.7, 3, 8), blackM, -0.7, 1.72, s * 0.52).rotation.z = Math.PI / 2;
  // Placas (amarillas) y emblema
  const plateTex = canvasTex(128, (c) => { c.fillStyle = '#e8c21a'; c.fillRect(0, 32, 128, 64); c.strokeStyle = '#111'; c.lineWidth = 3; c.strokeRect(3, 35, 122, 58);
    c.fillStyle = '#111'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.fillText(kind === 'suv' ? 'KIA·384' : 'BGA·217', 64, 76); });
  const plateM = new THREE.MeshBasicMaterial({ map: plateTex, transparent: true });
  const pf = add(new THREE.PlaneGeometry(0.46, 0.46), plateM, xMax + 0.085, st(N - 1).y0 + 0.02, 0); pf.rotation.y = Math.PI / 2; pf.castShadow = false;
  const pb = add(new THREE.PlaneGeometry(0.46, 0.46), plateM, xMin - 0.085, st(0).y0 + 0.12, 0); pb.rotation.y = -Math.PI / 2; pb.castShadow = false;
  if (S.badge) {
    const bt = canvasTex(128, (c) => { c.fillStyle = '#0d0d0e'; c.beginPath(); c.ellipse(64, 64, 60, 28, 0, 0, 6.3); c.fill(); c.strokeStyle = '#d8dce0'; c.lineWidth = 4; c.stroke();
      c.fillStyle = '#eef0f2'; c.font = 'bold 34px Arial'; c.textAlign = 'center'; c.fillText(S.badge, 64, 76); });
    const bm = new THREE.MeshBasicMaterial({ map: bt, transparent: true });
    const b1 = add(new THREE.PlaneGeometry(0.3, 0.3), bm, xMax - 0.02, st(N - 2).yb + 0.0, 0); b1.rotation.y = Math.PI / 2; b1.rotation.x = 0; b1.castShadow = false;
    const b2 = add(new THREE.PlaneGeometry(0.3, 0.3), bm, xMin + 0.06, st(2).yb + 0.06, 0); b2.rotation.y = -Math.PI / 2; b2.castShadow = false;
  }
  // Ruedas: grupo de dirección -> grupo de giro
  const wheels = [], WR = S.wheelR, tire = new THREE.TorusGeometry(WR - 0.11, 0.112, 14, 30), rimG = new THREE.CylinderGeometry(WR - 0.17, WR - 0.17, 0.15, 24); rimG.rotateX(Math.PI / 2);
  const rimM = new THREE.MeshStandardMaterial({ color: kind === 'suv' ? 0x3a3d40 : 0xa4a7aa, metalness: 0.9, roughness: 0.3 });
  for (const x of S.wheelsX) for (const s of [-1, 1]) {
    const steer = new THREE.Group(); steer.position.set(x, WR, s * (P.w[Math.round(N / 2)] - 0.12)); g.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    const t = new THREE.Mesh(tire, blackM); t.castShadow = true; spin.add(t);
    spin.add(new THREE.Mesh(rimG, rimM));
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, (WR - 0.2) * 2, 3, 8), blackM); sp.rotation.z = k * Math.PI / 5; sp.position.z = s * 0.075; spin.add(sp); }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), chrome); cap.scale.z = 0.5; cap.position.z = s * 0.08; spin.add(cap);
    wheels.push({ steer, spin, front: x > 0 });
  }
  g.userData = { wheels, body, door, stopMat, kind, st: {} };
  return g;
}

/* ---------------- 3) Personajes más suaves ---------------- */
function limb(len, r, mat) {
  const p = new THREE.Group(), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 1.3), 6, 16), mat);
  m.position.y = -len / 2; m.castShadow = true; p.add(m); return p;
}
function makeHumanoid(style) {
  const L = lookFor(style), k = L.complexion || 1, root = new THREE.Group(); root.rotation.order = 'YXZ';
  const skin = M(L.piel, { roughness: 0.7 }), shirt = M(L.camisa, { roughness: 0.85 }), pants = M(L.pantalon), shoes = M(L.zapatos, { roughness: 0.6 });
  const hairM = M(L.pelo, { roughness: 0.55 }), coat = L.bata ? M(0xf4f4f0, { roughness: 0.8 }) : shirt;
  const part = (geo, mat, x, y, z, parent, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
  const sph = r => new THREE.SphereGeometry(r, 20, 14);
  const lathe = pts => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 24);

  // Cadera y piernas
  const hips = new THREE.Group(); hips.position.y = 0.9; root.add(hips);
  part(sph(0.17), pants, 0, 0, 0, hips, 1.06 * k, 0.74, 0.84 * k);
  if (!L.bata) part(new THREE.TorusGeometry(0.168, 0.016, 6, 24), M(0x1a1512, { roughness: 0.6 }), 0, 0.085, 0, hips, 1.08 * k, 0.86 * k, 1).rotation.x = Math.PI / 2;     // cinturón
  const mkLeg = sx => {
    const leg = limb(0.44, 0.092 * k, pants); leg.position.set(sx * k, -0.04, 0); hips.add(leg);
    const shin = limb(0.42, 0.07 * (L.botas ? 1.15 : 1), L.botas ? M(0x15181a, { roughness: 0.35 }) : pants); shin.position.y = -0.44; leg.add(shin);
    part(sph(0.078), pants, 0, 0, 0.005, shin, 1, 1, 1);                                              // rodilla
    const foot = part(new THREE.CapsuleGeometry(0.047, 0.14, 4, 10), shoes, 0, -0.455, 0.055, shin, 1.05, 1, 1); foot.rotation.x = Math.PI / 2;
    part(softBox(0.1, 0.022, 0.25), M(0x0e0e0f, { roughness: 0.9 }), 0, -0.497, 0.055, shin);          // suela
    return [leg, shin];
  };
  const [legL, shinL] = mkLeg(-0.1), [legR, shinR] = mkLeg(0.1);

  // Torso torneado (cintura, pecho, hombros y base del cuello en una sola superficie)
  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
  part(lathe([[0.001, -0.03], [0.118, -0.03], [0.142, 0.03], [0.148, 0.14], [0.162, 0.28], [0.176, 0.39], [0.17, 0.455], [0.128, 0.505], [0.07, 0.535], [0.052, 0.57]]), coat, 0, 0, 0, torso, 1.28 * k, 1, 0.84 * k);
  if (L.chaleco != null) part(lathe([[0.001, 0.09], [0.158, 0.09], [0.17, 0.18], [0.186, 0.34], [0.184, 0.44], [0.14, 0.5], [0.085, 0.522]]), M(L.chaleco), 0, 0, 0, torso, 1.3 * k, 1, 0.92 * k);
  if (L.banda) part(new THREE.CylinderGeometry(0.185, 0.18, 0.05, 24), M(0xe8e8e8), 0, 0.27, 0, torso, 1.31 * k, 1, 0.93 * k);
  if (L.mochila) { part(new THREE.CapsuleGeometry(0.1, 0.18, 6, 12), M(0x2d3528), 0, 0.3, -0.19, torso, 1.3, 1, 0.8);
    for (const sx of [-0.12, 0, 0.12]) part(new THREE.CapsuleGeometry(0.035, 0.07, 4, 10), M(0x2d3528), sx, 0.2, 0.165, torso); }
  if (L.bata || L.camisaLarga) { const h = L.bata ? 0.6 : 0.26;
    part(new THREE.CylinderGeometry(0.2, L.bata ? 0.25 : 0.21, h, 24, 1, true), M(L.bata ? 0xf4f4f0 : L.camisa, { side: THREE.DoubleSide, roughness: 0.85 }), 0, 0.06 - h / 2, 0, torso, 1.1 * k, 1, 0.8 * k); }
  if (L.bata) part(new THREE.CapsuleGeometry(0.05, 0.16, 4, 10), shirt, 0, 0.36, 0.115, torso, 1.2, 1, 0.5);
  if (L.collar) { const c = part(new THREE.TorusGeometry(0.07, 0.004, 6, 28), M(0xd4a84a, { metalness: 0.9, roughness: 0.3 }), 0, 0.5, 0.045, torso); c.rotation.x = 1.15;
    part(sph(0.012), M(0xb48ae0, { metalness: 0.5, roughness: 0.3 }), 0, 0.445, 0.125, torso); }

  // Cabeza y rostro
  const head = new THREE.Group(); head.position.y = 0.56; torso.add(head);
  part(new THREE.CylinderGeometry(0.047, 0.056, 0.1, 16), skin, 0, 0.02, 0, head);
  part(new THREE.SphereGeometry(0.115, 28, 20), skin, 0, 0.165, 0, head, 0.94, 1.12, 1.02);
  part(sph(0.085), skin, 0, 0.105, 0.022, head, 0.96, 0.95, 1.0);                                     // mandíbula y mentón
  part(sph(0.022), skin, 0, 0.142, 0.113, head, 0.85, 1.3, 1);                                         // nariz
  for (const sx of [-0.108, 0.108]) part(sph(0.026), skin, sx, 0.155, 0, head, 0.5, 1, 0.75);          // orejas
  const eyeM = M(0x17110d, { roughness: 0.3 }), whiteM = M(0xf2efe8, { roughness: 0.4 });
  if (!L.pasamontanas) {
    for (const sx of [-0.042, 0.042]) { part(sph(0.017), whiteM, sx, 0.176, 0.094, head, 1.2, 0.72, 0.6); part(sph(0.0105), eyeM, sx, 0.176, 0.104, head);
      part(new THREE.CapsuleGeometry(0.0055, 0.034, 3, 8), hairM, sx, 0.203, 0.1, head).rotation.z = Math.PI / 2 - sx * 2.2; }
    part(new THREE.CapsuleGeometry(0.007, 0.036, 3, 8), M(L.bata ? 0xb8505a : 0x8a4a40, { roughness: 0.5 }), 0, 0.1, 0.104, head).rotation.z = Math.PI / 2;
  }
  const dome = (r, f) => new THREE.SphereGeometry(r, 26, 14, 0, Math.PI * 2, 0, Math.PI * f);
  if (L.casco != null) { part(dome(0.152, 0.5), M(L.casco, { roughness: 0.4 }), 0, 0.185, 0, head, 1, 1.02, 1.08);
    part(new THREE.TorusGeometry(0.158, 0.01, 6, 28), M(L.casco, { roughness: 0.4 }), 0, 0.188, 0.008, head, 1, 1.09, 1).rotation.x = Math.PI / 2; }
  else if (L.peinado === 'largo') {
    part(dome(0.128, 0.56), hairM, 0, 0.172, -0.01, head, 1, 1.13, 1.07);
    part(new THREE.CapsuleGeometry(0.1, 0.3, 6, 16), hairM, 0, -0.03, -0.078, head, 1.16, 1, 0.5);
    for (const sx of [-0.104, 0.104]) part(new THREE.CapsuleGeometry(0.034, 0.3, 6, 12), hairM, sx, -0.01, 0.028, head, 1, 1, 1.25);
  }
  else if (L.peinado === 'fade') { part(dome(0.12, 0.4), hairM, 0, 0.186, -0.006, head, 0.96, 1.13, 1.03);
    part(dome(0.117, 0.62), M(L.pelo, { roughness: 0.9, transparent: true, opacity: 0.55 }), 0, 0.166, -0.012, head, 0.97, 1.13, 1.0); }
  else part(dome(0.121, 0.5), hairM, 0, 0.174, -0.008, head, 0.97, 1.14, 1.04);
  if (L.gorra != null) { const gm = M(L.gorra, { roughness: 0.8 });
    part(dome(0.127, 0.46), gm, 0, 0.186, 0, head, 1, 1.06, 1.06);
    part(new THREE.CylinderGeometry(0.095, 0.095, 0.012, 20, 1, false, -Math.PI / 2, Math.PI), gm, 0, 0.208, 0.085, head, 1, 1, 1.15); }
  if (L.barba) { part(new THREE.SphereGeometry(0.108, 22, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), hairM, 0, 0.15, 0.014, head, 0.99, 1.22, 1.03);
    part(new THREE.CapsuleGeometry(0.009, 0.05, 3, 8), hairM, 0, 0.122, 0.11, head).rotation.z = Math.PI / 2; }
  if (L.bigote) part(new THREE.CapsuleGeometry(0.009, 0.05, 3, 8), hairM, 0, 0.122, 0.11, head).rotation.z = Math.PI / 2;
  if (L.pasamontanas) { part(sph(0.121), M(0x15181a), 0, 0.16, 0, head, 0.97, 1.16, 1.03); part(new THREE.CapsuleGeometry(0.014, 0.1, 3, 8), skin, 0, 0.178, 0.108, head).rotation.z = Math.PI / 2; }
  if (L.gafas === 'sol') {
    const lens = M(0x08080a, { roughness: 0.15, metalness: 0.7 });
    for (const sx of [-0.045, 0.045]) { const l = part(new THREE.CylinderGeometry(0.031, 0.031, 0.008, 20), lens, sx, 0.176, 0.112, head, 1.22, 1, 0.85); l.rotation.x = Math.PI / 2;
      part(new THREE.CapsuleGeometry(0.0028, 0.105, 2, 6), lens, sx * 2.35, 0.18, 0.06, head).rotation.x = Math.PI / 2; }
    part(new THREE.CapsuleGeometry(0.003, 0.026, 2, 6), lens, 0, 0.182, 0.114, head).rotation.z = Math.PI / 2;
  } else if (L.gafas === 'redondas') {
    const fr = M(L.colorGafas || 0xd99a9a, { roughness: 0.4 }), glass = M(0xdcecff, { transparent: true, opacity: 0.28, roughness: 0.1 });
    for (const sx of [-0.045, 0.045]) { part(new THREE.TorusGeometry(0.031, 0.0045, 8, 28), fr, sx, 0.176, 0.114, head);
      part(new THREE.CircleGeometry(0.03, 24), glass, sx, 0.176, 0.114, head);
      part(new THREE.CapsuleGeometry(0.0026, 0.105, 2, 6), fr, sx * 2.4, 0.18, 0.06, head).rotation.x = Math.PI / 2; }
    part(new THREE.CapsuleGeometry(0.0028, 0.026, 2, 6), fr, 0, 0.18, 0.116, head).rotation.z = Math.PI / 2;
  }

  // Brazos y manos
  const mkArm = sx => {
    const arm = limb(0.3, 0.062 * k, coat); arm.position.set(sx * (0.24 * k + 0.03), 0.48, 0); torso.add(arm);
    part(sph(0.072 * k), coat, 0, 0, 0, arm);
    const fore = limb(0.27, 0.05 * k, L.mangaCorta ? skin : coat); fore.position.y = -0.3; arm.add(fore);
    part(sph(0.058 * k), L.mangaCorta ? skin : coat, 0, 0, 0, fore);                                   // codo
    part(sph(0.046), skin, 0, -0.305, 0, fore, 0.8, 1.2, 0.55);                                        // palma
    part(new THREE.CapsuleGeometry(0.012, 0.035, 2, 6), skin, -sx * 0.03, -0.3, 0.02, fore).rotation.z = sx * 0.6;    // pulgar
    return [arm, fore];
  };
  const [armL, foreL] = mkArm(-1), [armR, foreR] = mkArm(1);

  // Arma
  const gun = new THREE.Group(); gun.position.set(0.14, 0.33, 0.28); torso.add(gun);
  const gm = M(0x16181a, { metalness: 0.5, roughness: 0.5 });
  if (style === 'op' || style === 'civ') part(softBox(0.035, 0.1, 0.18), gm, 0, 0, 0.06, gun);
  else { part(softBox(0.045, 0.075, 0.5), gm, 0, 0, 0.1, gun);
    const br = part(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 12), gm, 0, 0.01, 0.48, gun); br.rotation.x = Math.PI / 2;
    part(softBox(0.032, 0.19, 0.065), gm, 0, -0.11, 0.14, gun).rotation.x = 0.3;
    part(new THREE.CapsuleGeometry(0.03, 0.16, 4, 10), M(0x5a4226), 0, -0.02, -0.25, gun).rotation.x = Math.PI / 2; }
  root.userData = { hips, torso, head, armL, armR, foreL, foreR, legL, legR, shinL, shinR, gun, look: L };
  return root;
}

/* ---------------- 4) Vertimiento al río ---------------- */
const POUR = [];
let streamTex = null, plumeTex = null;
function pourTextures() {
  if (streamTex) return;
  streamTex = canvasTex(64, (g, s) => { g.clearRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.6})`; g.fillRect(Math.random() * s, Math.random() * s, 10 + Math.random() * 26, 2 + Math.random() * 5); } }, true);
  plumeTex = canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) { const x = Math.random() * s, y = s * (0.28 + Math.random() * 0.44), r = 9 + Math.random() * 20, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${0.2 + Math.random() * 0.3})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      for (const ox of [-s, 0, s]) { g.setTransform(1, 0, 0, 1, ox, 0); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }
    g.setTransform(1, 0, 0, 1, 0, 0); }, true);
}
// Monta un punto de vertimiento: barril inclinado en su cuna, chorro, ondas y pluma río abajo
function buildPour(x, isHg, op) {
  pourTextures();
  const zr = riverZ(x), keep = o => { scene.add(o); pourProps.push(o); return o; };
  const color = isHg ? 0xdfe8ee : 0x9dff3a, bz = zr + 5.6, by = terrainH(x, bz);
  const barrel = new THREE.Group(); barrel.position.set(x, by + 0.52, bz); barrel.rotation.x = -1.93; keep(barrel);
  const bm = M(isHg ? 0x8a8f96 : 0xd4b21f, { metalness: 0.45, roughness: 0.5 });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 24, 1, true), bm); shell.castShadow = true; barrel.add(shell);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), bm); cap.rotation.x = Math.PI / 2; cap.position.y = -0.45; barrel.add(cap);
  for (const yy of [-0.3, 0, 0.3]) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.014, 6, 28), bm); rib.rotation.x = Math.PI / 2; rib.position.y = yy; barrel.add(rib); }
  const lip = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), new THREE.MeshBasicMaterial({ color })); lip.rotation.x = -Math.PI / 2; lip.position.y = 0.4; barrel.add(lip);     // líquido en la boca
  for (const oz of [-0.25, 0.3]) { const log = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 12), M(0x5a4226))); log.rotation.z = Math.PI / 2; log.position.set(x, terrainH(x, bz + oz) + 0.07, bz + oz); log.castShadow = true; }
  // Chorro en arco desde la boca hasta el agua
  const mz = bz - 0.42, my = by + 0.36, wz = zr + 4.05, wy = CFG.WATER_Y + 0.03, pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(x, my + (wy - my) * t * t - 0.02 * t, lerp(mz, wz, t))); }
  const sm = new THREE.MeshBasicMaterial({ map: streamTex.clone(), color, transparent: true, opacity: 0.95, depthWrite: false });
  sm.map.needsUpdate = true; sm.map.repeat.set(3, 1);
  const stream = keep(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.055, 10), sm));
  const core = keep(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.03, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })));
  // Ondas en el punto de caída
  const ripples = [0, 1, 2].map(() => { const r = keep(new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 28), new THREE.MeshBasicMaterial({ color: isHg ? 0xf2f6f8 : 0xd8ffb0, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })));
    r.rotation.x = -Math.PI / 2; r.position.set(x, wy + 0.02, wz); return r; });
  // Pluma de contaminación que la corriente arrastra río abajo
  const pp = [], pc = [], pu = [], pi = [], c = new THREE.Color(isHg ? 0xc2d0d4 : 0x9be05a), SEG = 44;
  for (let k = 0; k <= SEG; k++) {
    const t = k / SEG, px = x + k * 0.92, zc = lerp(wz, riverZ(px) + (wz - zr) * 0.25, Math.min(1, t * 2.4)), hw = 0.25 + 2.1 * Math.sqrt(t), a = 0.62 * Math.pow(1 - t, 1.4) * Math.min(1, k / 2);
    pp.push(px, wy + 0.012, zc - hw, px, wy + 0.012, zc + hw); pu.push(k * 0.11, 0, k * 0.11, 1); pc.push(c.r, c.g, c.b, a, c.r, c.g, c.b, a);
    if (k) { const b = (k - 1) * 2; pi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
  pg.setAttribute('color', new THREE.Float32BufferAttribute(pc, 4)); pg.setIndex(pi);
  const pm = new THREE.MeshBasicMaterial({ map: plumeTex.clone(), vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  pm.map.needsUpdate = true;
  const plume = keep(new THREE.Mesh(pg, pm));
  const vapor = { pos: new THREE.Vector3(x, wy + 0.3, wz), color: isHg ? 0xd9e2e6 : 0xc9e05a, rate: 2.2, acc: 0, size: 0.55, active: true, rise: 0.7, temp: true };
  emitters.push(vapor);
  POUR.push({ op, barrel, stream, core, ripples, plume, vapor, hit: new THREE.Vector3(x, wy, wz), color, acc: 0, level: 1, seed: op.seed });
}
function updatePour(dt) {
  for (const p of POUR) {
    const on = p.op.alive && p.op.state !== 'combat';
    p.stream.visible = p.core.visible = on; p.vapor.active = on;
    p.level = lerp(p.level, on ? 1 : 0.28, Math.min(1, dt * 0.35));                   // al caer el operario, la pluma se va diluyendo
    p.plume.material.opacity = 0.9 * p.level; p.plume.material.map.offset.x -= dt * 0.22;
    p.barrel.rotation.x = -1.93 + (on ? Math.sin(T * 2.2 + p.seed) * 0.05 : 0.5 * (1 - p.level));
    p.ripples.forEach((r, i) => { const ph = (T * 0.75 + i / 3) % 1; r.visible = on; r.scale.setScalar(0.25 + ph * 1.9); r.material.opacity = (1 - ph) * 0.55; });
    if (!on) continue;
    p.stream.material.map.offset.x -= dt * 2.6;
    p.acc += dt * 15;
    while (p.acc >= 1) { p.acc -= 1;
      _v.set((Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 1.8, (Math.random() - 0.5) * 1.5);
      spawnParticle(p.hit, _v, 0.42, 0.11, p.color, { grav: 9, opacity: 0.85 }); }
  }
}

/* ---------------- 5) Lluvia, relámpagos y truenos ---------------- */
let rain = null, rainHead = null, splash = null, rainNodes = null;
const STORM = { next: 11, t: 0, on: false, hemi: null, base: 0.85 };
// Sustituye la bruma anterior: gotas en caída con viento y salpicaduras en el suelo
function buildMist() {
  const N = 1700; rainHead = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { rainHead[i * 3] = (Math.random() - 0.5) * 44; rainHead[i * 3 + 1] = Math.random() * 24 - 8; rainHead[i * 3 + 2] = (Math.random() - 0.5) * 44; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc6d4de, transparent: true, opacity: 0.3, depthWrite: false }));
  rain.frustumCulled = false; scene.add(rain);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3));
  splash = new THREE.Points(sg, new THREE.PointsMaterial({ map: softTex, color: 0xdfe9f0, size: 0.09, transparent: true, opacity: 0.3, depthWrite: false }));
  splash.frustumCulled = false; scene.add(splash);
}
function updateMist(dt) {
  const a = rain.geometry.attributes.position, p = camera.position, N = rainHead.length / 3, vy = 19, wx = 3.4, wz = 1.1, len = 0.03;
  for (let i = 0; i < N; i++) {
    let x = rainHead[i * 3] + wx * dt, y = rainHead[i * 3 + 1] - vy * dt, z = rainHead[i * 3 + 2] + wz * dt;
    if (y - p.y < -9) { y += 23; x = p.x + (Math.random() - 0.5) * 44; z = p.z + (Math.random() - 0.5) * 44; }
    if (x - p.x > 22) x -= 44; else if (x - p.x < -22) x += 44;
    if (z - p.z > 22) z -= 44; else if (z - p.z < -22) z += 44;
    rainHead[i * 3] = x; rainHead[i * 3 + 1] = y; rainHead[i * 3 + 2] = z;
    a.setXYZ(i * 2, x, y, z); a.setXYZ(i * 2 + 1, x + wx * len, y + vy * len, z + wz * len);
  }
  a.needsUpdate = true;
  const s = splash.geometry.attributes.position;                    // salpicaduras: cada cuadro se reubican algunas
  for (let k = 0; k < 14; k++) { const i = Math.floor(Math.random() * s.count), x = p.x + (Math.random() - 0.5) * 26, z = p.z + (Math.random() - 0.5) * 26;
    s.setXYZ(i, x, Math.max(terrainH(x, z), CFG.WATER_Y) + 0.05, z); }
  s.needsUpdate = true;
  updateWeather(dt);
}
function startRainSound() {
  const mk = (type, freq, q, gain) => { const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = AC.createGain(); g.gain.value = gain; src.connect(f); f.connect(g); g.connect(master); src.start(0, Math.random()); return g; };
  rainNodes = [mk('highpass', 2400, 0.3, 0.035), mk('bandpass', 900, 0.4, 0.03)];            // siseo fino + cuerpo suave
}
function thunder() {
  if (!AC || G.state === 'paused') return;
  noiseBurst({ freq: 700, freqEnd: 110, dur: 0.4, vol: 0.2, type: 'bandpass', q: 0.6 });
  noiseBurst({ freq: 240, freqEnd: 42, dur: 4.4, vol: 0.5, attack: 0.3 });
  noiseBurst({ freq: 170, freqEnd: 38, dur: 3.4, vol: 0.28, delay: 1.4, attack: 0.5 });
}
function updateWeather(dt) {
  if (AC && !rainNodes && noiseBuf) startRainSound();
  if (!STORM.hemi) { STORM.hemi = scene.children.find(o => o.isHemisphereLight); if (STORM.hemi) STORM.base = STORM.hemi.intensity; }
  STORM.next -= dt;
  if (STORM.next <= 0) { STORM.next = 17 + Math.random() * 26; STORM.t = 0; STORM.on = true; setTimeout(thunder, 900 + Math.random() * 2200); }
  let L = 0;
  if (STORM.on) { STORM.t += dt; const t = STORM.t;
    L = t < 0.07 ? 1 : (t < 0.14 ? 0.12 : (t < 0.24 ? 0.85 : (t < 0.62 ? 0.85 * (1 - (t - 0.24) / 0.38) : 0)));
    if (t > 0.62) STORM.on = false; }
  if (STORM.hemi) STORM.hemi.intensity = STORM.base + L * 2.4;
  if (skyDome) skyDome.material.color.setScalar(1 + L * 1.6);
}
// Suelo mojado: un poco más oscuro y brillante
function wetWorld() {
  const t = scene.userData.terrain;
  if (t) { t.material.roughness = 0.72; t.material.color.setScalar(0.88); t.material.needsUpdate = true; }
}
