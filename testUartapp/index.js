import { UartPort } from '@dhaval/uart.js';

const uart = new UartPort({
  path: '/dev/pts/2',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});

// Event-driven listening for complete lines
uart.on('line', (line) => {
  console.log('Received line:', line);
});

uart.on('error', (err) => {
  console.error('UART Error:', err.message);
});

// Open port & start streaming listener
await uart.open();
console.log(`Port ${uart.getConfig().path} opened successfully. Listening for data stream (Press Ctrl+C to stop)...`);

// Handle SIGINT (Ctrl+C) cleanly
process.on('SIGINT', async () => {
  console.log('\nClosing port and exiting...');
  await uart.close();
  process.exit(0);
});
