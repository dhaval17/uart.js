export type DataBits = 5 | 6 | 7 | 8;
export type StopBits = 1 | 1.5 | 2;
export type Parity = 'none' | 'even' | 'odd' | 'mark' | 'space';

export interface UartConfig {
  /** Serial device path (e.g. '/dev/ttyUSB0', '/dev/ttyACM0', 'COM3') */
  path: string;
  /** Baud rate (e.g., 9600, 115200). Defaults to 115200 if not specified. */
  baudRate?: number;
  /** Number of data bits per frame. Defaults to 8. */
  dataBits?: DataBits;
  /** Number of stop bits per frame. Defaults to 1. */
  stopBits?: StopBits;
  /** Parity bit mode. Defaults to 'none'. */
  parity?: Parity;
  /** Whether to automatically open the port upon creation. Defaults to false. */
  autoOpen?: boolean;
  /** Hardware flow control (RTS/CTS). Defaults to false. */
  rtscts?: boolean;
  /** Software flow control (XON). Defaults to false. */
  xon?: boolean;
  /** Software flow control (XOFF). Defaults to false. */
  xoff?: boolean;
  /** Software flow control (XANY). Defaults to false. */
  xany?: boolean;
  /** Hangup on close. Defaults to true. */
  hupcl?: boolean;
  /** Custom serial port binding (useful for unit testing with @serialport/binding-mock). */
  binding?: any;
}

export interface WriteOptions {
  /** String encoding when writing string data. Defaults to 'utf8'. */
  encoding?: BufferEncoding;
  /** Whether to wait for OS write buffer to drain before resolving. Defaults to true. */
  drain?: boolean;
  /** Maximum time in milliseconds to wait for write/drain completion. */
  timeoutMs?: number;
}

export interface ReadOptions {
  /** Maximum time in milliseconds to wait for incoming data. */
  timeoutMs?: number;
  /** Character encoding to return as string. If omitted, returns Buffer. */
  encoding?: BufferEncoding;
}

export interface UartCandidate {
  baudRate: number;
  dataBits: DataBits;
  stopBits: StopBits;
  parity: Parity;
  /** Fraction of printable ASCII characters in sample (0.0 to 1.0) */
  readableRatio: number;
  /** Fraction of line breaks (\r, \n) in sample (0.0 to 1.0) */
  lineBreakRatio: number;
  /** Shannon entropy of sampled bytes (bits per byte, 0.0 to 8.0) */
  entropy: number;
  /** Overall heuristic score (higher means higher probability of being correct parameters) */
  score: number;
  /** First 2048 characters of the captured sample */
  sample: string;
}

export interface AnalysisOptions {
  /** List of baud rates to test. Defaults to common baud rates. */
  baudRates?: number[];
  /** Data bits to test. Defaults to [8, 7]. */
  dataBitsList?: DataBits[];
  /** Stop bits to test. Defaults to [1, 2]. */
  stopBitsList?: StopBits[];
  /** Parities to test. Defaults to ['none', 'even', 'odd']. */
  parityList?: Parity[];
  /** Timeout in ms per individual parameter combination test. Defaults to 1000ms. */
  testTimeoutMs?: number;
  /** Duration in ms to accumulate sample data per test. Defaults to 600ms. */
  sampleTimeoutMs?: number;
  /** Minimum score threshold (0.0 - 1.0) for early exit when a strong candidate is found. Defaults to 0.85. */
  earlyExitScore?: number;
  /** Custom serial port binding (useful for unit testing with @serialport/binding-mock). */
  binding?: any;
}

export interface UartAnalysisResult {
  path: string;
  candidates: UartCandidate[];
  best?: UartCandidate;
  notes: string[];
}

export interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  vendorId?: string;
  productId?: string;
}
