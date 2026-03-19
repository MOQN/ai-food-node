// Note:
// taskkill /F /IM python.exe                // Simply kill all servers

const express = require('express');
const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const COMFYUI_SERVER = "127.0.0.1:8188";

// Load workflows into memory at startup
const imageWorkflowPath = path.join(__dirname, 'workflow/image.json');
const audioWorkflowPath = path.join(__dirname, 'workflow/audio.json');
const rawImageTemplate = fs.readFileSync(imageWorkflowPath, 'utf8');
const rawAudioTemplate = fs.readFileSync(audioWorkflowPath, 'utf8');

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

/**
 * Helper function to upload a Base64 image to ComfyUI's input folder
 * Returns the saved filename on the ComfyUI server.
 */
async function uploadImageToComfyUI(base64Data) {
  // Remove the data URI header (e.g., "data:image/png;base64,")
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Image, 'base64');

  // Create a Blob from the buffer (Requires Node 18+)
  const blob = new Blob([buffer], { type: 'image/png' });
  const filename = `upload_${Date.now()}.png`;

  const formData = new FormData();
  formData.append('image', blob, filename);
  formData.append('type', 'input');
  formData.append('overwrite', 'true');

  try {
    const res = await fetch(`http://${COMFYUI_SERVER}/upload/image`, {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    return result.name; // ComfyUI returns the actual saved filename
  } catch (error) {
    console.error("[API] Failed to upload image to ComfyUI:", error);
    throw error;
  }
}

// Handle ComfyUI WebSocket communication
function runComfyUIWorkflow(workflowJSON) {
  return new Promise((resolve, reject) => {
    const clientId = crypto.randomUUID();
    const wsUrl = `ws://${COMFYUI_SERVER}/ws?clientId=${clientId}`;
    const ws = new WebSocket(wsUrl);

    let outputDataURI = null;
    let downloadPromise = null;

    ws.on('open', async () => {
      try {
        const promptResponse = await fetch(`http://${COMFYUI_SERVER}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: workflowJSON, client_id: clientId })
        });

        if (!promptResponse.ok) throw new Error(`HTTP Error: ${promptResponse.status}`);
      } catch (error) {
        ws.close();
        reject(error);
      }
    });

    ws.on('message', async (data, isBinary) => {
      if (!isBinary) {
        const message = JSON.parse(data.toString());

        if (message.type === 'executed' && message.data.output) {
          const output = message.data.output;

          downloadPromise = (async () => {
            let fileInfo = null;
            let mediaCategory = '';

            if (output.audio && output.audio.length > 0) {
              fileInfo = output.audio[0];
              mediaCategory = 'audio';
            } else if (output.images && output.images.length > 0) {
              fileInfo = output.images[0];
              mediaCategory = 'image';
            }

            if (fileInfo) {
              const fetchUrl = `http://${COMFYUI_SERVER}/view?filename=${fileInfo.filename}&type=${fileInfo.type}&subfolder=${fileInfo.subfolder}`;
              try {
                const fileRes = await fetch(fetchUrl);
                const arrayBuffer = await fileRes.arrayBuffer();
                const base64Data = Buffer.from(arrayBuffer).toString('base64');
                const ext = fileInfo.filename.split('.').pop();

                console.log(`[API] Successfully fetched and converted ${mediaCategory}!`);
                return `data:${mediaCategory}/${ext};base64,${base64Data}`;
              } catch (err) {
                console.error(`[API] Failed to fetch file from ComfyUI:`, err);
                return null;
              }
            }
            return null;
          })();
        }

        if (message.type === 'executing' && message.data.node === null) {
          ws.close();
          if (downloadPromise) {
            outputDataURI = await downloadPromise;
          }
          resolve(outputDataURI);
        }
      }
    });

    ws.on('error', (error) => {
      ws.close();
      reject(error);
    });
  });
}

// ==========================================
// API Endpoint 1: Generate Image (Flux.2 Img2Img)

app.post('/api/generate-image', async (req, res) => {
  const { promptText, seed, referenceImage } = req.body;

  if (!promptText) return res.status(400).json({ error: "promptText is required." });
  if (!referenceImage) return res.status(400).json({ error: "referenceImage (Base64) is required." });

  try {
    // 1. Upload the reference image to ComfyUI first
    console.log("[API] Uploading reference image to ComfyUI...");
    const uploadedFilename = await uploadImageToComfyUI(referenceImage);
    console.log(`[API] Image uploaded successfully as: ${uploadedFilename}`);

    // 2. Prepare the workflow
    const workflowJSON = JSON.parse(rawImageTemplate);

    // Target nodes based on your NEW Flux image.json
    workflowJSON["135"]["inputs"]["text"] = promptText; // CLIP Text Encode
    workflowJSON["125"]["inputs"]["noise_seed"] = seed || Math.floor(Math.random() * 1000000); // RandomNoise node
    workflowJSON["76"]["inputs"]["image"] = uploadedFilename;

    // 3. Run the generation
    const dataURI = await runComfyUIWorkflow(workflowJSON);
    res.json({ success: true, dataURI });
  } catch (error) {
    console.error("[API Error - Image]", error);
    res.status(500).json({ error: "Image generation failed." });
  }
});

// ==========================================
// API Endpoint 2: Generate Audio (ACE Model)

app.post('/api/generate-audio', async (req, res) => {
  const { promptText, seed } = req.body;
  if (!promptText) return res.status(400).json({ error: "promptText is required." });

  try {
    const workflowJSON = JSON.parse(rawAudioTemplate);
    const currentSeed = seed || Math.floor(Math.random() * 1000000);

    workflowJSON["94"]["inputs"]["tags"] = promptText;
    workflowJSON["94"]["inputs"]["seed"] = currentSeed;
    workflowJSON["3"]["inputs"]["seed"] = currentSeed;

    const dataURI = await runComfyUIWorkflow(workflowJSON);
    res.json({ success: true, dataURI });
  } catch (error) {
    console.error("[API Error - Audio]", error);
    res.status(500).json({ error: "Audio generation failed." });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));