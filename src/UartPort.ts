import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import { UartConfig, WriteOptions, ReadOptions } from './types';

export class UartPort extends EventEmitter {
  private config: Required<Omit<UartConfig, 'binding'>> & { binding?: any };
  private port: SerialPort | null = null;
  private lineBuffer: string = '';
  private lineDelimiter: string = '\n';

  constructor(config: UartConfig) {
    super();
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

    if (this.config.autoOpen) {
      // Fire and forget, user can listen to 'open' or 'error' event
      this.open().catch((err) => {
        this.emit('error', err);
      });
    }
  }

  /**
   * Get current configuration details.
   */
  public getConfig(): Readonly<UartConfig> {
    return { ...this.config };
  }

  /**
   * Check if serial port is currently open.
   */
  public isOpen(): boolean {
    return this.port !== null && this.port.isOpen;
  }

  /**
   * Access the underlying SerialPort instance directly if needed.
   */
  public getUnderlyingPort(): SerialPort | null {
    return this.port;
  }

  /**
   * Set custom line delimiter for 'line' events (default is '\n').
   */
  public setLineDelimiter(delimiter: string): void {
    this.lineDelimiter = delimiter;
  }

  /**
   * Open the serial port connection.
   */
  public open(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isOpen()) {
        resolve();
        return;
      }

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
        autoOpen: false,
      });

      this.port.on('data', (data: Buffer) => {
        this.emit('data', data);

        // Process line buffer if there are 'line' listeners
        if (this.listenerCount('line') > 0) {
          this.lineBuffer += data.toString('utf8');
          const lines = this.lineBuffer.split(this.lineDelimiter);
          // Keep incomplete line snippet in buffer
          this.lineBuffer = lines.pop() ?? '';
          for (const line of lines) {
            this.emit('line', line.replace(/\r$/, ''));
          }
        }
      });

      this.port.on('error', (err: Error) => {
        this.emit('error', err);
      });

      this.port.on('close', () => {
        this.emit('close');
      });

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
   * Close the serial port connection.
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        this.port = null;
        resolve();
        return;
      }

      this.port.close((err) => {
        this.port = null;
        this.lineBuffer = '';
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Write data to the serial port.
   * Resolves when the write (and optionally drain) operation completes.
   */
  public write(
    data: string | Buffer | Uint8Array,
    options?: WriteOptions
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.isOpen() || !this.port) {
        reject(new Error(`Cannot write: Serial port ${this.config.path} is not open.`));
        return;
      }

      const encoding = options?.encoding ?? 'utf8';
      const shouldDrain = options?.drain ?? true;
      const timeoutMs = options?.timeoutMs;

      let timer: NodeJS.Timeout | null = null;
      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          reject(new Error(`Write operation timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }

      const cleanup = () => {
        if (timer) clearTimeout(timer);
      };

      const payload = typeof data === 'string' ? Buffer.from(data, encoding) : Buffer.from(data);
      const bytesToWrite = payload.length;

      this.port.write(payload, encoding, (err) => {
        if (err) {
          cleanup();
          reject(err);
          return;
        }

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
   * Read next data payload asynchronously with a timeout.
   */
  public read(options?: ReadOptions | number): Promise<Buffer | string> {
    const opts: ReadOptions = typeof options === 'number' ? { timeoutMs: options } : options ?? {};
    const timeoutMs = opts.timeoutMs ?? 5000;

    return new Promise((resolve, reject) => {
      if (!this.isOpen()) {
        reject(new Error(`Cannot read: Serial port ${this.config.path} is not open.`));
        return;
      }

      let timer: NodeJS.Timeout | null = null;

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

      const onError = (err: Error) => {
        if (timer) clearTimeout(timer);
        this.removeListener('data', onData);
        this.removeListener('error', onError);
        reject(err);
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.removeListener('data', onData);
          this.removeListener('error', onError);
          reject(new Error(`Read timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }

      this.on('data', onData);
      this.on('error', onError);
    });
  }

  /**
   * Read next single line asynchronously with a timeout.
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

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.removeListener('data', onData);
        this.removeListener('error', onError);
      };

      const onData = (data: Buffer) => {
        accumulated += data.toString('utf8');
        const idx = accumulated.indexOf(lineDelim);
        if (idx !== -1) {
          const line = accumulated.slice(0, idx).replace(/\r$/, '');
          cleanup();
          resolve(line);
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

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
   * Flush both receive and transmit buffer of the serial port.
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
   * Wait for all written data to be transmitted.
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
