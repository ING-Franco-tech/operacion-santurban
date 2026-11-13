'use strict';
/* =====================================================================
   ARRANQUE v5 — construye el mundo y ejecuta el bucle principal
   ===================================================================== */
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state === 'playing') {
    T += dt; G.time += dt;
    updatePlayer(dt); updateAction(dt); updateEnemies(dt); updateStory(dt); updateBullets(dt); updateMission(dt);
    updateWorld(dt); updateParticles(dt); updateMist(dt); updateHUD(dt); updateNav(dt); updateClips();
  } else if (G.state === 'ph') {                     // panel de pH: el mundo sigue vivo
    T += dt; G.time += dt;
    updatePh(dt); updateEnemies(dt); updateStory(dt); updateMission(dt); updateWorld(dt); updateParticles(dt); updateMist(dt); updateHUD(dt);
  } else if (G.state === 'intro') {
    T += dt; updateIntro(dt); updateEnemies(dt); updateWorld(dt); updateParticles(dt); updateMist(dt);
  } else if (G.state === 'menu' || G.state === 'loadout' || G.state === 'won') {
    T += dt; updateWorld(dt); updateParticles(dt); updateMist(dt);
    if (G.state !== 'won') { camera.rotation.y = Math.sin(performance.now() * 0.00008) * 0.25; updateEnemies(dt); }
  }
  if (G.state !== 'paused' && G.state !== 'reading') updatePour(dt);
  updatePolish(dt);
  renderFrame();
}

// Primero el campamento y la utilería; después la vegetación, que así no crece atravesando objetos
buildSky(); buildBackdrop(); buildTerrain(); buildRiver();
buildCamp(); dressCamp(); buildStoryProps();
G.campCols = colliders.length;
buildVegetation(); buildC4Markers(); buildMist(); buildGuns();
initImage(); wetWorld();
resetMission();
guns.forEach(g => { g.visible = false; });
loop();
