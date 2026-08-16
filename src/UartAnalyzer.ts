/**
 * @file UartAnalyzer.ts
 * @description Automated UART baud rate, framing, and parity detection tool.
 * 
 * Sequentially sweeps through parameter permutations (baud rate, data bits, stop bits, parity),
 * samples incoming bytes, and computes heuristic metrics (printable ASCII ratio, line breaks, Shannon entropy)
 * to accurately identify active serial port configurations without manual guessing.
 */

import { SerialPort } from 'serialport';
import {
  AnalysisOptions,
  DataBits,
  Parity,
  StopBits,
  UartAnalysisResult,
  UartCandidate,
} from './types';
import { calculateAsciiStats, calculateEntropy, COMMON_BAUD_RATES } from './utils';

/**
 * `UartAnalyzer` automates serial communication configuration discovery.
 * 
 * Useful when connecting to unknown hardware devices (microcontrollers, industrial sensors, routers)
 * where baud rate or framing settings are unspecified or unknown.
 */
export class UartAnalyzer {
  /**
   * Analyzes a target serial device path by performing a parameter sweep.
   * 
   * Iterates through combinations of baud rate, data bits, stop bits, and parity.
   * Ranks candidates based on a weighted scoring algorithm:
   * - **Printable ASCII Ratio (60%)**: Measures proportion of readable characters.
   * - **Line Break Frequency (25%)**: Checks presence of protocol line terminations (`\r`, `\n`).
   * - **Low Shannon Entropy (15%)**: Distinguishes structured text from random garbage or framing errors.
   * 
   * @param path - Serial device path (e.g. '/dev/ttyUSB0', 'COM4').
   * @param options - Analysis parameters (baud rate lists, test durations, early exit threshold).
   * @returns Promise resolving to `UartAnalysisResult` containing ranked candidates and top match.
   * 
   * @example
   * ```typescript
   * const analyzer = new UartAnalyzer();
   * const result = await analyzer.analyze('/dev/ttyUSB0', { testTimeoutMs: 800 });
   * console.log('Best match:', result.best);
   * ```
   */
  public async analyze(
    path: string,
    options?: AnalysisOptions
  ): Promise<UartAnalysisResult> {
    // Extract user options or assign standard defaults
    const baudRates = options?.baudRates ?? COMMON_BAUD_RATES;
    const dataBitsList: DataBits[] = options?.dataBitsList ?? [8, 7];
    const stopBitsList: StopBits[] = options?.stopBitsList ?? [1, 2];
    const parityList: Parity[] = options?.parityList ?? ['none', 'even', 'odd'];

    const testTimeoutMs = options?.testTimeoutMs ?? 1000;
    const sampleTimeoutMs = options?.sampleTimeoutMs ?? 600;
    const earlyExitScore = options?.earlyExitScore ?? 0.85;

    const candidates: UartCandidate[] = [];
    const notes: string[] = [];

    // Begin nested parameter sweep loops
    for (const baudRate of baudRates) {
      for (const dataBits of dataBitsList) {
        for (const stopBits of stopBitsList) {
          for (const parity of parityList) {
            try {
              // Test individual configuration combination
              const candidate = await this.testCombination({
                path,
                baudRate,
                dataBits,
                stopBits,
                parity,
                testTimeoutMs,
                sampleTimeoutMs,
                binding: options?.binding,
              });

              // If candidate produced readable data (score > 0), record it
              if (candidate && candidate.score > 0) {
                candidates.push(candidate);

                // Check if score satisfies early exit criteria (avoids scanning remaining slow rates)
                if (candidate.score >= earlyExitScore) {
                  const sorted = candidates.sort((a, b) => b.score - a.score);
                  notes.push(
                    `Early exit triggered: found strong candidate (${candidate.baudRate} baud, ${candidate.dataBits}N${candidate.stopBits}, parity: ${candidate.parity}) with score ${candidate.score.toFixed(2)}.`
                  );
                  return {
                    path,
                    candidates: sorted,
                    best: sorted[0],
                    notes,
                  };
                }
              }
            } catch {
              // Ignore individual combination failures (e.g., unsupported baud rates by OS driver)
            }
          }
        }
      }
    }

    // Sort all accumulated candidates in descending order by calculated score
    const sorted = candidates.sort((a, b) => b.score - a.score);
    if (sorted.length === 0) {
      notes.push('No readable data detected for any tested UART combination.');
    } else {
      notes.push(`Completed analysis of ${sorted.length} successful parameter combinations.`);
      const top = sorted[0];
      notes.push(
        `Top candidate: ${top.baudRate} baud, ${top.dataBits} dataBits, ${top.stopBits} stopBits, ${top.parity} parity (Score: ${top.score.toFixed(2)})`
      );
    }

    return {
      path,
      candidates: sorted,
      best: sorted[0],
      notes,
    };
  }

  /**
   * Helper method testing a single parameter permutation.
   * Opens port, collects incoming data for sample duration, and scores the result.
   */
  private testCombination(params: {
    path: string;
    baudRate: number;
    dataBits: DataBits;
    stopBits: StopBits;
    parity: Parity;
    testTimeoutMs: number;
    sampleTimeoutMs: number;
    binding?: any;
  }): Promise<UartCandidate | null> {
    return new Promise((resolve) => {
      // Create temporary SerialPort instance for test iteration
      const port = new SerialPort({
        path: params.path,
        baudRate: params.baudRate,
        dataBits: params.dataBits,
        stopBits: params.stopBits,
        parity: params.parity,
        ...(params.binding ? { binding: params.binding } : {}),
        autoOpen: false,
      });

      let bufferAcc = Buffer.alloc(0);
      let isFinalized = false;

      // Overall safety timer preventing hanging test calls
      const overallTimer = setTimeout(() => {
        finalize();
      }, params.testTimeoutMs);

      // Sampling timer defining maximum duration to accumulate data bytes
      const sampleTimer = setTimeout(() => {
        finalize();
      }, params.sampleTimeoutMs);

      // Listener to accumulate incoming binary bytes
      const onData = (data: Buffer) => {
        bufferAcc = Buffer.concat([bufferAcc, data]);
        // Cap sample buffer size to latest 4096 bytes to avoid memory bloat
        if (bufferAcc.length > 4096) {
          bufferAcc = bufferAcc.subarray(bufferAcc.length - 4096);
        }
      };

      // Listener for serial errors during sampling
      const onError = () => {
        finalize();
      };

      // Cleanup and candidate evaluation function
      const finalize = () => {
        if (isFinalized) return;
        isFinalized = true;

        clearTimeout(overallTimer);
        clearTimeout(sampleTimer);

        port.removeListener('data', onData);
        port.removeListener('error', onError);

        const closePort = () => {
          // If no data was received during sample window, candidate is invalid
          if (bufferAcc.length === 0) {
            resolve(null);
            return;
          }

          // Calculate ASCII readability and entropy metrics
          const { readableRatio, lineBreakRatio, sampleText } = calculateAsciiStats(bufferAcc);
          const entropy = calculateEntropy(bufferAcc);

          // Calculate entropy score component (lower entropy produces higher score, max entropy = 8.0)
          const entropyScore = 1 - Math.min(1, entropy / 8);

          // Weighted scoring formula:
          // - 60% weight on printable ASCII character ratio
          // - 25% weight on presence of line breaks (\r, \n)
          // - 15% weight on low Shannon entropy (predictable structure vs random noise)
          const score =
            readableRatio * 0.6 +
            Math.min(1, lineBreakRatio * 5) * 0.25 +
            entropyScore * 0.15;

          resolve({
            baudRate: params.baudRate,
            dataBits: params.dataBits,
            stopBits: params.stopBits,
            parity: params.parity,
            readableRatio,
            lineBreakRatio,
            entropy,
            score,
            sample: sampleText,
          });
        };

        // Close temporary port safely
        if (port.isOpen) {
          port.close(() => closePort());
        } else {
          closePort();
        }
      };

      port.on('data', onData);
      port.on('error', onError);

      // Open serial port for sampling
      port.open((err) => {
        if (err) {
          clearTimeout(overallTimer);
          clearTimeout(sampleTimer);
          resolve(null);
        }
      });
    });
  }
}

/**
 * Standalone convenience function to run automated UART analysis on a serial port path.
 * 
 * @param path - Serial port path to analyze.
 * @param options - Optional analysis configuration options.
 * @returns Promise resolving to analysis results.
 * 
 * @example
 * ```typescript
 * import { analyzeUart } from '@dhaval/uart.js';
 * const result = await analyzeUart('/dev/ttyUSB0');
 * ```
 */
export async function analyzeUart(
  path: string,
  options?: AnalysisOptions
): Promise<UartAnalysisResult> {
  const analyzer = new UartAnalyzer();
  return analyzer.analyze(path, options);
}
