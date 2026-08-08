import { SerialPort } from 'serialport';
import { PortInfo } from './types';

export const COMMON_BAUD_RATES = [
  115200, 9600, 57600, 38400, 19200, 4800, 2400, 1200, 230400, 460800, 921600
];

/**
 * List all available serial ports on the system.
 */
export async function listPorts(): Promise<PortInfo[]> {
  const ports = await SerialPort.list();
  return ports.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer,
    serialNumber: p.serialNumber,
    pnpId: p.pnpId,
    locationId: p.locationId,
    vendorId: p.vendorId,
    productId: p.productId,
  }));
}

/**
 * Calculate the Shannon entropy of a binary buffer (bits per byte, 0.0 to 8.0).
 * Lower entropy generally indicates structured text/ASCII data, while near 8.0 indicates random noise or binary.
 */
export function calculateEntropy(buffer: Buffer): number {
  if (!buffer || buffer.length === 0) return 0;
  const counts = new Array<number>(256).fill(0);
  for (let i = 0; i < buffer.length; i++) {
    counts[buffer[i]]++;
  }
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (counts[i] === 0) continue;
    const p = counts[i] / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Analyze buffer for ASCII readability metrics.
 */
export function calculateAsciiStats(buffer: Buffer): {
  readableRatio: number;
  lineBreakRatio: number;
  sampleText: string;
} {
  if (!buffer || buffer.length === 0) {
    return { readableRatio: 0, lineBreakRatio: 0, sampleText: '' };
  }

  const str = buffer.toString('utf8');
  const len = str.length;
  let printableCount = 0;
  let lineBreakCount = 0;

  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    if (code === 10 || code === 13) lineBreakCount++; // \n or \r
    if ((code >= 0x20 && code <= 0x7E) || code === 9 || code === 10 || code === 13) {
      printableCount++;
    }
  }

  return {
    readableRatio: len === 0 ? 0 : printableCount / len,
    lineBreakRatio: len === 0 ? 0 : lineBreakCount / len,
    sampleText: str.slice(0, 2048),
  };
}
