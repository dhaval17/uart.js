import { SerialPort } from 'serialport';

// Define the initialization options
export interface UartConfig {
    path: string;       // e.g., '/dev/ttyUSB0' or 'COM3'
    baudRate: number;   // e.g., 9600, 115200
    dataBits?: 8 | 7 | 6 | 5;
    stopBits?: 1 | 2;
    parity?: 'none' | 'even' | 'mark' | 'odd' | 'space';
}

export class UartListener {
    private port: SerialPort;
    private config: UartConfig;

    constructor(config: UartConfig) {
        this.config = config;
        
        // Initialize the port, but don't open it automatically
        this.port = new SerialPort({
            path: config.path,
            baudRate: config.baudRate,
            dataBits: config.dataBits || 8,
            stopBits: config.stopBits || 1,
            parity: config.parity || 'none',
            autoOpen: false, 
        });
    }

    /**
     * Checks and returns the current configured baud rate.
     */
    public getBaudRate(): number {
        return this.port.baudRate;
    }

    /**
     * Opens the connection, verifies the baud rate, and starts listening for data.
     * @param onData Callback fired when data is received
     * @param onError Optional callback for handling errors
     */
    public startListening(
        onData: (data: string) => void, 
        onError?: (error: Error) => void
    ): void {
        if (!this.port.isOpen) {
            this.port.open((err) => {
                if (err) {
                    if (onError) onError(err);
                    return;
                }
                
                // Explicitly checking the baud rate as requested
                const currentBaud = this.getBaudRate();
                console.log(`[UART Module] Successfully connected to ${this.config.path} at ${currentBaud} baud.`);
            });
        }

        // Listen for incoming data
        this.port.on('data', (data: Buffer) => {
            // Convert the raw Buffer to a string before outputting
            onData(data.toString('utf8'));
        });

        this.port.on('error', (err) => {
            if (onError) onError(err);
        });
    }

    /**
     * Gracefully closes the serial port.
     */
    public stopListening(): void {
        if (this.port.isOpen) {
            this.port.close();
        }
    }
}
