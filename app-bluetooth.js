const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let txCharacteristic = null;
let acumuladorTexto = "";

async function conectarBluetooth() {
  const statusText = document.getElementById("status-text");
  const statusDot = document.getElementById("status-dot");
  const btnConectar = document.getElementById("btn-conectar");

  try {
    statusText.innerText = "Buscando dispositivo...";
    
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

    statusText.innerText = "Conectado";
    statusDot.classList.add("connected");
    btnConectar.innerText = "Desconectar";
    btnConectar.setAttribute("onclick", "desconectarBluetooth()");

  } catch (error) {
    console.error(error);
    statusText.innerText = "Error de conexión";
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
      const valor = parseInt(linea.replace("PULSE:", ""));
      
      // 1. Actualizar Tarjeta KY-039 (P0)
      document.getElementById("val-ky039").innerText = valor;
      const porcentaje = Math.min(Math.max((valor / 1023) * 100, 0), 100);
      document.getElementById("fill-ky039").style.width = porcentaje + "%";

      // 2. Actualizar Estado del Buzzer (P1)
      const valBuzzer = document.getElementById("val-buzzer");
      if (valor > 600) {
        valBuzzer.innerText = "BEEP! 🔔";
        valBuzzer.style.color = "#F6B40E";
      } else {
        valBuzzer.innerText = "OFF";
        valBuzzer.style.color = "#ffffff";
      }

      // 3. Log en la consola
      const consoleBox = document.getElementById("visor-output");
      consoleBox.innerText = `[${new Date().toLocaleTimeString()}] KY-039 (P0): ${valor}\n` + consoleBox.innerText;
    }
  }
}

function desconectarBluetooth() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  }
}

function onDisconnected() {
  document.getElementById("status-text").innerText = "Desconectado";
  document.getElementById("status-dot").classList.remove("connected");
  const btn = document.getElementById("btn-conectar");
  btn.innerText = "Conectar micro:bit";
  btn.setAttribute("onclick", "conectarBluetooth()");
}
