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

export class UartAnalyzer {
  /**
   * Analyze a serial port path by testing parameter combinations (baud rate, data bits, stop bits, parity)
   * to detect the active UART configuration.
   */
  public async analyze(
    path: string,
    options?: AnalysisOptions
  ): Promise<UartAnalysisResult> {
    const baudRates = options?.baudRates ?? COMMON_BAUD_RATES;
    const dataBitsList: DataBits[] = options?.dataBitsList ?? [8, 7];
    const stopBitsList: StopBits[] = options?.stopBitsList ?? [1, 2];
    const parityList: Parity[] = options?.parityList ?? ['none', 'even', 'odd'];

    const testTimeoutMs = options?.testTimeoutMs ?? 1000;
    const sampleTimeoutMs = options?.sampleTimeoutMs ?? 600;
    const earlyExitScore = options?.earlyExitScore ?? 0.85;

    const candidates: UartCandidate[] = [];
    const notes: string[] = [];

    for (const baudRate of baudRates) {
      for (const dataBits of dataBitsList) {
        for (const stopBits of stopBitsList) {
          for (const parity of parityList) {
            try {
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

              if (candidate && candidate.score > 0) {
                candidates.push(candidate);
                // Check if candidate exceeds early exit threshold
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
              // Ignore individual combination errors
            }
          }
        }
      }
    }

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
   * Helper method to test a single parameter combination safely.
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

      const overallTimer = setTimeout(() => {
        finalize();
      }, params.testTimeoutMs);

      const sampleTimer = setTimeout(() => {
        finalize();
      }, params.sampleTimeoutMs);

      const onData = (data: Buffer) => {
        bufferAcc = Buffer.concat([bufferAcc, data]);
        if (bufferAcc.length > 4096) {
          bufferAcc = bufferAcc.subarray(bufferAcc.length - 4096);
        }
      };

      const onError = () => {
        finalize();
      };

      const finalize = () => {
        if (isFinalized) return;
        isFinalized = true;

        clearTimeout(overallTimer);
        clearTimeout(sampleTimer);

        port.removeListener('data', onData);
        port.removeListener('error', onError);

        const closePort = () => {
          if (bufferAcc.length === 0) {
            resolve(null);
            return;
          }

          const { readableRatio, lineBreakRatio, sampleText } = calculateAsciiStats(bufferAcc);
          const entropy = calculateEntropy(bufferAcc);

          // Scoring weights: readable ASCII (60%), line breaks (25%), low entropy (15%)
          const entropyScore = 1 - Math.min(1, entropy / 8);
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

        if (port.isOpen) {
          port.close(() => closePort());
        } else {
          closePort();
        }
      };

      port.on('data', onData);
      port.on('error', onError);

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
 * Standalone helper function to run analysis on a serial port path.
 */
export async function analyzeUart(
  path: string,
  options?: AnalysisOptions
): Promise<UartAnalysisResult> {
  const analyzer = new UartAnalyzer();
  return analyzer.analyze(path, options);
}
