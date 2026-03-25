// script-shaders.js

let instancedObjs;
let customMaterial;
let isAnimatingIn = false;
let hasCompletedInitialGather = false;
let clickPulseStartTime = 0;
let isClickPulsing = false;
let clickPulseEventBound = false;

const SHADER_CONFIG = {
  gridX: 512,
  gridY: 512,
  physicalWidth: 1000,
  physicalHeight: 1000,
  particleSize: 3,
  defaultDepthScale: 120.0,
  scatterRadiusXY: 1620.0,
  scatterRadiusZ: 1340.0,
  transitionSpeed: 0.005,
  depthInvert: true,
  appearDuration: 10.0,
  transitionDecay: 0.99,
  transitionOscillation: 1.4,
  clickPulseDuration: 0.45,
  clickPulseStrength: 0.12,
  idleOrbitRadius: 2.2,
  idleOrbitSpeedMin: 0.82,
  idleOrbitSpeedMax: 1.92
};

function triggerClickPulse() {
  clickPulseStartTime = performance.now() * 0.001;
  isClickPulsing = true;
}

function bindClickPulseEvent() {
  if (clickPulseEventBound) return;

  window.addEventListener('pointerdown', () => {
    triggerClickPulse();
  });

  clickPulseEventBound = true;
}

async function loadShaders() {
  const vRes = await fetch('shader/vertex.glsl');
  const fRes = await fetch('shader/fragment.glsl');

  return {
    vertex: await vRes.text(),
    fragment: await fRes.text()
  };
}

function configureTexture(texture) {
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
}

async function setupShaders(scene, initialDepthScale) {
  bindClickPulseEvent();

  const shaders = await loadShaders();

  const gridX = SHADER_CONFIG.gridX;
  const gridY = SHADER_CONFIG.gridY;
  const instances = gridX * gridY;

  const instOffsets = [];
  const instUVs = [];
  const instRandoms = [];

  const physicalWidth = SHADER_CONFIG.physicalWidth;
  const physicalHeight = SHADER_CONFIG.physicalHeight;

  for (let y = 0; y < gridY; y++) {
    for (let x = 0; x < gridX; x++) {
      const posX = (x / (gridX - 1)) * physicalWidth - physicalWidth * 0.5;
      const posY = (y / (gridY - 1)) * physicalHeight - physicalHeight * 0.5;

      instOffsets.push(posX, posY, 0.0);

      // Flip Y so the projected image is not upside down
      instUVs.push(x / (gridX - 1), y / (gridY - 1));
      instRandoms.push(Math.random());
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

  geometry.setAttribute(
    'aRandom',
    new THREE.InstancedBufferAttribute(new Float32Array(instRandoms), 1)
  );

  customMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uTime: { value: 0.0 },
      uTransition: { value: 0.0 },
      uClickPulse: { value: 0.0 },
      uIdleOrbitRadius: { value: SHADER_CONFIG.idleOrbitRadius },
      uIdleOrbitSpeedMin: { value: SHADER_CONFIG.idleOrbitSpeedMin },
      uIdleOrbitSpeedMax: { value: SHADER_CONFIG.idleOrbitSpeedMax },
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
    premultipliedAlpha: true,
    alphaTest: 0.02,
    depthTest: true,
    depthWrite: true
  });

  instancedObjs = new THREE.Mesh(geometry, customMaterial);

  // Slight backward tilt to make depth easier to read
  instancedObjs.rotation.x = -0.35;
  instancedObjs.rotation.y = 0.0;

  scene.add(instancedObjs);
}

let animationStartTime = 0;

function updateShaders(currentTime, currentDepthScale, meshTilt) {
  if (!customMaterial) return;

  const timeInSeconds = currentTime * 0.001;
  customMaterial.uniforms.uTime.value = timeInSeconds; // 

  if (typeof currentDepthScale === 'number') {
    customMaterial.uniforms.uDepthScale.value = currentDepthScale; //
  }

  if (instancedObjs && typeof meshTilt === 'number') {
    instancedObjs.rotation.x = meshTilt; //
  }

  if (isClickPulsing) {
    const pulseElapsed = timeInSeconds - clickPulseStartTime;
    const pulseNorm = Math.min(1, pulseElapsed / SHADER_CONFIG.clickPulseDuration);
    const envelope = Math.exp(-6.0 * pulseNorm);
    const hit = Math.sin(pulseNorm * 3.14159265359);
    customMaterial.uniforms.uClickPulse.value = envelope * hit * SHADER_CONFIG.clickPulseStrength;

    if (pulseNorm >= 1) {
      customMaterial.uniforms.uClickPulse.value = 0.0;
      isClickPulsing = false;
    }
  }

  if (isAnimatingIn) {
    // 애니메이션이 시작된 시점부터의 경과 시간 계산
    const elapsed = timeInSeconds - animationStartTime;

    // EXPLANATION: Damped Oscillation (감쇄 진동)
    // uTransition = exp(-decay*t) * cos(freq*t)
    // freq를 올려 초반에 음수 구간으로 빨리 진입시키고,
    // decay를 낮춰 음수 딥이 실제로 보이게 유지합니다.
    const decay = Math.exp(-elapsed * SHADER_CONFIG.transitionDecay);
    const oscillation = Math.cos(elapsed * SHADER_CONFIG.transitionOscillation);

    const nextTransition = decay * oscillation;

    customMaterial.uniforms.uTransition.value = nextTransition;

    // 값이 충분히 0에 가까워지면 애니메이션 종료
    if (elapsed > SHADER_CONFIG.appearDuration) {
      customMaterial.uniforms.uTransition.value = 0.0;
      isAnimatingIn = false;
      hasCompletedInitialGather = true;
    }
  }
}

function trigger25DAppearance(imageURI, depthURI) {
  const loader = new THREE.TextureLoader();

  loader.load(imageURI, (colorTexture) => {
    configureTexture(colorTexture);
    const targetDepth = depthURI ? depthURI : imageURI;

    loader.load(targetDepth, (depthTexture) => {
      configureTexture(depthTexture);
      if (!customMaterial) return;

      customMaterial.uniforms.tColor.value = colorTexture; // [cite: 1]
      customMaterial.uniforms.tDepth.value = depthTexture; // [cite: 3]

      // 애니메이션 시작 시간 기록 및 플래그 활성화
      animationStartTime = performance.now() * 0.001;
      isAnimatingIn = true;

      // 초기 상태는 흩어진 상태 (t=0일 때 cos(0)=1이므로 uTransition=1에서 시작)
      customMaterial.uniforms.uTransition.value = 1.0;
    });
  });
}

window.updateThreeJSMaterial = trigger25DAppearance;