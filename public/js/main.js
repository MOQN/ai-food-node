let ui = {
  fps: 0,
  depthScale: 120,
  meshTilt: -0.45
};

let cube;

function setupThree() {
  cube = getBox();
  scene.add(cube);
  cube.scale.x = 100;
  cube.scale.y = 100;
  cube.scale.z = 100;

  if (!cube.material.map) {
    cube.material.color.set("#ff0000");
  }
  cube.material.wireframe = true;

  // Call the external wrapper to setup shaders
  setupShaders(scene, ui.depthScale);
}

function updateThree() {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.009;
  cube.rotation.z += 0.008;

  // Call the external wrapper to update shaders every frame
  updateShaders(time, ui.depthScale, ui.meshTilt);
}