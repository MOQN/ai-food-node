function setupThree() {
  // Call the external wrapper to setup shaders
  setupShaders(scene, ui.depthScale);
}

function updateThree() {
  // Call the external wrapper to update shaders every frame
  updateShaders(time, ui.depthScale, ui.meshTilt);


  // swing the mesh back and forth for a more dynamic look
  if (instancedObjs) {
    instancedObjs.rotation.y = Math.sin(time * 0.001) * 0.2; // Swing between -0.2 and 0.2 radians
    instancedObjs.rotation.z = Math.cos(time * 0.0007) * 0.15; // Swing between -0.15 and 0.15 radians
  }
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.key?.toLowerCase() !== 't') return;

  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

  if (typeof window.loadShaderTestImages === 'function') {
    window.loadShaderTestImages();
  }
});