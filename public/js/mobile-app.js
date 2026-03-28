let motionGranted = false;
let selectedImageUrl = "";
let selectedImageBase64 = "";
let isConfirmed = false;
let lastShakeTime = 0;
let pixelsReady = false;
let pixelBlocks = [];
let pixelState = "idle";
let mobileSocket = null;
let mobileSocketConnected = false;
let dragState = {
  active: false,
  lastX: 0,
  velocity: 0,
};

const COLLISION_SPEED_DECAY = 0.72;
const SHAKE_ENERGY_BOOST = 4.8;

const ui = {
  permission: document.getElementById("permission-ui"),
  startBtn: document.getElementById("start-btn"),
  galleryScreen: document.getElementById("screen-gallery"),
  detailScreen: document.getElementById("screen-detail"),
  row1Track: document.getElementById("row-1-track"),
  row2Track: document.getElementById("row-2-track"),
  row1Viewport: document.getElementById("row-1-viewport"),
  row2Viewport: document.getElementById("row-2-viewport"),
  uploadBtn: document.getElementById("mobile-upload-btn"),
  fileInput: document.getElementById("mobile-file-input"),
  preview: document.getElementById("selected-preview"),
  backBtn: document.getElementById("btn-back"),
  confirmBtn: document.getElementById("btn-confirm"),
  detailButtons: document.getElementById("detail-buttons"),
  statusLine: document.getElementById("status-line"),
};

const rowState = {
  row1: {
    x: 0,
    speed: 0.7,
    itemWidth: 180,
    count: 0,
    draggingBoost: 1,
  },
  row2: {
    x: 0,
    speed: 1.2,
    itemWidth: 180,
    count: 0,
    draggingBoost: 1.15,
  },
};

async function requestMotionPermissions() {
  const requests = [];

  if (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    requests.push(DeviceMotionEvent.requestPermission());
  } else {
    requests.push(Promise.resolve("granted"));
  }

  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    requests.push(DeviceOrientationEvent.requestPermission());
  } else {
    requests.push(Promise.resolve("granted"));
  }

  const result = await Promise.all(requests);
  return result.every((status) => status === "granted");
}

async function initApp() {
  try {
    motionGranted = await requestMotionPermissions();
  } catch (err) {
    console.error("Permission error:", err);
    motionGranted = false;
  }

  if (!motionGranted) {
    alert("Motion permission denied. Shake/gyro effects may not work.");
  }

  ui.permission.classList.add("hidden");
  ui.galleryScreen.classList.remove("hidden");

  await buildGallery();
  bindGalleryDrag();
  startGalleryLoop();
}

function setSelectedImage(base64OrUrl, isBase64) {
  isConfirmed = false;
  pixelsReady = false;
  pixelBlocks = [];
  pixelState = "idle";

  selectedImageUrl = isBase64 ? base64OrUrl : base64OrUrl;
  selectedImageBase64 = isBase64 ? base64OrUrl : "";

  ui.preview.src = selectedImageUrl;
  ui.statusLine.classList.add("hidden");
  ui.detailButtons.classList.remove("hidden");

  ui.galleryScreen.classList.add("hidden");
  ui.detailScreen.classList.remove("hidden");
}

function backToGallery() {
  isConfirmed = false;
  pixelsReady = false;
  pixelBlocks = [];
  pixelState = "idle";
  ui.detailScreen.classList.add("hidden");
  ui.galleryScreen.classList.remove("hidden");
  ui.statusLine.classList.add("hidden");
  ui.detailButtons.classList.remove("hidden");
}

async function toBase64FromUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return blobToBase64(blob);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function buildGallery() {
  const res = await fetch("/api/dishes");
  const data = await res.json();
  const images = Array.isArray(data.images) ? data.images : [];

  if (images.length === 0) {
    throw new Error("No dish images found in /public/dishes.");
  }

  const row1 = [];
  const row2 = [];

  images.forEach((img, idx) => {
    if (idx % 2 === 0) row1.push(img);
    else row2.push(img);
  });

  if (row1.length === 0) row1.push(...images);
  if (row2.length === 0) row2.push(...images);

  renderRow(ui.row1Track, row1, rowState.row1);
  renderRow(ui.row2Track, row2, rowState.row2);
}

function renderRow(trackEl, imageList, state) {
  const repeatTimes = 4;
  trackEl.innerHTML = "";

  const allItems = [];
  for (let i = 0; i < repeatTimes; i += 1) {
    allItems.push(...imageList);
  }

  allItems.forEach((filename) => {
    const img = document.createElement("img");
    img.src = `/dishes/${filename}`;
    img.alt = filename;
    img.className = "gallery-item";

    img.addEventListener("click", async () => {
      setSelectedImage(img.src, false);
      try {
        selectedImageBase64 = await toBase64FromUrl(img.src);
      } catch (err) {
        console.error(
          "Failed to convert selected gallery image to base64:",
          err,
        );
      }
    });

    trackEl.appendChild(img);
  });

  const sample = trackEl.querySelector(".gallery-item");
  const itemWidth = sample ? sample.getBoundingClientRect().width + 16 : 180;
  state.itemWidth = itemWidth;
  state.count = imageList.length;
}

function normalizeRow(state) {
  const cycle = state.itemWidth * state.count;
  if (!Number.isFinite(cycle) || cycle <= 0) return;

  while (state.x <= -cycle) state.x += cycle;
  while (state.x >= cycle) state.x -= cycle;
}

function applyRowTransforms() {
  ui.row1Track.style.transform = `translate3d(${rowState.row1.x}px, -50%, 0)`;
  ui.row2Track.style.transform = `translate3d(${rowState.row2.x}px, -50%, 0)`;
}

function bindGalleryDrag() {
  const stage = document.getElementById("gallery-stage");

  stage.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.touches[0];
      dragState.active = true;
      dragState.lastX = touch.clientX;
      dragState.velocity = 0;
    },
    { passive: true },
  );

  stage.addEventListener(
    "touchmove",
    (e) => {
      if (!dragState.active) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragState.lastX;
      dragState.lastX = touch.clientX;
      dragState.velocity = dx;

      rowState.row1.x += dx * rowState.row1.draggingBoost;
      rowState.row2.x += dx * rowState.row2.draggingBoost;
      normalizeRow(rowState.row1);
      normalizeRow(rowState.row2);
      applyRowTransforms();
    },
    { passive: true },
  );

  stage.addEventListener(
    "touchend",
    () => {
      dragState.active = false;
    },
    { passive: true },
  );
}

function startGalleryLoop() {
  const animate = () => {
    if (!ui.galleryScreen.classList.contains("hidden")) {
      rowState.row1.x -= rowState.row1.speed;
      rowState.row2.x -= rowState.row2.speed;

      if (!dragState.active) {
        rowState.row1.x += dragState.velocity * 0.4;
        rowState.row2.x += dragState.velocity * 0.4;
        dragState.velocity *= 0.9;
      }

      normalizeRow(rowState.row1);
      normalizeRow(rowState.row2);
      applyRowTransforms();
    }

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

async function sendSelectedImageToServer() {
  if (!selectedImageBase64) {
    selectedImageBase64 = await toBase64FromUrl(selectedImageUrl);
  }

  // Prefer WebSocket for direct low-latency transfer; fallback to HTTP when needed.
  if (
    mobileSocketConnected &&
    mobileSocket &&
    mobileSocket.readyState === WebSocket.OPEN
  ) {
    mobileSocket.send(
      JSON.stringify({
        type: "mobile-upload",
        imageBase64: selectedImageBase64,
      }),
    );
    return;
  }

  const res = await fetch("/api/mobile-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: selectedImageBase64 }),
  });

  if (!res.ok) {
    throw new Error(`Upload failed with status ${res.status}`);
  }

  const data = await res.json();
  console.log("Mobile upload success (HTTP fallback):", data);
}

function initMobileSocket() {
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProto}//${window.location.host}/ws`;

  mobileSocket = new WebSocket(wsUrl);

  mobileSocket.addEventListener("open", () => {
    mobileSocketConnected = true;
    console.log("[Mobile WS] connected:", wsUrl);
  });

  mobileSocket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "upload-ack" && data.ok) {
        console.log("Mobile upload success (WebSocket):", data.message);
      }
    } catch (err) {
      console.warn("[Mobile WS] Non-JSON message", err);
    }
  });

  mobileSocket.addEventListener("close", () => {
    mobileSocketConnected = false;
    mobileSocket = null;

    // Auto-reconnect while detail screen remains active.
    setTimeout(() => {
      if (!ui.detailScreen.classList.contains("hidden")) {
        initMobileSocket();
      }
    }, 1200);
  });

  mobileSocket.addEventListener("error", () => {
    mobileSocketConnected = false;
  });
}

function energizePixelBlocks() {
  if (pixelBlocks.length === 0) return;

  const centerX = window.innerWidth * 0.5;
  const centerY = window.innerHeight * 0.42;

  for (let i = 0; i < pixelBlocks.length; i += 1) {
    const p = pixelBlocks[i];
    const angle =
      Math.atan2(p.homeY - centerY, p.homeX - centerX) + random(-0.55, 0.55);
    const boost = random(SHAKE_ENERGY_BOOST * 0.65, SHAKE_ENERGY_BOOST * 1.3);

    p.vx = p.vx * 0.35 + Math.cos(angle) * boost + random(-1.1, 1.1);
    p.vy = p.vy * 0.35 + Math.sin(angle) * boost + random(-1.1, 1.1);
  }

  pixelsReady = true;
  pixelState = "exploded";
  ui.preview.style.opacity = "0";
}

function startRestorePixels() {
  if (!pixelsReady || pixelBlocks.length === 0) return;
  pixelState = "restoring";
}

function triggerExplosionFromImage() {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = selectedImageUrl;

  img.onload = () => {
    const blockSize = 14;
    const temp = document.createElement("canvas");
    temp.width = img.width;
    temp.height = img.height;
    const ctx = temp.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const targetSize = Math.min(window.innerWidth * 0.78, 360);
    const scale = targetSize / Math.max(img.width, img.height);
    const renderW = Math.floor(img.width * scale);
    const renderH = Math.floor(img.height * scale);
    const originX = (window.innerWidth - renderW) * 0.5;
    const originY = (window.innerHeight - renderH) * 0.42;

    pixelBlocks = [];

    for (let y = 0; y < img.height; y += blockSize) {
      for (let x = 0; x < img.width; x += blockSize) {
        const px = ctx.getImageData(x, y, 1, 1).data;
        const alpha = px[3];
        if (alpha < 10) continue;

        const bx = originX + x * scale;
        const by = originY + y * scale;
        const cx = originX + renderW * 0.5;
        const cy = originY + renderH * 0.5;
        const dx = bx - cx;
        const dy = by - cy;
        const len = Math.max(1, Math.hypot(dx, dy));

        // Radial burst plus angle jitter so particles do not launch in a uniform direction.
        const burstPower = random(2.5, 7.5);
        const jitterAngle = random(-0.9, 0.9);
        const baseAngle = Math.atan2(dy, dx) + jitterAngle;
        const radialVx = Math.cos(baseAngle) * burstPower;
        const radialVy = Math.sin(baseAngle) * burstPower;

        pixelBlocks.push({
          x: bx,
          y: by,
          homeX: bx,
          homeY: by,
          vx: radialVx + random(-1.8, 1.8) + (dx / len) * random(0.2, 1.4),
          vy: radialVy + random(-1.8, 1.8) + (dy / len) * random(0.2, 1.4),
          size: Math.max(4, blockSize * scale),
          color: `rgba(${px[0]}, ${px[1]}, ${px[2]}, 0.95)`,
          drag: random(0.972, 0.992),
          bounce: random(0.6, 0.88),
          swirl: random(0.4, 1.6),
          phase: random(0, Math.PI * 2),
        });
      }
    }

    pixelsReady = true;
    pixelState = "exploded";
    ui.preview.style.opacity = "0";
  };
}

function setup() {
  const parent = document.getElementById("physics-layer");
  const cnv = createCanvas(window.innerWidth, window.innerHeight);
  cnv.parent(parent);
  clear();
}

function draw() {
  clear();
  if (!pixelsReady || pixelBlocks.length === 0) return;

  const gyroX = Number(window.rotationY || 0);
  const gyroY = Number(window.rotationX || 0);
  const gravityX = map(gyroX, -90, 90, -0.35, 0.35, true);
  const gravityY = map(gyroY, -90, 90, -0.35, 0.35, true);
  const t = millis() * 0.001;
  let settledCount = 0;

  for (let i = 0; i < pixelBlocks.length; i += 1) {
    const p = pixelBlocks[i];

    if (pixelState === "restoring") {
      const dx = p.homeX - p.x;
      const dy = p.homeY - p.y;

      p.vx += dx * 0.08;
      p.vy += dy * 0.08;
      p.vx *= 0.82;
      p.vy *= 0.82;
    } else {
      // Keep motion lively but let collision damping dominate over time.
      const noiseX = Math.sin(t * (1.2 + p.swirl) + p.phase) * 0.04;
      const noiseY = Math.cos(t * (1.1 + p.swirl) - p.phase) * 0.04;

      p.vx += gravityX + noiseX + random(-0.006, 0.006);
      p.vy += gravityY + noiseY + random(-0.006, 0.006);

      p.vx *= p.drag;
      p.vy *= p.drag;
    }

    p.x += p.vx;
    p.y += p.vy;

    let collided = false;

    if (p.x < 0) {
      p.x = 0;
      p.vx *= -p.bounce;
      collided = true;
    }
    if (p.x > width - p.size) {
      p.x = width - p.size;
      p.vx *= -p.bounce;
      collided = true;
    }
    if (p.y < 0) {
      p.y = 0;
      p.vy *= -p.bounce;
      collided = true;
    }
    if (p.y > height - p.size) {
      p.y = height - p.size;
      p.vy *= -p.bounce;
      collided = true;
    }

    if (collided) {
      p.vx *= COLLISION_SPEED_DECAY;
      p.vy *= COLLISION_SPEED_DECAY;
    }

    if (pixelState === "restoring") {
      const closeToHome =
        Math.abs(p.homeX - p.x) < 0.9 &&
        Math.abs(p.homeY - p.y) < 0.9 &&
        Math.abs(p.vx) < 0.25 &&
        Math.abs(p.vy) < 0.25;

      if (closeToHome) {
        p.x = p.homeX;
        p.y = p.homeY;
        p.vx = 0;
        p.vy = 0;
        settledCount += 1;
      }
    }

    noStroke();
    fill(p.color);
    rect(p.x, p.y, p.size, p.size);
  }

  if (pixelState === "restoring" && settledCount >= pixelBlocks.length * 0.98) {
    pixelsReady = false;
    pixelState = "idle";
    ui.preview.style.opacity = "1";
  }
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}

function onShakeDetected() {
  if (!isConfirmed) return;

  const now = Date.now();
  // Keep a short debounce to avoid sensor noise, but still allow rapid repeated shakes.
  if (now - lastShakeTime < 300) return;
  lastShakeTime = now;

  if (pixelBlocks.length === 0) {
    triggerExplosionFromImage();
  } else {
    energizePixelBlocks();
  }

  // Upload on every valid shake so desktop always receives the latest selected image.
  sendSelectedImageToServer().catch((err) => {
    console.error("Failed to send selected image to server:", err);
  });
}

window.addEventListener("devicemotion", (event) => {
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;

  const mag = Math.sqrt(
    (acc.x || 0) * (acc.x || 0) +
      (acc.y || 0) * (acc.y || 0) +
      (acc.z || 0) * (acc.z || 0),
  );

  if (mag > 22) {
    onShakeDetected();
  }
});

ui.startBtn.addEventListener("click", () => {
  initApp().catch((err) => {
    console.error(err);
    alert("Failed to initialize mobile page. Check console.");
  });
});

ui.uploadBtn.addEventListener("click", () => {
  ui.fileInput.click();
});

ui.fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const base64 = await blobToBase64(file);
  setSelectedImage(base64, true);

  // Allow selecting the same file again and still triggering change.
  ui.fileInput.value = "";
});

ui.backBtn.addEventListener("click", () => {
  ui.preview.style.opacity = "1";
  backToGallery();
});

ui.confirmBtn.addEventListener("click", () => {
  isConfirmed = true;
  ui.detailButtons.classList.add("hidden");
  ui.statusLine.classList.remove("hidden");

  if (!mobileSocketConnected) {
    initMobileSocket();
  }
});

window.addEventListener("pointerdown", () => {
  if (!isConfirmed) return;
  if (ui.detailScreen.classList.contains("hidden")) return;
  if (pixelState !== "exploded") return;
  startRestorePixels();
});
