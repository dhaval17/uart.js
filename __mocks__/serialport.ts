// jest mock for serialport used in tests

type DataHandler = (data: Buffer) => void;
type ErrorHandler = (err: Error) => void;

export class SerialPort {
  public path: string;
  public baudRate?: number;
  public dataBits?: number;
  public stopBits?: number;
  public parity?: string;
  public isOpen: boolean = false;

  private dataHandlers: DataHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];

  constructor(opts: any) {
    this.path = opts.path;
    this.baudRate = opts.baudRate;
    this.dataBits = opts.dataBits;
    this.stopBits = opts.stopBits;
    this.parity = opts.parity;
  }

  open(cb?: (err?: Error | null) => void) {
    // simulate open and immediate data emission depending on baudRate
    this.isOpen = true;
    if (cb) cb(undefined as any);

    // Emit a predictable ASCII payload for a particular baud rate to make tests deterministic
    const asciiPayload = Buffer.from('Hello\nUART Test\n');
    const garbage = Buffer.from([0xff, 0x00, 0xab, 0x13]);

    process.nextTick(() => {
      if (this.baudRate === 9600 || this.baudRate === 115200) {
        this.dataHandlers.forEach(h => h(asciiPayload));
      } else {
        this.dataHandlers.forEach(h => h(garbage));
      }
    });
  }

  close(cb?: () => void) {
    this.isOpen = false;
    if (cb) cb();
  }

  on(event: string, handler: any) {
    if (event === 'data') this.dataHandlers.push(handler);
    if (event === 'error') this.errorHandlers.push(handler);
  }

  removeListener(event: string, handler: any) {
    if (event === 'data') this.dataHandlers = this.dataHandlers.filter(h => h !== handler);
    if (event === 'error') this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
  }
}

export default { SerialPort };