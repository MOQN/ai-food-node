let currentP5Sound = null;
let p5AmplitudeAnalyzer = null;
let previousFrameVolume = 0;
let currentFrameVolume = 0;
let frameVolumeDelta = 0;

const P5_AUDIO_CONFIG = {
  fadeInSeconds: 0.25,
  fadeOutSeconds: 1.0,
  stopAfterFadeOutMs: 1200,
  deltaSmoothing: 0.35
};

function updateAudioProgressBar(progressRatio) {
  const progressBar = document.getElementById('audio-progress-bar');
  if (!progressBar) return;

  const clampedRatio = Math.max(0, Math.min(1, Number(progressRatio) || 0));
  progressBar.style.width = `${clampedRatio * 100}%`;
}

function setup() {
  // Make p5 canvas fullscreen
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("container-p5");

  p5AmplitudeAnalyzer = new p5.Amplitude();
  p5AmplitudeAnalyzer.smooth(0.75);

  // Crucial: initThree() starts the Three.js rendering sequence
  initThree();
}

function draw() {
  // clear() makes the p5 background transparent so Three.js is visible beneath it
  clear();

  // Draw a test element to prove p5 is running on top of Three.js
  //fill(255, 0, 127, 150); // Hot pink with some transparency
  //noStroke();
  //circle(mouseX, mouseY, 50);

  if (p5AmplitudeAnalyzer && currentP5Sound) {
    currentFrameVolume = p5AmplitudeAnalyzer.getLevel();
    const rawDelta = Math.abs(currentFrameVolume - previousFrameVolume);
    frameVolumeDelta = lerp(frameVolumeDelta, rawDelta, P5_AUDIO_CONFIG.deltaSmoothing);
    previousFrameVolume = currentFrameVolume;

    const duration = typeof currentP5Sound.duration === 'function' ? currentP5Sound.duration() : 0;
    const currentTime = typeof currentP5Sound.currentTime === 'function' ? currentP5Sound.currentTime() : 0;
    updateAudioProgressBar(duration > 0 ? currentTime / duration : 0);
  } else {
    currentFrameVolume = 0;
    frameVolumeDelta = lerp(frameVolumeDelta, 0, P5_AUDIO_CONFIG.deltaSmoothing);
    previousFrameVolume = 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function playGeneratedAudioInP5(audioURI) {
  if (!audioURI || typeof loadSound !== 'function') return;

  if (typeof userStartAudio === 'function') {
    userStartAudio();
  }

  loadSound(
    audioURI,
    (newSound) => {
      const previousSound = currentP5Sound;

      currentP5Sound = newSound;
      updateAudioProgressBar(0);
      currentP5Sound.setVolume(0);
      currentP5Sound.loop();
      currentP5Sound.setVolume(1, P5_AUDIO_CONFIG.fadeInSeconds);

      if (p5AmplitudeAnalyzer) {
        p5AmplitudeAnalyzer.setInput(currentP5Sound);
      }

      if (previousSound) {
        previousSound.setVolume(0, P5_AUDIO_CONFIG.fadeOutSeconds);
        setTimeout(() => {
          previousSound.stop();
        }, P5_AUDIO_CONFIG.stopAfterFadeOutMs);
      }
    },
    (err) => {
      console.error('[p5.sound] Failed to load generated audio:', err);
    }
  );
}

function getP5AudioMetrics() {
  const isPlaying = Boolean(currentP5Sound && typeof currentP5Sound.isPlaying === 'function' && currentP5Sound.isPlaying());

  return {
    volume: currentFrameVolume,
    delta: frameVolumeDelta,
    isPlaying
  };
}

window.playGeneratedAudioInP5 = playGeneratedAudioInP5;
window.getP5AudioMetrics = getP5AudioMetrics;