/**
 * @file types.ts
 * @description Type definitions and interfaces for @dhaval/uart.js library.
 * 
 * Provides strong TypeScript typings for UART port configuration, read/write options,
 * auto-detection parameters, candidate scoring metrics, and hardware port information.
 */

/** Valid data bit widths supported by UART controllers (5, 6, 7, or 8 bits per frame). */
export type DataBits = 5 | 6 | 7 | 8;

/** Valid stop bit configurations (1, 1.5, or 2 bits per frame). */
export type StopBits = 1 | 1.5 | 2;

/** Parity bit verification modes ('none', 'even', 'odd', 'mark', or 'space'). */
export type Parity = 'none' | 'even' | 'odd' | 'mark' | 'space';

/**
 * Configuration options required to instantiate a `UartPort`.
 */
export interface UartConfig {
  /** Serial device path (e.g. '/dev/ttyUSB0', '/dev/ttyACM0', 'COM3', '/dev/pts/2'). */
  path: string;

  /** Communication speed in symbols/bits per second (e.g., 9600, 115200). Defaults to 115200. */
  baudRate?: number;

  /** Number of data payload bits in each frame. Defaults to 8. */
  dataBits?: DataBits;

  /** Number of stop bits signalling frame completion. Defaults to 1. */
  stopBits?: StopBits;

  /** Parity checking mode for error detection. Defaults to 'none'. */
  parity?: Parity;

  /** Whether to automatically open the physical serial connection upon class construction. Defaults to false. */
  autoOpen?: boolean;

  /** Enable Hardware flow control via RTS (Request to Send) / CTS (Clear to Send) signals. Defaults to false. */
  rtscts?: boolean;

  /** Enable Software flow control via XON character transmission. Defaults to false. */
  xon?: boolean;

  /** Enable Software flow control via XOFF character transmission. Defaults to false. */
  xoff?: boolean;

  /** Enable Software flow control continuation via XANY character. Defaults to false. */
  xany?: boolean;

  /** Hangup (close DTR signal) when closing the serial port device file. Defaults to true. */
  hupcl?: boolean;

  /** Custom underlying binding backend (useful for testing with `@serialport/binding-mock`). */
  binding?: any;
}

/**
 * Options for configuring asynchronous write operations on `UartPort`.
 */
export interface WriteOptions {
  /** Text encoding format when writing string data. Defaults to 'utf8'. */
  encoding?: BufferEncoding;

  /** 
   * Whether to wait until all buffered bytes are physically transmitted 
   * to the underlying hardware device before resolving the Promise. Defaults to true.
   */
  drain?: boolean;

  /** Maximum time in milliseconds to wait for write and drain operations to complete before throwing a timeout error. */
  timeoutMs?: number;
}

/**
 * Options for configuring asynchronous single-read operations on `UartPort`.
 */
export interface ReadOptions {
  /** Maximum duration in milliseconds to wait for data arrival before throwing a timeout error. Defaults to 5000ms. */
  timeoutMs?: number;

  /** Character encoding format. If specified, `read()` returns a string; if omitted, returns a raw Buffer. */
  encoding?: BufferEncoding;
}

/**
 * Evaluated UART configuration candidate generated during auto-detection analysis (`analyzeUart`).
 */
export interface UartCandidate {
  /** Baud rate speed tested for this candidate (e.g. 115200). */
  baudRate: number;

  /** Data bits tested for this candidate (e.g. 8). */
  dataBits: DataBits;

  /** Stop bits tested for this candidate (e.g. 1). */
  stopBits: StopBits;

  /** Parity mode tested for this candidate (e.g. 'none'). */
  parity: Parity;

  /** Proportion of printable ASCII characters detected in the sample (value ranges from 0.0 to 1.0). */
  readableRatio: number;

  /** Proportion of line breaks (\r, \n) detected in the sample (value ranges from 0.0 to 1.0). */
  lineBreakRatio: number;

  /** Shannon entropy measurement of the sampled payload (bits per byte, ranges from 0.0 to 8.0). */
  entropy: number;

  /** 
   * Overall calculated probability score (0.0 to 1.0).
   * Weighted combination of readable ASCII (60%), line breaks (25%), and low entropy (15%).
   */
  score: number;

  /** Preview snippet of up to the first 2048 characters decoded during sampling. */
  sample: string;
}

/**
 * Information describing current progress of a UART analysis parameter sweep.
 */
export interface AnalysisProgress {
  /** Current step index (1-based). */
  current: number;

  /** Total number of parameter combinations to be tested. */
  total: number;

  /** Calculated percentage of completed sweep iterations (0.0 to 100.0). */
  percentage: number;

  /** Configuration parameters currently being evaluated. */
  currentConfig: {
    baudRate: number;
    dataBits: DataBits;
    stopBits: StopBits;
    parity: Parity;
  };

  /** The top candidate configuration found so far, if any. */
  bestCandidate?: UartCandidate;
}

/**
 * Options to customize the auto-detection sweep performed by `UartAnalyzer`.
 */
export interface AnalysisOptions {
  /** List of baud rates to test sequentially. Defaults to `COMMON_BAUD_RATES`. */
  baudRates?: number[];

  /** List of data bit sizes to test. Defaults to `[8, 7]`. */
  dataBitsList?: DataBits[];

  /** List of stop bit lengths to test. Defaults to `[1, 2]`. */
  stopBitsList?: StopBits[];

  /** List of parity modes to test. Defaults to `['none', 'even', 'odd']`. */
  parityList?: Parity[];

  /** Total timeout allowance per parameter test in milliseconds. Defaults to 1000ms. */
  testTimeoutMs?: number;

  /** Window duration in milliseconds to accumulate incoming serial data per test iteration. Defaults to 600ms. */
  sampleTimeoutMs?: number;

  /** Score threshold (0.0 to 1.0). If a candidate exceeds this score, analysis halts immediately. Defaults to 0.85. */
  earlyExitScore?: number;

  /** Custom underlying binding backend (useful for testing with `@serialport/binding-mock`). */
  binding?: any;

  /** Whether to render a live visual progress bar to stdout/stderr during analysis. Defaults to false. */
  showProgressBar?: boolean;

  /** Custom writable stream for progress bar output. Defaults to `process.stdout`. */
  progressStream?: NodeJS.WritableStream;

  /** Callback function invoked at each step of the analysis sweep with progress updates. */
  onProgress?: (progress: AnalysisProgress) => void;
}

/**
 * Detailed output produced after completing UART configuration auto-detection.
 */
export interface UartAnalysisResult {
  /** Device file path of analyzed serial port. */
  path: string;

  /** All successfully tested candidate configurations, sorted in descending order by score. */
  candidates: UartCandidate[];

  /** The top-ranked candidate configuration, or `undefined` if no readable data was detected. */
  best?: UartCandidate;

  /** Log messages and notes detailing the progression of the analysis sweep. */
  notes: string[];
}

/**
 * Information structure representing a physical or virtual serial port attached to the host system.
 */
export interface PortInfo {
  /** System path identifying the port (e.g. '/dev/ttyUSB0', 'COM1', '/dev/pts/2'). */
  path: string;

  /** Name of the device manufacturer (if reported by OS/driver). */
  manufacturer?: string;

  /** Hardware serial number string. */
  serialNumber?: string;

  /** Plug-and-Play (PnP) subsystem identifier. */
  pnpId?: string;

  /** Physical USB topology location ID. */
  locationId?: string;

  /** USB Vendor Identifier (VID) hex string. */
  vendorId?: string;

  /** USB Product Identifier (PID) hex string. */
  productId?: string;
}
