// Assuming your class is in index.ts. Adjust the import path if needed.
import { UartListener, analyzeUartStandalone } from './index'; 

async function testUart() {
    const portPath = '/dev/pts/3';
    console.log(`Starting UART analysis on ${portPath}... This may take a few moments.`);

    try {
        // 1. Run the analysis to find the best configuration
        const analysis = await analyzeUartStandalone(portPath, {
            timeoutMs: 1000,
            sampleTimeoutMs: 600
        });

        if (!analysis.best) {
            console.error('\n No readable UART configuration could be detected.');
            if (analysis.notes) console.log(analysis.notes.join('\n'));
            return;
        }

        // 2. Log the discovered configuration
        console.log('\n Analysis Complete! Best configuration found:');
        console.log(`   Baud Rate: ${analysis.best.baudRate}`);
        console.log(`   Data Bits: ${analysis.best.dataBits}`);
        console.log(`   Stop Bits: ${analysis.best.stopBits}`);
        console.log(`   Parity:    ${analysis.best.parity}`);
        console.log(`   Score:     ${analysis.best.score.toFixed(3)}`);
        
        if (analysis.notes) {
            console.log(`   Notes:     ${analysis.notes.join(' | ')}`);
        }

        // 3. Initialize the listener with the best candidate's settings
        const uart = new UartListener({
            path: portPath,
            baudRate: analysis.best.baudRate,
            dataBits: analysis.best.dataBits,
            stopBits: analysis.best.stopBits,
            parity: analysis.best.parity
        });

        console.log(`\nStarting listener on ${portPath} at ${uart.getBaudRate()} baud...`);

        // 4. Start listening to the data stream
        await uart.startListening(
            (data) => {
                // Check if the data is not just empty whitespace before logging
                if (data.trim()) {
                    console.log(`[DATA]: ${data.trim()}`);
                }
            },
            (error) => {
                console.error(`UART Error:`, error.message);
            }
        );

    } catch (error) {
        console.error('An error occurred during UART testing:', error);
    }
}

// Run the test
testUart();
