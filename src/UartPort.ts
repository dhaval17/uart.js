/**
 * @file UartPort.ts
 * @description High-level wrapper class around serialport providing Promise-based operations,
 * event-driven line parsing, safe port opening/closing, write-draining, and timeout handling.
 */

import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import { UartConfig, WriteOptions, ReadOptions } from './types';

/**
 * `UartPort` encapsulates serial hardware interaction into a clean, event-driven,
 * and Promise-based interface.
 * 
 * Events emitted:
 * - `'open'`: Emitted when serial port connection opens successfully.
 * - `'close'`: Emitted when serial port connection closes.
 * - `'data'` `(buffer: Buffer)`: Emitted when raw binary data is received from port.
 * - `'line'` `(line: string)`: Emitted when a complete line terminated by `lineDelimiter` is parsed.
 * - `'error'` `(err: Error)`: Emitted when a serial error or device fault occurs.
 */
export class UartPort extends EventEmitter {
  /** Complete normalized configuration object with sensible defaults applied. */
  private config: Required<Omit<UartConfig, 'binding'>> & { binding?: any };

  /** Active underlying SerialPort instance, or `null` if port is currently closed. */
  private port: SerialPort | null = null;

  /** Internal buffer accumulating incoming data stream to extract complete lines. */
  private lineBuffer: string = '';

  /** Delimiter character used to split incoming data into `'line'` events (defaults to '\n'). */
  private lineDelimiter: string = '\n';

  /**
   * Constructs a new `UartPort` instance with the provided configuration.
   * 
   * @param config - Serial port configuration options (path, baud rate, framing parameters).
   * 
   * @example
   * ```typescript
   * const uart = new UartPort({ path: '/dev/ttyUSB0', baudRate: 115200 });
   * uart.on('line', line => console.log('Line:', line));
   * await uart.open();
   * ```
   */
  constructor(config: UartConfig) {
    super();
    
    // Apply default values for any optional parameters omitted by user
    this.config = {
      path: config.path,
      baudRate: config.baudRate ?? 115200,
      dataBits: config.dataBits ?? 8,
      stopBits: config.stopBits ?? 1,
      parity: config.parity ?? 'none',
      autoOpen: config.autoOpen ?? false,
      rtscts: config.rtscts ?? false,
      xon: config.xon ?? false,
      xoff: config.xoff ?? false,
      xany: config.xany ?? false,
      hupcl: config.hupcl ?? true,
      binding: config.binding,
    };

    // If autoOpen is set to true, initiate non-blocking port opening immediately
    if (this.config.autoOpen) {
      this.open().catch((err) => {
        // Emit error event asynchronously if autoOpen fails
        this.emit('error', err);
      });
    }
  }

  /**
   * Retrieves a read-only snapshot of current port configuration settings.
   * 
   * @returns Copy of configuration object.
   */
  public getConfig(): Readonly<UartConfig> {
    return { ...this.config };
  }

  /**
   * Checks whether the underlying serial port connection is open and active.
   * 
   * @returns `true` if port is open, `false` otherwise.
   */
  public isOpen(): boolean {
    return this.port !== null && this.port.isOpen;
  }

  /**
   * Direct access to the raw underlying `SerialPort` instance from the `serialport` package.
   * Useful when low-level pin signaling (DTR, RTS) or custom bindings are required.
   * 
   * @returns Active `SerialPort` instance or `null` if closed.
   */
  public getUnderlyingPort(): SerialPort | null {
    return this.port;
  }

  /**
   * Sets custom character sequence used to segment incoming stream data into `'line'` events.
   * 
   * @param delimiter - String sequence defining end-of-line (default is `'\n'`).
   */
  public setLineDelimiter(delimiter: string): void {
    this.lineDelimiter = delimiter;
  }

  /**
   * Asynchronously opens the serial port connection.
   * 
   * Attaches event listeners for raw data streaming, error handling, and line parsing.
   * Resolves when the connection is established; rejects if opening fails (e.g. port locked or missing).
   * 
   * @returns Promise resolving when port is open.
   */
  public open(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If port is already open, resolve immediately to avoid redundant re-opening
      if (this.isOpen()) {
        resolve();
        return;
      }

      // Instantiate new SerialPort object with configured parameters
      this.port = new SerialPort({
        path: this.config.path,
        baudRate: this.config.baudRate,
        dataBits: this.config.dataBits,
        stopBits: this.config.stopBits,
        parity: this.config.parity,
        rtscts: this.config.rtscts,
        xon: this.config.xon,
        xoff: this.config.xoff,
        xany: this.config.xany,
        hupcl: this.config.hupcl,
        ...(this.config.binding ? { binding: this.config.binding } : {}),
        autoOpen: false, // Explicit control over open timing
      });

      // Handle raw binary data received from hardware port
      this.port.on('data', (data: Buffer) => {
        // Emit raw data event for consumers interested in raw buffers
        this.emit('data', data);

        // Process line buffer only if active 'line' listeners exist (saves CPU cycles)
        if (this.listenerCount('line') > 0) {
          this.lineBuffer += data.toString('utf8');
          const lines = this.lineBuffer.split(this.lineDelimiter);
          
          // Retain incomplete trailing snippet back in buffer for next chunk
          this.lineBuffer = lines.pop() ?? '';
          
          // Emit completed line strings (strip trailing carriage return '\r' if present)
          for (const line of lines) {
            this.emit('line', line.replace(/\r$/, ''));
          }
        }
      });

      // Forward underlying serial port error events to UartPort listeners
      this.port.on('error', (err: Error) => {
        this.emit('error', err);
      });

      // Forward port close events
      this.port.on('close', () => {
        this.emit('close');
      });

      // Initiate hardware port opening
      this.port.open((err) => {
        if (err) {
          this.port = null;
          reject(err);
        } else {
          this.emit('open');
          resolve();
        }
      });
    });
  }

  /**
   * Asynchronously closes the serial port connection.
   * 
   * Clears internal line buffer state and releases OS file handle.
   * 
   * @returns Promise resolving when port is closed.
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If port is already closed or uninstantiated, resolve immediately
      if (!this.port || !this.port.isOpen) {
        this.port = null;
        resolve();
        return;
      }

      // Close serial port connection
      this.port.close((err) => {
        this.port = null;
        this.lineBuffer = ''; // Reset accumulated line buffer state
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Writes data (string, Buffer, or Uint8Array) to the serial port.
   * 
   * Options allow enforcing write buffer draining and operation timeout enforcement.
   * 
   * @param data - Payload to send to serial device.
   * @param options - Optional writing options (encoding, drain flag, timeoutMs).
   * @returns Promise resolving to total number of bytes written.
   * 
   * @example
   * ```typescript
   * await uart.write('AT+RST\r\n', { drain: true, timeoutMs: 2000 });
   * ```
   */
  public write(
    data: string | Buffer | Uint8Array,
    options?: WriteOptions
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      // Check if port is open before attempting write operation
      if (!this.isOpen() || !this.port) {
        reject(new Error(`Cannot write: Serial port ${this.config.path} is not open.`));
        return;
      }

      const encoding = options?.encoding ?? 'utf8';
      const shouldDrain = options?.drain ?? true;
      const timeoutMs = options?.timeoutMs;

      // Setup write timeout timer if specified
      let timer: NodeJS.Timeout | null = null;
      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          reject(new Error(`Write operation timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }

      // Helper function to clear active timers
      const cleanup = () => {
        if (timer) clearTimeout(timer);
      };

      // Standardize input payload to Buffer format
      const payload = typeof data === 'string' ? Buffer.from(data, encoding) : Buffer.from(data);
      const bytesToWrite = payload.length;

      // Initiate serial port write
      this.port.write(payload, encoding, (err) => {
        if (err) {
          cleanup();
          reject(err);
          return;
        }

        // If drain option is enabled, wait until transmission finishes physically
        if (shouldDrain && this.port) {
          this.port.drain((drainErr) => {
            cleanup();
            if (drainErr) {
              reject(drainErr);
            } else {
              resolve(bytesToWrite);
            }
          });
        } else {
          cleanup();
          resolve(bytesToWrite);
        }
      });
    });
  }

  /**
   * Reads next incoming data chunk asynchronously with configurable timeout.
   * 
   * Suspends execution until new data arrives or timeout expires.
   * 
   * @param options - Timeout in milliseconds OR ReadOptions configuration object.
   * @returns Promise resolving to Buffer (if encoding is omitted) or string (if encoding is specified).
   * 
   * @example
   * ```typescript
   * const chunk = await uart.read({ timeoutMs: 3000, encoding: 'utf8' });
   * ```
   */
  public read(options?: ReadOptions | number): Promise<Buffer | string> {
    // Normalize options parameter when passed as number vs object
    const opts: ReadOptions = typeof options === 'number' ? { timeoutMs: options } : options ?? {};
    const timeoutMs = opts.timeoutMs ?? 5000;

    return new Promise((resolve, reject) => {
      if (!this.isOpen()) {
        reject(new Error(`Cannot read: Serial port ${this.config.path} is not open.`));
        return;
      }

      let timer: NodeJS.Timeout | null = null;

      // Callback invoked when data arrives on port
      const onData = (data: Buffer) => {
        if (timer) clearTimeout(timer);
        this.removeListener('data', onData);
        this.removeListener('error', onError);

        if (opts.encoding) {
          resolve(data.toString(opts.encoding));
        } else {
          resolve(data);
        }
      };

      // Callback invoked if port encounters error while waiting for data
      const onError = (err: Error) => {
        if (timer) clearTimeout(timer);
        this.removeListener('data', onData);
        this.removeListener('error', onError);
        reject(err);
      };

      // Start timeout watchdog
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.removeListener('data', onData);
          this.removeListener('error', onError);
          reject(new Error(`Read timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }

      // Attach temporary one-shot data listeners
      this.on('data', onData);
      this.on('error', onError);
    });
  }

  /**
   * Reads a single line of text terminated by `delimiter` asynchronously.
   * 
   * Accumulates incoming data stream until delimiter is encountered or timeout occurs.
   * 
   * @param delimiter - End-of-line delimiter character (defaults to lineDelimiter or '\n').
   * @param timeoutMs - Maximum duration to wait for line completion in milliseconds (default: 5000ms).
   * @returns Promise resolving to decoded line string (excluding trailing carriage return).
   * 
   * @example
   * ```typescript
   * const line = await uart.readLine('\n', 3000);
   * console.log('Response line:', line);
   * ```
   */
  public readLine(delimiter?: string, timeoutMs: number = 5000): Promise<string> {
    const lineDelim = delimiter ?? this.lineDelimiter;

    return new Promise((resolve, reject) => {
      if (!this.isOpen()) {
        reject(new Error(`Cannot readLine: Serial port ${this.config.path} is not open.`));
        return;
      }

      let accumulated = '';
      let timer: NodeJS.Timeout | null = null;

      // Remove listeners and clear timers on resolution/rejection
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.removeListener('data', onData);
        this.removeListener('error', onError);
      };

      // Inspect incoming data chunks for delimiter match
      const onData = (data: Buffer) => {
        accumulated += data.toString('utf8');
        const idx = accumulated.indexOf(lineDelim);
        if (idx !== -1) {
          // Extract line up to delimiter, stripping trailing '\r' if present
          const line = accumulated.slice(0, idx).replace(/\r$/, '');
          cleanup();
          resolve(line);
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      // Start line read timeout timer
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`readLine timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }

      this.on('data', onData);
      this.on('error', onError);
    });
  }

  /**
   * Flushes both receive and transmit hardware buffers on the serial device.
   * Discards unread incoming data and unsent outgoing data.
   * 
   * @returns Promise resolving when flush operation completes.
   */
  public flush(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isOpen() || !this.port) {
        reject(new Error(`Cannot flush: Serial port ${this.config.path} is not open.`));
        return;
      }
      this.port.flush((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Waits until all pending transmit data has been physically sent out the serial port interface.
   * 
   * @returns Promise resolving when transmit buffer is drained.
   */
  public drain(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isOpen() || !this.port) {
        reject(new Error(`Cannot drain: Serial port ${this.config.path} is not open.`));
        return;
      }
      this.port.drain((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
