/**
 * @file utils.ts
 * @description Utility functions and constants for serial port enumeration,
 * information theory analysis (Shannon entropy), and ASCII readability statistics.
 */

import { SerialPort } from 'serialport';
import { PortInfo } from './types';

/**
 * Standard UART baud rates frequently utilized across embedded hardware,
 * microcontrollers (Arduino, ESP32, STM32), and serial adapters.
 * Ordered from highest probability / standard rates downwards.
 */
export const COMMON_BAUD_RATES = [
  115200, 9600, 57600, 38400, 19200, 4800, 2400, 1200, 230400, 460800, 921600
];

/**
 * Enumerates all serial ports currently available on the operating system.
 * 
 * Returns an array of `PortInfo` objects containing path names and hardware metadata
 * such as manufacturer, vendor ID, and product ID.
 *
 * @returns Promise resolving to an array of detected serial ports.
 * 
 * @example
 * ```typescript
 * const ports = await listPorts();
 * ports.forEach(p => console.log(`Found port ${p.path} (${p.manufacturer})`));
 * ```
 */
export async function listPorts(): Promise<PortInfo[]> {
  // Query underlying system serial port list via serialport library
  const ports = await SerialPort.list();
  
  // Map internal raw port records to structured PortInfo instances
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
 * Calculates the Shannon Entropy of a binary data buffer.
 * 
 * Formula: H(X) = - Σ (P(x_i) * log2(P(x_i)))
 * 
 * Shannon entropy measures the randomness or information density of byte sequences:
 * - Entropy near 0.0: Highly predictable, uniform byte values (e.g. repeated characters).
 * - Entropy ~3.5 to 5.0: Typical structured ASCII text or log streams.
 * - Entropy near 8.0: High randomness, compressed data, or garbage noise from incorrect baud rate framing.
 *
 * @param buffer - Data buffer to evaluate.
 * @returns Entropy score in bits per byte (0.0 to 8.0).
 */
export function calculateEntropy(buffer: Buffer): number {
  // Return zero entropy for empty or missing buffers
  if (!buffer || buffer.length === 0) return 0;

  // Step 1: Count frequency of each byte value (0 to 255)
  const counts = new Array<number>(256).fill(0);
  for (let i = 0; i < buffer.length; i++) {
    counts[buffer[i]]++;
  }

  // Step 2: Compute Shannon entropy sum across present byte values
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (counts[i] === 0) continue; // Skip byte values with zero occurrences
    
    // Probability of occurrence P(x_i)
    const p = counts[i] / buffer.length;
    
    // Accumulate entropy: - P(x) * log2(P(x))
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Analyzes a binary buffer to compute ASCII readability ratios and extract sample text.
 * 
 * Useful for automated baud rate and framing detection by evaluating how closely
 * incoming serial bytes resemble human-readable text and line-oriented protocols.
 *
 * @param buffer - Data buffer to inspect.
 * @returns Object containing readable character ratio, line break ratio, and sample text preview.
 */
export function calculateAsciiStats(buffer: Buffer): {
  readableRatio: number;
  lineBreakRatio: number;
  sampleText: string;
} {
  // Handle empty or zero-length buffer safely
  if (!buffer || buffer.length === 0) {
    return { readableRatio: 0, lineBreakRatio: 0, sampleText: '' };
  }

  // Decode buffer bytes into UTF-8 text string
  const str = buffer.toString('utf8');
  const len = str.length;
  let printableCount = 0;
  let lineBreakCount = 0;

  // Inspect each character code in decoded string
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    
    // Count carriage return (\r: 13) and line feed (\n: 10)
    if (code === 10 || code === 13) lineBreakCount++;

    // Check if character code falls within printable ASCII range (0x20-0x7E) or whitespace (\t, \n, \r)
    if ((code >= 0x20 && code <= 0x7E) || code === 9 || code === 10 || code === 13) {
      printableCount++;
    }
  }

  return {
    // Ratio of printable ASCII characters relative to total decoded length
    readableRatio: len === 0 ? 0 : printableCount / len,
    // Ratio of line break control characters relative to total length
    lineBreakRatio: len === 0 ? 0 : lineBreakCount / len,
    // Truncate text sample preview to a maximum of 2048 characters
    sampleText: str.slice(0, 2048),
  };
}
