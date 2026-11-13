'use strict';
/* =====================================================================
   MODELOS v3 — formas orgánicas y redondeadas
   - blobGeo: rocas, arbustos y copas con superficie irregular suave
   - makeHumanoid: personajes con cápsulas, rostro, pelo, barba, gafas
   - makeVehicle: camionetas con perfil suavizado y biselado
   ===================================================================== */

// Esfera deformada con normales suaves (roca / follaje)
function blobGeo(detail, amp, seed) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + amp * (Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 1.3) + 0.55 * Math.sin(v.z * 5.3 + v.x * 2.1 + seed) + 0.3 * Math.cos(v.y * 7.1 + v.z * 3.3));
    v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z);
    v.normalize(); n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/* ---------------- Personajes ---------------- */
const SKINS = [0xe2b897, 0xcc9d7a, 0xae7e58, 0x8f5f3e, 0x74503a];
function lookFor(style) {
  if (style === 'boss') return PERSONAJES.jefe.aspecto;
  if (style === 'civ') return PERSONAJES.ingeniera.aspecto;
  if (style === 'chamo') return PERSONAJES.chamo.aspecto;
  if (style === 'catire') return PERSONAJES.catire.aspecto;
  const piel = SKINS[Math.floor(Math.random() * SKINS.length)];
  if (style === 'op') return { piel, pelo: 0x1a120c, casco: 0xf2d21b, camisa: 0x3b4a63, chaleco: 0xff7a1a, banda: true, pantalon: 0x2f3542, zapatos: 0x1b1b1b, botas: true, mangaCorta: true };
  return { piel, pelo: 0x1a120c, casco: 0x2c3a26, camisa: 0x445238, chaleco: 0x20261f, mochila: true, pantalon: 0x3a4630, zapatos: 0x15130f, pasamontanas: Math.random() < 0.45, barba: Math.random() < 0.3 };
}
// Extremidad articulada redondeada (pivote arriba, cuelga hacia -Y)
function limb(len, r, mat) {
  const p = new THREE.Group(), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 1.3), 4, 10), mat);
  m.position.y = -len / 2; m.castShadow = true; p.add(m); return p;
}
function makeHumanoid(style) {
  const L = lookFor(style), k = L.complexion || 1, root = new THREE.Group(); root.rotation.order = 'YXZ';
  const skin = M(L.piel, { roughness: 0.72 }), shirt = M(L.camisa, { roughness: 0.85 }), pants = M(L.pantalon), shoes = M(L.zapatos, { roughness: 0.6 });
  const hairM = M(L.pelo, { roughness: 0.55 }), coat = L.bata ? M(0xf4f4f0, { roughness: 0.8 }) : shirt;
  const part = (geo, mat, x, y, z, parent, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
  const sph = r => new THREE.SphereGeometry(r, 14, 10);

  // Cadera y piernas
  const hips = new THREE.Group(); hips.position.y = 0.9; root.add(hips);
  part(sph(0.17), pants, 0, 0, 0, hips, 1.06 * k, 0.72, 0.82 * k);
  const mkLeg = sx => {
    const leg = limb(0.44, 0.09 * k, pants); leg.position.set(sx * k, -0.04, 0); hips.add(leg);
    const shin = limb(0.42, 0.07 * (L.botas ? 1.15 : 1), L.botas ? M(0x15181a, { roughness: 0.35 }) : pants); shin.position.y = -0.44; leg.add(shin);
    part(sph(0.07), shoes, 0, -0.45, 0.05, shin, 0.85, 0.6, 1.9);
    return [leg, shin];
  };
  const [legL, shinL] = mkLeg(-0.1), [legR, shinR] = mkLeg(0.1);

  // Torso
  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
  part(new THREE.CapsuleGeometry(0.15, 0.26, 4, 12), coat, 0, 0.27, 0, torso, 1.3 * k, 1, 0.86 * k);
  if (L.chaleco != null) part(new THREE.CapsuleGeometry(0.16, 0.18, 4, 12), M(L.chaleco), 0, 0.3, 0, torso, 1.36 * k, 1, 0.96 * k);
  if (L.banda) part(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), M(0xe8e8e8), 0, 0.27, 0, torso, 1.12 * k, 1, 0.84 * k);
  if (L.mochila) { part(new THREE.CapsuleGeometry(0.1, 0.18, 4, 8), M(0x2d3528), 0, 0.3, -0.19, torso, 1.3, 1, 0.8);
    for (const sx of [-0.12, 0, 0.12]) part(new THREE.CapsuleGeometry(0.035, 0.07, 3, 6), M(0x2d3528), sx, 0.2, 0.16, torso); }
  if (L.bata || L.camisaLarga) {                                   // faldón de bata / camisa por fuera
    const h = L.bata ? 0.6 : 0.26;
    part(new THREE.CylinderGeometry(0.2, L.bata ? 0.25 : 0.21, h, 16, 1, true), M(L.bata ? 0xf4f4f0 : L.camisa, { side: THREE.DoubleSide, roughness: 0.85 }), 0, 0.06 - h / 2, 0, torso, 1.1 * k, 1, 0.8 * k);
  }
  if (L.bata) part(new THREE.CapsuleGeometry(0.05, 0.16, 3, 8), shirt, 0, 0.36, 0.115, torso, 1.2, 1, 0.5);      // blusa visible bajo la bata
  if (L.collar) { const c = part(new THREE.TorusGeometry(0.07, 0.004, 5, 22), M(0xd4a84a, { metalness: 0.9, roughness: 0.3 }), 0, 0.5, 0.045, torso); c.rotation.x = 1.15;
    part(sph(0.012), M(0xb48ae0, { metalness: 0.5, roughness: 0.3 }), 0, 0.445, 0.125, torso); }

  // Cabeza y rostro
  const head = new THREE.Group(); head.position.y = 0.56; torso.add(head);
  part(new THREE.CylinderGeometry(0.048, 0.056, 0.1, 10), skin, 0, 0.02, 0, head);
  part(sph(0.115), skin, 0, 0.16, 0, head, 0.95, 1.15, 1.02);
  part(sph(0.022), skin, 0, 0.142, 0.113, head, 0.9, 1.25, 1);                                              // nariz
  for (const sx of [-0.108, 0.108]) part(sph(0.026), skin, sx, 0.155, 0, head, 0.5, 1, 0.75);               // orejas
  const eyeM = M(0x17110d, { roughness: 0.3 }), whiteM = M(0xf2efe8, { roughness: 0.4 });
  if (!L.pasamontanas) {
    for (const sx of [-0.042, 0.042]) { part(sph(0.017), whiteM, sx, 0.176, 0.094, head, 1.2, 0.75, 0.6); part(sph(0.0105), eyeM, sx, 0.176, 0.104, head);
      part(new THREE.BoxGeometry(0.046, 0.011, 0.012), hairM, sx, 0.203, 0.1, head).rotation.z = -sx * 2.2; }
    part(new THREE.CapsuleGeometry(0.007, 0.036, 2, 6), M(L.bata ? 0xb8505a : 0x8a4a40, { roughness: 0.5 }), 0, 0.103, 0.104, head).rotation.z = Math.PI / 2;   // boca
  }
  const dome = (r, f) => new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * f);
  if (L.casco != null) { part(dome(0.152, 0.5), M(L.casco, { roughness: 0.45 }), 0, 0.185, 0, head, 1, 1.02, 1.08);
    part(new THREE.CylinderGeometry(0.16, 0.165, 0.012, 18), M(L.casco, { roughness: 0.45 }), 0, 0.188, 0.01, head, 1, 1, 1.1); }
  else if (L.peinado === 'largo') {
    part(dome(0.128, 0.56), hairM, 0, 0.172, -0.01, head, 1, 1.13, 1.07);
    part(new THREE.CapsuleGeometry(0.1, 0.3, 4, 12), hairM, 0, -0.03, -0.078, head, 1.16, 1, 0.5);           // melena en la espalda
    for (const sx of [-0.104, 0.104]) part(new THREE.CapsuleGeometry(0.034, 0.3, 4, 8), hairM, sx, -0.01, 0.028, head, 1, 1, 1.25);   // mechones al frente
  }
  else if (L.peinado === 'fade') { part(dome(0.12, 0.4), hairM, 0, 0.186, -0.006, head, 0.96, 1.13, 1.03);
    part(dome(0.117, 0.62), M(L.pelo, { roughness: 0.9, transparent: true, opacity: 0.55 }), 0, 0.166, -0.012, head, 0.97, 1.13, 1.0); }
  else part(dome(0.121, 0.5), hairM, 0, 0.174, -0.008, head, 0.97, 1.14, 1.04);
  if (L.gorra != null) { const gm = M(L.gorra, { roughness: 0.8 });
    part(dome(0.127, 0.46), gm, 0, 0.186, 0, head, 1, 1.06, 1.06);
    part(new THREE.CylinderGeometry(0.095, 0.095, 0.012, 14, 1, false, -Math.PI / 2, Math.PI), gm, 0, 0.208, 0.085, head, 1, 1, 1.15); }
  if (L.barba) { part(new THREE.SphereGeometry(0.108, 16, 8, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48), hairM, 0, 0.15, 0.014, head, 0.99, 1.22, 1.03);
    part(new THREE.CapsuleGeometry(0.009, 0.05, 2, 6), hairM, 0, 0.122, 0.11, head).rotation.z = Math.PI / 2; }
  if (L.bigote) part(new THREE.CapsuleGeometry(0.009, 0.05, 2, 6), hairM, 0, 0.122, 0.11, head).rotation.z = Math.PI / 2;
  if (L.pasamontanas) { part(sph(0.121), M(0x15181a), 0, 0.16, 0, head, 0.97, 1.16, 1.03); part(new THREE.CapsuleGeometry(0.014, 0.1, 2, 6), skin, 0, 0.178, 0.108, head).rotation.z = Math.PI / 2; }
  if (L.gafas === 'sol') {
    const lens = M(0x08080a, { roughness: 0.15, metalness: 0.7 });
    for (const sx of [-0.045, 0.045]) { const l = part(new THREE.CylinderGeometry(0.031, 0.031, 0.008, 14), lens, sx, 0.176, 0.112, head, 1.22, 1, 0.85); l.rotation.x = Math.PI / 2;
      part(new THREE.BoxGeometry(0.004, 0.006, 0.11), lens, sx * 2.35, 0.18, 0.06, head); }
    part(new THREE.BoxGeometry(0.03, 0.006, 0.006), lens, 0, 0.182, 0.114, head);
  } else if (L.gafas === 'redondas') {
    const fr = M(L.colorGafas || 0xd99a9a, { roughness: 0.4 }), glass = M(0xdcecff, { transparent: true, opacity: 0.28, roughness: 0.1 });
    for (const sx of [-0.045, 0.045]) { part(new THREE.TorusGeometry(0.031, 0.0045, 6, 20), fr, sx, 0.176, 0.114, head);
      part(new THREE.CircleGeometry(0.03, 16), glass, sx, 0.176, 0.114, head);
      part(new THREE.BoxGeometry(0.004, 0.005, 0.11), fr, sx * 2.4, 0.18, 0.06, head); }
    part(new THREE.BoxGeometry(0.03, 0.005, 0.005), fr, 0, 0.18, 0.116, head);
  }

  // Brazos
  const mkArm = sx => {
    const arm = limb(0.3, 0.062 * k, coat); arm.position.set(sx * (0.24 * k + 0.03), 0.48, 0); torso.add(arm);
    part(sph(0.07 * k), coat, 0, 0, 0, arm);                                                              // hombro
    const fore = limb(0.27, 0.05 * k, L.mangaCorta ? skin : coat); fore.position.y = -0.3; arm.add(fore);
    part(sph(0.05), skin, 0, -0.3, 0, fore, 0.9, 1.1, 0.7);
    return [arm, fore];
  };
  const [armL, foreL] = mkArm(-1), [armR, foreR] = mkArm(1);

  // Arma
  const gun = new THREE.Group(); gun.position.set(0.14, 0.33, 0.28); torso.add(gun);
  const gm = M(0x16181a, { metalness: 0.5, roughness: 0.5 });
  if (style === 'op' || style === 'civ') part(new THREE.BoxGeometry(0.035, 0.1, 0.18), gm, 0, 0, 0.06, gun);
  else { part(new THREE.BoxGeometry(0.045, 0.075, 0.5), gm, 0, 0, 0.1, gun);
    const br = part(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), gm, 0, 0.01, 0.48, gun); br.rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(0.032, 0.19, 0.065), gm, 0, -0.11, 0.14, gun).rotation.x = 0.3;
    part(new THREE.CapsuleGeometry(0.03, 0.16, 3, 8), M(0x5a4226), 0, -0.02, -0.25, gun).rotation.x = Math.PI / 2; }
  root.userData = { hips, torso, head, armL, armR, foreL, foreR, legL, legR, shinL, shinR, gun, look: L };
  return root;
}

/* ---------------- Vehículos ---------------- */
// Suaviza un polígono (algoritmo de Chaikin) para que el perfil no sea anguloso
function smoothPoly(pts, it) {
  for (let k = 0; k < it; k++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    pts = out;
  }
  return pts;
}
// kind: 'suv' (Toyota negra) | 'pickup' (camioneta de escolta). Frente = +X.
// Estructura: grupo raíz -> carrocería (se inclina al frenar/girar) + ruedas (giran y viran) + puerta trasera derecha
function makeVehicle(kind, color) {
  const g = new THREE.Group(), body = new THREE.Group(), W = 1.85; g.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: kind === 'suv' ? 0.2 : 0.42 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1116, metalness: 0.9, roughness: 0.06 });
  const blackM = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 1, roughness: 0.25 });
  const profile = kind === 'suv'
    ? [[-2.38, 0.42], [-2.42, 1.15], [-2.3, 1.82], [0.45, 1.86], [1.22, 1.2], [2.32, 1.1], [2.42, 0.42]]
    : [[-2.6, 0.45], [-2.62, 1.08], [-0.75, 1.08], [-0.7, 1.82], [0.5, 1.84], [1.22, 1.18], [2.36, 1.08], [2.46, 0.45]];
  const pts = smoothPoly(profile, 2), shape = new THREE.Shape();
  pts.forEach((p, i) => i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1]));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.13, bevelSegments: 5 });
  geo.translate(0, 0, -(W - 0.3) / 2);
  const shell = new THREE.Mesh(geo, paint); shell.castShadow = true; body.add(shell);
  const add = (geo2, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo2, mat); m.position.set(x, y, z); m.castShadow = true; (parent || body).add(m); return m; };
  // Ventanas
  const cabX = kind === 'suv' ? -0.72 : -0.1, cabL = kind === 'suv' ? 2.5 : 1.25;
  add(new THREE.BoxGeometry(cabL, 0.42, W + 0.03), glass, cabX, 1.5, 0);
  add(new THREE.BoxGeometry(0.06, 0.5, W - 0.3), glass, 0.88, 1.5, 0).rotation.z = -0.86;                   // parabrisas
  if (kind === 'suv') for (const x of [-1.2, -0.25]) add(new THREE.BoxGeometry(0.07, 0.46, W + 0.05), paint, x, 1.5, 0);   // parales
  if (kind === 'pickup') { add(new THREE.BoxGeometry(1.75, 0.5, W - 0.25), blackM, -1.68, 1.02, 0);                        // platón
    add(new THREE.CapsuleGeometry(0.035, W - 0.3, 3, 8), blackM, -0.78, 1.95, 0).rotation.x = Math.PI / 2; }
  // Retrovisores, manijas y estribos
  for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.09, 8, 6), blackM, 0.78, 1.32, s * (W / 2 + 0.1)).scale.set(0.7, 0.8, 1.2);
    add(new THREE.CapsuleGeometry(0.03, 2.2, 3, 8), blackM, 0, 0.44, s * (W / 2 + 0.04)).rotation.z = Math.PI / 2; }
  // Luces: faros, stops (se encienden al frenar) y haces en la niebla
  const stopMat = new THREE.MeshBasicMaterial({ color: 0x5a0d08 });
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }), 2.42, 0.95, s * 0.62).scale.set(0.4, 0.7, 1.3);
    add(new THREE.SphereGeometry(0.1, 10, 8), stopMat, kind === 'suv' ? -2.46 : -2.66, 0.98, s * 0.7).scale.set(0.4, 1, 1);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff0cc, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.z = Math.PI / 2; beam.position.set(2.45 + 4.5, 0.9, s * 0.62); body.add(beam);
  }
  add(new THREE.BoxGeometry(0.06, 0.26, 1.0), blackM, 2.5, 0.92, 0);
  add(new THREE.BoxGeometry(0.02, 0.05, 0.5), chrome, 2.54, 0.95, 0);
  add(new THREE.CapsuleGeometry(0.09, W - 0.1, 3, 8), blackM, 2.5, 0.52, 0).rotation.x = Math.PI / 2;
  add(new THREE.CapsuleGeometry(0.09, W - 0.1, 3, 8), blackM, kind === 'suv' ? -2.5 : -2.68, 0.52, 0).rotation.x = Math.PI / 2;
  // Puerta trasera derecha (lado +Z): bisagra al frente, abre hacia afuera
  let door = null;
  if (kind === 'suv') {
    add(new THREE.BoxGeometry(0.92, 1.08, 0.02), new THREE.MeshBasicMaterial({ color: 0x050506 }), -0.5, 1.12, W / 2 + 0.006);     // interior oscuro
    door = new THREE.Group(); door.position.set(0.0, 0, W / 2 + 0.03); body.add(door);
    add(new THREE.BoxGeometry(0.98, 0.72, 0.05), paint, -0.5, 0.9, 0, door);
    add(new THREE.BoxGeometry(0.94, 0.4, 0.04), glass, -0.5, 1.48, 0, door);
    add(new THREE.BoxGeometry(0.14, 0.03, 0.03), chrome, -0.82, 1.12, 0.035, door);
  }
  // Ruedas: grupo de dirección -> grupo de giro
  const wheels = [], tire = new THREE.TorusGeometry(0.29, 0.13, 10, 20), hub = new THREE.CylinderGeometry(0.2, 0.2, 0.2, 14); hub.rotateX(Math.PI / 2);
  const rim = new THREE.MeshStandardMaterial({ color: kind === 'suv' ? 0x2a2c2e : 0x9a9da0, metalness: 0.8, roughness: 0.35 });
  for (const x of [-1.5, 1.52]) for (const s of [-1, 1]) {
    const steer = new THREE.Group(); steer.position.set(x, 0.42, s * (W / 2 - 0.02)); g.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    const t = new THREE.Mesh(tire, blackM); t.castShadow = true; spin.add(t);
    spin.add(new THREE.Mesh(hub, rim));
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.21), blackM); sp.rotation.z = k * Math.PI / 5; spin.add(sp); }
    wheels.push({ steer, spin, front: x > 0 });
    add(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), blackM, x, 0.42, s * (W / 2 - 0.16)).scale.set(1.05, 1, 0.5);   // guardabarros
  }
  g.userData = { wheels, body, door, stopMat, kind, st: {} };
  return g;
}
