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
});
