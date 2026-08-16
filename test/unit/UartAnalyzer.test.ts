import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MockBinding } from '@serialport/binding-mock';
import { UartAnalyzer, analyzeUart } from '../../src/UartAnalyzer';

describe('UartAnalyzer class', () => {
  const MOCK_PATH = '/dev/ttyMOCK_ANALYZER';

  beforeEach(() => {
    MockBinding.reset();
    MockBinding.createPort(MOCK_PATH, { echo: false, record: true });
  });

  it('runs analysis across parameter combinations and ranks candidates', async () => {
    const analyzer = new UartAnalyzer();
    const result = await analyzer.analyze(MOCK_PATH, {
      baudRates: [9600, 115200],
      dataBitsList: [8],
      stopBitsList: [1],
      parityList: ['none'],
      testTimeoutMs: 150,
      sampleTimeoutMs: 100,
      binding: MockBinding,
    });

    assert.strictEqual(result.path, MOCK_PATH);
    assert.ok(Array.isArray(result.candidates));
    assert.ok(result.notes.length > 0);
  });

  it('handles empty port gracefully during analysis', async () => {
    const result = await analyzeUart(MOCK_PATH, {
      baudRates: [115200, 9600],
      dataBitsList: [8],
      stopBitsList: [1],
      parityList: ['none'],
      testTimeoutMs: 100,
      sampleTimeoutMs: 50,
      binding: MockBinding,
    });

    assert.strictEqual(result.path, MOCK_PATH);
    assert.ok(result.notes.some((n) => n.includes('No readable data') || n.includes('Completed')));
  });

  it('formats progress bar string correctly', () => {
    const analyzer = new UartAnalyzer();
    const formatted = analyzer.formatProgressBar({
      current: 5,
      total: 10,
      percentage: 50,
      currentConfig: { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none' },
    }, 20);

    assert.ok(formatted.includes('[██████████░░░░░░░░░░]'));
    assert.ok(formatted.includes('50.0%'));
    assert.ok(formatted.includes('(5/10)'));
    assert.ok(formatted.includes('115200 8N1'));
  });

  it('invokes onProgress callback and renders progress bar to custom stream', async () => {
    const analyzer = new UartAnalyzer();
    const progressLog: Array<{ current: number; total: number }> = [];
    let streamOutput = '';

    const mockStream = {
      write(chunk: string) {
        streamOutput += chunk;
        return true;
      },
    } as any;

    await analyzer.analyze(MOCK_PATH, {
      baudRates: [9600, 115200],
      dataBitsList: [8],
      stopBitsList: [1],
      parityList: ['none'],
      testTimeoutMs: 100,
      sampleTimeoutMs: 50,
      binding: MockBinding,
      showProgressBar: true,
      progressStream: mockStream,
      onProgress: (p) => {
        progressLog.push({ current: p.current, total: p.total });
      },
    });

    assert.strictEqual(progressLog.length, 3); // step 1, step 2, final
    assert.strictEqual(progressLog[0].total, 2);
    assert.ok(streamOutput.includes('100.0%'));
    assert.ok(streamOutput.includes('Testing:'));
  });
});
