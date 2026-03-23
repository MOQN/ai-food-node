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

  pane.addBinding(ui, 'wireframe');
  pane.addBinding(ui, 'color', {
    picker: 'inline',
    // expanded: true,
  });
  pane.addBlade({ view: 'separator' });

  const folderPosition = pane.addFolder({ expanded: true, title: 'Position', });
  folderPosition.addBinding(cube.position, "x", { label: "PosX", min: -500, max: 500 });
  folderPosition.addBinding(cube.position, "y", { label: "PosY", min: -500, max: 500 });
  folderPosition.addBinding(cube.position, "z", { label: "PosZ", min: -500, max: 500 });

  const folderRotation = pane.addFolder({ expanded: true, title: 'Rotation', });
  folderRotation.addBinding(cube.rotation, "x", { label: "RotX" });
  folderRotation.addBinding(cube.rotation, "y", { label: "RotY" });
  folderRotation.addBinding(cube.rotation, "z", { label: "RotZ" });

  const folerScale = pane.addFolder({ expanded: true, title: 'Scale', });
  folerScale.addBinding(cube.scale, "x", { label: "ScaleX", min: 50, max: 300 });
  folerScale.addBinding(cube.scale, "y", { label: "ScaleY", min: 50, max: 300 });
  folerScale.addBinding(cube.scale, "z", { label: "ScaleZ", min: 50, max: 300 });
}

function updateGUI() {
  //

  pane.refresh();
}