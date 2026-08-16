/**
 * @file responder.js (testUartapp)
 * @description Hardware UART simulator for testing `@dhaval/uart.js`.
 * 
 * Listens on virtual serial port `/dev/pts/3` (paired with `/dev/pts/2` via `socat`).
 * Streams `"A\r\n"` every 1 second and responds to standard AT commands (e.g. `AT`, `AT+GMR`).
 */

import { UartPort } from '@dhaval/uart.js';

// 1. Initialize UartPort instance for the simulator on virtual port /dev/pts/3
const responder = new UartPort({
  path: '/dev/pts/3', // Paired port connected to /dev/pts/2 via socat
  baudRate: 115200,   // Communication speed (bits per second)
});

// 2. Listen for incoming command lines sent from index.js or terminal clients
responder.on('line', async (line) => {
  const cmd = line.trim();
  console.log(`[Responder /dev/pts/3] Received command: "${cmd}"`);
  
  // Respond to specific AT command payloads
  if (cmd === 'AT+GMR') {
    // Reply with mock version string followed by OK
    await responder.write('+GMR: v1.0.0-SDK\r\nOK\r\n');
    console.log('[Responder /dev/pts/3] Replied: +GMR: v1.0.0-SDK OK');
  } else if (cmd === 'AT') {
    // Reply standard AT handshake response
    await responder.write('OK\r\n');
    console.log('[Responder /dev/pts/3] Replied: OK');
  } else if (cmd.length > 0) {
    // Generic acknowledgment reply for any other command string
    await responder.write(`OK\r\n`);
    console.log(`[Responder /dev/pts/3] Replied: OK for "${cmd}"`);
  }
});

// 3. Log any serial errors encountered on the responder port
responder.on('error', (err) => {
  console.error('[Responder Error]:', err.message);
});

// 4. Open the serial port connection for the simulator
await responder.open();
console.log('UART Simulator listening on /dev/pts/3... Streaming "A" every 1s.');

// 5. Setup 1-second interval timer to simulate periodic hardware sensor stream ("A\r\n")
setInterval(async () => {
  try {
    if (responder.isOpen()) {
      await responder.write('A\r\n');
      console.log('[Responder /dev/pts/3] Sent periodic stream: "A"');
    }
  } catch (err) {
    console.error('[Responder Stream Error]:', err.message);
  }
}, 1000);
