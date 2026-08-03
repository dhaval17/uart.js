import { SerialPort } from 'serialport';

// Define the initialization options
export interface UartConfig {
  path: string;       // e.g., '/dev/ttyUSB0' or 'COM3'
  baudRate?: number;  // Optional: if omitted, the script will auto-detect
  dataBits?: 8 | 7 | 6 | 5;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'mark' | 'odd' | 'space';
}

export interface UartCandidate {
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'mark' | 'odd' | 'space';
  readableRatio: number; // fraction of printable ASCII characters
  lineBreakRatio: number; // fraction of linebreaks in sample
  sample: string; // small text sample
  score: number; // final heuristic score
}

export interface UartAnalysisResult {
  path: string;
  candidates: UartCandidate[]; // sorted by score desc
  best?: UartCandidate;
  notes?: string[];
}

export class UartListener {
  private port: SerialPort | null = null;
  private config: UartConfig;
  
  // Ordered from fastest/most common to slowest
  private readonly COMMON_BAUD_RATES = [115200, 57600, 38400, 19200, 9600, 4800, 2400, 1200];

  constructor(config: UartConfig) {
    this.config = config;

    // Only initialize automatically if the baud rate is known
    if (this.config.baudRate) {
      this.initPort(this.config.baudRate);
    }
  }

  /**
   * Helper to initialize or re-initialize the SerialPort instance
   */
  private initPort(baudRate: number) {
    if (this.port?.isOpen) {
      this.port.close();
    }
    this.port = new SerialPort({
      path: this.config.path,
      baudRate: baudRate,
      dataBits: this.config.dataBits || 8,
      stopBits: this.config.stopBits || 1,
      parity: this.config.parity || 'none',
      autoOpen: false,
    });
  }

  /**
   * Checks and returns the current configured baud rate.
   */
  public getBaudRate(): number | undefined {
    return this.port?.baudRate;
  }

  /**
   * Attempts to detect the correct baud rate by reading data and checking for valid ASCII.
   */
  public async detectBaudRate(): Promise<number> {
    console.log(`[UART Module] Starting auto-baud detection on ${this.config.path}...`);
    
    for (const baud of this.COMMON_BAUD_RATES) {
      console.log(`[UART Module] Testing ${baud} baud...`);
      this.initPort(baud);
      
      try {
        // Listen for up to 1500ms to see if we get valid readable data
        const isValid = await this.testCurrentBaudRate(1500); 
        if (isValid) {
          console.log(`[UART Module] Success! Appropriate baud rate detected: ${baud}`);
          this.config.baudRate = baud;
          return baud;
        }
      } catch (err) {
        console.error(`[UART Module] Error testing ${baud} baud:`, err);
      } finally {
        if (this.port?.isOpen) {
          this.port.close();
        }
      }
    }
    throw new Error('Failed to detect a valid baud rate. No readable ASCII data received.');
  }

  /**
   * Opens the port and checks if the incoming data stream contains readable characters.
   */
  private testCurrentBaudRate(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.port) return resolve(false);

      const timeout = setTimeout(() => {
        resolve(false); // Timeout reached without receiving any valid data
      }, timeoutMs);

      this.port.on('data', (data: Buffer) => {
        const str = data.toString('utf8');
        // Heuristic: Check if data consists of typical printable ASCII characters and whitespace.
        // A mismatched baud rate usually results in random replacement characters () or control chars.
        const isReadableASCII = /^[\x09\x0A\x0D\x20-\x7E]+$/.test(str);
        
        if (isReadableASCII && str.trim().length > 0) {
          clearTimeout(timeout);
          resolve(true);
        }
      });

      this.port.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

      this.port.open((err) => {
        if (err) {
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });
  }

  /**
   * Opens the connection, verifying or detecting the baud rate, and starts listening for data.
   * @param onData Callback fired when data is received
   * @param onError Optional callback for handling errors
   */
  public async startListening(
    onData: (data: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    
    // Auto-detect if baud rate wasn't provided in the config
    if (!this.config.baudRate) {
      try {
        await this.detectBaudRate();
        this.initPort(this.config.baudRate!); // Set up port with the discovered rate
      } catch (err) {
        if (onError) onError(err as Error);
        return;
      }
    } else if (!this.port) {
      this.initPort(this.config.baudRate);
    }

    if (this.port && !this.port.isOpen) {
      this.port.open((err) => {
        if (err) {
          if (onError) onError(err);
          return;
        }
        const currentBaud = this.getBaudRate();
        console.log(`[UART Module] Successfully connected to ${this.config.path} at ${currentBaud} baud.`);
      });
    }

    // Listen for incoming data
    this.port?.on('data', (data: Buffer) => {
      onData(data.toString('utf8'));
    });

    this.port?.on('error', (err) => {
      if (onError) onError(err);
    });
  }

  /**
   * Gracefully closes the serial port.
   */
  public stopListening(): void {
    if (this.port?.isOpen) {
      this.port.close();
    }
  }

  /**
   * Analyse a given UART path by iterating through common baud rates, dataBits, stopBits and parity
   * combinations. For each combination we collect a small sample and compute heuristics such as
   * readable ASCII ratio and linebreak frequency. Returns a ranked list of candidates and the best match.
   *
   * This function does not mutate the instance config.path unless you want it to — it accepts a path
   * parameter so it can be run ad-hoc without changing the listener's configuration.
   */
  public async analyseUART(
    path: string,
    options?: { timeoutMs?: number; sampleTimeoutMs?: number }
  ): Promise<UartAnalysisResult> {
    const timeoutMs = options?.timeoutMs ?? 1000; // per-combination timeout
    const sampleTimeoutMs = options?.sampleTimeoutMs ?? 600; // reading window

    const baudRates = this.COMMON_BAUD_RATES;
    const dataBitsOptions: Array<8 | 7 | 6 | 5> = [8, 7, 6, 5];
    const stopBitsOptions: Array<1 | 2> = [1, 2];
    const parityOptions: Array<'none' | 'even' | 'mark' | 'odd' | 'space'> = ['none', 'even', 'odd', 'mark', 'space'];

    const candidates: UartCandidate[] = [];

    // Helper to open port for a specific combination and read a sample
    const testCombination = (baudRate: number, dataBits: number, stopBits: number, parity: UartCandidate['parity']): Promise<UartCandidate | null> => {
      return new Promise((resolve) => {
        const localPort = new SerialPort({
          path,
          baudRate,
          dataBits,
          stopBits,
          parity,
          autoOpen: false,
        });

        let collected = Buffer.alloc(0);
        const timeout = setTimeout(() => {
          // evaluate whatever we have (maybe empty)
          finalize();
        }, timeoutMs);

        const sampleTimeout = setTimeout(() => {
          // stop reading after sampleTimeoutMs but allow overall timeout to still close
          finalize();
        }, sampleTimeoutMs);

        const onData = (data: Buffer) => {
          collected = Buffer.concat([collected, data]);
          // Keep collected sample reasonably small
          if (collected.length > 2048) collected = collected.slice(-2048);
        };

        const onError = () => {
          clearTimeout(timeout);
          clearTimeout(sampleTimeout);
          try { if (localPort.isOpen) localPort.close(); } catch (e) {/* ignore */}
          resolve(null);
        };

        const finalize = () => {
          clearTimeout(timeout);
          clearTimeout(sampleTimeout);
          localPort.removeListener('data', onData);
          localPort.removeListener('error', onError);
          if (localPort.isOpen) {
            localPort.close(() => { /* closed */ });
          }

          const str = collected.toString('utf8');
          const len = str.length;
          let printable = 0;
          let linebreaks = 0;
          for (let i = 0; i < len; i++) {
            const code = str.charCodeAt(i);
            if (code === 10 || code === 13) linebreaks++;
            if ((code >= 0x20 && code <= 0x7E) || code === 9 || code === 10 || code === 13) printable++;
          }
          const readableRatio = len === 0 ? 0 : printable / len;
          const lineBreakRatio = len === 0 ? 0 : linebreaks / len;

          // Heuristic score: readableRatio weighted more, but prefer presence of line breaks / structured data
          const score = readableRatio * 0.7 + Math.min(1, lineBreakRatio * 5) * 0.3;

          resolve({
            baudRate,
            dataBits,
            stopBits,
            parity,
            readableRatio,
            lineBreakRatio,
            sample: str.slice(0, 1024),
            score,
          });
        };

        localPort.on('data', onData);
        localPort.on('error', onError);

        localPort.open((err) => {
          if (err) {
            clearTimeout(timeout);
            clearTimeout(sampleTimeout);
            resolve(null);
            return;
          }

          // If no data events arrive, the timeouts will trigger finalize
        });
      });
    };

    // Iterate combinations but limit total number to avoid extremely long runs
    // We'll attempt all baud rates × dataBits × stopBits × parity but bail early if we've found a very good candidate
    for (const baud of baudRates) {
      for (const dataBits of dataBitsOptions) {
        for (const stopBits of stopBitsOptions) {
          for (const parity of parityOptions) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const result = await testCombination(baud, dataBits, stopBits, parity);
              if (result) {
                candidates.push(result);
                // If we find a near-perfect read, early exit
                if (result.readableRatio > 0.98 && result.lineBreakRatio > 0.02) {
                  // Very likely correct
                  const sorted = candidates.sort((a, b) => b.score - a.score);
                  return { path, candidates: sorted, best: sorted[0], notes: ['Early exit: very high quality match found'] };
                }
              }
            } catch (err) {
              // ignore single-combination failures
            }
          }
        }
      }
    }

    // Sort candidates by score descending
    const sorted = candidates.sort((a, b) => b.score - a.score);
    const notes: string[] = [];
    if (sorted.length === 0) {
      notes.push('No readable data detected for any tested combination.');
    } else {
      notes.push(`Tested ${sorted.length} successful combinations.`);
      notes.push(`Top candidate: ${sorted[0].baudRate} baud, dataBits=${sorted[0].dataBits}, stopBits=${sorted[0].stopBits}, parity=${sorted[0].parity}`);
    }

    return { path, candidates: sorted, best: sorted[0], notes };
  }
}
