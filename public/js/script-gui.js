let pane;

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
}

function updateGUI() {
  //

  pane.refresh();
}