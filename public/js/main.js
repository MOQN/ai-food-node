function setupThree() {
  if (typeof window.setupParticles === "function") {
    window.setupParticles(scene);
  }

  if (typeof window.setupTextMeshes === "function") {
    window.setupTextMeshes(scene);
  }

  // Call the external wrapper to setup shaders
  setupShaders(scene, ui.depthScale);
}

let isHoverDepthModeEnabled = false;
let hoverYRatio = 0.5;

function getDepthScaleFromHoverY(baseDepthScale) {
  const safeBase = Math.max(0, Number(baseDepthScale) || 0);
  const clampedY = Math.max(0, Math.min(1, Number(hoverYRatio) || 0));
  // Top (0) => full depth, Bottom (1) => flat
  return safeBase * (1 - clampedY);
}

function setHoverDepthModeEnabled(enabled) {
  isHoverDepthModeEnabled = Boolean(enabled);
  const toggleBtn = document.getElementById("hover-depth-toggle");
  if (!toggleBtn) return;

  toggleBtn.classList.toggle("is-active", isHoverDepthModeEnabled);
  toggleBtn.setAttribute(
    "aria-pressed",
    isHoverDepthModeEnabled ? "true" : "false",
  );
}

let deltaPeakTracker = 0.02;

function toNormalizedExponentialDelta(rawDelta) {
  const safeRaw = Math.max(0, Number(rawDelta) || 0);
  const decay = Math.max(
    0.97,
    Math.min(0.999, Number(ui.deltaPeakDecay) || 0.992),
  );
  deltaPeakTracker = Math.max(0.02, deltaPeakTracker * decay, safeRaw);

  const normalized = Math.max(0, Math.min(1, safeRaw / deltaPeakTracker));
  const exponent = Math.max(2, Math.min(4, Number(ui.deltaExponent) || 3));

  return 1 - Math.pow(1 - normalized, exponent);
}

function updateThree() {
  let audioVolume = 0;
  let audioDelta = 0;
  let isAudioPlaying = false;

  if (typeof window.getP5AudioMetrics === "function") {
    const metrics = window.getP5AudioMetrics();
    audioVolume = Number(metrics.volume.toFixed(4));
    audioDelta = toNormalizedExponentialDelta(metrics.delta);
    isAudioPlaying = Boolean(metrics.isPlaying);
    ui.audioVolume = audioVolume;
    ui.audioVolumeDelta = Number(audioDelta.toFixed(4));
  }

  if (typeof window.updateParticles === "function") {
    window.updateParticles(time, audioDelta, isAudioPlaying);
  }

  if (typeof window.updateTextMeshes === "function") {
    window.updateTextMeshes(time);
  }

  const effectiveDepthScale = isHoverDepthModeEnabled
    ? getDepthScaleFromHoverY(ui.depthScale)
    : ui.depthScale;

  // Call the external wrapper to update shaders every frame
  updateShaders(time, effectiveDepthScale, ui.meshTilt, audioVolume);

  // swing the mesh back and forth for a more dynamic look
  if (instancedObjs) {
    instancedObjs.rotation.y = Math.sin(time * 0.001) * 0.2; // Swing between -0.2 and 0.2 radians
    instancedObjs.rotation.z = Math.cos(time * 0.0007) * 0.15; // Swing between -0.15 and 0.15 radians
  }

  if (typeof updateGUI === "function") {
    updateGUI();
  }
}

// Listen for Server-Sent Events (SSE) for shake trigger and mobile image uploads
const evtSource = new EventSource("/api/listen-shake");
evtSource.onmessage = function (event) {
  try {
    const data = JSON.parse(event.data);

    // --- Handled shake action ---
    if (data.action === "shake") {
      console.log("Success: Shake event received from server!");
      // Keep shake as a signal only. We no longer trigger desktop file picker here,
      // because mobile upload is the source of truth for the latest selected image.
    }

    // --- Handled mobile image upload action ---
    if (data.action === "image-uploaded" && data.image) {
      console.log("Success: Image received from mobile device!");
      const step0 = document.getElementById("step-0");

      // Only auto-transition when the app is on START AUDITION (step-0).
      if (step0 && !step0.classList.contains("hidden")) {
        // Since 'currentBase64Image' and 'showStep' are in script-interface.js
        // and defined with 'let' globally, they might not be directly accessible
        // over 'window.currentBase64Image' or it might throw ReferenceError if
        // strict mode/module behavior applies. Let's force it via a custom event,
        // or just set window properties that script-interface.js can adopt.

        // Emitting a custom event is the safest way to pass data to another script.
        const event = new CustomEvent("mobileImageReceived", {
          detail: { base64: data.image },
        });
        window.dispatchEvent(event);
      }
    }
  } catch (err) {
    console.error("Error parsing SSE data:", err);
  }
};

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;

  const activeTag = document.activeElement?.tagName;
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

  const key = event.key?.toLowerCase();

  if (key === "t") {
    if (typeof window.loadShaderTestImages === "function") {
      window.loadShaderTestImages();
    }
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (typeof triggerClickPulse === "function") {
      triggerClickPulse();
    }
  }

  if (key === "f") {
    const fs = fullscreen();
    fullscreen(!fs);
  }

  if (key === "h") {
    if (typeof window.toggleGUI === "function") {
      window.toggleGUI();
    }
  }
});

window.addEventListener("mousemove", (event) => {
  if (window.innerHeight <= 0) return;
  hoverYRatio = event.clientY / window.innerHeight;
});

window.addEventListener(
  "touchmove",
  (event) => {
    if (window.innerHeight <= 0) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    hoverYRatio = touch.clientY / window.innerHeight;
  },
  { passive: true },
);

const hoverDepthToggleBtn = document.getElementById("hover-depth-toggle");
if (hoverDepthToggleBtn) {
  hoverDepthToggleBtn.addEventListener("click", () => {
    setHoverDepthModeEnabled(!isHoverDepthModeEnabled);
  });
}
