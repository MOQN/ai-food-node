// Data & Configuration
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

const OUTPUT_FOLDER = "AIxFood";

// State Management
let currentBase64Image = null;
let currentSessionTimestamp = "";

const selections = {
  food: new Set(),
  taste: new Set(),
  genre: new Set()
};

// Utility Functions
function getFormattedTimestamp() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}-${hh}${min}${ss}`;
}

function determineAudioSettings(selectedTastes) {
  let settings = {
    bpm: 190,
    keyscale: "E minor"
  };

  if (selectedTastes.has('Spicy') || selectedTastes.has('Refreshing')) {
    settings.bpm = 145;
    settings.keyscale = "C major";
  } else if (selectedTastes.has('Greasy') || selectedTastes.has('Bitter') || selectedTastes.has('Sour')) {
    settings.bpm = 90;
    settings.keyscale = "E minor";
  } else if (selectedTastes.has('Sweet') || selectedTastes.has('Creamy')) {
    settings.bpm = 110;
    settings.keyscale = "A minor";
  }

  return settings;
}

// DOM Elements
const dropOverlay = document.getElementById('drop-overlay');
const fileInput = document.getElementById('file-input');
const generateBtn = document.getElementById('generate-btn');

const outImage = document.getElementById('out-image');
const outAudio = document.getElementById('out-audio');
const audioProgressBar = document.getElementById('audio-progress-bar');
const statusImage = document.getElementById('status-image');
const statusAudio = document.getElementById('status-audio');

const commentsFood = document.getElementById('comments-food');
const commentsTaste = document.getElementById('comments-taste');
const commentsGenre = document.getElementById('comments-genre');

// Step Navigation
function showStep(stepIndex) {
  document.querySelectorAll('.step').forEach(step => {
    if (step.id === `step-${stepIndex}`) {
      step.classList.remove('hidden');
      setTimeout(() => step.classList.add('active'), 50);
    } else {
      step.classList.remove('active');
      setTimeout(() => {
        if (!step.classList.contains('active')) step.classList.add('hidden');
      }, 600);
    }
  });
}

document.querySelectorAll('.next-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const nextStep = e.target.getAttribute('data-next');
    if (nextStep) showStep(nextStep);
  });
});

// Initialization & UI
function init() {
  buildTagButtons('tags-food', TAG_DATA.food, 'food', '1');
  buildTagButtons('tags-taste', TAG_DATA.taste, 'taste', '2');
  buildTagButtons('tags-genre', TAG_DATA.genre, 'genre', '3', true);

  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => location.reload());
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
      if (nextBtn) nextBtn.disabled = selections[category].size === 0;
    });
    container.appendChild(btn);
  });
}

// File Handling
function processFile(file) {
  if (!file || !file.type.startsWith('image/')) {
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

const chooseFileBtn = document.getElementById('choose-file-btn');
if (chooseFileBtn) chooseFileBtn.addEventListener('click', () => fileInput.click());
if (fileInput) fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) processFile(e.target.files[0]);
});

let dragCounter = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; if (dropOverlay) dropOverlay.classList.add('show'); });
window.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter === 0 && dropOverlay) dropOverlay.classList.remove('show'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); dragCounter = 0; if (dropOverlay) dropOverlay.classList.remove('show'); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]); });

// Audio Player
outAudio.addEventListener('timeupdate', () => {
  if (outAudio.duration) {
    const percentage = (outAudio.currentTime / outAudio.duration) * 100;
    audioProgressBar.style.width = percentage + '%';
  }
});
outAudio.addEventListener('ended', () => audioProgressBar.style.width = '0%');

// Main Execution
if (generateBtn) {
  generateBtn.addEventListener('click', () => {
    showStep('loading');

    document.querySelectorAll('.loader-text, .circular-loader').forEach(el => el.classList.remove('done'));
    if (statusImage) statusImage.innerText = "VISUAL";
    if (statusAudio) statusAudio.innerText = "AUDIO";

    const foods = Array.from(selections.food);
    const tastes = Array.from(selections.taste);
    const genres = Array.from(selections.genre);

    const foodStr = foods.length > 0 ? foods.join(", ") : "generic food";
    const tasteStr = tastes.length > 0 ? tastes.join(", ") : "delicious";
    const genreStr = genres.length > 0 ? genres[0] : "Jazz";

    const genreDetail = commentsGenre ? ` (${commentsGenre.value.trim()})` : "";
    const instruments = INSTRUMENT_MAP[genreStr] || 'various musical instruments';

    const imagePrompt = `the food remain completely unchanged and realistic, preserving the original appearance and texture, photorealistic food, macro photography, tilt-shift effect, highly detailed. tiny food-shape musicians are generated based on ${foodStr} and performing as a small cozy band across a food landscape. cute miniature ${foodStr} characters playing ${instruments}${genreDetail}. The overall atmosphere has a ${tasteStr} and ${genreStr} vibe, passionate and dynamic performance.`;

    const audioPrompt = `A highly rhythmic, energetic track with a strong driving beat. Style: ${genreStr}${genreDetail}. Vibe and mood: ${tasteStr}. Inspired by a culinary experience of ${foodStr}.`;

    let lyricsArray = [...foods];
    const paddingWords = ['Tasty', 'Fresh', 'Savory', 'Bite'];
    let i = 0;
    while (lyricsArray.length < 4) { lyricsArray.push(paddingWords[i % paddingWords.length]); i++; }
    const finalLyrics = lyricsArray.slice(0, 4).join("\n");

    const audioSettings = determineAudioSettings(selections.taste);

    currentSessionTimestamp = getFormattedTimestamp();

    const payloadImage = {
      promptText: imagePrompt,
      seed: Math.floor(Math.random() * 1000000),
      referenceImage: currentBase64Image,
      filePrefix: `${OUTPUT_FOLDER}/ai-food-${currentSessionTimestamp}`
    };

    const payloadAudio = {
      promptText: audioPrompt,
      lyrics: finalLyrics,
      seed: Math.floor(Math.random() * 1000000),
      bpm: audioSettings.bpm,
      keyscale: audioSettings.keyscale,
      filePrefix: `${OUTPUT_FOLDER}/ai-food-${currentSessionTimestamp}-audio`
    };

    Promise.all([
      fetchMedia('/api/generate-image', payloadImage, 'image'),
      fetchMedia('/api/generate-audio', payloadAudio, 'audio')
    ]).then(([imageData, audioDataURI]) => {
      if (imageData && imageData.success && audioDataURI) {

        outImage.src = imageData.imageDataURI;
        outAudio.src = audioDataURI;

        if (statusImage) statusImage.innerText = "IMAGE & DEPTH READY";
        if (statusAudio) statusAudio.innerText = "AUDIO READY";

        showStep('result');
        outAudio.play();

        initThreeJSShader(imageData.imageDataURI, imageData.depthDataURI);
        runContinuousImageRegeneration(imagePrompt);
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    const loaderId = type === 'image' ? 'loader-image' : 'loader-audio';
    document.getElementById(loaderId)?.classList.add('done');
    document.getElementById(`status-${type}`)?.classList.add('done');

    if (!result.success) {
      console.error(`[Fetch Error - ${type}]`, result.error);
      return null;
    }

    return type === 'image' ? result : result.dataURI;

  } catch (err) {
    console.error(`[Fetch Error - ${type}]`, err);
    return null;
  }
}

// Continuous Image Loop
async function runContinuousImageRegeneration(originalPrompt) {
  const resultStep = document.getElementById('step-result');
  if (!resultStep || resultStep.classList.contains('hidden')) {
    if (reloadingSpinner) reloadingSpinner.classList.add('hidden');
    return;
  }

  const resultBase64Input = outImage.src;
  const movementAugmentation = ", high-energy action performance, energetic stage presence, dramatic camera pan right";
  const hyperDynamicPrompt = originalPrompt + movementAugmentation;

  // Send only the base prefix
  const nextPayload = {
    promptText: hyperDynamicPrompt,
    seed: Math.floor(Math.random() * 1000000),
    referenceImage: resultBase64Input,
    filePrefix: `${OUTPUT_FOLDER}/ai-food-${currentSessionTimestamp}`
  };

  try {
    const loopRes = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextPayload)
    });
    const loopResult = await loopRes.json();

    if (loopResult.success && loopResult.imageDataURI) {
      outImage.src = loopResult.imageDataURI;

      // Re-apply both the new color image and the newly generated depth map
      initThreeJSShader(loopResult.imageDataURI, loopResult.depthDataURI);
    }
  } catch (err) {
    console.error("[Loop] Failed.", err);
  }

  //setTimeout(() => runContinuousImageRegeneration(originalPrompt), 1000);
}

// Shader Integration Hook
function initThreeJSShader(imageURI, depthURI) {
  if (window.updateThreeJSMaterial) {
    window.updateThreeJSMaterial(imageURI, depthURI);
  }
}

init();




// to test
async function loadShaderTestImages() {
  const testImagePath = '/shaderTest/image.png';
  const testDepthPath = '/shaderTest/depth.png';

  if (outImage) {
    outImage.src = testImagePath;
  }

  showStep('result');

  const applyWhenReady = () => {
    if (window.updateThreeJSMaterial) {
      initThreeJSShader(testImagePath, testDepthPath);
    } else {
      setTimeout(applyWhenReady, 100);
    }
  };

  // Wait a bit longer so setupShaders() can finish creating customMaterial
  setTimeout(applyWhenReady, 300);
}

window.addEventListener('load', () => {
  loadShaderTestImages();
});