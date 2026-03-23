let ui = {
  fps: 0,
  color: "#0F0",
  wireframe: false, // Turned off wireframe by default to see the image texture
};

let cube;
let ball;

function setupThree() {
  ball = getSphere();
  scene.add(ball);
  ball.scale.set(10, 10, 10);
  ball.position.set(100, 0, 0);

  cube = getBox();
  scene.add(cube);
  cube.scale.x = 100;
  cube.scale.y = 100;
  cube.scale.z = 100;
}

function updateThree() {
  // Only apply UI color if we don't have a map, or mix them
  if (!cube.material.map) {
    cube.material.color.set(ui.color);
  }
  cube.material.wireframe = ui.wireframe;

  cube.rotation.x += 0.01;
  cube.rotation.y += 0.009;
  cube.rotation.z += 0.008;
}

// Expose to window so UI script can call it
window.updateThreeJSMaterial = updateThreeJSMaterial;