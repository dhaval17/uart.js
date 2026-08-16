/**
 * @file index.js (testUartapp)
 * @description Receiver application for testing `@dhaval/uart.js`.
 * 
 * Opens serial port `/dev/pts/2` (created via `socat`), listens for incoming data lines
 * streamed by `responder.js`, and prints received lines to the console in real time.
 */

import { UartPort } from '@dhaval/uart.js';

// 1. Initialize UartPort instance connected to virtual serial port /dev/pts/2
const uart = new UartPort({
  path: '/dev/pts/2', // Device path allocated by socat (update if socat assigns a different /dev/pts/X)
  baudRate: 115200,   // Standard 115200 baud speed matching responder.js
  dataBits: 8,        // 8 data bits per serial frame
  stopBits: 1,        // 1 stop bit
  parity: 'none',     // No parity bit checking
});

// 2. Attach event listener for complete parsed lines (terminated by newline '\n')
uart.on('line', (line) => {
  console.log('Received line:', line);
});

// 3. Attach error event listener to catch port or serial hardware issues
uart.on('error', (err) => {
  console.error('UART Error:', err.message);
});

// 4. Asynchronously open the serial port connection
await uart.open();
console.log(`Port ${uart.getConfig().path} opened successfully. Listening for data stream (Press Ctrl+C to stop)...`);

// 5. Register process termination signal handler (SIGINT / Ctrl+C) for graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nClosing port and exiting...');
  await uart.close(); // Cleanly release serial port device handle
  process.exit(0);
});
