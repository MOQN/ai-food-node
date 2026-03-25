let backgroundPointCloud = null;
let backgroundParticleGeometry = null;
let backgroundParticles = [];
let particleFrame = 0;
let lastDeltaBurstTime = 0;
let wasDeltaAboveThreshold = false;

const PARTICLE_BG_CONFIG = {
  maxParticles: 5000,
  spawnPerFrame: 20,
  spawnRangeX: 5200,
  spawnRangeY: 3000,
  spawnNearZ: 1500,
  spawnFarZ: -2600,
  baseSpeedMin: 0.03,
  baseSpeedMax: 0.1,
  damping: 0.995,
  flowStrength: 0.004,
  deltaFlowBoost: 0.015,
  backwardSpeedBase: 0.06,
  backwardSpeedDeltaBoost: 0.12,
  backwardSpeedAudioBoost: 0.25,
  deltaBurstThreshold: 0.08,
  deltaBurstCooldownMs: 200,
  deltaBurstKillZ: -1800,
  deltaBurstRingCount: 260,
  deltaBurstRingRadiusMin: 160,
  deltaBurstRingRadiusMax: 520,
  deltaBurstSpawnDistanceFromCamera: 1000,
  deltaBurstPushSpeedMin: 1.8,
  deltaBurstPushSpeedMax: 2.2,
  deltaBurstRadialPush: 0.0,
  recycleFarZ: -3400,
  pointSize: 10,
  yStretch: 1.0,
  zDepthOffset: 0
};

const PARTICLE_BG_PALETTE = [
  new THREE.Color('#ff4d8d'),
  new THREE.Color('#ffa24d'),
  new THREE.Color('#ffe14d'),
  new THREE.Color('#4dffd2')
];

class DecorativeParticle {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.acc = new THREE.Vector3();
    this.mass = 0.8 + Math.random() * 1.4;
    this.lifespan = 1.0;
    this.lifeReduction = 0.001 + Math.random() * 0.004;
    this.isDone = false;
    this.seed = Math.random() * 1000;
    this.paletteIndex = Math.floor(Math.random() * PARTICLE_BG_PALETTE.length);
    this.isBurst = false;
    this.burstFrames = 0;
  }

  setPosition(x, y, z) {
    this.pos.set(x, y, z);
    return this;
  }

  setVelocity(x, y, z) {
    this.vel.set(x, y, z);
    return this;
  }

  applyForce(force) {
    this.acc.add(force.clone().divideScalar(this.mass));
  }

  adjustVelocity(amount) {
    this.vel.multiplyScalar(1 + amount);
  }

  flow(frameIndex, audioDelta) {
    const f = frameIndex * 0.005;
    const xFreq = this.pos.x * 0.005 + f;
    const yFreq = this.pos.y * 0.005 + f;
    const zFreq = this.pos.z * 0.005 + f;
    const noiseValue = mapRange(pseudoNoise3(xFreq + this.seed, yFreq, zFreq), -1, 1, -1, 1);

    const direction = new THREE.Vector3(
      Math.sin(yFreq + this.seed * 0.11),
      Math.cos(zFreq + this.seed * 0.17),
      Math.sin(xFreq + this.seed * 0.13)
    ).normalize();

    const deltaBoost = Math.max(0, Math.min(1, Number(audioDelta) || 0)) * PARTICLE_BG_CONFIG.deltaFlowBoost;
    direction.multiplyScalar(noiseValue * (PARTICLE_BG_CONFIG.flowStrength + deltaBoost));
    this.applyForce(direction);
  }

  moveOutward(audioDelta, isAudioPlaying) {
    const deltaFactor = Math.max(0, Math.min(1, Number(audioDelta) || 0));
    const audioFactor = isAudioPlaying ? 1.0 : 0.0;

    const backwardPush = new THREE.Vector3(0, 0, -1).multiplyScalar(
      PARTICLE_BG_CONFIG.backwardSpeedBase +
      PARTICLE_BG_CONFIG.backwardSpeedDeltaBoost * deltaFactor +
      PARTICLE_BG_CONFIG.backwardSpeedAudioBoost * audioFactor
    );

    const sideDrift = new THREE.Vector3(
      Math.sin((particleFrame + this.seed * 10) * 0.004),
      Math.cos((particleFrame + this.seed * 8) * 0.0035),
      0
    ).multiplyScalar(0.01 + deltaFactor * 0.02);

    this.applyForce(backwardPush);
    this.applyForce(sideDrift);
  }

  move() {
    this.vel.add(this.acc);
    this.vel.multiplyScalar(PARTICLE_BG_CONFIG.damping);
    this.pos.add(this.vel);
    this.acc.set(0, 0, 0);
  }

  age() {
    this.lifespan -= this.lifeReduction * 0.6;
    if (this.lifespan <= 0 || this.pos.z < PARTICLE_BG_CONFIG.recycleFarZ) {
      this.lifespan = 1.0;
      this.isDone = true;
    }
  }
}

function randomSphereDirection() {
  const direction = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1
  );
  if (direction.lengthSq() < 0.000001) {
    direction.set(1, 0, 0);
  }
  return direction.normalize();
}

function randomSpherePoint(radius) {
  return randomSphereDirection().multiplyScalar(radius * Math.cbrt(Math.random()));
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax - inMin === 0) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * t;
}

function pseudoNoise3(x, y, z) {
  return Math.sin(x * 1.31) * 0.5 + Math.cos(y * 1.77) * 0.35 + Math.sin(z * 1.13 + x * 0.21) * 0.15;
}

function createParticle() {
  const x = THREE.MathUtils.randFloatSpread(PARTICLE_BG_CONFIG.spawnRangeX);
  const y = THREE.MathUtils.randFloatSpread(PARTICLE_BG_CONFIG.spawnRangeY);
  const z = THREE.MathUtils.randFloat(PARTICLE_BG_CONFIG.spawnFarZ, PARTICLE_BG_CONFIG.spawnNearZ);

  const dir = randomSphereDirection();
  const speed = THREE.MathUtils.randFloat(PARTICLE_BG_CONFIG.baseSpeedMin, PARTICLE_BG_CONFIG.baseSpeedMax);

  return new DecorativeParticle()
    .setPosition(x, y, z)
    .setVelocity(dir.x * speed, dir.y * speed, dir.z * speed);
}

function getCameraBasis() {
  // Use fixed world-space axes — ring center and orientation are independent of orbit controls
  return {
    center: new THREE.Vector3(0, 0, PARTICLE_BG_CONFIG.deltaBurstSpawnDistanceFromCamera),
    forward: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0)
  };
}

function pushParticleToBurstRing(particle, basis, deltaNorm, ringIndex, ringTotal) {
  // Evenly spaced angle — no jitter so the ring stays uniform
  const t = ringTotal <= 1 ? 0 : ringIndex / ringTotal;
  const angle = t * Math.PI * 2;

  // All particles placed at the same radius for a clean ring
  const radius = THREE.MathUtils.lerp(
    PARTICLE_BG_CONFIG.deltaBurstRingRadiusMin,
    PARTICLE_BG_CONFIG.deltaBurstRingRadiusMax,
    0.5
  );

  const radialDir = basis.right.clone().multiplyScalar(Math.cos(angle)).add(
    basis.up.clone().multiplyScalar(Math.sin(angle))
  ).normalize();

  const tangentDir = basis.up.clone().multiplyScalar(Math.cos(angle)).add(
    basis.right.clone().multiplyScalar(-Math.sin(angle))
  ).normalize();

  const radiusJitter = THREE.MathUtils.randFloatSpread(14.6667);
  const tangentJitter = THREE.MathUtils.randFloatSpread(8);
  const zJitter = THREE.MathUtils.randFloatSpread(12);

  const position = basis.center.clone()
    .add(radialDir.clone().multiplyScalar(radius + radiusJitter))
    .add(tangentDir.clone().multiplyScalar(tangentJitter))
    .add(basis.forward.clone().multiplyScalar(zJitter));

  // Uniform forward speed — all particles travel at the same rate
  const pushSpeed = THREE.MathUtils.lerp(
    PARTICLE_BG_CONFIG.deltaBurstPushSpeedMin,
    PARTICLE_BG_CONFIG.deltaBurstPushSpeedMax,
    0.5
  );

  // Pure forward velocity — no radial component keeps the ring flat
  const velocity = basis.forward.clone().multiplyScalar(pushSpeed);

  particle
    .setPosition(position.x, position.y, position.z)
    .setVelocity(velocity.x, velocity.y, velocity.z);
  particle.acc.set(0, 0, 0);
  particle.mass = 1.0;           // uniform mass for equal force response
  particle.isDone = false;
  particle.lifespan = 0.9;
  particle.isBurst = true;
  particle.burstFrames = 90;     // ~1.5s at 60fps, hold ring formation
}

function triggerDeltaBurst(currentTime, audioDelta) {
  const deltaNorm = Math.max(0, Math.min(1, Number(audioDelta) || 0));
  const isAbove = deltaNorm > PARTICLE_BG_CONFIG.deltaBurstThreshold;
  const canTrigger =
    isAbove &&
    !wasDeltaAboveThreshold &&
    (currentTime - lastDeltaBurstTime) >= PARTICLE_BG_CONFIG.deltaBurstCooldownMs;

  if (!canTrigger) {
    wasDeltaAboveThreshold = isAbove;
    return;
  }

  const basis = getCameraBasis();
  if (!basis) {
    wasDeltaAboveThreshold = isAbove;
    return;
  }

  const farIndices = [];
  for (let i = 0; i < backgroundParticles.length; i++) {
    if (backgroundParticles[i].pos.z < PARTICLE_BG_CONFIG.deltaBurstKillZ) {
      farIndices.push(i);
    }
  }

  const replaceCount = Math.min(PARTICLE_BG_CONFIG.deltaBurstRingCount, farIndices.length);
  for (let i = 0; i < replaceCount; i++) {
    const index = farIndices[i];
    const p = backgroundParticles[index];
    pushParticleToBurstRing(p, basis, deltaNorm, i, replaceCount);
  }

  lastDeltaBurstTime = currentTime;
  wasDeltaAboveThreshold = isAbove;
}

function buildBackgroundPoints(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  backgroundParticles = [];
  for (let i = 0; i < Math.min(count, 1500); i++) {
    const particle = createParticle();
    backgroundParticles.push(particle);

    const i3 = i * 3;
    positions[i3 + 0] = particle.pos.x;
    positions[i3 + 1] = particle.pos.y * PARTICLE_BG_CONFIG.yStretch;
    positions[i3 + 2] = particle.pos.z + PARTICLE_BG_CONFIG.zDepthOffset;

    const color = PARTICLE_BG_PALETTE[particle.paletteIndex];
    colors[i3 + 0] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setDrawRange(0, backgroundParticles.length);

  const texture = new THREE.TextureLoader().load('asset/particle_texture.jpg');
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.PointsMaterial({
    vertexColors: true,
    size: PARTICLE_BG_CONFIG.pointSize,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: texture
  });

  return {
    geometry,
    mesh: new THREE.Points(geometry, material)
  };
}

function setupParticles(scene) {
  if (!scene || backgroundPointCloud) return;

  const pointsBundle = buildBackgroundPoints(PARTICLE_BG_CONFIG.maxParticles);
  backgroundParticleGeometry = pointsBundle.geometry;
  backgroundPointCloud = pointsBundle.mesh;
  scene.add(backgroundPointCloud);
}

function setParticleBurstThreshold(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return;
  PARTICLE_BG_CONFIG.deltaBurstThreshold = Math.max(0, Math.min(1, next));
}

function setParticleBurstSpawnDistance(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return;
  PARTICLE_BG_CONFIG.deltaBurstSpawnDistanceFromCamera = Math.max(0, Math.min(1200, next));
}

function updateParticles(currentTime, audioDelta = 0, isAudioPlaying = false) {
  if (!backgroundPointCloud || !backgroundParticleGeometry) return;

  particleFrame++;
  triggerDeltaBurst(currentTime, audioDelta);

  while (backgroundParticles.length < PARTICLE_BG_CONFIG.maxParticles) {
    for (let i = 0; i < PARTICLE_BG_CONFIG.spawnPerFrame; i++) {
      if (backgroundParticles.length >= PARTICLE_BG_CONFIG.maxParticles) break;
      backgroundParticles.push(createParticle());
    }
    break;
  }

  const positions = backgroundParticleGeometry.attributes.position.array;
  const colors = backgroundParticleGeometry.attributes.color.array;
  const clampedDelta = Math.max(0, Math.min(1, Number(audioDelta) || 0));

  for (let i = 0; i < backgroundParticles.length; i++) {
    const p = backgroundParticles[i];

    if (p.isBurst) {
      // Ring phase: no noise forces, just coast forward with light damping
      p.burstFrames--;
      if (p.burstFrames <= 0) p.isBurst = false;
      p.vel.multiplyScalar(0.997);
      p.pos.add(p.vel);
    } else {
      p.flow(particleFrame, clampedDelta);
      p.moveOutward(clampedDelta, isAudioPlaying);
      p.move();
      p.adjustVelocity(-0.005);
    }
    p.age();

    if (p.isDone) {
      backgroundParticles[i] = createParticle();
      backgroundParticles[i].lifespan = 1.0;
    }

    const activeParticle = backgroundParticles[i];

    const i3 = i * 3;
    positions[i3 + 0] = activeParticle.pos.x;
    positions[i3 + 1] = activeParticle.pos.y * PARTICLE_BG_CONFIG.yStretch;
    positions[i3 + 2] = activeParticle.pos.z + PARTICLE_BG_CONFIG.zDepthOffset;

    const baseColor = PARTICLE_BG_PALETTE[activeParticle.paletteIndex];
    const boost = isAudioPlaying ? 0.2 : 0.0;
    const intensity = activeParticle.lifespan * (1 + clampedDelta * 0.35 + boost);
    colors[i3 + 0] = Math.min(1, baseColor.r * intensity);
    colors[i3 + 1] = Math.min(1, baseColor.g * intensity);
    colors[i3 + 2] = Math.min(1, baseColor.b * intensity);
  }

  backgroundPointCloud.rotation.y = 0;
  backgroundPointCloud.rotation.x = 0;
  backgroundParticleGeometry.setDrawRange(0, backgroundParticles.length);
  backgroundParticleGeometry.attributes.position.needsUpdate = true;
  backgroundParticleGeometry.attributes.color.needsUpdate = true;
}

window.setupParticles = setupParticles;
window.updateParticles = updateParticles;
window.setParticleBurstThreshold = setParticleBurstThreshold;
window.setParticleBurstSpawnDistance = setParticleBurstSpawnDistance;
