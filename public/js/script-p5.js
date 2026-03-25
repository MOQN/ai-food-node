function setup() {
  // Make p5 canvas fullscreen
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("container-p5");

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
  noLoop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}