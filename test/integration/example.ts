import { listPorts, analyzeUart, UartPort } from '../../src/index';

async function main() {
  console.log('=== UART.JS Example Suite ===\n');

  // 1. List available serial ports
  console.log('1. Enumerating connected serial ports...');
  const ports = await listPorts();
  if (ports.length === 0) {
    console.log('   No physical serial ports detected on this system.');
  } else {
    for (const port of ports) {
      console.log(`   - Path: ${port.path} (Vendor: ${port.vendorId ?? 'N/A'}, Product: ${port.productId ?? 'N/A'})`);
    }
  }

  // 2. Select target port (or specify target device path)
  const targetPath = ports[0]?.path ?? '/dev/ttyUSB0';
  console.log(`\n2. Running parameter auto-detection on ${targetPath}...`);

  try {
    const analysis = await analyzeUart(targetPath, {
      testTimeoutMs: 500,
      sampleTimeoutMs: 300,
      showProgressBar: true,
    });

    console.log('   Analysis notes:', analysis.notes);
    if (analysis.best) {
      console.log(`   Recommended config: ${analysis.best.baudRate} baud, ${analysis.best.dataBits}N${analysis.best.stopBits}, parity: ${analysis.best.parity}`);
    }

    // 3. Instantiate UartPort with recommended configuration
    const uart = new UartPort({
      path: targetPath,
      baudRate: analysis.best?.baudRate ?? 115200,
      dataBits: analysis.best?.dataBits ?? 8,
      stopBits: analysis.best?.stopBits ?? 1,
      parity: analysis.best?.parity ?? 'none',
    });

    // 4. Attach event listeners
    uart.on('open', () => {
      console.log(`\n3. [EVENT] Port ${targetPath} opened successfully.`);
    });

    uart.on('line', (line) => {
      console.log(`   [LINE RECEIVED]: ${line}`);
    });

    uart.on('error', (err) => {
      console.error(`   [ERROR]:`, err.message);
    });

    uart.on('close', () => {
      console.log(`   [EVENT] Port closed.`);
    });

    // 5. Connect and send data
    console.log('4. Connecting to serial port...');
    await uart.open();

    console.log('5. Sending command payload: "AT\\r\\n"...');
    await uart.write('AT\r\n');

    // Wait a brief period to listen for incoming line responses
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 6. Close connection cleanly
    console.log('6. Closing port...');
    await uart.close();
    console.log('\n=== Process Complete ===');
  } catch (err: any) {
    console.log(`   Analysis or connection skipped: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
});
