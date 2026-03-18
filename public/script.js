// python main.py --enable-cors-header="*"   // deal with CORS issues
// taskkill /F /IM python.exe                // Kill left servers: 


let workflowJSON;
let ws;
let resultImage = null;
let isGenerating = false;

const SERVER_ADDRESS = "127.0.0.1:8188";
const CLIENT_ID = "p5js_direct_" + Math.floor(Math.random() * 1000);

function preload() {
  workflowJSON = loadJSON('workflow/test.json');
}

function setup() {
  createCanvas(512, 512);
  textAlign(CENTER, CENTER);
  textSize(16);

  connectWebSocket();
}

function draw() {
  background(40);

  if (resultImage) {
    image(resultImage, 0, 0, width, height);
  } else {
    fill(255);
    text("화면을 클릭하면 이미지 생성을 시작합니다.", width / 2, height / 2);
  }

  if (isGenerating) {
    fill(0, 150);
    rect(0, 0, width, height);
    fill(255);
    text("ComfyUI에서 렌더링 중...", width / 2, height / 2);
  }
}

function mousePressed() {
  sendPrompt();
}

//

function sendPrompt() {
  if (isGenerating) return;

  workflowJSON["6"]["inputs"]["text"] = "a beautiful cyberpunk cat, neon lights, 8k resolution";
  workflowJSON["3"]["inputs"]["seed"] = Math.floor(random(1000000));

  triggerComfyUI();
}


async function triggerComfyUI() {
  isGenerating = true;
  console.log("ComfyUI에 렌더링 명령 전송 중...");

  try {
    let response = await fetch(`http://${SERVER_ADDRESS}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: workflowJSON,
        client_id: CLIENT_ID
      })
    });

    let result = await response.json();
    console.log("주문 성공! 주문번호:", result.prompt_id);
  } catch (error) {
    console.error("통신 에러! ComfyUI가 켜져 있는지, CORS 설정이 되었는지 확인하세요.", error);
    isGenerating = false;
  }
}

// 7. 다이렉트 웹소켓 통신 및 바이너리 이미지 수신
function connectWebSocket() {
  ws = new WebSocket(`ws://${SERVER_ADDRESS}/ws?clientId=${CLIENT_ID}`);

  // 🌟 핵심: ComfyUI가 보내는 파일 덩어리를 Blob으로 받겠다고 선언
  ws.binaryType = "blob";

  ws.onopen = () => console.log("웹소켓 연결 성공!");

  ws.onmessage = function (event) {
    // [A] 상태 알림 (텍스트 메시지) 처리
    if (typeof event.data === "string") {
      let msg = JSON.parse(event.data);
      if (msg.type === 'executed') {
        console.log("엔진 계산 완료 (이미지 전송 대기 중...)");
      }
    }
    // [B] SaveImageWebsocket 노드가 쏜 실제 이미지 (바이너리 Blob) 처리
    else if (event.data instanceof Blob) {
      console.log("이미지 바이너리 데이터 수신 성공!");

      // ComfyUI 바이너리 데이터의 맨 앞 8바이트(헤더)를 잘라냅니다.
      let imageBlob = event.data.slice(8);

      // 브라우저 메모리에 임시 URL 생성
      let imageUrl = URL.createObjectURL(imageBlob);

      // p5.js 전역 변수에 이미지 로드 (draw 함수에서 그려짐)
      loadImage(imageUrl, function (img) {
        resultImage = img;
        isGenerating = false; // 로딩 상태 해제

        // 메모리 누수 방지를 위해 임시 URL 파기
        URL.revokeObjectURL(imageUrl);
      });
    }
  };

  ws.onerror = (error) => console.error("웹소켓 에러 발생:", error);
  ws.onclose = () => console.log("웹소켓 연결이 끊어졌습니다.");
}