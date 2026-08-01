// Assuming your class is in index.ts. Adjust the import path if needed.
import { UartListener } from './index'; 

const uart = new UartListener({
    path: '/dev/pts/2', // Connecting to the first virtual port
    baudRate: 9600      // Baud rate doesn't strictly matter for virtual ports, but required by serialport
});

console.log(`Checking Configured Baud Rate: ${uart.getBaudRate()}`);

uart.startListening(
    (data) => {
        console.log(`=> Received data from UART: ${data.trim()}`);
    },
    (error) => {
        console.error(`UART Error:`, error.message);
    }
);
