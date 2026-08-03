# uart.js — UART analysis helper

This project provides a small TypeScript module for listening to UART serial devices and an analysis helper to infer UART settings.

Features added in this commit:

- analyseUART method on UartListener that tests combinations of baud rate, data bits, stop bits, and parity and returns ranked candidates using heuristics (readable ASCII ratio, linebreak frequency, entropy).
- entropy and byte-frequency scoring to help detect binary streams vs text streams.
- analyseUARTStandalone exported helper for quick one-off analysis without instantiating UartListener.
- Jest unit tests with a mocked `serialport` implementation and a README usage example.

Usage example

```ts
import { analyseUARTStandalone } from 'uart.js';

(async () => {
  const result = await analyseUARTStandalone('/dev/ttyUSB0', { timeoutMs: 800, sampleTimeoutMs: 400 });
  console.log('Best candidate:', result.best);
  console.log('Top candidates:', result.candidates.slice(0, 5));
})();
```

Notes

- The analyser focuses on human-readable ASCII streams. For binary protocols, low readableRatio and high entropy are expected. Consider adding protocol-specific recognizers if you need to detect known binary formats.
- Running the analyzer requires permission to open the serial device. Repeated open/close cycles may affect devices that need exclusive control.
