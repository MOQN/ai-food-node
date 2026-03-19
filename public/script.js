const dropOverlay = document.getElementById('drop-overlay');
const fileInput = document.getElementById('file-input');
const chooseFileBtn = document.getElementById('choose-file-btn');
const generateBtn = document.getElementById('generate-btn');

const refImage = document.getElementById('ref-image');
const refPlaceholder = document.getElementById('ref-placeholder');
const refImageBox = document.getElementById('ref-image-box');

const outImage = document.getElementById('out-image');
const outAudio = document.getElementById('out-audio');
const loadingIndicator = document.getElementById('loading-indicator');
const statusText = document.getElementById('status-text');

let currentBase64Image = null;
let isGeneratingImage = false;
let isGeneratingAudio = false;

// Read file as Base64 and update UI
function processFile(file, autoGenerate = false) {
  if (!file || !file.type.startsWith('image/')) {
    alert("Please upload a valid image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentBase64Image = e.target.result;

    // Update UI
    refImage.src = currentBase64Image;
    refImage.classList.remove('hidden');
    refPlaceholder.classList.add('hidden');
    refImageBox.style.border = "2px solid #fca311";
    generateBtn.disabled = false;

    // Method 2: Auto-execute if dropped
    if (autoGenerate) {
      startGeneration();
    }
  };
  reader.readAsDataURL(file);
}

// ==========================================
// Event Listeners: Method 1 (Click & Submit)
// ==========================================

// Link custom button to hidden file input
chooseFileBtn.addEventListener('click', () => {
  fileInput.click();
});

// Handle file selection
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  processFile(file, false); // false = Do not auto-generate
});

// Handle Generate button click
generateBtn.addEventListener('click', () => {
  if (currentBase64Image) {
    startGeneration();
  }
});

// ==========================================
// Event Listeners: Method 2 (Drag & Drop)
// ==========================================

// Highlight overlay when dragging over the window
window.addEventListener('dragover', (e) => {
  e.preventDefault(); // Required to allow dropping
  dropOverlay.classList.remove('hidden');
});

// Hide overlay when dragging leaves the window
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  // Only hide if we are leaving the actual window (not child elements)
  if (e.relatedTarget === null || e.relatedTarget.nodeName === "HTML") {
    dropOverlay.classList.add('hidden');
  }
});

// Handle the actual drop event
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('hidden');

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    // true = Auto-trigger generation immediately after reading the file
    processFile(file, true);
  }
});

// ==========================================
// API Communication (Flux & ACE)
// ==========================================

function updateLoadingState() {
  if (isGeneratingImage || isGeneratingAudio) {
    generateBtn.disabled = true;
    outImage.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');

    if (isGeneratingImage && isGeneratingAudio) {
      statusText.innerText = "Generating Image & Audio...";
    } else if (isGeneratingImage) {
      statusText.innerText = "Generating Image...";
    } else {
      statusText.innerText = "Generating Audio...";
    }
  } else {
    generateBtn.disabled = false;
    loadingIndicator.classList.add('hidden');
  }
}

function startGeneration() {
  if (isGeneratingImage || isGeneratingAudio) return;

  // Reset output UI
  outImage.classList.add('hidden');
  outAudio.classList.add('hidden');
  outAudio.src = "";

  const payload = {
    promptText: "the food remain completely unchanged and realistic, preserving the original appearance and texture, photorealistic food, macro photography, tilt-shift effect, highly detailed, tiny food-shape musicians are generated based on the ingredient of food and performing as a small cozy band across a food landscape, cute miniature ingredients playing soft jazz instruments",
    seed: Math.floor(Math.random() * 1000000),
    referenceImage: currentBase64Image
  };

  // Fire concurrently
  fetchImage(payload);
  fetchAudio(payload);
}

async function fetchImage(payload) {
  isGeneratingImage = true;
  updateLoadingState();

  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success && result.dataURI) {
      outImage.src = result.dataURI;
      outImage.classList.remove('hidden');
    } else {
      console.error("Image API Error:", result.error);
      alert("Failed to generate image.");
    }
  } catch (err) {
    console.error("Fetch Error (Image):", err);
  } finally {
    isGeneratingImage = false;
    updateLoadingState();
  }
}

async function fetchAudio(payload) {
  isGeneratingAudio = true;
  updateLoadingState();

  try {
    const response = await fetch('/api/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success && result.dataURI) {
      outAudio.src = result.dataURI;
      outAudio.classList.remove('hidden');
      // Autoplay the generated audio
      outAudio.play();
    } else {
      console.error("Audio API Error:", result.error);
    }
  } catch (err) {
    console.error("Fetch Error (Audio):", err);
  } finally {
    isGeneratingAudio = false;
    updateLoadingState();
  }
}