let blocks = [];
let permissionGranted = false;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Create some objects (blocks/balls)
  for (let i = 0; i < 30; i++) {
    blocks.push({
      x: random(width),
      y: random(height),
      vx: 0,
      vy: 0,
      size: random(20, 45),
      color: color(random(150, 255), random(50, 150), random(100, 255)),
    });
  }

  // iOS 13+ requires prompting the user to grant permission for sensor data.
  // Must be triggered by a user action (like a button click).
  const startBtn = document.getElementById("start-btn");
  startBtn.addEventListener("click", () => {
    // Request both Orientation and Motion
    const requestMotion =
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
        ? DeviceMotionEvent.requestPermission()
        : Promise.resolve("granted");

    const requestOrientation =
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
        ? DeviceOrientationEvent.requestPermission()
        : Promise.resolve("granted");

    Promise.all([requestMotion, requestOrientation])
      .then((responses) => {
        if (responses[0] === "granted" && responses[1] === "granted") {
          permissionGranted = true;
          document.getElementById("permission-ui").style.display = "none";
          setShakeThreshold(30); // You can adjust the sensitivity here
        } else {
          alert("Permission denied. The physics simulation won't work.");
        }
      })
      .catch(console.error);
  });
}

// Triggered automatically by p5.js when the phone is shaken
let lastShakeTime = 0;
function deviceShaken() {
  if (!permissionGranted) return;

  let currentTime = millis();
  if (currentTime - lastShakeTime > 2000) {
    // Add 2-second cooldown to prevent spam
    lastShakeTime = currentTime;

    console.log("Success: Device Shaken!");

    fetch("/api/trigger-shake", { method: "POST" })
      .then((res) => res.json())
      .then((data) => console.log("Server responded:", data))
      .catch((err) => console.error("Error triggering shake:", err));
  }
}

function draw() {
  background(30);

  if (!permissionGranted) return;

  // Map rotationX (pitch) and rotationY (roll) to a gravity vector
  // rotationX is pitch (-180 to 180)
  // rotationY is roll (-90 to 90)
  // Note: p5.js provides these variables automatically when sensors are available
  let gravityX = map(rotationY, -90, 90, -1.5, 1.5, true);
  let gravityY = map(rotationX, -90, 90, -1.5, 1.5, true);

  // Fallback for desktop testing with the mouse
  if (rotationX === 0 && rotationY === 0) {
    gravityX = map(mouseX, 0, width, -1.5, 1.5);
    gravityY = map(mouseY, 0, height, -1.5, 1.5);
  }

  for (let b of blocks) {
    // Apply gravity vector to velocity
    b.vx += gravityX;
    b.vy += gravityY;

    // Add some friction/air resistance
    b.vx *= 0.92;
    b.vy *= 0.92;

    // Update position
    b.x += b.vx;
    b.y += b.vy;

    // Boundaries: Left and Right walls
    if (b.x < b.size / 2) {
      b.x = b.size / 2;
      b.vx *= -0.7; // Bounce
    }
    if (b.x > width - b.size / 2) {
      b.x = width - b.size / 2;
      b.vx *= -0.7;
    }

    // Boundaries: Bottom wall
    if (b.y > height - b.size / 2) {
      b.y = height - b.size / 2;
      b.vy *= -0.7;
    }

    // Feature: "Pouring out" of the top
    // If the phone is turned upside down, gravityY is negative and they fall UP (towards the phone top).
    // If they bypass the top of the canvas, we reset them.
    if (b.y < -b.size * 2) {
      // Respawn at the bottom so we don't run out of blocks
      b.y = height + b.size;
      b.x = random(width);
      b.vy = -random(2, 5); // give a little upward toss
      b.vx = 0;
    }

    // Draw the block
    noStroke();
    fill(b.color);
    rectMode(CENTER);
    // Add a slight rotation based on velocity to make it feel more dynamic
    push();
    translate(b.x, b.y);
    rotate(b.vx * 0.1);
    rect(0, 0, b.size, b.size, 8); // rounded rects
    pop();
  }

  // Debug info for the user
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text(`Pitch (X): ${int(rotationX)}`, 10, 10);
  text(`Roll (Y):  ${int(rotationY)}`, 10, 30);
  text(`Turn phone upside down to empty the screen!`, 10, height - 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
// Logic for uploading image via mobile
const mobileFileInput = document.getElementById("mobile-file-input");
const mobileUploadBtn = document.getElementById("mobile-upload-btn");

if (mobileUploadBtn && mobileFileInput) {
  mobileUploadBtn.addEventListener("click", () => {
    mobileFileInput.click();
  });

  mobileFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Visual feedback
    const originalText = mobileUploadBtn.innerText;
    mobileUploadBtn.innerText = "⏳ SENDING...";
    mobileUploadBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Data = evt.target.result;

      fetch("/api/mobile-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Data }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Photo sent successfully!");
          mobileUploadBtn.innerText = "✅ SENT! SEND ANOTHER?";
          setTimeout(() => {
            mobileUploadBtn.innerText = originalText;
            mobileUploadBtn.disabled = false;
          }, 3000);
        })
        .catch((err) => {
          console.error("Error sending photo:", err);
          mobileUploadBtn.innerText = "❌ ERROR! TRY AGAIN";
          setTimeout(() => {
            mobileUploadBtn.innerText = originalText;
            mobileUploadBtn.disabled = false;
          }, 3000);
        });
    };
    reader.readAsDataURL(file);
  });
}
