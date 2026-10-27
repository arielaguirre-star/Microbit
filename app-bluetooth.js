const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let txCharacteristic = null;
let acumuladorTexto = "";

/* =============================================================
   1. INICIALIZACIÓN DE MOTOR 3D (THREE.JS) PARA EL CORAZÓN
   ============================================================= */
let scene3D, camera3D, renderer3D, heartMesh;
let targetScale = 1.0;

function init3DHeart() {
  const container = document.getElementById("heart-3d-container");
  if (!container) return;

  scene3D = new THREE.Scene();
  camera3D = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera3D.position.z = 4.5;

  renderer3D = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer3D.setSize(45, 45);
  renderer3D.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer3D.domElement);

  // Iluminación
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene3D.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 1.2);
  pointLight.position.set(2, 3, 4);
  scene3D.add(pointLight);

  // Forma paramétrica 2D del Corazón extruida a 3D
  const x = 0, y = 0;
  const heartShape = new THREE.Shape();
  heartShape.moveTo(x + 0.25, y + 0.25);
  heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.2, y, x, y);
  heartShape.bezierCurveTo(x - 0.3, y, x - 0.3, y + 0.35, x - 0.3, y + 0.35);
  heartShape.bezierCurveTo(x - 0.3, y + 0.55, x - 0.1, y + 0.77, x + 0.25, y + 0.95);
  heartShape.bezierCurveTo(x + 0.6, y + 0.77, x + 0.8, y + 0.55, x + 0.8, y + 0.35);
  heartShape.bezierCurveTo(x + 0.8, y + 0.35, x + 0.8, y, x + 0.5, y);
  heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

  const extrudeSettings = {
    depth: 0.2,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 2,
    bevelSize: 0.08,
    bevelThickness: 0.08
  };

  const geometry = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
  geometry.center();

  // Material Rojo Metálico con estilo moderno
  const material = new THREE.MeshPhongMaterial({
    color: 0xef4444,
    emissive: 0x330000,
    specular: 0xffffff,
    shininess: 100
  });

  heartMesh = new THREE.Mesh(geometry, material);
  heartMesh.rotation.x = Math.PI; // Orientación correcta
  scene3D.add(heartMesh);

  animate3D();
}

function animate3D() {
  requestAnimationFrame(animate3D);

  if (heartMesh) {
    // Rotación suave continua
    heartMesh.rotation.y += 0.02;

    // Animación de retorno elástico a tamaño normal
    heartMesh.scale.x += (targetScale - heartMesh.scale.x) * 0.15;
    heartMesh.scale.y += (targetScale - heartMesh.scale.y) * 0.15;
    heartMesh.scale.z += (targetScale - heartMesh.scale.z) * 0.15;

    if (targetScale > 1.0) {
      targetScale -= 0.03; // Reducir escala gradualmente tras el latido
    }
  }

  renderer3D.render(scene3D, camera3D);
}

// Activa el golpe de latido en el modelo 3D
function trigger3DPulse() {
  targetScale = 1.45; // Amplía el tamaño del corazón
}

window.addEventListener("DOMContentLoaded", init3DHeart);

/* =============================================================
   2. CONFIGURACIÓN DEL CANVAS PPG (2D)
   ============================================================= */
const canvas = document.getElementById("ppgCanvas");
const ctx = canvas.getContext("2d");
let dataBuffer = new Array(200).fill(0);

function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Reemplazar la función drawGraph en app-bluetooth.js por esta:
function drawGraph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const paddingLeft = 45; // Espacio reservado a la izquierda para los números de escala
  const graphWidth = canvas.width - paddingLeft;
  const graphHeight = canvas.height - 20; // Espacio para margen superior e inferior

  // 1. Dibujar Líneas Guía Horizontales y Texto de Escala (Eje Y)
  const steps = [1024, 800, 600, 400, 200, 0];
  ctx.font = "10px monospace";
  ctx.fillStyle = "#94a3b8"; // Color del texto de la escala
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  steps.forEach((val) => {
    // Calcular coordenada Y dentro del gráfico
    const yRatio = 1 - (val / 1024);
    const yPos = 10 + (yRatio * graphHeight);

    // Dibujar línea de cuadrícula
    ctx.strokeStyle = "rgba(117, 170, 219, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yPos);
    ctx.lineTo(canvas.width, yPos);
    ctx.stroke();

    // Dibujar texto del valor en el eje Y
    ctx.fillText(val, paddingLeft - 8, yPos);
  });

  // 2. Dibujar Trazo de la Señal del Sensor KY-039
  ctx.strokeStyle = "#75AADB"; // Azul Albiceleste
  ctx.lineWidth = 2;
  ctx.beginPath();

  const stepX = graphWidth / (dataBuffer.length - 1);
  for (let i = 0; i < dataBuffer.length; i++) {
    const val = Math.min(Math.max(dataBuffer[i], 0), 1024); // Clampear a 0-1024
    const normalizedY = 10 + (1 - (val / 1024)) * graphHeight;
    const xPos = paddingLeft + (i * stepX);

    if (i === 0) ctx.moveTo(xPos, normalizedY);
    else ctx.lineTo(xPos, normalizedY);
  }
  ctx.stroke();

  requestAnimationFrame(drawGraph);
}

/* =============================================================
   3. ALGORITMO DE DETECCIÓN DE PICOS + INTEGRACIÓN 3D
   ============================================================= */
let lastPeakTime = 0;
let ibiHistory = [];
let rawHistory = [];
let threshold = 550;
let isAboveThreshold = false;
const MIN_BEAT_INTERVAL = 300;
const MAX_BEAT_INTERVAL = 2000;

function processPulseData(rawValue) {
  const currentTime = performance.now();

  rawHistory.push(rawValue);
  if (rawHistory.length > 3) rawHistory.shift();
  const smoothedValue = rawHistory.reduce((a, b) => a + b, 0) / rawHistory.length;

  threshold = threshold * 0.95 + smoothedValue * 0.05;

  if (smoothedValue > threshold + 15 && !isAboveThreshold) {
    isAboveThreshold = true;

    // Disparar latido en el corazón 3D
    trigger3DPulse();

    if (lastPeakTime !== 0) {
      const ibi = currentTime - lastPeakTime;

      if (ibi >= MIN_BEAT_INTERVAL && ibi <= MAX_BEAT_INTERVAL) {
        ibiHistory.push(ibi);
        if (ibiHistory.length > 10) ibiHistory.shift();

        const avgIbi = ibiHistory.reduce((a, b) => a + b, 0) / ibiHistory.length;
        const realBpm = Math.round(60000 / avgIbi);

        let sumSquaredDiffs = 0;
        for (let i = 1; i < ibiHistory.length; i++) {
          let diff = ibiHistory[i] - ibiHistory[i - 1];
          sumSquaredDiffs += diff * diff;
        }
        const hrv = ibiHistory.length > 1 ? Math.round(Math.sqrt(sumSquaredDiffs / (ibiHistory.length - 1))) : 0;

        document.getElementById("val-bpm").innerText = realBpm;
        document.getElementById("val-hrv").innerText = hrv;
        document.getElementById("val-pi").innerText = ((smoothedValue / 1024) * 2.5).toFixed(1);
        document.getElementById("val-estres").innerText = Math.min(Math.max(Math.round(100 - (hrv * 1.2)), 10), 95);
      }
    }
    lastPeakTime = currentTime;
  } else if (smoothedValue < threshold) {
    isAboveThreshold = false;
  }
}

/* =============================================================
   4. CONEXIÓN WEB BLUETOOTH API
   ============================================================= */
async function conectarBluetooth() {
  try {
    document.getElementById("bt-status-text").innerText = "Buscando...";
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'BBC micro:bit' }],
      optionalServices: [UART_SERVICE_UUID]
    });

    bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService(UART_SERVICE_UUID);
    txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener('characteristicvaluechanged', handleDataReceived);

    document.getElementById("bt-status-text").innerText = "Bluetooth: Conectado";
    document.getElementById("graph-status").innerText = "TRANSMITIENDO EN VIVO";
    document.getElementById("graph-status").style.color = "#10b981";
    document.getElementById("btn-connect").innerText = "Desconectar";
    document.getElementById("btn-connect").setAttribute("onclick", "desconectarBluetooth()");

  } catch (error) {
    console.error(error);
    document.getElementById("bt-status-text").innerText = "Error al conectar";
  }
}

function handleDataReceived(event) {
  const value = event.target.value;
  const decoder = new TextDecoder('utf-8');
  acumuladorTexto += decoder.decode(value);

  let lineas = acumuladorTexto.split('\n');
  acumuladorTexto = lineas.pop();

  for (let linea of lineas) {
    linea = linea.trim();
    if (linea.startsWith("PULSE:")) {
      const val = parseInt(linea.replace("PULSE:", ""));
      dataBuffer.push(val);
      dataBuffer.shift();

      processPulseData(val);
    }
  }
}

function desconectarBluetooth() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
}

function onDisconnected() {
  document.getElementById("bt-status-text").innerText = "Bluetooth: Desconectado";
  document.getElementById("graph-status").innerText = "DESCONECTADO";
  document.getElementById("graph-status").style.color = "#94a3b8";
  document.getElementById("btn-connect").innerText = 'Conectar "visor"';
  document.getElementById("btn-connect").setAttribute("onclick", "conectarBluetooth()");
}
