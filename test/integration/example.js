"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../src/index");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        var _f, _g, _h, _j, _k, _l, _m;
        console.log('=== UART.JS Example Suite ===\n');
        // 1. List available serial ports
        console.log('1. Enumerating connected serial ports...');
        const ports = yield (0, index_1.listPorts)();
        if (ports.length === 0) {
            console.log('   No physical serial ports detected on this system.');
        }
        else {
            for (const port of ports) {
                console.log(`   - Path: ${port.path} (Vendor: ${(_f = port.vendorId) !== null && _f !== void 0 ? _f : 'N/A'}, Product: ${(_g = port.productId) !== null && _g !== void 0 ? _g : 'N/A'})`);
            }
        }
        // 2. Select target port (or specify target device path)
        const targetPath = (_h = (_a = ports[0]) === null || _a === void 0 ? void 0 : _a.path) !== null && _h !== void 0 ? _h : '/dev/ttyUSB0';
        console.log(`\n2. Running parameter auto-detection on ${targetPath}...`);
        try {
            const analysis = yield (0, index_1.analyzeUart)(targetPath, {
                testTimeoutMs: 500,
                sampleTimeoutMs: 300,
            });
            console.log('   Analysis notes:', analysis.notes);
            if (analysis.best) {
                console.log(`   Recommended config: ${analysis.best.baudRate} baud, ${analysis.best.dataBits}N${analysis.best.stopBits}, parity: ${analysis.best.parity}`);
            }
            // 3. Instantiate UartPort with recommended configuration
            const uart = new index_1.UartPort({
                path: targetPath,
                baudRate: (_j = (_b = analysis.best) === null || _b === void 0 ? void 0 : _b.baudRate) !== null && _j !== void 0 ? _j : 115200,
                dataBits: (_k = (_c = analysis.best) === null || _c === void 0 ? void 0 : _c.dataBits) !== null && _k !== void 0 ? _k : 8,
                stopBits: (_l = (_d = analysis.best) === null || _d === void 0 ? void 0 : _d.stopBits) !== null && _l !== void 0 ? _l : 1,
                parity: (_m = (_e = analysis.best) === null || _e === void 0 ? void 0 : _e.parity) !== null && _m !== void 0 ? _m : 'none',
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
            yield uart.open();
            console.log('5. Sending command payload: "AT\\r\\n"...');
            yield uart.write('AT\r\n');
            // Wait a brief period to listen for incoming line responses
            yield new Promise((resolve) => setTimeout(resolve, 1000));
            // 6. Close connection cleanly
            console.log('6. Closing port...');
            yield uart.close();
            console.log('\n=== Process Complete ===');
        }
        catch (err) {
            console.log(`   Analysis or connection skipped: ${err.message}`);
        }
    });
}
main().catch((err) => {
    console.error('Unhandled error:', err);
});
