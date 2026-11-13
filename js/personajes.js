'use strict';
/* =====================================================================
   PERSONAJES — nombres (ficticios) y aspecto de cada personaje.
   Cambia aquí alias, etiquetas, colores de piel, pelo y ropa.
   Los colores son hexadecimales: 0xRRGGBB.
   ===================================================================== */
const PERSONAJES = {
  jugador: 'Cóndor',
  comando: 'Halcón',
  operadorAnterior: 'Arciniegas',

  // Cabecilla: llega en la Toyota negra
  jefe: {
    alias: 'Deivis',
    etiqueta: 'ALIAS «DEIVIS» · CABECILLA',
    aspecto: { piel: 0xc99a78, pelo: 0x17120e, peinado: 'fade', barba: true, gafas: 'sol',
      camisa: 0xf2f2ee, camisaLarga: true, pantalon: 0x141414, zapatos: 0x23407a, complexion: 1.18 }
  },

  // Ingeniera química secuestrada
  ingeniera: {
    nombre: 'Daniela Rangel',
    etiqueta: 'ING. DANIELA RANGEL · REHÉN',
    aspecto: { piel: 0xdcae90, pelo: 0x120d0b, peinado: 'largo', gafas: 'redondas', colorGafas: 0xd99a9a,
      camisa: 0xe9c9b0, bata: true, pantalon: 0x34405a, zapatos: 0x3a2a1e, collar: true, complexion: 1.04 }
  },

  // Jefe de campo (venezolano)
  chamo: {
    alias: 'el Chamo',
    etiqueta: 'ALIAS «EL CHAMO» · JEFE DE CAMPO',
    aspecto: { piel: 0x7a4f33, pelo: 0x0d0a08, peinado: 'corto', gorra: 0x8a1c1c, bigote: true,
      camisa: 0x2a2f3a, chaleco: 0x3a2a1e, pantalon: 0x2b2b30, zapatos: 0x15130f, complexion: 1.0 }
  },

  // Su compinche (venezolano)
  catire: {
    alias: 'el Catire',
    nombre: 'Carlitos',
    etiqueta: 'CARLITOS «EL CATIRE» · GUARDIA',
    aspecto: { piel: 0xe6bf9e, pelo: 0xb89554, peinado: 'corto',
      camisa: 0x4a5a3a, chaleco: 0x20261f, pantalon: 0x3a4630, zapatos: 0x15130f, complexion: 0.96 }
  }
};
