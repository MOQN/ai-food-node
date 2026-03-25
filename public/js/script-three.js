console.log("three.js Version: " + THREE.REVISION);

let container;
let scene, camera, renderer;
let controls;

let time, frame = 0;
const fps = { value: 0 };

function initThree() {
  scene = new THREE.Scene();
  // scene.background = new THREE.Color(0xffffff);

  const fov = 75;
  const aspectRatio = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 10000;
  camera = new THREE.PerspectiveCamera(fov, aspectRatio, near, far);
  camera.position.z = 1000;

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  container = document.getElementById("container-three");
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = true;
  controls.zoomSpeed = 0.9;
  controls.minDistance = 350;
  controls.maxDistance = 3200;
  controls.enableDamping = true;
  controls.dampingFactor = 0.03;

  setupThree();
  setupGUI();

  renderer.setAnimationLoop(animate);
}

function animate() {
  // update the frame count of three.js
  frame++;

  // update the time in milliseconds of three.js
  time = performance.now();

  // calculate the frames per second based on the time
  fps.value = 1000 / (time - (fps.last || time));
  fps.last = time;
  // update the fps value in the ui object
  ui.fps = fps.value.toFixed(2);

  // update the three.js scene
  updateThree(); // ***

  if (controls) {
    controls.update();
  }

  // render the three.js scene
  renderer.render(scene, camera);
}

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});