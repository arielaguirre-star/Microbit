const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let txCharacteristic = null;
let acumuladorTexto = "";

// Configuración del Canvas (Trazador PPG en vivo)
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

  // Dibujar líneas de cuadrícula del fondo
  ctx.strokeStyle = "rgba(117, 170, 219, 0.1)";
  ctx.lineWidth = 1;
  for (let y = 0; y <= canvas.height; y += canvas.height / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Dibujar curva de la señal del sensor KY-039
  ctx.strokeStyle = "#75AADB"; // Azul Albiceleste
  ctx.lineWidth = 2;
  ctx.beginPath();

  const step = canvas.width / (dataBuffer.length - 1);
  for (let i = 0; i < dataBuffer.length; i++) {
    // Escalar valor de 0-1024 a la altura del canvas
    const normalizedY = canvas.height - (dataBuffer[i] / 1024) * canvas.height;
    const x = i * step;

    if (i === 0) ctx.moveTo(x, normalizedY);
    else ctx.lineTo(x, normalizedY);
  }
  ctx.stroke();
  requestAnimationFrame(drawGraph);
}
drawGraph();

// Lógica Web Bluetooth API
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

      // Agregar punto al buffer del gráfico
      dataBuffer.push(val);
      dataBuffer.shift();

      // Cálculo de métricas simuladas a partir de la señal
      document.getElementById("val-bpm").innerText = Math.round(60 + (val % 30));
      document.getElementById("val-hrv").innerText = Math.round(40 + (val % 25));
      document.getElementById("val-pi").innerText = (1.2 + (val / 1000)).toFixed(1);
      document.getElementById("val-estres").innerText = Math.round(20 + (val % 15));
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
