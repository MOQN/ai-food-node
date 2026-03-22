// ==========================================
// Data & Configuration
// ==========================================
const TAG_DATA = {
  food: ['Noodles', 'Dessert', 'Pasta', 'Hotpot', 'Strawberry', 'Cream', 'Chili Powder', 'Sushi', 'Burger', 'Steak', 'Chocolate'],
  taste: ['Spicy', 'Creamy', 'Sweet', 'Refreshing', 'Greasy', 'Clean', 'Savory', 'Sour', 'Bitter'],
  genre: ['K-Pop', 'Rock', 'R&B', 'Rap', 'Chinese Classical', 'Jazz', 'EDM', 'Acoustic', 'Heavy Metal']
};

const INSTRUMENT_MAP = {
  'K-Pop': 'sleek synthesizers and glittering pop microphones',
  'Rock': 'electric guitars and heavy drum kits',
  'R&B': 'smooth bass guitars and modern keyboards',
  'Rap': 'turntables, beatpads, and gold microphones',
  'Chinese Classical': 'guzheng, erhu, and traditional bamboo flutes',
  'Jazz': 'saxophones, trumpets, and a classy upright bass',
  'EDM': 'DJ decks, neon synthesizers, and glowing launchpads',
  'Acoustic': 'wooden acoustic guitars, cajons, and tambourines',
  'Heavy Metal': 'spiky flying-V guitars and massive double-kick drums'
};

// ==========================================
// State Management
// ==========================================
let currentBase64Image = null;
let isGeneratingImage = false;
let isGeneratingAudio = false;

const selections = {
  food: new Set(),
  taste: new Set(),
  genre: new Set()
};

// ==========================================
// DOM Elements
// ==========================================
const dropOverlay = document.getElementById('drop-overlay');
const fileInput = document.getElementById('file-input');
const generateBtn = document.getElementById('generate-btn');
const wizardPanel = document.getElementById('wizard-panel');

const outImage = document.getElementById('out-image');
const outAudio = document.getElementById('out-audio');
const audioProgressBar = document.getElementById('audio-progress-bar');
const loadingIndicator = document.getElementById('loading-indicator');
const statusText = document.getElementById('status-text');

// Reference to the new continuous loop spinner
const reloadingSpinner = document.getElementById('reloading-spinner');

const commentsFood = document.getElementById('comments-food');
const commentsTaste = document.getElementById('comments-taste');
const commentsGenre = document.getElementById('comments-genre');

// ==========================================
// Custom Audio Player Logic
// ==========================================
function updateAudioProgress() {
  if (outAudio.duration) {
    const percentage = (outAudio.currentTime / outAudio.duration) * 100;
    audioProgressBar.style.width = percentage + '%';
  }
}

outAudio.addEventListener('timeupdate', updateAudioProgress);
outAudio.addEventListener('ended', () => {
  audioProgressBar.style.width = '0%';
});

// ==========================================
// Flow Controller (Step Navigation)
// ==========================================
function showStep(stepIndex) {
  document.querySelectorAll('.step').forEach(step => {
    if (step.id === `step-${stepIndex}`) {
      // Show the new target screen smoothly
      step.classList.remove('hidden');
      setTimeout(() => step.classList.add('active'), 50);
    } else {
      // Hide the existing screen and wait for the CSS transition to finish
      step.classList.remove('active');
      setTimeout(() => {
        if (!step.classList.contains('active')) {
          step.classList.add('hidden');
        }
      }, 600);
    }
  });
}

// Attach event listeners to all NEXT buttons
document.querySelectorAll('.next-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const nextStep = e.target.getAttribute('data-next');
    if (nextStep) showStep(nextStep);
  });
});

// ==========================================
// Initialization & UI Builders
// ==========================================
function init() {
  buildTagButtons('tags-food', TAG_DATA.food, 'food', '1');
  buildTagButtons('tags-taste', TAG_DATA.taste, 'taste', '2');
  buildTagButtons('tags-genre', TAG_DATA.genre, 'genre', '3', true); // Single select for genre

  // Reload the page to start a fresh audition
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      location.reload();
    });
  }
}

function buildTagButtons(containerId, items, category, stepNum, isSingleSelect = false) {
  const container = document.getElementById(containerId);
  const nextBtn = document.querySelector(`#step-${stepNum} .next-btn`);

  if (!container) return;

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn';
    btn.innerText = item;

    btn.addEventListener('click', () => {
      if (isSingleSelect) {
        Array.from(container.children).forEach(c => c.classList.remove('active'));
        selections[category].clear();
        btn.classList.add('active');
        selections[category].add(item);
      } else {
        const isActive = btn.classList.toggle('active');
        if (isActive) selections[category].add(item);
        else selections[category].delete(item);
      }

      // Enable the NEXT button only if at least 1 tag is selected
      if (nextBtn) {
        nextBtn.disabled = selections[category].size === 0;
      }
    });
    container.appendChild(btn);
  });
}

// ==========================================
// File Upload & Drag-and-Drop Handling
// ==========================================
function processFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert("Invalid file. Please upload an image.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentBase64Image = e.target.result;
    // Proceed directly to Step 1.
    showStep(1);
  };
  reader.readAsDataURL(file);
}

// Click to upload
const chooseFileBtn = document.getElementById('choose-file-btn');
if (chooseFileBtn) {
  chooseFileBtn.addEventListener('click', () => fileInput.click());
}

if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
  });
}

// Bulletproof drag-and-drop defense logic
let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  if (dropOverlay) dropOverlay.classList.add('show');
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  // Only hide overlay when the cursor fully leaves the browser window
  if (dragCounter === 0 && dropOverlay) {
    dropOverlay.classList.remove('show');
  }
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (dropOverlay) dropOverlay.classList.remove('show');

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    processFile(e.dataTransfer.files[0]);
  }
});

// ==========================================
// Prompt Engineering & API Execution
// ==========================================
if (generateBtn) {
  generateBtn.addEventListener('click', () => {
    // Move to the loading screen
    showStep('loading');

    const foods = Array.from(selections.food);
    const tastes = Array.from(selections.taste);
    const genres = Array.from(selections.genre);

    const cFood = commentsFood ? commentsFood.value.trim() : "";
    const cTaste = commentsTaste ? commentsTaste.value.trim() : "";
    const cGenre = commentsGenre ? commentsGenre.value.trim() : "";

    const foodStr = foods.length > 0 ? foods.join(", ") : "generic food";
    const tasteStr = tastes.length > 0 ? tastes.join(", ") : "delicious";
    const genreStr = genres.length > 0 ? genres[0] : "Jazz";

    const foodDetail = cFood ? ` (${cFood})` : "";
    const tasteDetail = cTaste ? ` (${cTaste})` : "";
    const genreDetail = cGenre ? ` (${cGenre})` : "";

    const instruments = INSTRUMENT_MAP[genreStr] || 'various musical instruments';

    // Construct final prompts
    const imagePrompt = `the food remain completely unchanged and realistic, preserving the original appearance and texture, photorealistic food, macro photography, tilt-shift effect, highly detailed. tiny food-shape musicians are generated based on ${foodStr}${foodDetail} and performing as a small cozy band across a food landscape. cute miniature ${foodStr} characters playing ${instruments}${genreDetail}. The overall atmosphere has a ${tasteStr}${tasteDetail} and ${genreStr} vibe, passionate and dynamic performance.`;

    const audioPrompt = `A highly rhythmic, energetic track with a strong driving beat. Style: ${genreStr}${genreDetail}. Vibe and mood: ${tasteStr}${tasteDetail}. Inspired by a culinary experience of ${foodStr}${foodDetail}.`;

    // Extract 4 lyric words for audio model
    let lyricsArray = [...foods];
    const paddingWords = ['Tasty', 'Fresh', 'Savory', 'Bite'];
    let i = 0;
    while (lyricsArray.length < 4) {
      lyricsArray.push(paddingWords[i % paddingWords.length]);
      i++;
    }
    const finalLyrics = lyricsArray.slice(0, 4).join("\n");

    const payloadImage = {
      promptText: imagePrompt,
      seed: Math.floor(Math.random() * 1000000),
      referenceImage: currentBase64Image
    };

    const payloadAudio = {
      promptText: audioPrompt,
      lyrics: finalLyrics,
      seed: Math.floor(Math.random() * 1000000)
    };

    console.log("Image Prompt:", imagePrompt);
    console.log("Audio Prompt:", audioPrompt);

    // Clear previous results
    outImage.src = "";
    outAudio.src = "";
    audioProgressBar.style.width = '0%';

    // Execute both generations concurrently
    Promise.all([
      fetchImage(payloadImage),
      fetchAudio(payloadAudio)
    ]).then(([imgDataUri, audioDataUri]) => {
      if (imgDataUri && audioDataUri) {
        outImage.src = imgDataUri;
        outAudio.src = audioDataUri;

        showStep('result');
        outAudio.play();

        // Trigger Three.js environment setup
        initThreeJSPlane(imgDataUri);

        // 🌟 START THE INFINITE LOOP 🌟
        runContinuousImageRegeneration(imagePrompt);
      } else {
        alert("Generation failed. Please check the server logs.");
        showStep(0);
      }
    });
  });
}

// ==========================================
// Network Requests (Initial Generation)
// ==========================================
async function fetchImage(payload) {
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    // Update circular loader UI to indicate completion
    const loaderImage = document.getElementById('loader-image');
    const statusImage = document.getElementById('status-image');
    if (loaderImage) loaderImage.classList.add('done');
    if (statusImage) {
      statusImage.classList.add('done');
      statusImage.innerText = "IMAGE READY";
    }

    return result.success ? result.dataURI : null;
  } catch (err) {
    console.error("Fetch Error (Image):", err);
    return null;
  }
}

async function fetchAudio(payload) {
  try {
    const res = await fetch('/api/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    // Update circular loader UI to indicate completion
    const loaderAudio = document.getElementById('loader-audio');
    const statusAudio = document.getElementById('status-audio');
    if (loaderAudio) loaderAudio.classList.add('done');
    if (statusAudio) {
      statusAudio.classList.add('done');
      statusAudio.innerText = "AUDIO READY";
    }

    return result.success ? result.dataURI : null;
  } catch (err) {
    console.error("Fetch Error (Audio):", err);
    return null;
  }
}

// ==========================================
// 🌟 Continuous Image Regeneration Loop 🌟
// ==========================================
/**
 * Executes an infinite recursive loop that generates new images 
 * using the previously generated result as input.
 * Modified to force highly dynamic movement for subsequent generations.
 * @param {string} originalPrompt - The original visual prompt text.
 */
async function runContinuousImageRegeneration(originalPrompt) {
  const resultStep = document.getElementById('step-result');

  // Safety check: Stop the loop if we are not on the result step anymore
  if (!resultStep || resultStep.classList.contains('hidden')) {
    if (reloadingSpinner) reloadingSpinner.classList.add('hidden');
    return;
  }

  // 1. Get the current result image Base64 to use as input
  const resultBase64Input = outImage.src;

  // 🌟 🌟 🌟 MODIFICATION START: Augmenting for dynamic movement 🌟 🌟 🌟

  // Construct a specific "dynamic movement" prompt to append.
  // We emphasize jumping, dancing, wild gestures, and sweat to force drastic pose changes.
  const movementAugmentation = ", high-energy action performance, characters captured mid-air, jumping, dancing wildly, extreme dynamic poses, wild instrument gestures, intense facial expressions, sweat dripping, motion blur on limbs, energetic stage presence, dramatic camera pan right, rotating view to the right, dynamic perspective shift revealing the right side of the scene, dynamic camera zooming in on one specific character, shallow depth of field, flashy lighting, dramatic light shifts, stark contrast between light and shadow, chiaroscuro, strobe lights, pulsating colors, rapid changes from dark to bright, moody atmosphere with brilliant highlights";

  // Combine original prompt with the movement modification
  const hyperDynamicPrompt = originalPrompt + movementAugmentation;

  // console.log("[Loop] Augmented Prompt:", hyperDynamicPrompt); // Debugging

  // 🌟 🌟 🌟 MODIFICATION END 🌟 🌟 🌟

  // 2. Construct payload using result image, new random seed, and HYPER-DYNAMIC prompt
  const nextPayload = {
    promptText: hyperDynamicPrompt, // 🌟 Now uses the augmented prompt for movement
    seed: Math.floor(Math.random() * 1000000), // New seed is crucial for pose changes
    referenceImage: resultBase64Input // Feed result back
  };

  // 3. Show circular loader over the current image
  if (reloadingSpinner) reloadingSpinner.classList.remove('hidden');

  try {
    console.log("[Loop] Requesting next dynamic image iteration...");
    // 4. Request image generation
    const nextDataURI = await fetchNextImageIteration(nextPayload);

    if (nextDataURI) {
      // 5. Update the image on screen with the new dynamic result
      outImage.src = nextDataURI;
      console.log("[Loop] Dynamic image updated.");
    }
  } catch (err) {
    console.error("[Loop] Image regeneration failed. Stopping loop.", err);
    if (reloadingSpinner) reloadingSpinner.classList.add('hidden');
    return;
  }

  // 6. Hide loader after success
  if (reloadingSpinner) reloadingSpinner.classList.add('hidden');

  // 7. Briefly pause for UX/API stability, then make recursive call
  setTimeout(() => {
    runContinuousImageRegeneration(originalPrompt);
  }, 100); // 100ms pause
}

/**
 * Specialized network helper for the regeneration loop.
 */
async function fetchNextImageIteration(payload) {
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (!result.success || !result.dataURI) {
      throw new Error(result.error || "Loop generation returned unsuccessful");
    }

    return result.dataURI;
  } catch (err) {
    throw err;
  }
}

// ==========================================
// Three.js Integration Hook
// ==========================================
function initThreeJSPlane(imageURI) {
  console.log("====================================");
  console.log("🎬 Three.js Trigger Fired!");
  console.log("Target Texture URI length:", imageURI.length);
  console.log("TODO: Initialize Scene, Camera, Renderer, and Dynamic Plane here.");
  console.log("====================================");
}

// Run setup
init();