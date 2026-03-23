
function getBox() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  return new THREE.Mesh(geometry, material);
}

function getSphere() {
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  return new THREE.Mesh(geometry, material);
}

// 🌟 Hook to receive generated image from script-ui.js
function updateThreeJSMaterial(imageURI) {
  const loader = new THREE.TextureLoader();
  loader.load(imageURI, (texture) => {
    // Apply the generated AI image to the spinning cube
    cube.material.map = texture;
    cube.material.color.set(0xffffff); // Reset base color so image looks correct
    cube.material.needsUpdate = true;
    console.log("🎨 Three.js updated with new API image texture!");
  });
}