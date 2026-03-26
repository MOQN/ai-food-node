// script-text3d.js
// Floating 3D text meshes for selected food & taste labels

let textMeshScene = null;
let activeTextMeshes = [];
let currentLabels = [];
let textFont = null;
let textFontReady = false;
let pendingLabels = null;

const TEXT3D_CONFIG = {
  maxMeshes: 6,
  textSize: 68,
  textDepth: 8,
  bevelEnabled: true,
  bevelThickness: 2.5,
  bevelSize: 1.2,
  bevelSegments: 2,
  curveSegments: 4,
  spreadX: 1100,
  spreadY: 720,
  centerAvoidRadiusXY: 450,
  minTextDistanceXY: 185,
  placementMaxAttempts: 40,
  spreadZ: 60,
  baseZ: 120,
  floatAmplitudeX: 45,
  floatAmplitudeY: 38,
  floatAmplitudeZ: 14,
  floatSpeedBase: 0.00028,
  rotAmplitude: 0.14,
  opacity: 0.72,
};

// Matches / extends the particle palette for visual cohesion
const TEXT3D_PALETTE = [
  new THREE.Color('#ff4d8d'),
  new THREE.Color('#ffa24d'),
  new THREE.Color('#ffe14d'),
  new THREE.Color('#4dffd2'),
  new THREE.Color('#a78bfa'),
  new THREE.Color('#67e8f9'),
];

class FloatingTextMesh {
  constructor(text, font, colorIndex, scene, basePosition = null) {
    this.scene = scene;
    this.seedX = Math.random() * Math.PI * 2;
    this.seedY = Math.random() * Math.PI * 2;
    this.seedZ = Math.random() * Math.PI * 2;
    this.floatSpeed = TEXT3D_CONFIG.floatSpeedBase * (0.7 + Math.random() * 0.6);

    this.basePos = basePosition
      ? basePosition.clone()
      : sampleTextBasePosition();

    const geo = new window.TextGeometry(text, {
      font,
      size: TEXT3D_CONFIG.textSize,
      depth: TEXT3D_CONFIG.textDepth,
      curveSegments: TEXT3D_CONFIG.curveSegments,
      bevelEnabled: TEXT3D_CONFIG.bevelEnabled,
      bevelThickness: TEXT3D_CONFIG.bevelThickness,
      bevelSize: TEXT3D_CONFIG.bevelSize,
      bevelSegments: TEXT3D_CONFIG.bevelSegments,
    });
    geo.center();

    const mat = new THREE.MeshBasicMaterial({
      color: TEXT3D_PALETTE[colorIndex % TEXT3D_PALETTE.length],
      transparent: true,
      opacity: TEXT3D_CONFIG.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.basePos);
    scene.add(this.mesh);
  }

  update(time) {
    const cfg = TEXT3D_CONFIG;
    const s = this.floatSpeed;
    this.mesh.position.x = this.basePos.x + Math.sin(time * s + this.seedX) * cfg.floatAmplitudeX;
    this.mesh.position.y = this.basePos.y + Math.cos(time * s * 0.8 + this.seedY) * cfg.floatAmplitudeY;
    this.mesh.position.z = this.basePos.z + Math.sin(time * s * 0.6 + this.seedZ) * cfg.floatAmplitudeZ;
    this.mesh.rotation.y = Math.sin(time * s * 0.5 + this.seedX) * cfg.rotAmplitude;
    this.mesh.rotation.x = Math.cos(time * s * 0.4 + this.seedY) * (cfg.rotAmplitude * 0.5);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.scene.remove(this.mesh);
  }
}

function sampleTextBasePosition() {
  const pos = new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(TEXT3D_CONFIG.spreadX),
    THREE.MathUtils.randFloatSpread(TEXT3D_CONFIG.spreadY),
    TEXT3D_CONFIG.baseZ + THREE.MathUtils.randFloatSpread(TEXT3D_CONFIG.spreadZ)
  );

  const minRadius = TEXT3D_CONFIG.centerAvoidRadiusXY;
  const xyDistance = Math.hypot(pos.x, pos.y);
  if (xyDistance < minRadius) {
    const angle = xyDistance > 0.001
      ? Math.atan2(pos.y, pos.x)
      : Math.random() * Math.PI * 2;
    const pushedRadius = minRadius + Math.random() * 80;
    pos.x = Math.cos(angle) * pushedRadius;
    pos.y = Math.sin(angle) * pushedRadius;
  }

  return pos;
}

function isFarEnoughFromPlaced(candidate, placedPositions) {
  const minDistance = TEXT3D_CONFIG.minTextDistanceXY;
  for (let i = 0; i < placedPositions.length; i++) {
    const placed = placedPositions[i];
    const dx = candidate.x - placed.x;
    const dy = candidate.y - placed.y;
    if (Math.hypot(dx, dy) < minDistance) {
      return false;
    }
  }
  return true;
}

function placeTextPositions(count) {
  const placed = [];

  for (let i = 0; i < count; i++) {
    let chosen = null;

    for (let attempt = 0; attempt < TEXT3D_CONFIG.placementMaxAttempts; attempt++) {
      const candidate = sampleTextBasePosition();
      if (isFarEnoughFromPlaced(candidate, placed)) {
        chosen = candidate;
        break;
      }
    }

    if (!chosen) {
      chosen = sampleTextBasePosition();
    }

    placed.push(chosen);
  }

  return placed;
}

function clearTextMeshes() {
  activeTextMeshes.forEach(t => t.dispose());
  activeTextMeshes = [];
  currentLabels = [];
}

function spawnTextMeshes(labels) {
  if (!textFont || !textMeshScene) return;
  clearTextMeshes();
  const limited = labels.slice(0, TEXT3D_CONFIG.maxMeshes);
  const positions = placeTextPositions(limited.length);
  currentLabels = [...limited];
  limited.forEach((label, i) => {
    activeTextMeshes.push(new FloatingTextMesh(label, textFont, i, textMeshScene, positions[i]));
  });
}

function setupTextMeshes(scene) {
  if (textMeshScene) return;
  textMeshScene = scene;

  const loader = new window.FontLoader();
  loader.load('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json', (font) => {
    textFont = font;
    textFontReady = true;
    if (pendingLabels) {
      spawnTextMeshes(pendingLabels);
      pendingLabels = null;
    }
  });
}

function updateTextLabels(labels) {
  if (!textFontReady) {
    pendingLabels = labels;
    return;
  }
  const same =
    labels.length === currentLabels.length &&
    labels.every((l, i) => l === currentLabels[i]);
  if (same) return;
  spawnTextMeshes(labels);
}

function updateTextMeshes(time) {
  activeTextMeshes.forEach(t => t.update(time));
}

window.setupTextMeshes = setupTextMeshes;
window.updateTextMeshes = updateTextMeshes;
window.updateTextLabels = updateTextLabels;
