import { UartPort } from '@dhaval/uart.js';

const responder = new UartPort({
  path: '/dev/pts/3',
  baudRate: 115200,
});

responder.on('line', async (line) => {
  const cmd = line.trim();
  console.log(`[Responder /dev/pts/3] Received command: "${cmd}"`);
  
  if (cmd === 'AT+GMR') {
    await responder.write('+GMR: v1.0.0-SDK\r\nOK\r\n');
    console.log('[Responder /dev/pts/3] Replied: +GMR: v1.0.0-SDK OK');
  } else if (cmd === 'AT') {
    await responder.write('OK\r\n');
    console.log('[Responder /dev/pts/3] Replied: OK');
  } else if (cmd.length > 0) {
    await responder.write(`OK\r\n`);
    console.log(`[Responder /dev/pts/3] Replied: OK for "${cmd}"`);
  }
});

responder.on('error', (err) => {
  console.error('[Responder Error]:', err.message);
});

await responder.open();
console.log('UART Simulator listening on /dev/pts/3... Streaming "A" every 1s.');

// Send "A\r\n" every second
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
