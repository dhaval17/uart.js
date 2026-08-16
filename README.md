# @dhaval/uart.js

> A robust, TypeScript-first Node.js library to **read**, **analyze**, and **write** UART serial port data.

Built on top of `serialport`, `@dhaval/uart.js` simplifies hardware serial communication with clean event-driven streams, Promise-based read/write methods, port enumeration, and automated baud rate & framing detection.

---

## Features

- **Complete UART Toolkit**: Read, write, list ports, and auto-detect UART communication parameters.
- **EventEmitter API**: Listen to `'data'`, `'line'`, `'open'`, `'close'`, and `'error'` events cleanly.
- **Promise-based Read & Write**: High-level `write()`, `read()`, and `readLine()` methods with configurable timeouts and drain options.
- **Automated Baud & Parameter Analysis**: `analyzeUart()` sweeps baud rates, data bits, stop bits, and parity using Shannon entropy and ASCII metrics.
- **Resource Safety**: Safe asynchronous port opening and closing preventing OS device file lockups (`EBUSY`).
- **Mocking & Test Support**: Native integration with `@serialport/binding-mock` for testing without physical hardware.

---

## Installation

```bash
npm install @dhaval/uart.js serialport
```

---

## Quick Start

### 1. List Available Serial Ports

```typescript
import { listPorts } from '@dhaval/uart.js';

const ports = await listPorts();
for (const port of ports) {
  console.log(`Port: ${port.path} | Manufacturer: ${port.manufacturer ?? 'Unknown'}`);
}
```

### 2. Auto-Detect UART Parameters

```typescript
import { analyzeUart } from '@dhaval/uart.js';

const result = await analyzeUart('/dev/ttyUSB0', {
  testTimeoutMs: 1000,
  sampleTimeoutMs: 600,
});

if (result.best) {
  console.log(`Best configuration found: ${result.best.baudRate} baud, ${result.best.dataBits}N${result.best.stopBits}`);
}
```

### 3. Read and Write Serial Data (`UartPort`)

#### Option A: Command/Response Pattern (with Timeout Handling)

```typescript
import { UartPort } from '@dhaval/uart.js';

const uart = new UartPort({
  path: '/dev/ttyUSB0',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});

uart.on('error', (err) => {
  console.error('UART Error:', err.message);
});

// Open port & send command
await uart.open();
await uart.write('AT+GMR\r\n');

// Read single response line with timeout safety
try {
  // readLine(delimiter, timeoutMs) throws if no line arrives within timeoutMs
  const response = await uart.readLine('\n', 3000);
  console.log('Response:', response);
} catch (err) {
  if (err.message.includes('timed out')) {
    console.warn('No response received within timeout window.');
  } else {
    console.error('Read error:', err.message);
  }
}

// Close connection cleanly when done
await uart.close();
```

#### Option B: Continuous Data Stream Pattern

```typescript
import { UartPort } from '@dhaval/uart.js';

const uart = new UartPort({
  path: '/dev/ttyUSB0',
  baudRate: 115200,
});

// Continuously process incoming lines as a data stream
uart.on('line', (line) => {
  console.log('Streamed line:', line);
});

uart.on('error', (err) => {
  console.error('UART Error:', err.message);
});

await uart.open();
console.log('Listening for UART data stream...');

// Cleanly close port on process termination (Ctrl+C)
process.on('SIGINT', async () => {
  await uart.close();
  process.exit(0);
});
```

> **Testing Note for Virtual Ports (`socat` / `/dev/pts`)**: When testing with paired pseudo-terminals (e.g. `/dev/pts/2` <-> `/dev/pts/3`), ensure an active responder or simulator process is running on the opposite end (`/dev/pts/3`) to reply or stream data back.

---

## Running Tests

The workspace includes unit tests using Node's native test runner and `@serialport/binding-mock`:

```bash
# Run unit test suite
npm test

# Run interactive integration example
npm run example
```

---

## License

ISC © [Dhaval Chauhan](https://github.com/dhaval17)