// UUIDs del Servicio UART de la micro:bit
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Transmitir datos desde la micro:bit
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Enviar datos a la micro:bit

let bluetoothDevice = null;
let txCharacteristic = null;
let rxCharacteristic = null;

async function conectarBluetooth() {
  const statusElement = document.getElementById("status-text");
  
  try {
    statusElement.innerText = "Buscando micro:bit...";
    
    // Solicitar dispositivo Bluetooth con el servicio UART
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'BBC micro:bit' }],
      optionalServices: [UART_SERVICE_UUID]
    });

    bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

    // Conectar al servidor GATT
    const server = await bluetoothDevice.gatt.connect();
    const service = await server.getPrimaryService(UART_SERVICE_UUID);

    // Obtener Características TX y RX
    txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);
    rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

    // Escuchar notificaciones entrantes de la micro:bit
    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener('characteristicvaluechanged', handleDataReceived);

    statusElement.innerText = " Conectado exitosamente";
    statusElement.style.color = "#4CAF50";
    document.getElementById("btn-conectar").style.display = "none";
    document.getElementById("btn-desconectar").style.display = "inline-block";

  } catch (error) {
    console.error("Error al conectar:", error);
    statusElement.innerText = "Error o conexión cancelada";
    statusElement.style.color = "#f44336";
  }
}

let acumuladorTexto = "";

function handleDataReceived(event) {
  const value = event.target.value;
  const decoder = new TextDecoder('utf-8');
  acumuladorTexto += decoder.decode(value);

  // Procesar cuando llega un salto de línea (\n)
  let lineas = acumuladorTexto.split('\n');
  acumuladorTexto = lineas.pop(); // Mantener el fragmento incompleto

  for (let linea of lineas) {
    linea = linea.trim();
    if (linea.startsWith("PULSE:")) {
      const valorAnalogo = parseInt(linea.replace("PULSE:", ""));
      
      // Mostrar en pantalla del Visor
      const visorDisplay = document.getElementById("visor-output");
      if (visorDisplay) {
        visorDisplay.innerText = `[${new Date().toLocaleTimeString()}] KY-039 (P0): ${valorAnalogo} units\n` + visorDisplay.innerText;
      }
    }
  }
}

function desconectarBluetooth() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
}

function onDisconnected() {
  const statusElement = document.getElementById("status-text");
  statusElement.innerText = " Desconectado";
  statusElement.style.color = "#F6B40E";
  document.getElementById("btn-conectar").style.display = "inline-block";
  document.getElementById("btn-desconectar").style.display = "none";
}
