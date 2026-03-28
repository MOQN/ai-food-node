// Data & Configuration
const TAG_DATA = {
  food: [
    "Noodles",
    "Dessert",
    "Pasta",
    "Hotpot",
    "Strawberry",
    "Cream",
    "Chili Powder",
    "Sushi",
    "Burger",
    "Steak",
    "Chocolate",
  ],
  taste: [
    "Spicy",
    "Creamy",
    "Sweet",
    "Refreshing",
    "Greasy",
    "Clean",
    "Savory",
    "Sour",
    "Bitter",
  ],
  genre: [
    "K-Pop",
    "Rock",
    "R&B",
    "Rap",
    "Chinese Classical",
    "Jazz",
    "EDM",
    "Acoustic",
    "Heavy Metal",
  ],
  moodSpeed: [
    "Chill & Slow",
    "Steady & Medium",
    "Upbeat & Fast",
    "Hyper & Super Fast",
  ],
  moodVibe: ["A Bit Melancholic", "Just Chilling", "Super Excited!"],
};

const INSTRUMENT_MAP = {
  "K-Pop": "sleek synthesizers and glittering pop microphones",
  Rock: "electric guitars and heavy drum kits",
  "R&B": "smooth bass guitars and modern keyboards",
  Rap: "turntables, beatpads, and gold microphones",
  "Chinese Classical": "guzheng, erhu, and traditional bamboo flutes",
  Jazz: "saxophones, trumpets, and a classy upright bass",
  EDM: "DJ decks, neon synthesizers, and glowing launchpads",
  Acoustic: "wooden acoustic guitars, cajons, and tambourines",
  "Heavy Metal": "spiky flying-V guitars and massive double-kick drums",
};

const OUTPUT_FOLDER = "AIxFood";
const DEFAULT_AUDIO_DURATION_SECONDS = 120;
const DEFAULT_LYRICS_REPEAT_COUNT = 3;
const DEFAULT_CUSTOM_LYRICS_DIRECTION = "";
const DEFAULT_SPEED_MOOD = "Steady & Medium";
const DEFAULT_VIBE_MOOD = "Just Chilling";
const TOTAL_LOOP_VISUALS = 3;
const VISUAL_LOOP_INTERVAL_MS = 1200;
const IMAGE_REGEN_PROMPT_APPEND =
  ", high-energy action performance, energetic stage presence, dramatic camera pan right";
const ENABLE_MOBILE_UPLOAD_PREVIEW_STEP = true;

// ==========================================
// History Management & Band Class
// ==========================================
let historyGrid = [];

class Band {
  constructor(id, colorUri, depthUri, soundUri) {
    this.id = id;
    this.colorUri = colorUri;
    this.depthUri = depthUri;
    this.soundUri = soundUri;
    this.meshGroup = null;
  }

  buildPlaneMesh() {
    if (!window.THREE) {
      console.warn("THREE.js is not loaded yet.");
      return;
    }

    const textureLoader = new window.THREE.TextureLoader();
    const map = textureLoader.load(this.colorUri);

    const innerGeo = new window.THREE.PlaneGeometry(100, 100);
    const innerMat = new window.THREE.MeshBasicMaterial({
      map: map,
      side: window.THREE.DoubleSide,
    });
    const innerMesh = new window.THREE.Mesh(innerGeo, innerMat);

    const outerGeo = new window.THREE.PlaneGeometry(106, 106);
    const outerMat = new window.THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: window.THREE.DoubleSide,
    });
    const outerMesh = new window.THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.z = -0.5;

    const group = new window.THREE.Group();
    group.add(outerMesh);
    group.add(innerMesh);

    this.meshGroup = group;
  }
}

// State Management
let currentBase64Image = null;
let currentSessionTimestamp = "";
let generatedVisuals = [];
let visualLoopTimerId = null;
let visualLoopIndex = 0;
let activeVisualGenerationToken = 0;
let bandArrivalHideTimerId = null;

const selections = {
  food: new Set(),
  taste: new Set(),
  genre: new Set(),
  moodSpeed: new Set(),
  moodVibe: new Set(),
};

// Utility Functions
function getFormattedTimestamp() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yy}${mm}${dd}-${hh}${min}${ss}`;
}

function determineAudioSettings({ speedMood, vibeMood }) {
  const bpmBySpeedMood = {
    "Chill & Slow": 82,
    "Steady & Medium": 110,
    "Upbeat & Fast": 148,
    "Hyper & Super Fast": 190,
  };

  const keyscaleByVibeMood = {
    "A Bit Melancholic": "A minor",
    "Just Chilling": "C major",
    "Super Excited!": "E major",
  };

  return {
    bpm: bpmBySpeedMood[speedMood] || bpmBySpeedMood[DEFAULT_SPEED_MOOD],
    keyscale:
      keyscaleByVibeMood[vibeMood] || keyscaleByVibeMood[DEFAULT_VIBE_MOOD],
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function stopVisualLoop() {
  if (visualLoopTimerId) {
    clearInterval(visualLoopTimerId);
    visualLoopTimerId = null;
  }
}

function clearBandArrivalTimer() {
  if (bandArrivalHideTimerId) {
    clearTimeout(bandArrivalHideTimerId);
    bandArrivalHideTimerId = null;
  }
}

function showBandArrivalMessage() {
  const topArea = document.querySelector("#step-result .result-top-area");
  if (!topArea) return;

  clearBandArrivalTimer();
  topArea.classList.remove("message-hidden");

  bandArrivalHideTimerId = setTimeout(() => {
    topArea.classList.add("message-hidden");
  }, 4000);
}

function resetSelectionUI() {
  document.querySelectorAll(".tag-btn.active").forEach((button) => {
    button.classList.remove("active");
  });

  selections.food.clear();
  selections.taste.clear();
  selections.genre.clear();
  selections.moodSpeed.clear();
  selections.moodVibe.clear();

  document.querySelectorAll(".next-btn").forEach((button) => {
    button.disabled = true;
  });

  if (commentsFood) commentsFood.value = "";
  if (commentsTaste) commentsTaste.value = "";
  if (commentsGenre) commentsGenre.value = "";
  if (fileInput) fileInput.value = "";

  applyDefaultMoodSelections();
}

function setContainerThreeOpacityState(state) {
  const containerThree = document.getElementById("container-three");
  if (!containerThree) return;

  containerThree.classList.remove("dimmed", "active");

  if (state === "dimmed") {
    containerThree.classList.add("dimmed");
    return;
  }

  containerThree.classList.add("active");
}

function updateStep4GenerateState() {
  if (!generateBtn) return;

  const hasSpeedMood = selections.moodSpeed.size > 0;
  const hasVibeMood = selections.moodVibe.size > 0;

  generateBtn.disabled = !(hasSpeedMood && hasVibeMood);
}

function applyDefaultMoodSelections() {
  const defaults = [
    {
      containerId: "tags-mood-speed",
      category: "moodSpeed",
      value: DEFAULT_SPEED_MOOD,
    },
    {
      containerId: "tags-mood-vibe",
      category: "moodVibe",
      value: DEFAULT_VIBE_MOOD,
    },
  ];

  defaults.forEach(({ containerId, category, value }) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    selections[category].clear();
    selections[category].add(value);

    Array.from(container.children).forEach((button) => {
      button.classList.toggle("active", button.innerText === value);
    });
  });

  updateStep4GenerateState();
}

function inviteNextBand() {
  setContainerThreeOpacityState("dimmed");

  stopVisualLoop();
  clearBandArrivalTimer();
  generatedVisuals = [];
  visualLoopIndex = 0;
  activeVisualGenerationToken += 1;
  currentBase64Image = null;
  currentSessionTimestamp = "";

  const topArea = document.querySelector("#step-result .result-top-area");
  if (topArea) {
    topArea.classList.remove("message-hidden");
  }

  if (outImage) outImage.src = "";
  if (outAudio) outAudio.src = "";
  if (audioProgressBar) audioProgressBar.style.width = "0%";

  if (statusImage) statusImage.innerText = "IMAGE";
  if (statusAudio) statusAudio.innerText = "AUDIO";

  document
    .querySelectorAll(".loader-text, .circular-loader")
    .forEach((element) => {
      element.classList.remove("done");
    });

  resetSelectionUI();
  showStep(0);
}

function beginNewVisualSequence() {
  stopVisualLoop();
  generatedVisuals = [];
  visualLoopIndex = 0;
  activeVisualGenerationToken += 1;
  return activeVisualGenerationToken;
}

function isResultStepVisible() {
  const resultStep = document.getElementById("step-result");
  return Boolean(resultStep && !resultStep.classList.contains("hidden"));
}

function displayVisual(visual, options = {}) {
  if (!visual?.imageDataURI) return;

  outImage.src = visual.imageDataURI;
  initThreeJSShader(visual.imageDataURI, visual.depthDataURI, options);
}

function startVisualLoop(token) {
  stopVisualLoop();

  if (generatedVisuals.length < 2) return;

  visualLoopTimerId = window.setInterval(() => {
    if (token !== activeVisualGenerationToken || !isResultStepVisible()) {
      stopVisualLoop();
      return;
    }

    visualLoopIndex = (visualLoopIndex + 1) % generatedVisuals.length;
    displayVisual(generatedVisuals[visualLoopIndex], {
      animateIn: false,
      pulseOnSwap: false,
    });
  }, VISUAL_LOOP_INTERVAL_MS);
}

function buildStructuredLyrics({
  foods,
  tastes,
  genre,
  repeatCount,
  customDirection,
  foodComment,
  tasteComment,
}) {
  const foodLine = foods.length > 0 ? foods.join(", ") : "signature flavor";
  const tasteLine = tastes.length > 0 ? tastes.join(", ") : "vivid emotions";

  const foodPhrase = foodComment ? `${foodLine}, ${foodComment}` : foodLine;
  const tastePhrase = tasteComment
    ? `${tasteLine}, ${tasteComment}`
    : tasteLine;

  const foodRepeat = Array(4).fill(foodPhrase).join("\n");
  const tasteRepeat = Array(4).fill(tastePhrase).join("\n");

  const chorusMixed = [foodPhrase, tastePhrase, foodPhrase, tastePhrase].join(
    "\n",
  );

  return [
    "[Verse 1 - Male Vocal]",
    foodRepeat,
    "",
    "[Verse 2 - Female Vocal]",
    tasteRepeat,
    "",
    "[Pre-Chorus - Male & Female]",
    foodLine,
    tasteLine,
    "",
    "[Chorus - Male + Female + Chorus Stack]",
    chorusMixed,
    "",
    customDirection ? `[Custom Direction]\n${customDirection}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// DOM Elements
const dropOverlay = document.getElementById("drop-overlay");
const fileInput = document.getElementById("file-input");
const generateBtn = document.getElementById("generate-btn");
const mobilePreviewImage = document.getElementById(
  "mobile-upload-preview-image",
);
const mobilePreviewNextBtn = document.getElementById("mobile-preview-next-btn");

const outImage = document.getElementById("out-image");
const outAudio = document.getElementById("out-audio");
const audioProgressBar = document.getElementById("audio-progress-bar");
const statusImage = document.getElementById("status-image");
const statusAudio = document.getElementById("status-audio");

const commentsFood = document.getElementById("comments-food");
const commentsTaste = document.getElementById("comments-taste");
const commentsGenre = document.getElementById("comments-genre");

// Step Navigation
function showStep(stepIndex) {
  if (stepIndex !== "result") {
    stopVisualLoop();
    clearBandArrivalTimer();
  }

  document.querySelectorAll(".step").forEach((step) => {
    if (step.id === `step-${stepIndex}`) {
      step.classList.remove("hidden");
      setTimeout(() => step.classList.add("active"), 50);
    } else {
      step.classList.remove("active");
      setTimeout(() => {
        if (!step.classList.contains("active")) step.classList.add("hidden");
      }, 600);
    }
  });
}

document.querySelectorAll(".next-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const nextStep = e.target.getAttribute("data-next");
    if (nextStep) showStep(nextStep);
  });
});

// Initialization & UI
function init() {
  buildTagButtons("tags-food", TAG_DATA.food, "food", "1");
  buildTagButtons("tags-taste", TAG_DATA.taste, "taste", "2");
  buildTagButtons("tags-genre", TAG_DATA.genre, "genre", "3", true);
  buildTagButtons(
    "tags-mood-vibe",
    TAG_DATA.moodVibe,
    "moodVibe",
    "4",
    true,
    DEFAULT_VIBE_MOOD,
  );
  buildTagButtons(
    "tags-mood-speed",
    TAG_DATA.moodSpeed,
    "moodSpeed",
    "4",
    true,
    DEFAULT_SPEED_MOOD,
  );
  setContainerThreeOpacityState("active");
  bindCommentTextareaEnterAdvance();
  updateStep4GenerateState();

  const restartBtn = document.getElementById("restart-btn");
  if (restartBtn) restartBtn.addEventListener("click", inviteNextBand);
}

function bindCommentTextareaEnterAdvance() {
  document.querySelectorAll(".comment-box").forEach((textarea) => {
    textarea.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;

      event.preventDefault();

      const step = textarea.closest(".step");
      if (!step) return;

      const nextButton = step.querySelector(".next-btn");
      if (nextButton && !nextButton.disabled) {
        nextButton.click();
      }
    });
  });
}

function buildTagButtons(
  containerId,
  items,
  category,
  stepNum,
  isSingleSelect = false,
  defaultItem = null,
) {
  const container = document.getElementById(containerId);
  const nextBtn = document.querySelector(`#step-${stepNum} .next-btn`);
  if (!container) return;

  const shouldApplyDefault = isSingleSelect && Boolean(defaultItem);

  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "tag-btn";
    btn.innerText = item;

    if (shouldApplyDefault && item === defaultItem) {
      btn.classList.add("active");
      selections[category].clear();
      selections[category].add(item);
    }

    btn.addEventListener("click", () => {
      if (isSingleSelect) {
        Array.from(container.children).forEach((c) =>
          c.classList.remove("active"),
        );
        selections[category].clear();
        btn.classList.add("active");
        selections[category].add(item);
      } else {
        const isActive = btn.classList.toggle("active");
        if (isActive) selections[category].add(item);
        else selections[category].delete(item);
      }

      if (stepNum === "4") {
        updateStep4GenerateState();
      } else if (nextBtn) {
        nextBtn.disabled = selections[category].size === 0;
      }

      if (category === "food" || category === "taste") {
        if (typeof window.updateTextLabels === "function") {
          const labels = [...selections.food, ...selections.taste].slice(0, 6);
          window.updateTextLabels(labels);
        }
      }
    });
    container.appendChild(btn);
  });

  if (stepNum === "4") {
    updateStep4GenerateState();
  }
}

// File Handling
function processFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Invalid file. Please upload an image.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    currentBase64Image = e.target.result;
    showStep(1);
  };
  reader.readAsDataURL(file);
}

function handleIncomingMobileBase64Image(base64Image) {
  currentBase64Image = base64Image;

  if (
    ENABLE_MOBILE_UPLOAD_PREVIEW_STEP &&
    mobilePreviewImage &&
    mobilePreviewNextBtn
  ) {
    mobilePreviewImage.src = base64Image;
    showStep("mobile-preview");
    return;
  }

  showStep(1);
}

// Receive mobile image upload via CustomEvent from main.js
window.addEventListener("mobileImageReceived", (e) => {
  if (e.detail && e.detail.base64) {
    handleIncomingMobileBase64Image(e.detail.base64);
  }
});

if (mobilePreviewNextBtn) {
  mobilePreviewNextBtn.addEventListener("click", () => {
    showStep(1);
  });
}

const chooseFileBtn = document.getElementById("choose-file-btn");
if (chooseFileBtn)
  chooseFileBtn.addEventListener("click", () => fileInput.click());
if (fileInput)
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
  });

let dragCounter = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  if (dropOverlay) dropOverlay.classList.add("show");
});
window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0 && dropOverlay) dropOverlay.classList.remove("show");
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (dropOverlay) dropOverlay.classList.remove("show");
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
    processFile(e.dataTransfer.files[0]);
});

// Audio Player
outAudio.addEventListener("timeupdate", () => {
  if (outAudio.duration) {
    const percentage = (outAudio.currentTime / outAudio.duration) * 100;
    audioProgressBar.style.width = percentage + "%";
  }
});
outAudio.addEventListener("ended", () => (audioProgressBar.style.width = "0%"));

// Main Execution
if (generateBtn) {
  generateBtn.addEventListener("click", () => {
    const visualToken = beginNewVisualSequence();
    showStep("loading");

    document
      .querySelectorAll(".loader-text, .circular-loader")
      .forEach((el) => el.classList.remove("done"));
    if (statusImage) statusImage.innerText = "VISUAL";
    if (statusAudio) statusAudio.innerText = "AUDIO";

    const foods = Array.from(selections.food);
    const tastes = Array.from(selections.taste);
    const genres = Array.from(selections.genre);
    const speedMood = Array.from(selections.moodSpeed)[0] || DEFAULT_SPEED_MOOD;
    const vibeMood = Array.from(selections.moodVibe)[0] || DEFAULT_VIBE_MOOD;

    const foodStr = foods.length > 0 ? foods.join(", ") : "generic food";
    const tasteStr = tastes.length > 0 ? tastes.join(", ") : "delicious";
    const genreStr = genres.length > 0 ? genres[0] : "Jazz";

    const foodComment = commentsFood ? commentsFood.value.trim() : "";
    const tasteComment = commentsTaste ? commentsTaste.value.trim() : "";
    const genreDetail = commentsGenre ? ` (${commentsGenre.value.trim()})` : "";
    const foodDetail = foodComment ? ` (${foodComment})` : "";
    const tasteDetail = tasteComment ? ` (${tasteComment})` : "";
    const instruments =
      INSTRUMENT_MAP[genreStr] || "various musical instruments";

    const imagePrompt = `the food remain completely unchanged and realistic, preserving the original appearance and texture, photorealistic food, macro photography, tilt-shift effect, highly detailed. tiny food-shape musicians are generated based on ${foodStr}${foodDetail} and performing as a small cozy band across a food landscape. cute miniature ${foodStr} characters playing ${instruments}${genreDetail}. The overall atmosphere has a ${tasteStr}${tasteDetail} and ${genreStr} vibe, passionate and dynamic performance.`;

    const audioPrompt = `Priority: make low-mid frequencies dominant with a hard-hitting kick and an aggressive bassline. A highly rhythmic, energetic track with a strong driving beat. Style: ${genreStr}${genreDetail}. Vibe and mood: ${tasteStr}${tasteDetail}. Current energy: ${speedMood}. Emotional tone: ${vibeMood}. Inspired by a culinary experience of ${foodStr}${foodDetail}.`;

    const finalLyrics = buildStructuredLyrics({
      foods,
      tastes,
      genre: genreStr,
      repeatCount: DEFAULT_LYRICS_REPEAT_COUNT,
      customDirection: DEFAULT_CUSTOM_LYRICS_DIRECTION,
      foodComment,
      tasteComment,
    });

    const durationSeconds = DEFAULT_AUDIO_DURATION_SECONDS;

    const audioSettings = determineAudioSettings({ speedMood, vibeMood });

    currentSessionTimestamp = getFormattedTimestamp();

    const payloadImage = {
      promptText: imagePrompt,
      seed: Math.floor(Math.random() * 1000000),
      referenceImage: currentBase64Image,
      filePrefix: `${OUTPUT_FOLDER}/ai-food-${currentSessionTimestamp}`,
    };

    const payloadAudio = {
      promptText: audioPrompt,
      lyrics: finalLyrics,
      seed: Math.floor(Math.random() * 1000000),
      bpm: audioSettings.bpm,
      keyscale: audioSettings.keyscale,
      durationSeconds,
      filePrefix: `${OUTPUT_FOLDER}/ai-food-${currentSessionTimestamp}-audio`,
    };

    Promise.all([
      fetchMedia("/api/generate-image", payloadImage, "image"),
      fetchMedia("/api/generate-audio", payloadAudio, "audio"),
    ]).then(([imageData, audioDataURI]) => {
      if (imageData && imageData.success && audioDataURI) {
        setContainerThreeOpacityState("active");

        const initialVisual = {
          imageDataURI: imageData.imageDataURI,
          depthDataURI: imageData.depthDataURI,
        };
        generatedVisuals = [initialVisual];
        visualLoopIndex = 0;

        // 1. Create Band instance and generate Plane Meshes
        const newBand = new Band(
          currentSessionTimestamp,
          imageData.imageDataURI,
          imageData.depthDataURI,
          audioDataURI,
        );
        newBand.buildPlaneMesh(); // This creates the bordered plane group

        // 2. Add to global history
        historyGrid.push(newBand);
        console.log("Total Bands in History:", historyGrid.length);

        // 3. Update DOM elements
        outAudio.src = audioDataURI;

        if (statusImage) statusImage.innerText = "IMAGE & DEPTH READY";
        if (statusAudio) statusAudio.innerText = "AUDIO READY";

        showStep("result");
        showBandArrivalMessage();

        displayVisual(initialVisual, { animateIn: true, pulseOnSwap: false });

        if (typeof window.playGeneratedAudioInP5 === "function") {
          window.playGeneratedAudioInP5(audioDataURI);
        } else {
          outAudio.play();
        }

        void generateAdditionalVisuals(imagePrompt, visualToken);
      } else {
        alert("Generation failed. Check server logs.");
        showStep(0);
      }
    });
  });
}

// Network Requests
async function fetchMedia(endpoint, payload, type) {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    const loaderId = type === "image" ? "loader-image" : "loader-audio";
    document.getElementById(loaderId)?.classList.add("done");
    document.getElementById(`status-${type}`)?.classList.add("done");

    if (!result.success) {
      console.error(`[Fetch Error - ${type}]`, result.error);
      return null;
    }

    return type === "image" ? result : result.dataURI;
  } catch (err) {
    console.error(`[Fetch Error - ${type}]`, err);
    return null;
  }
}

async function fetchNextImageIteration(payload) {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await res.json();

  if (!result.success || !result.imageDataURI || !result.depthDataURI) {
    throw new Error(result.error || "Image regeneration failed.");
  }

  return result;
}

async function generateAdditionalVisuals(originalPrompt, token) {
  let referenceImage = generatedVisuals[0]?.imageDataURI || outImage.src;
  const hyperDynamicPrompt = `${originalPrompt}${IMAGE_REGEN_PROMPT_APPEND}`;

  while (generatedVisuals.length < TOTAL_LOOP_VISUALS) {
    if (token !== activeVisualGenerationToken || !isResultStepVisible()) {
      return;
    }

    const nextPayload = {
      promptText: hyperDynamicPrompt,
      seed: Math.floor(Math.random() * 1000000),
      referenceImage,
      filePrefix: `${OUTPUT_FOLDER}/ai-food-${currentSessionTimestamp}-loop-${generatedVisuals.length + 1}`,
    };

    try {
      const loopResult = await fetchNextImageIteration(nextPayload);
      generatedVisuals.push({
        imageDataURI: loopResult.imageDataURI,
        depthDataURI: loopResult.depthDataURI,
      });
      referenceImage = loopResult.imageDataURI;
    } catch (err) {
      console.error("[Loop] Failed.", err);
      break;
    }
  }

  if (token !== activeVisualGenerationToken) {
    return;
  }

  startVisualLoop(token);
}

// Shader Integration Hook
function initThreeJSShader(imageURI, depthURI, options) {
  if (window.updateThreeJSMaterial) {
    window.updateThreeJSMaterial(imageURI, depthURI, options);
  }
}

init();

// to test
async function loadShaderTestImages() {
  const testImagePath = "/shaderTest/image.png";
  const testDepthPath = "/shaderTest/depth.png";

  if (outImage) {
    outImage.src = testImagePath;
  }

  showStep("result");

  const applyWhenReady = () => {
    if (window.updateThreeJSMaterial) {
      initThreeJSShader(testImagePath, testDepthPath);
    } else {
      setTimeout(applyWhenReady, 100);
    }
  };

  setTimeout(applyWhenReady, 300);
}

window.loadShaderTestImages = loadShaderTestImages;
