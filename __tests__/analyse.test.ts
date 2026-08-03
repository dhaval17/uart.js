import { analyseUARTStandalone } from '../src/index';

jest.mock('serialport'); // use the mock defined in __mocks__

describe('analyseUARTStandalone', () => {
  jest.setTimeout(10000);

  test('finds readable ASCII candidate from mocked serialport', async () => {
    const result = await analyseUARTStandalone('/dev/ttyMOCK', { timeoutMs: 200, sampleTimeoutMs: 100 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.candidates)).toBe(true);
    // should have at least one candidate with decent readableRatio when mock emits ASCII for 9600/115200
    const good = result.candidates.find(c => c.readableRatio > 0.5);
    expect(good).toBeDefined();
    if (good) {
      expect(good.entropy).toBeLessThanOrEqual(8);
      expect(good.sample.length).toBeGreaterThan(0);
    }
  });
});
