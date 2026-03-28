// taskkill /F /IM python.exe // Kill ComfyUI servers if needed

const express = require("express");
const WebSocket = require("ws");
const { WebSocketServer } = WebSocket;
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Configuration
const COMFYUI_SERVER_IMAGE = "127.0.0.1:8188";
const COMFYUI_SERVER_AUDIO = "127.0.0.1:8188";
// const COMFYUI_SERVER_IMAGE = "169.254.214.124:8188";
// const COMFYUI_SERVER_AUDIO = "169.254.214.124:8188";

const imageWorkflowPath = path.join(__dirname, "workflow/image.json");
const audioWorkflowPath = path.join(__dirname, "workflow/audio.json");

const rawImageTemplate = fs.readFileSync(imageWorkflowPath, "utf8");
const rawAudioTemplate = fs.readFileSync(audioWorkflowPath, "utf8");

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));

// Helper: Upload
async function uploadImageToComfyUI(base64Data, targetServer) {
  try {
    const parts = base64Data.split(",");
    const pureBase64 = parts.length > 1 ? parts[1] : parts[0];
    const buffer = Buffer.from(pureBase64, "base64");

    if (buffer.length === 0) throw new Error("Buffer empty");

    const filename = `ai-food-input-${Date.now()}.png`;
    const boundary =
      "----ComfyUIBoundary" + Math.random().toString(16).slice(2);

    let header = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`;
    let footer = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\ninput\r\n--${boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--${boundary}--\r\n`;

    const multipartBody = Buffer.concat([
      Buffer.from(header, "utf8"),
      buffer,
      Buffer.from(footer, "utf8"),
    ]);

    const res = await fetch(`http://${targetServer}/upload/image`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": multipartBody.length,
      },
      body: multipartBody,
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const result = await res.json();
    return result.name;
  } catch (err) {
    console.error("[Upload] FATAL:", err);
    throw err;
  }
}

// Helper: Run Workflow
function runComfyUIWorkflow(workflowJSON, targetServer, targetNodeIds) {
  return new Promise((resolve, reject) => {
    const clientId = crypto.randomUUID();
    const wsUrl = `ws://${targetServer}/ws?clientId=${clientId}`;
    const ws = new WebSocket(wsUrl);

    const collectedOutputs = {};
    let executionError = null;
    const downloadPromises = []; // Tracker for async file downloads

    ws.on("open", async () => {
      try {
        const promptResponse = await fetch(`http://${targetServer}/prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: workflowJSON, client_id: clientId }),
        });
        if (!promptResponse.ok)
          throw new Error(`HTTP ${promptResponse.status}`);
      } catch (error) {
        ws.close();
        reject(error);
      }
    });

    ws.on("message", async (data, isBinary) => {
      if (!isBinary) {
        const message = JSON.parse(data.toString());

        if (message.type === "executed" && message.data.output) {
          const nodeId = message.data.node;
          const output = message.data.output;

          if (targetNodeIds.includes(nodeId)) {
            let fileInfo = null;
            let mediaType = "";

            if (output.images && output.images.length > 0) {
              fileInfo = output.images[0];
              mediaType = "image";
            } else if (output.audio && output.audio.length > 0) {
              fileInfo = output.audio[0];
              mediaType = "audio";
            }

            if (fileInfo) {
              const fetchUrl = `http://${targetServer}/view?filename=${fileInfo.filename}&type=${fileInfo.type}&subfolder=${fileInfo.subfolder}`;

              const downloadTask = (async () => {
                try {
                  const fileRes = await fetch(fetchUrl);
                  const arrayBuffer = await fileRes.arrayBuffer();
                  const base64Data =
                    Buffer.from(arrayBuffer).toString("base64");
                  const ext = fileInfo.filename.split(".").pop();

                  collectedOutputs[nodeId] =
                    `data:${mediaType}/${ext};base64,${base64Data}`;
                } catch (err) {
                  console.error(`[WS] Fetch file failed from ${nodeId}:`, err);
                }
              })();

              downloadPromises.push(downloadTask);
            }
          }
        }

        if (message.type === "execution_error") {
          executionError = message.data;
          ws.close();
        }

        if (message.type === "executing" && message.data.node === null) {
          ws.close();
          if (executionError) {
            reject(
              new Error(`ComfyUI Error: ${JSON.stringify(executionError)}`),
            );
          } else {
            // Wait for all downloads to finish before returning
            Promise.all(downloadPromises).then(() => {
              resolve(collectedOutputs);
            });
          }
        }
      }
    });

    ws.on("error", (error) => {
      ws.close();
      reject(error);
    });
  });
}

// Global variable for SSE clients
let sseClients = [];
let wsClients = new Set();

function safeSendWS(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function broadcastImageUploaded(imageBase64) {
  const ssePayload = JSON.stringify({
    action: "image-uploaded",
    image: imageBase64,
  });

  // Existing desktop channel: SSE
  sseClients.forEach((client) => client.write(`data: ${ssePayload}\n\n`));

  // Optional WS broadcast for future clients
  const wsPayload = { type: "image-uploaded", image: imageBase64 };
  wsClients.forEach((client) => safeSendWS(client, wsPayload));
}

function broadcastShakeTriggered() {
  const ssePayload = JSON.stringify({ action: "shake" });
  sseClients.forEach((client) => client.write(`data: ${ssePayload}\n\n`));

  const wsPayload = { type: "shake" };
  wsClients.forEach((client) => safeSendWS(client, wsPayload));
}

// Endpoint for main page to listen for shake events
app.get("/api/listen-shake", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // flush the headers to establish SSE
  sseClients.push(res);

  req.on("close", () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
});

app.get("/api/dishes", (req, res) => {
  const dishesDir = path.join(__dirname, "public", "dishes");

  fs.readdir(dishesDir, (err, files) => {
    if (err) {
      console.error("[API Error - Dishes]", err);
      return res.status(500).json({ error: "Failed to list dishes." });
    }

    const images = files
      .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
      .sort((a, b) => a.localeCompare(b));

    res.json({ success: true, images });
  });
});

// Endpoint for mobile to trigger shake
app.post("/api/trigger-shake", (req, res) => {
  console.log("[Server] Success: Shake detected from mobile device!");
  broadcastShakeTriggered();
  res.json({ success: true, message: "Shake triggered" });
});

// Endpoint for receiving image from mobile
app.post("/api/mobile-upload", (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

  console.log("[Server] Success: Received image upload from mobile device!");
  // Broadcast image to main screens
  broadcastImageUploaded(imageBase64);
  res.json({ success: true, message: "Image forwarded to main screen" });
});

// API Endpoint 1: Generate Image + Depth
app.post("/api/generate-image", async (req, res) => {
  const { promptText, seed, referenceImage, filePrefix } = req.body;

  if (!promptText || !referenceImage)
    return res.status(400).json({ error: "Missing data." });

  try {
    const uploadedFilename = await uploadImageToComfyUI(
      referenceImage,
      COMFYUI_SERVER_IMAGE,
    );
    const workflow = JSON.parse(rawImageTemplate);

    workflow["76"]["inputs"]["image"] = uploadedFilename;
    workflow["125"]["inputs"]["noise_seed"] =
      seed || Math.floor(Math.random() * 1000000);
    workflow["135"]["inputs"]["text"] = promptText;

    // Ensure the base prefix is clean before appending
    let basePrefix = filePrefix || `AIxFood/ai-food-${Date.now()}`;
    if (basePrefix.endsWith("-image")) {
      basePrefix = basePrefix.slice(0, -6);
    }

    workflow["94"]["inputs"]["filename_prefix"] = `${basePrefix}-image`;
    workflow["698"]["inputs"]["filename_prefix"] = `${basePrefix}-depth`;

    const targetNodes = ["94", "698"];
    const results = await runComfyUIWorkflow(
      workflow,
      COMFYUI_SERVER_IMAGE,
      targetNodes,
    );

    res.json({
      success: true,
      imageDataURI: results["94"],
      depthDataURI: results["698"],
    });
  } catch (error) {
    console.error("[API Error - Image]", error);
    res.status(500).json({ error: "Image/Depth generation failed." });
  }
});

// API Endpoint 2: Generate Audio
app.post("/api/generate-audio", async (req, res) => {
  const {
    promptText,
    lyrics,
    seed,
    bpm,
    keyscale,
    durationSeconds,
    filePrefix,
  } = req.body;
  if (!promptText)
    return res.status(400).json({ error: "Missing promptText." });

  try {
    const workflow = JSON.parse(rawAudioTemplate);
    const currentSeed = seed || Math.floor(Math.random() * 1000000);

    workflow["94"]["inputs"]["tags"] = promptText;
    if (lyrics) workflow["94"]["inputs"]["lyrics"] = lyrics;
    workflow["94"]["inputs"]["seed"] = currentSeed;

    workflow["94"]["inputs"]["bpm"] = bpm || 190;
    workflow["94"]["inputs"]["keyscale"] = keyscale || "E minor";

    const safeDuration = Math.min(
      240,
      Math.max(30, Number(durationSeconds) || 120),
    );
    console.log(
      `[Audio] durationSeconds received: ${durationSeconds} → safeDuration: ${safeDuration}`,
    );
    workflow["94"]["inputs"]["duration"] = safeDuration;
    workflow["98"]["inputs"]["seconds"] = safeDuration;
    console.log(
      `[Audio] workflow["94"]["inputs"]["duration"]: ${workflow["94"]["inputs"]["duration"]}`,
    );
    console.log(
      `[Audio] workflow["98"]["inputs"]["seconds"]: ${workflow["98"]["inputs"]["seconds"]}`,
    );

    workflow["3"]["inputs"]["seed"] = currentSeed;

    const fallbackName = `AIxFood/audio/ai-food-${Date.now()}`;
    workflow["107"]["inputs"]["filename_prefix"] = filePrefix || fallbackName;

    const targetNodes = ["107"];
    const results = await runComfyUIWorkflow(
      workflow,
      COMFYUI_SERVER_AUDIO,
      targetNodes,
    );

    res.json({ success: true, dataURI: results["107"] });
  } catch (error) {
    console.error("[API Error - Audio]", error);
    res.status(500).json({ error: "Audio generation failed." });
  }
});

const server = app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`),
);

// Shared WebSocket server for mobile <-> server direct messaging.
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  wsClients.add(ws);
  console.log("[WS] Client connected:", req.socket.remoteAddress || "unknown");

  safeSendWS(ws, {
    type: "connected",
    message: "WebSocket connected",
    serverTime: Date.now(),
  });

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (err) {
      safeSendWS(ws, { type: "error", message: "Invalid JSON payload" });
      return;
    }

    // Mobile direct image transfer
    if (data.type === "mobile-upload") {
      const imageBase64 = data.imageBase64;
      if (!imageBase64 || typeof imageBase64 !== "string") {
        safeSendWS(ws, {
          type: "upload-ack",
          ok: false,
          message: "Missing imageBase64",
        });
        return;
      }

      console.log("[WS] Success: Received image upload from mobile device!");
      broadcastImageUploaded(imageBase64);

      safeSendWS(ws, {
        type: "upload-ack",
        ok: true,
        message: "Image forwarded to main screen",
      });
      return;
    }

    // Optional shake event over WS
    if (data.type === "trigger-shake") {
      console.log("[WS] Success: Shake detected from mobile device!");
      broadcastShakeTriggered();
      safeSendWS(ws, {
        type: "shake-ack",
        ok: true,
        message: "Shake triggered",
      });
      return;
    }

    safeSendWS(ws, {
      type: "error",
      message: `Unsupported message type: ${data.type || "unknown"}`,
    });
  });

  ws.on("close", () => {
    wsClients.delete(ws);
  });

  ws.on("error", () => {
    wsClients.delete(ws);
  });
});
