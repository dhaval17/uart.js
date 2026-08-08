import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateEntropy, calculateAsciiStats, COMMON_BAUD_RATES } from '../../src/utils';

describe('utils module', () => {
  it('calculates Shannon entropy correctly', () => {
    // All identical bytes should have 0 entropy
    const zeroEntropyBuf = Buffer.from('AAAAAAAAAAAAAA', 'utf8');
    assert.strictEqual(calculateEntropy(zeroEntropyBuf), 0);

    // Empty buffer should return 0
    assert.strictEqual(calculateEntropy(Buffer.alloc(0)), 0);

    // Random byte distribution should have higher entropy
    const textBuf = Buffer.from('Hello, World!\nThis is a standard text stream.', 'utf8');
    const entropy = calculateEntropy(textBuf);
    assert.ok(entropy > 0 && entropy < 8, `Entropy ${entropy} should be between 0 and 8`);
  });

  it('calculates ASCII statistics correctly', () => {
    const text = 'Line 1\nLine 2\r\nLine 3';
    const buf = Buffer.from(text, 'utf8');
    const stats = calculateAsciiStats(buf);

    assert.strictEqual(stats.readableRatio, 1.0);
    assert.ok(stats.lineBreakRatio > 0);
    assert.strictEqual(stats.sampleText, text);
  });

  it('handles empty buffer in ASCII stats', () => {
    const stats = calculateAsciiStats(Buffer.alloc(0));
    assert.strictEqual(stats.readableRatio, 0);
    assert.strictEqual(stats.lineBreakRatio, 0);
    assert.strictEqual(stats.sampleText, '');
  });

  it('includes standard baud rates', () => {
    assert.ok(COMMON_BAUD_RATES.includes(115200));
    assert.ok(COMMON_BAUD_RATES.includes(9600));
  });
});
