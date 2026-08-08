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

```typescript
import { UartPort } from '@dhaval/uart.js';

const uart = new UartPort({
  path: '/dev/ttyUSB0',
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

// Open port & write data
await uart.open();
await uart.write('AT+GMR\r\n');

// Read a single line asynchronously with a timeout
const response = await uart.readLine('\n', 3000);
console.log('Response:', response);

// Close connection cleanly when done
await uart.close();
```

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