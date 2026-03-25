function setupThree() {
  if (typeof window.setupParticles === 'function') {
    window.setupParticles(scene);
  }

  if (typeof window.setupTextMeshes === 'function') {
    window.setupTextMeshes(scene);
  }

  // Call the external wrapper to setup shaders
  setupShaders(scene, ui.depthScale);
}

function updateThree() {
  let audioVolume = 0;
  let audioDelta = 0;
  let isAudioPlaying = false;

  if (typeof window.getP5AudioMetrics === 'function') {
    const metrics = window.getP5AudioMetrics();
    audioVolume = Number(metrics.volume.toFixed(4));
    audioDelta = Number(metrics.delta.toFixed(4));
    isAudioPlaying = Boolean(metrics.isPlaying);
    ui.audioVolume = audioVolume;
    ui.audioVolumeDelta = audioDelta;
  }

  if (typeof window.updateParticles === 'function') {
    window.updateParticles(time, audioDelta, isAudioPlaying);
  }

  if (typeof window.updateTextMeshes === 'function') {
    window.updateTextMeshes(time);
  }

  // Call the external wrapper to update shaders every frame
  updateShaders(time, ui.depthScale, ui.meshTilt, audioVolume);


  // swing the mesh back and forth for a more dynamic look
  if (instancedObjs) {
    instancedObjs.rotation.y = Math.sin(time * 0.001) * 0.2; // Swing between -0.2 and 0.2 radians
    instancedObjs.rotation.z = Math.cos(time * 0.0007) * 0.15; // Swing between -0.15 and 0.15 radians
  }

  if (typeof updateGUI === 'function') {
    updateGUI();
  }
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

  const key = event.key?.toLowerCase();

  if (key === 't') {
    if (typeof window.loadShaderTestImages === 'function') {
      window.loadShaderTestImages();
    }
  }

  if (event.code === 'Space') {
    event.preventDefault();
    if (typeof triggerClickPulse === 'function') {
      triggerClickPulse();
    }
  }

  if (key === 'f') {
    const fs = fullscreen();
    fullscreen(!fs);
  }

  if (key === 'h') {
    if (typeof window.toggleGUI === 'function') {
      window.toggleGUI();
    }
  }
});