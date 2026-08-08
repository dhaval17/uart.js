import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MockBinding } from '@serialport/binding-mock';
import { UartPort } from '../../src/UartPort';

describe('UartPort class', () => {
  const MOCK_PATH = '/dev/ttyMOCK_PORT';

  beforeEach(() => {
    MockBinding.reset();
    MockBinding.createPort(MOCK_PATH, { echo: false, record: true });
  });

  it('opens and closes serial port connection correctly', async () => {
    const uart = new UartPort({
      path: MOCK_PATH,
      baudRate: 115200,
      binding: MockBinding,
    });

    assert.strictEqual(uart.isOpen(), false);
    await uart.open();
    assert.strictEqual(uart.isOpen(), true);

    await uart.close();
    assert.strictEqual(uart.isOpen(), false);
  });

  it('prevents writing on closed port', async () => {
    const uart = new UartPort({
      path: MOCK_PATH,
      binding: MockBinding,
    });

    await assert.rejects(async () => {
      await uart.write('test payload');
    }, /not open/);
  });

  it('writes data and resolves bytes written', async () => {
    const uart = new UartPort({
      path: MOCK_PATH,
      binding: MockBinding,
    });

    await uart.open();
    const bytesWritten = await uart.write('HELLO UART', { drain: false });
    assert.strictEqual(bytesWritten, 10);
    await uart.close();
  });

  it('emits data events when serial port receives data', async () => {
    const uart = new UartPort({
      path: MOCK_PATH,
      binding: MockBinding,
    });

    await uart.open();
    const portInstance = uart.getUnderlyingPort();
    assert.ok(portInstance);

    const receivedPromise = new Promise<Buffer>((resolve) => {
      uart.on('data', (buf) => resolve(buf));
    });

    // Simulate incoming data via mock port binding
    (portInstance?.port as any).emitData(Buffer.from('SERIAL DATA PKT'));

    const received = await receivedPromise;
    assert.strictEqual(received.toString('utf8'), 'SERIAL DATA PKT');

    await uart.close();
  });

  it('emits line events when complete line is received', async () => {
    const uart = new UartPort({
      path: MOCK_PATH,
      binding: MockBinding,
    });

    await uart.open();
    const portInstance = uart.getUnderlyingPort();

    const lines: string[] = [];
    uart.on('line', (l) => lines.push(l));

    (portInstance?.port as any).emitData(Buffer.from('FIRST LINE\nSECOND '));
    (portInstance?.port as any).emitData(Buffer.from('LINE\n'));

    // Wait briefly for event loop
    await new Promise((r) => setTimeout(r, 50));

    assert.deepStrictEqual(lines, ['FIRST LINE', 'SECOND LINE']);

    await uart.close();
  });

  it('reads a line using readLine() helper', async () => {
    const uart = new UartPort({
      path: MOCK_PATH,
      binding: MockBinding,
    });

    await uart.open();
    const portInstance = uart.getUnderlyingPort();

    const readLinePromise = uart.readLine('\n', 2000);
    (portInstance?.port as any).emitData(Buffer.from('COMMAND OK\n'));

    const line = await readLinePromise;
    assert.strictEqual(line, 'COMMAND OK');

    await uart.close();
  });
});
