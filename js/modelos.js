'use strict';
/* =====================================================================
   MODELOS v3 — formas orgánicas y redondeadas
   - blobGeo: rocas, arbustos y copas con superficie irregular suave
   - lookFor: aspecto de cada personaje
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
// Los personajes y los vehículos se construyen en diseno.js
