# testUartapp

A sample test application for **`@dhaval/uart.js`** that demonstrates serial communication over virtual pseudo-terminal (PTY) ports using `socat`.

---

## Overview

This application consists of two main scripts:
- **`responder.js`** (`npm run responder`): Simulates a hardware UART device listening on a PTY port (default `/dev/pts/3`). It streams `"A"` every second and replies to AT commands.
- **`index.js`** (`npm run start`): Uses `@dhaval/uart.js` to open the paired PTY port (default `/dev/pts/2`) and prints incoming stream lines in real time.

---

## Prerequisites

- **Node.js** (v18+ recommended)
- **`socat`**: Utility required for creating virtual serial port pairs on Linux/macOS.
  - Linux (Debian/Ubuntu): `sudo apt install socat`
  - macOS: `brew install socat`

---

## Step-by-Step Testing Guide

### 1. Create Virtual Serial Ports with `socat`

Open a terminal and run `socat` to create a pair of linked pseudo-terminal ports:

```bash
socat -d -d pty,raw,echo=0 pty,raw,echo=0
```

**Example Output:**
```text
2026/08/16 09:37:18 socat[17882] N PTY is /dev/pts/2
2026/08/16 09:37:18 socat[17882] N PTY is /dev/pts/3
2026/08/16 09:37:18 socat[17882] N starting data transfer loop with FDs [5,5] and [7,7]
```

> **Note:** Take note of the PTY device paths assigned by `socat` (e.g., `/dev/pts/2` and `/dev/pts/3`). If your system assigns different device paths, update `index.js` and `responder.js` accordingly.

---

### 2. Start the UART Responder Simulator

In a second terminal, navigate to the `testUartapp` directory and start the responder simulator:

```bash
cd testUartapp
npm run responder
```

**Output:**
```text
> testuartapp@1.0.0 responder
> node responder.js

UART Simulator listening on /dev/pts/3... Streaming "A" every 1s.
[Responder /dev/pts/3] Sent periodic stream: "A"
[Responder /dev/pts/3] Sent periodic stream: "A"
[Responder /dev/pts/3] Sent periodic stream: "A"
```

---

### 3. Run the Test Application

In a third terminal, navigate to the `testUartapp` directory and start the test application:

```bash
cd testUartapp
npm run start
```

**Output:**
```text
> testuartapp@1.0.0 start
> node index.js

Port /dev/pts/2 opened successfully. Listening for data stream (Press Ctrl+C to stop)...
Received line: A
Received line: A
Received line: A
Received line: A
```

Press `Ctrl+C` in the terminals to stop execution cleanly.

---

## Configuration

If `socat` allocates different PTY paths, update the `path` parameter in the respective scripts:

- In [`index.js`](./index.js):
  ```javascript
  const uart = new UartPort({
    path: '/dev/pts/2', // Update to match your receiver PTY path
    baudRate: 115200,
    ...
  });
  ```

- In [`responder.js`](./responder.js):
  ```javascript
  const responder = new UartPort({
    path: '/dev/pts/3', // Update to match your responder PTY path
    baudRate: 115200,
  });
  ```
