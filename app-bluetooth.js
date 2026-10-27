const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let txCharacteristic = null;
let acumuladorTexto = "";

// Configuración del Canvas (Trazador PPG)
const canvas = document.getElementById("ppgCanvas");
const ctx = canvas.getContext("2d");
let dataBuffer = new Array(200).fill(0);

function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawGraph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Cuadrícula de fondo
  ctx.strokeStyle = "rgba(117, 170, 219, 0.1)";
  ctx.lineWidth = 1;
  for (let y = 0; y <= canvas.height; y += canvas.height / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Trazo de la señal del sensor
  ctx.strokeStyle = "#75AADB"; // Albiceleste
  ctx.lineWidth = 2;
  ctx.beginPath();

  const step = canvas.width / (dataBuffer.length - 1);
  for (let i = 0; i < dataBuffer.length; i++) {
    const normalizedY = canvas.height - (dataBuffer[i] / 1024) * canvas.height;
    const x = i * step;

    if (i === 0) ctx.moveTo(x, normalizedY);
    else ctx.lineTo(x, normalizedY);
  }
  ctx.stroke();
  requestAnimationFrame(drawGraph);
}
drawGraph();

/* =============================================================
   ALGORITMO DE DETECCIÓN DE PICOS Y CÁLCULO DE BPM
   ============================================================= */
let lastPeakTime = 0;           // Tiempo del último latido detectado (ms)
let ibiHistory = [];            // Historial de intervalos entre latidos (ms)
let rawHistory = [];            // Historial reciente para filtro de suavizado
let threshold = 550;            // Umbral inicial de corte analógico
let isAboveThreshold = false;   // Estado de la señal sobre el umbral
const MIN_BEAT_INTERVAL = 300;  // Período refractario (Máx 200 BPM)
const MAX_BEAT_INTERVAL = 2000; // Límite inferior (Mín 30 BPM)

function processPulseData(rawValue) {
  const currentTime = performance.now();

  // 1. Filtro de promedio móvil (Suaviza 3 lecturas para reducir ruido)
  rawHistory.push(rawValue);
  if (rawHistory.length > 3) rawHistory.shift();
  const smoothedValue = rawHistory.reduce((a, b) => a + b, 0) / rawHistory.length;

  // 2. Ajuste adaptativo del umbral dinámico según la señal
  threshold = threshold * 0.95 + smoothedValue * 0.05;

  // 3. Detección de cresta/pico (Latido)
  if (smoothedValue > threshold + 15 && !isAboveThreshold) {
    isAboveThreshold = true;

    if (lastPeakTime !== 0) {
      const ibi = currentTime - lastPeakTime; // Intervalo entre latidos

      // Validar si el pulso está dentro de rangos fisiológicos normales
      if (ibi >= MIN_BEAT_INTERVAL && ibi <= MAX_BEAT_INTERVAL) {
        ibiHistory.push(ibi);
        if (ibiHistory.length > 10) ibiHistory.shift(); // Guardar los últimos 10 latidos

        // Calcular BPM promedio
        const avgIbi = ibiHistory.reduce((a, b) => a + b, 0) / ibiHistory.length;
        const realBpm = Math.round(60000 / avgIbi);

        // Calcular HRV (RMSSD - Variabilidad del Ritmo Cardíaco)
        let sumSquaredDiffs = 0;
        for (let i = 1; i < ibiHistory.length; i++) {
          let diff = ibiHistory[i] - ibiHistory[i - 1];
          sumSquaredDiffs += diff * diff;
        }
        const hrv = ibiHistory.length > 1 ? Math.round(Math.sqrt(sumSquaredDiffs / (ibiHistory.length - 1))) : 0;

        // Actualizar UI con valores reales
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
   CONEXIÓN BLUETOOTH Y RECEPCIÓN DE DATOS
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

      // Renderizar en el Canvas
      dataBuffer.push(val);
      dataBuffer.shift();

      // Procesar pulso real con el algoritmo
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
