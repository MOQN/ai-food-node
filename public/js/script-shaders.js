// Variable to hold the instanced mesh
let instancedObjs;
let customMaterial;
let isAnimatingIn = false;

// Async function to load shaders
async function loadShaders() {
  const vRes = await fetch('shader/vertex.glsl');
  const fRes = await fetch('shader/fragment.glsl');
  return {
    vertex: await vRes.text(),
    fragment: await fRes.text()
  };
}

// Setup InstancedBufferGeometry approach
async function setupShaders(scene, initialDepthScale) {
  const shaders = await loadShaders();

  // Setup grid configuration for instances
  const gridX = 200;
  const gridY = 200;
  const instances = gridX * gridY;

  let instOffsets = [];
  let instUVs = [];

  const physicalWidth = 400;
  const physicalHeight = 400;

  // Calculate offsets and UVs for each box
  for (let y = 0; y < gridY; y++) {
    for (let x = 0; x < gridX; x++) {
      // Center the grid
      let posX = (x / gridX) * physicalWidth - (physicalWidth / 2);
      let posY = (y / gridY) * physicalHeight - (physicalHeight / 2);
      instOffsets.push(posX, posY, 0);

      // UV coordinates mapping from 0.0 to 1.0
      instUVs.push(x / gridX, y / gridY);
    }
  }

  // Base box geometry
  let bufferGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  let geometry = new THREE.InstancedBufferGeometry();
  geometry.instanceCount = instances;

  // Copy index and position attributes from base geometry
  geometry.index = bufferGeometry.index;
  geometry.setAttribute('position', bufferGeometry.attributes.position);

  // Add custom instanced attributes
  geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(instOffsets), 3));
  geometry.setAttribute('aUv', new THREE.InstancedBufferAttribute(new Float32Array(instUVs), 2));

  // Setup ShaderMaterial
  customMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uTime: { value: 0.0 },
      uTransition: { value: 0.0 },
      uDepthScale: { value: initialDepthScale }
    },
    vertexShader: shaders.vertex,
    fragmentShader: shaders.fragment,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: true
  });

  instancedObjs = new THREE.Mesh(geometry, customMaterial);

  // Default rotation for better perspective
  instancedObjs.rotation.x = -0.3;
  instancedObjs.rotation.y = 0.3;

  scene.add(instancedObjs);
}

function updateShaders(currentTime, currentDepthScale) {
  if (customMaterial) {
    customMaterial.uniforms.uTime.value = currentTime * 0.001;
    customMaterial.uniforms.uDepthScale.value = currentDepthScale;

    if (isAnimatingIn && customMaterial.uniforms.uTransition.value < 1.0) {
      customMaterial.uniforms.uTransition.value += 0.005;
    }
  }

  if (instancedObjs) {
    instancedObjs.rotation.y = Math.sin(currentTime * 0.0003) * 0.15;
  }
}

function trigger25DAppearance(imageURI, depthURI) {
  const loader = new THREE.TextureLoader();

  isAnimatingIn = false;
  if (customMaterial) customMaterial.uniforms.uTransition.value = 0.0;

  loader.load(imageURI, (colorTexture) => {
    const targetDepth = depthURI ? depthURI : imageURI;

    loader.load(targetDepth, (depthTexture) => {
      if (customMaterial) {
        customMaterial.uniforms.tColor.value = colorTexture;
        customMaterial.uniforms.tDepth.value = depthTexture;
        customMaterial.needsUpdate = true;
      }
      isAnimatingIn = true;
    });
  });
}

window.updateThreeJSMaterial = trigger25DAppearance;