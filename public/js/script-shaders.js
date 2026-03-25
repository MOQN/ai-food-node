// script-shaders.js

let instancedObjs;
let customMaterial;
let isAnimatingIn = false;
let hasCompletedInitialGather = false;

const SHADER_CONFIG = {
  gridX: 512,
  gridY: 512,
  physicalWidth: 1000,
  physicalHeight: 1000,
  particleSize: 4,
  defaultDepthScale: 120.0,
  scatterRadiusXY: 420.0,
  scatterRadiusZ: 220.0,
  transitionSpeed: 0.02,
  depthInvert: true
};

async function loadShaders() {
  const vRes = await fetch('shader/vertex.glsl');
  const fRes = await fetch('shader/fragment.glsl');

  return {
    vertex: await vRes.text(),
    fragment: await fRes.text()
  };
}

async function setupShaders(scene, initialDepthScale) {
  const shaders = await loadShaders();

  const gridX = SHADER_CONFIG.gridX;
  const gridY = SHADER_CONFIG.gridY;
  const instances = gridX * gridY;

  const instOffsets = [];
  const instUVs = [];

  const physicalWidth = SHADER_CONFIG.physicalWidth;
  const physicalHeight = SHADER_CONFIG.physicalHeight;

  for (let y = 0; y < gridY; y++) {
    for (let x = 0; x < gridX; x++) {
      const posX = (x / (gridX - 1)) * physicalWidth - physicalWidth * 0.5;
      const posY = (y / (gridY - 1)) * physicalHeight - physicalHeight * 0.5;

      instOffsets.push(posX, posY, 0.0);

      // Flip Y so the projected image is not upside down
      instUVs.push(x / (gridX - 1), y / (gridY - 1));
    }
  }

  const bufferGeometry = new THREE.BoxGeometry(
    SHADER_CONFIG.particleSize,
    SHADER_CONFIG.particleSize,
    SHADER_CONFIG.particleSize
  );

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.instanceCount = instances;

  geometry.index = bufferGeometry.index;
  geometry.setAttribute('position', bufferGeometry.attributes.position);
  geometry.setAttribute('normal', bufferGeometry.attributes.normal);
  geometry.setAttribute('uv', bufferGeometry.attributes.uv);

  geometry.setAttribute(
    'offset',
    new THREE.InstancedBufferAttribute(new Float32Array(instOffsets), 3)
  );

  geometry.setAttribute(
    'aUv',
    new THREE.InstancedBufferAttribute(new Float32Array(instUVs), 2)
  );

  customMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uTime: { value: 0.0 },
      uTransition: { value: 0.0 },
      uDepthScale: {
        value:
          typeof initialDepthScale === 'number'
            ? initialDepthScale
            : SHADER_CONFIG.defaultDepthScale
      },
      uDepthInvert: { value: SHADER_CONFIG.depthInvert ? 1.0 : 0.0 },
      uScatterRadiusXY: { value: SHADER_CONFIG.scatterRadiusXY },
      uScatterRadiusZ: { value: SHADER_CONFIG.scatterRadiusZ }
    },
    vertexShader: shaders.vertex,
    fragmentShader: shaders.fragment,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: true,
    depthWrite: true
  });

  instancedObjs = new THREE.Mesh(geometry, customMaterial);

  // Slight backward tilt to make depth easier to read
  instancedObjs.rotation.x = -0.35;
  instancedObjs.rotation.y = 0.0;

  scene.add(instancedObjs);
}

function updateShaders(currentTime, currentDepthScale, meshTilt) {
  if (!customMaterial) return;

  if (!hasCompletedInitialGather) {
    customMaterial.uniforms.uTime.value = currentTime * 0.001;
  }

  if (typeof currentDepthScale === 'number') {
    customMaterial.uniforms.uDepthScale.value = currentDepthScale;
  }

  if (instancedObjs && typeof meshTilt === 'number') {
    instancedObjs.rotation.x = meshTilt;
  }

  if (isAnimatingIn && customMaterial.uniforms.uTransition.value < 1.0) {
    customMaterial.uniforms.uTransition.value = Math.min(
      1.0,
      customMaterial.uniforms.uTransition.value + SHADER_CONFIG.transitionSpeed
    );

    if (customMaterial.uniforms.uTransition.value >= 1.0) {
      customMaterial.uniforms.uTransition.value = 1.0;
      isAnimatingIn = false;
      hasCompletedInitialGather = true;
    }
  }
}

function configureTexture(texture) {
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
}

function trigger25DAppearance(imageURI, depthURI) {
  const loader = new THREE.TextureLoader();

  loader.load(imageURI, (colorTexture) => {
    configureTexture(colorTexture);

    const targetDepth = depthURI ? depthURI : imageURI;

    loader.load(targetDepth, (depthTexture) => {
      configureTexture(depthTexture);

      if (!customMaterial) return;

      customMaterial.uniforms.tColor.value = colorTexture;
      customMaterial.uniforms.tDepth.value = depthTexture;
      customMaterial.needsUpdate = true;

      // Animate only once for the first image
      if (!hasCompletedInitialGather) {
        customMaterial.uniforms.uTransition.value = 0.0;
        isAnimatingIn = true;
      } else {
        customMaterial.uniforms.uTransition.value = 1.0;
        isAnimatingIn = false;
      }
    });
  });
}

window.updateThreeJSMaterial = trigger25DAppearance;