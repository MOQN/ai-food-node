// Note:
// taskkill /F /IM python.exe                // Simply kill all servers

const express = require('express');
const WebSocket = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ==========================================
// Configuration: Remote GPU PCs (Multi-Server Setup)
// ==========================================
// Set these to different IPs later when using 2 separate PCs
const COMFYUI_SERVER_IMAGE = "127.0.0.1:8188";
const COMFYUI_SERVER_AUDIO = "127.0.0.1:8188";

// Load BOTH workflows into memory at startup
const imageWorkflowPath = path.join(__dirname, 'workflow/image.json');
const audioWorkflowPath = path.join(__dirname, 'workflow/audio.json');

const rawImageTemplate = fs.readFileSync(imageWorkflowPath, 'utf8');
const rawAudioTemplate = fs.readFileSync(audioWorkflowPath, 'utf8');

// Increase JSON payload limit to accept large Base64 image strings from frontend
app.use(express.json({ limit: '50mb' }));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use(express.static('public'));

/**
 * Helper function to upload a Base64 image to the target ComfyUI server.
 * Added 'targetServer' parameter to route the upload to the correct PC.
 */
async function uploadImageToComfyUI(base64Data, targetServer) {
  try {
    console.log(`[Upload] 1. Analyzing Base64 data and targeting ${targetServer}...`);

    const parts = base64Data.split(',');
    const pureBase64 = parts.length > 1 ? parts[1] : parts[0];
    const buffer = Buffer.from(pureBase64, 'base64');

    console.log(`[Upload] 2. Image buffer created. Size: ${buffer.length} bytes`);

    if (buffer.length === 0) {
      throw new Error("Buffer is empty! The image from frontend is corrupted.");
    }

    const filename = `flux_ref_${Date.now()}.png`;
    const boundary = '----ComfyUIBoundary' + Math.random().toString(16).slice(2);

    let header = '';
    header += `--${boundary}\r\n`;
    header += `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n`;
    header += `Content-Type: image/png\r\n\r\n`;

    let footer = '';
    footer += `\r\n--${boundary}\r\n`;
    footer += `Content-Disposition: form-data; name="type"\r\n\r\n`;
    footer += `input\r\n`;
    footer += `--${boundary}\r\n`;
    footer += `Content-Disposition: form-data; name="overwrite"\r\n\r\n`;
    footer += `true\r\n`;
    footer += `--${boundary}--\r\n`;

    const multipartBody = Buffer.concat([
      Buffer.from(header, 'utf8'),
      buffer,
      Buffer.from(footer, 'utf8')
    ]);

    console.log(`[Upload] 3. Sending multipart payload to ${targetServer}...`);

    const res = await fetch(`http://${targetServer}/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length
      },
      body: multipartBody
    });

    const result = await res.json();
    console.log("[Upload] 4. ComfyUI Server Response:", result);

    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}: ${JSON.stringify(result)}`);
    }

    return result.name;
  } catch (err) {
    console.error("[Upload] FATAL ERROR during image upload:", err);
    throw err;
  }
}

/**
 * Reusable helper function to handle ComfyUI WebSocket communication.
 * Added 'targetServer' parameter to connect to the correct ComfyUI instance.
 */
function runComfyUIWorkflow(workflowJSON, targetServer) {
  return new Promise((resolve, reject) => {
    const clientId = crypto.randomUUID();
    const wsUrl = `ws://${targetServer}/ws?clientId=${clientId}`;
    const ws = new WebSocket(wsUrl);

    let outputDataURI = null;
    let downloadPromise = null;

    ws.on('open', async () => {
      try {
        const promptResponse = await fetch(`http://${targetServer}/prompt`, {
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
              const fetchUrl = `http://${targetServer}/view?filename=${fileInfo.filename}&type=${fileInfo.type}&subfolder=${fileInfo.subfolder}`;
              try {
                const fileRes = await fetch(fetchUrl);
                const arrayBuffer = await fileRes.arrayBuffer();
                const base64Data = Buffer.from(arrayBuffer).toString('base64');
                const ext = fileInfo.filename.split('.').pop();

                console.log(`[API] Successfully fetched and converted ${mediaCategory} from ${targetServer}!`);
                return `data:${mediaCategory}/${ext};base64,${base64Data}`;
              } catch (err) {
                console.error(`[API] Failed to fetch file from ${targetServer}:`, err);
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
// API Endpoint 1: Generate Image (Routed to Image PC)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
  const { promptText, seed, referenceImage } = req.body;

  if (!promptText) return res.status(400).json({ error: "promptText is required." });
  if (!referenceImage) return res.status(400).json({ error: "referenceImage (Base64) is required." });

  try {
    console.log("[API - Image] Routing upload to Image Server...");
    // Inject COMFYUI_SERVER_IMAGE
    const uploadedFilename = await uploadImageToComfyUI(referenceImage, COMFYUI_SERVER_IMAGE);

    const workflowJSON = JSON.parse(rawImageTemplate);
    workflowJSON["135"]["inputs"]["text"] = promptText;
    workflowJSON["125"]["inputs"]["noise_seed"] = seed || Math.floor(Math.random() * 1000000);
    workflowJSON["76"]["inputs"]["image"] = uploadedFilename;

    console.log("[API - Image] Starting workflow on Image Server...");
    // Inject COMFYUI_SERVER_IMAGE
    const dataURI = await runComfyUIWorkflow(workflowJSON, COMFYUI_SERVER_IMAGE);
    res.json({ success: true, dataURI });
  } catch (error) {
    console.error("[API Error - Image]", error);
    res.status(500).json({ error: "Image generation failed." });
  }
});

// ==========================================
// API Endpoint 2: Generate Audio (Routed to Audio PC)
// ==========================================
app.post('/api/generate-audio', async (req, res) => {
  const { promptText, lyrics, seed } = req.body;
  if (!promptText) return res.status(400).json({ error: "promptText is required." });

  try {
    const workflowJSON = JSON.parse(rawAudioTemplate);
    const currentSeed = seed || Math.floor(Math.random() * 1000000);

    workflowJSON["94"]["inputs"]["tags"] = promptText;

    // Inject the parsed lyrics if they exist
    if (lyrics) {
      workflowJSON["94"]["inputs"]["lyrics"] = lyrics;
    }

    workflowJSON["94"]["inputs"]["seed"] = currentSeed;
    workflowJSON["3"]["inputs"]["seed"] = currentSeed;

    console.log("[API - Audio] Starting workflow on Audio Server...");
    // Inject COMFYUI_SERVER_AUDIO
    const dataURI = await runComfyUIWorkflow(workflowJSON, COMFYUI_SERVER_AUDIO);
    res.json({ success: true, dataURI });
  } catch (error) {
    console.error("[API Error - Audio]", error);
    res.status(500).json({ error: "Audio generation failed." });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));