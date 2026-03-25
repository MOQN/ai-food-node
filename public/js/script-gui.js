let pane;
let isGuiVisible = true;
let ui = {
  fps: 0,
  depthScale: 120,
  meshTilt: -0.30,
  audioVolume: 0,
  audioVolumeDelta: 0,
  burstThreshold: 0.08,
  burstSpawnDistance: 1000
};

function setupGUI() {
  pane = new Pane();
  pane.addBinding(ui, 'fps', {
    label: 'FPS',
    readonly: true,
  });
  pane.addBinding(ui, 'fps', {
    label: 'FPS Graph',
    readonly: true,
    view: 'graph',
    min: 0,
    max: 120,
  });
  pane.addBlade({ view: 'separator' });

  pane.addBinding(ui, 'meshTilt', {
    label: 'Mesh Tilt',
    min: -1.2,
    max: 0.2,
    step: 0.01,
  });

  pane.addBlade({ view: 'separator' });
  pane.addBinding(ui, 'audioVolume', {
    label: 'Audio Volume',
    readonly: true,
    view: 'graph',
    min: 0,
    max: 1,
  });
  pane.addBinding(ui, 'audioVolumeDelta', {
    label: 'Volume Delta',
    readonly: true,
    view: 'graph',
    min: 0,
    max: 0.5,
  });

  const burstBinding = pane.addBinding(ui, 'burstThreshold', {
    label: 'Burst Threshold',
    min: 0,
    max: 1,
    step: 0.01,
  });

  burstBinding.on('change', (ev) => {
    if (typeof window.setParticleBurstThreshold === 'function') {
      window.setParticleBurstThreshold(ev.value);
    }
  });

  if (typeof window.setParticleBurstThreshold === 'function') {
    window.setParticleBurstThreshold(ui.burstThreshold);
  }

  const burstDistanceBinding = pane.addBinding(ui, 'burstSpawnDistance', {
    label: 'Burst World Z',
    min: -2000,
    max: 1000,
    step: 1,
  });

  burstDistanceBinding.on('change', (ev) => {
    if (typeof window.setParticleBurstSpawnDistance === 'function') {
      window.setParticleBurstSpawnDistance(ev.value);
    }
  });

  if (typeof window.setParticleBurstSpawnDistance === 'function') {
    window.setParticleBurstSpawnDistance(ui.burstSpawnDistance);
  }
}

function updateGUI() {
  //

  pane.refresh();
}

function toggleGUI() {
  if (!pane) return;
  isGuiVisible = !isGuiVisible;

  if ('hidden' in pane) {
    pane.hidden = !isGuiVisible;
    return;
  }

  if (pane.element) {
    pane.element.style.display = isGuiVisible ? '' : 'none';
  }
}

window.toggleGUI = toggleGUI;