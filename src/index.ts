import { SerialPort } from 'serialport';

// Define the initialization options
export interface UartConfig {
  path: string;       // e.g., '/dev/ttyUSB0' or 'COM3'
  baudRate?: number;  // Optional: if omitted, the script will auto-detect
  dataBits?: 8 | 7 | 6 | 5;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'mark' | 'odd' | 'space';
}

export class UartListener {
  private port: SerialPort | null = null;
  private config: UartConfig;
  
  // Ordered from fastest/most common to slowest
  private readonly COMMON_BAUD_RATES = [115200, 57600, 38400, 19200, 9600, 4800];

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
}
