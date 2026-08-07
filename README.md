# uart.js

A robust, TypeScript-based UART (Universal Asynchronous Receiver-Transmitter) listener module for Node.js. Built on top of the `serialport` library, it makes connecting to hardware devices and reading serial data simple and type-safe.

## Features
- Written in TypeScript for out-of-the-box type safety.
- Simple, event-driven listener API.
- Automatically checks and logs configured baud rates.

## Installation

Once published to npm, you can install it via:

```bash
npm i @dhaval/uart.js
```

NPM Package at: https://www.npmjs.com/package/@dhaval/uart.js

## Usage

Import the module and initialize it with your specific hardware path (e.g., `/dev/ttyUSB0` on Linux, `COM3` on Windows) and your desired baud rate.

```typescript
import { UartListener } from '@dhaval/uart.js';

const uart = new UartListener({
    path: '/dev/ttyUSB0',
    baudRate: 9600,
    dataBits: 8,
    parity: 'none'
});

// Check the baud rate
console.log(`Configured Baud Rate: ${uart.getBaudRate()}`);

// Start listening and outputting data
uart.startListening(
    (data) => {
        console.log(`Received data: ${data}`);
    },
    (error) => {
        console.error(`UART Error:`, error.message);
    }
);
```

---

## Testing & Mocking Locally (Without Hardware)

If you don't have physical hardware (like an Arduino or USB-to-Serial adapter) available, you can mock a hardware serial port using `socat` on Linux/Ubuntu. This creates a virtual "loopback" pair of pseudo-terminals that you can use to send and receive serial data locally.

### 1. Install `socat`
Open your terminal and install the `socat` utility:

```bash
sudo apt update && sudo apt install socat
```

### 2. Create Virtual Serial Ports
Run the following command to create two linked pseudo-terminals (PTYs):

```bash
socat -d -d pty,raw,echo=0 pty,raw,echo=0
```

**Do not close this terminal!** You should see output similar to this:

```text
2026/08/01 22:30:00 socat[12345] N PTY is /dev/pts/2
2026/08/01 22:30:00 socat[12345] N PTY is /dev/pts/3
```

Take note of the two paths (e.g., `/dev/pts/2` and `/dev/pts/3`). They act as the two ends of your virtual cable.

### 3. Run the Test Script
In a **new terminal window**, update your test script (`src/test.ts`) to use the first virtual port (e.g., `/dev/pts/2`), and run it using `tsx`:

```bash
npm install -D tsx
npx tsx src/test.ts
```

You should see something like:

```text
Checking Configured Baud Rate: 9600
[UART Module] Successfully connected to /dev/pts/2 at 9600 baud.
```

### 4. Send Mock Data
Open a **third terminal window** and send a string into the *other* end of your virtual cable (e.g., `/dev/pts/3`):

```bash
echo "Hello from the virtual hardware!" > /dev/pts/3
```

Look back at your Node.js script terminal. You should see the data successfully received by your module.

## Extras

- analyzeUart method on UartListener that tests combinations of baud rate, data bits, stop bits, and parity and returns ranked candidates using heuristics (readable ASCII ratio, linebreak frequency, entropy).
- entropy and byte-frequency scoring to help detect binary streams vs text streams.
- analyzeUartStandalone exported helper for quick one-off analysis without instantiating UartListener.
- Jest unit tests with a mocked `serialport` implementation and a README usage example.

### Usage example

```ts
import { analyzeUartStandalone } from '@dhaval/uart.js';

(async () => {
  const result = await analyzeUartStandalone('/dev/ttyUSB0', { timeoutMs: 800, sampleTimeoutMs: 400 });
  console.log('Best candidate:', result.best);
  console.log('Top candidates:', result.candidates.slice(0, 5));
})();
```

### Notes

- The analyser focuses on human-readable ASCII streams. For binary protocols, low readableRatio and high entropy are expected. Consider adding protocol-specific recognizers if you need to detect known binary formats.
- Running the analyzer requires permission to open the serial device. Repeated open/close cycles may affect devices that need exclusive control.
