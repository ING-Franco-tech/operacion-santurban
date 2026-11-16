'use strict';
/*
 * PAISAJE PILOTO — capa visual reversible, posterior al arranque original.
 * No sustituye funciones del juego, no consume rng/Math.random, no añade
 * colisiones y no escribe en G, player, STORY, PH, audio ni temporizadores.
 * Zona: mirador y ladera alrededor de (12, 88). El cauce conserva sus colores.
 */
(() => {
  const api = window.SanturbanPaisaje = { enabled: false, ready: null, error: null };
  const bindings = [];
  const zone = new THREE.Vector4(12, 88, 47, 72);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const assetPath = 'assets/paisaje/';
  const loader = new THREE.TextureLoader();
  const originalPost = POST.mat;
  const postScreen = POST.scene && POST.scene.children.find(o => o.material === originalPost);
  let enhancedPost, environment, lastUIState;

  // Generador privado: las decisiones aleatorias del original quedan intactas.
  function privateRandom(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function canvasMap(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = anisotropy;
    t.encoding = THREE.LinearEncoding;
    return t;
  }
  function load(file) {
    return new Promise((resolve, reject) => loader.load(assetPath + file, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy;
      // Los samplers propios del shader convierten el albedo sRGB explícitamente.
      t.encoding = THREE.LinearEncoding; resolve(t);
    }, undefined, () => reject(new Error('No se pudo cargar ' + file))));
  }
  function makeGrass() {
    const rnd = privateRandom(381107);
    return canvasMap(512, 512, (g, w, h) => {
      for (let i = 0; i < 58; i++) {
        const x = 16 + rnd() * (w - 32), length = 170 + rnd() * 330;
        const lean = (rnd() - .5) * 145, width = 1.3 + rnd() * 3.2;
        const straw = rnd() < .42, v = .72 + rnd() * .25;
        const gradient = g.createLinearGradient(0, h, 0, h - length);
        gradient.addColorStop(0, straw ? '#645c3b' : '#46513b');
        gradient.addColorStop(.45, straw ? `rgb(${172*v|0},${160*v|0},${108*v|0})` : `rgb(${147*v|0},${157*v|0},${112*v|0})`);
        gradient.addColorStop(1, straw ? '#c5bb91' : '#a4af88');
        g.fillStyle = gradient; g.beginPath(); g.moveTo(x - width, h);
        g.bezierCurveTo(x + lean * .12 - width, h - length * .35,
          x + lean * .35, h - length * .82, x + lean, h - length);
        g.bezierCurveTo(x + lean * .45, h - length * .73,
          x + lean * .08 + width, h - length * .3, x + width, h); g.fill();
        if (i % 6 === 0) {
          g.strokeStyle = 'rgba(194,181,136,.85)'; g.lineWidth = .7;
          for (let k = 0; k < 6; k++) {
            const f = .75 + k * .035, px = x + lean * f * f, py = h - length * f;
            g.beginPath(); g.moveTo(px, py); g.lineTo(px + (k % 2 ? -1 : 1) * 8, py - 15); g.stroke();
          }
        }
      }
    });
  }
  function makeLeaf() {
    const rnd = privateRandom(382007);
    return canvasMap(128, 512, (g, w, h) => {
      const gradient = g.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, '#64715a'); gradient.addColorStop(.35, '#8e9b7e');
      gradient.addColorStop(1, '#bcc6a6'); g.fillStyle = gradient; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 13000; i++) {
        const x = rnd() * w, y = rnd() * h;
        g.fillStyle = rnd() > .5 ? 'rgba(230,235,211,.12)' : 'rgba(41,58,35,.10)';
        g.fillRect(x, y, .6, 1.5 + rnd() * 3);
      }
      g.strokeStyle = 'rgba(218,222,191,.45)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w * .54, h * .5, w / 2, 0); g.stroke();
      for (let y = 12; y < h; y += 13) {
        g.strokeStyle = 'rgba(65,84,51,.10)'; g.lineWidth = .7;
        g.beginPath(); g.moveTo(w / 2, y); g.lineTo(0, y + 23);
        g.moveTo(w / 2, y); g.lineTo(w, y + 23); g.stroke();
      }
      const shade = g.createLinearGradient(0, 0, w, 0);
      shade.addColorStop(0, 'rgba(31,46,28,.24)'); shade.addColorStop(.46, 'rgba(0,0,0,0)');
      shade.addColorStop(.54, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(31,46,28,.24)');
      g.fillStyle = shade; g.fillRect(0, 0, w, h);
    });
  }
  function makeEnvironment() {
    const texture = canvasMap(512, 256, (g, w, h) => {
      const gradient = g.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#9bafba'); gradient.addColorStop(.38, '#c6d0d1');
      gradient.addColorStop(.51, '#d9ded8'); gradient.addColorStop(.57, '#8b9584');
      gradient.addColorStop(1, '#4b5145'); g.fillStyle = gradient; g.fillRect(0, 0, w, h);
    });
    texture.encoding = THREE.sRGBEncoding;
    const generator = new THREE.PMREMGenerator(renderer);
    const target = generator.fromEquirectangular(texture);
    texture.dispose(); generator.dispose(); return target;
  }

  const shaderCommon = `
    uniform vec4 pZone;
    varying vec3 vPaisajeWorld;
    float paisajeMask() {
      return 1.0 - smoothstep(pZone.z, pZone.w, distance(vPaisajeWorld.xz, pZone.xy));
    }
    vec3 paisajeLinear(vec3 c) {
      return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(vec3(0.04045), c));
    }
    vec3 paisajeTri(sampler2D tex, vec3 p, vec3 n, float scale) {
      vec3 weights = pow(abs(n), vec3(5.0)); weights /= max(dot(weights, vec3(1.0)), 0.0001);
      return texture2D(tex, p.zy*scale).rgb*weights.x
        + texture2D(tex, p.xz*scale).rgb*weights.y
        + texture2D(tex, p.xy*scale).rgb*weights.z;
    }
  `;
  function patch(material, original, kind, uniforms, code) {
    const originalHook = original.onBeforeCompile;
    material.onBeforeCompile = shader => {
      originalHook.call(original, shader, renderer);
      Object.assign(shader.uniforms, uniforms, { pZone: { value: zone } });
      shader.vertexShader = 'varying vec3 vPaisajeWorld;\n' + shader.vertexShader;
      if (kind === 'leaf') {
        shader.vertexShader = 'attribute vec2 paisajeLeaf; varying vec2 vPaisajeLeaf;\n' + shader.vertexShader;
        shader.fragmentShader = 'varying vec2 vPaisajeLeaf;\n' + shader.fragmentShader;
      }
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
        vec4 pVisualWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          pVisualWorld = instanceMatrix * pVisualWorld;
        #endif
        vPaisajeWorld = (modelMatrix * pVisualWorld).xyz;
        ${kind === 'leaf' ? 'vPaisajeLeaf = paisajeLeaf;' : ''}
        #include <project_vertex>
      `);
      shader.fragmentShader = shaderCommon + code.declare + '\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + code.color);
      if (code.normal) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + code.normal);
      if (code.roughness) shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + code.roughness);
    };
    material.customProgramCacheKey = () => 'paisaje-piloto-v1-' + kind;
    return material;
  }
  function bind(mesh, material, geometry) {
    bindings.push({ mesh, originalMaterial: mesh.material, material, originalGeometry: mesh.geometry, geometry: geometry || mesh.geometry });
  }
  function groundMaterial(mesh, maps) {
    const original = mesh.material, material = original.clone();
    material.envMap = environment.texture; material.envMapIntensity = .10;
    patch(material, original, 'ground', {
      pGroundColor: { value: maps[0] }, pGroundNormal: { value: maps[1] }, pGroundRough: { value: maps[2] }
    }, {
      declare: 'uniform sampler2D pGroundColor, pGroundNormal, pGroundRough;',
      color: `
        float pWeight = paisajeMask();
        // Excluir el campamento y la carretera: mantienen la lectura original.
        float pCamp = (1.0-smoothstep(38.0,44.0,abs(vPaisajeWorld.x)))
          * (1.0-smoothstep(24.0,30.0,abs(vPaisajeWorld.z-30.0)));
        pWeight *= 1.0-pCamp;
        vec2 pUV = vPaisajeWorld.xz * 0.09;
        vec3 pScan = paisajeLinear(texture2D(pGroundColor,pUV).rgb);
        pScan = mix(vec3(dot(pScan,vec3(0.2126,0.7152,0.0722))),pScan,0.50);
        vec3 pMacro = paisajeLinear(texture2D(pGroundColor,pUV*0.173+vec2(0.41,0.27)).rgb);
        float pVariation = clamp(dot(pMacro,vec3(0.2126,0.7152,0.0722))*1.3+0.72,0.8,1.15);
        diffuseColor.rgb = mix(diffuseColor.rgb,pScan*vec3(0.86,0.98,1.02)*pVariation,pWeight);
      `,
      normal: `
        float pnWeight = paisajeMask();
        vec2 pMicroNormal = texture2D(pGroundNormal,vPaisajeWorld.xz*0.09).xy*2.0-1.0;
        normal = normalize(normal + mat3(viewMatrix)*vec3(pMicroNormal.x,0.0,-pMicroNormal.y)*0.33*pnWeight);
      `,
      roughness: 'roughnessFactor = mix(roughnessFactor, clamp(texture2D(pGroundRough,vPaisajeWorld.xz*0.09).g*0.83,0.55,0.94),paisajeMask());'
    });
    bind(mesh, material);
  }
  function rockMaterial(mesh, maps) {
    const original = mesh.material, material = original.clone();
    material.envMap = environment.texture; material.envMapIntensity = .16;
    patch(material, original, 'rock', { pRockColor: { value: maps[3] }, pRockNormal: { value: maps[4] }, pRockRough: { value: maps[5] } }, {
      declare: 'uniform sampler2D pRockColor, pRockNormal, pRockRough;',
      color: `
        vec3 pRockUp = normalize(inverseTransformDirection(vNormal,viewMatrix));
        vec3 pStone = paisajeLinear(paisajeTri(pRockColor,vPaisajeWorld,pRockUp,0.65));
        pStone = mix(vec3(dot(pStone,vec3(0.2126,0.7152,0.0722))),pStone,0.38);
        diffuseColor.rgb = mix(diffuseColor.rgb,pStone*vec3(0.97,1.01,1.05),paisajeMask());
      `,
      normal: `
        vec2 pGrain = texture2D(pRockNormal,vPaisajeWorld.xz*0.65).xy*2.0-1.0;
        normal = normalize(normal + mat3(viewMatrix)*vec3(pGrain.x,0.0,-pGrain.y)*0.24*paisajeMask());
      `,
      roughness: 'roughnessFactor = mix(roughnessFactor,clamp(texture2D(pRockRough,vPaisajeWorld.xz*0.65).g,0.70,0.95),paisajeMask());'
    });
    bind(mesh, material);
  }
  function leaves(mesh, texture) {
    const original = mesh.material, material = original.clone(), geometry = mesh.geometry.clone();
    const pos = geometry.getAttribute('position'), leafUV = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      leafUV[i*2] = [0,1,.5][i%3]; leafUV[i*2+1] = Math.floor((i%15)/3)/4;
    }
    geometry.setAttribute('paisajeLeaf', new THREE.BufferAttribute(leafUV, 2));
    patch(material, original, 'leaf', { pLeaf: { value: texture } }, {
      declare: 'uniform sampler2D pLeaf;',
      color: 'diffuseColor.rgb = mix(diffuseColor.rgb,paisajeLinear(texture2D(pLeaf,vec2(vPaisajeLeaf.x,1.0-vPaisajeLeaf.y)).rgb)*0.93,paisajeMask());',
      roughness: 'roughnessFactor = mix(roughnessFactor,0.98,paisajeMask());'
    });
    bind(mesh, material, geometry);
  }
  function grasses(mesh, texture) {
    const original = mesh.material, material = original.clone();
    patch(material, original, 'grass', { pGrass: { value: texture } }, {
      declare: 'uniform sampler2D pGrass;',
      color: `
        vec4 pBlade = texture2D(pGrass,vUv);
        float pGrassWeight = paisajeMask();
        diffuseColor.rgb = mix(diffuseColor.rgb,paisajeLinear(pBlade.rgb),pGrassWeight);
        diffuseColor.a = mix(diffuseColor.a,pBlade.a,pGrassWeight);
      `
    });
    bind(mesh, material);
  }
  function syncUI() {
    const state = G.state;
    if (lastUIState !== state) {
      lastUIState = state;
      controlsUI.hidden = !['menu','loadout','paused'].includes(state);
      if (controlsUI.hidden) {
        document.body.classList.remove('paisaje-vista');
        viewButton.textContent = 'Ver paisaje';
      }
    }
  }
  function setEnabled(enabled) {
    api.enabled = !!enabled;
    for (const b of bindings) {
      b.mesh.material = enabled ? b.material : b.originalMaterial;
      b.mesh.geometry = enabled ? b.geometry : b.originalGeometry;
    }
    if (enhancedPost) {
      POST.mat = enabled ? enhancedPost : originalPost;
      if (postScreen) postScreen.material = POST.mat;
    }
    modeButton.textContent = enabled ? 'Ver original' : 'Ver mejora';
    statusLabel.textContent = enabled ? 'Paisaje mejorado' : 'Paisaje original';
    controlsUI.dataset.enabled = String(enabled);
    api.enabled = enabled;
  }
  api.setEnabled = setEnabled;
  api.audit = () => ({ enabled: api.enabled, objects: bindings.map(b => ({ name: b.mesh.name, instances: b.mesh.count || 0,
    originalVertices: b.originalGeometry.getAttribute('position').count,
    enhancedVertices: b.geometry.getAttribute('position').count })), zone: Array.from(zone.toArray()) });

  const style = document.createElement('style');
  style.textContent = `
    #paisaje-comparar{position:fixed;z-index:900;right:16px;top:14px;padding:12px 14px;background:#152320ee;color:#e2e8d9;
      border:1px solid #73816b80;border-radius:8px;font:12px/1.4 system-ui,sans-serif;max-width:290px;box-shadow:0 5px 25px #0004}
    #paisaje-comparar[hidden]{display:none}#paisaje-comparar small{display:block;color:#a5b59e;letter-spacing:.08em;font-size:9px;margin-bottom:4px}
    #paisaje-comparar button{background:#2e4038;border:1px solid #71856d;color:#eef0df;border-radius:4px;padding:7px 10px;font:inherit;cursor:pointer;margin:8px 5px 0 0}
    #paisaje-comparar button:hover{background:#435847}#paisaje-comparar button:disabled{opacity:.5;cursor:wait}
    body.paisaje-vista #menu,body.paisaje-vista #loadout,body.paisaje-vista #pause{visibility:hidden;pointer-events:none}
    @media(max-width:700px){#paisaje-comparar{right:6px;top:6px;max-width:210px;padding:8px;font-size:11px}}
  `;
  document.head.appendChild(style);
  const controlsUI = document.createElement('aside'); controlsUI.id = 'paisaje-comparar';
  controlsUI.setAttribute('aria-label','Comparación visual del paisaje');
  const caption = document.createElement('small'); caption.textContent = 'PRUEBA VISUAL · MIRADOR Y LADERA'; controlsUI.appendChild(caption);
  const statusLabel = document.createElement('div'); statusLabel.textContent = 'Cargando texturas del paisaje…'; controlsUI.appendChild(statusLabel);
  const modeButton = document.createElement('button'); modeButton.type = 'button'; modeButton.textContent = 'Ver original'; modeButton.disabled = true;
  const viewButton = document.createElement('button'); viewButton.type = 'button'; viewButton.textContent = 'Ver paisaje';
  controlsUI.append(modeButton,viewButton); document.body.appendChild(controlsUI);
  modeButton.addEventListener('click', e => { e.stopPropagation(); setEnabled(!api.enabled); });
  viewButton.addEventListener('click', e => {
    e.stopPropagation(); const on = document.body.classList.toggle('paisaje-vista');
    viewButton.textContent = on ? (G.state === 'paused' ? 'Volver a pausa' : 'Volver al menú') : 'Ver paisaje';
  });

  api.ready = Promise.all([
    'aerial_grass_rock_diffuse.jpg','aerial_grass_rock_nor_gl.jpg','aerial_grass_rock_rough.jpg',
    'lichen_rock_diffuse.jpg','lichen_rock_nor_gl.jpg','lichen_rock_rough.jpg'
  ].map(load)).then(maps => {
    environment = makeEnvironment();
    groundMaterial(scene.userData.terrain, maps);
    const leafTexture = makeLeaf(), grassTexture = makeGrass();
    for (const mesh of scene.children.filter(o => o.isInstancedMesh)) {
      const color = mesh.material.color && mesh.material.color.getHexString();
      if (color === '707275' && mesh.geometry.type === 'IcosahedronGeometry') rockMaterial(mesh,maps);
      else if (color === 'b2c2a4' && mesh.geometry.type === 'BufferGeometry') leaves(mesh,leafTexture);
      else if (mesh.geometry.type === 'PlaneGeometry' && mesh.count > 10000) grasses(mesh,grassTexture);
    }
    const river = scene.userData.river, water = river.material.clone();
    water.envMap = environment.texture; water.envMapIntensity = .65;
    water.metalness = .04; water.roughness = .16;
    // Misma malla, altura, UV, textura normal animada y colores de contaminación.
    bind(river, water);
    if (originalPost) {
      enhancedPost = originalPost.clone(); enhancedPost.uniforms.tD.value = POST.rt.texture;
      enhancedPost.uniforms.uVig.value = .48;
      enhancedPost.fragmentShader = originalPost.fragmentShader.replaceAll('r2 * 0.010','r2 * 0.000').replace(') * 0.03;',') * 0.008;');
    }
    function watchUI() { syncUI(); requestAnimationFrame(watchUI); }
    requestAnimationFrame(watchUI);
    modeButton.disabled = false;
    setEnabled(new URLSearchParams(location.search).get('paisaje') !== 'original');
    syncUI(); return true;
  }).catch(error => {
    api.error = error.message; setEnabled(false); statusLabel.textContent = 'No se cargó la mejora; el original sigue disponible.';
    console.warn('Paisaje piloto:',error.message); return false;
  });
})();
