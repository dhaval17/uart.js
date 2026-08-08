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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const binding_mock_1 = require("@serialport/binding-mock");
const UartPort_1 = require("../../src/UartPort");
(0, node_test_1.describe)('UartPort class', () => {
    const MOCK_PATH = '/dev/ttyMOCK_PORT';
    (0, node_test_1.beforeEach)(() => {
        binding_mock_1.MockBinding.reset();
        binding_mock_1.MockBinding.createPort(MOCK_PATH, { echo: false, record: true });
    });
    (0, node_test_1.it)('opens and closes serial port connection correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const uart = new UartPort_1.UartPort({
            path: MOCK_PATH,
            baudRate: 115200,
            binding: binding_mock_1.MockBinding,
        });
        node_assert_1.default.strictEqual(uart.isOpen(), false);
        yield uart.open();
        node_assert_1.default.strictEqual(uart.isOpen(), true);
        yield uart.close();
        node_assert_1.default.strictEqual(uart.isOpen(), false);
    }));
    (0, node_test_1.it)('prevents writing on closed port', () => __awaiter(void 0, void 0, void 0, function* () {
        const uart = new UartPort_1.UartPort({
            path: MOCK_PATH,
            binding: binding_mock_1.MockBinding,
        });
        yield node_assert_1.default.rejects(() => __awaiter(void 0, void 0, void 0, function* () {
            yield uart.write('test payload');
        }), /not open/);
    }));
    (0, node_test_1.it)('writes data and resolves bytes written', () => __awaiter(void 0, void 0, void 0, function* () {
        const uart = new UartPort_1.UartPort({
            path: MOCK_PATH,
            binding: binding_mock_1.MockBinding,
        });
        yield uart.open();
        const bytesWritten = yield uart.write('HELLO UART', { drain: false });
        node_assert_1.default.strictEqual(bytesWritten, 10);
        yield uart.close();
    }));
    (0, node_test_1.it)('emits data events when serial port receives data', () => __awaiter(void 0, void 0, void 0, function* () {
        const uart = new UartPort_1.UartPort({
            path: MOCK_PATH,
            binding: binding_mock_1.MockBinding,
        });
        yield uart.open();
        const portInstance = uart.getUnderlyingPort();
        node_assert_1.default.ok(portInstance);
        const receivedPromise = new Promise((resolve) => {
            uart.on('data', (buf) => resolve(buf));
        });
        // Simulate incoming data via mock port binding
        (portInstance === null || portInstance === void 0 ? void 0 : portInstance.port).emitData(Buffer.from('SERIAL DATA PKT'));
        const received = yield receivedPromise;
        node_assert_1.default.strictEqual(received.toString('utf8'), 'SERIAL DATA PKT');
        yield uart.close();
    }));
    (0, node_test_1.it)('emits line events when complete line is received', () => __awaiter(void 0, void 0, void 0, function* () {
        const uart = new UartPort_1.UartPort({
            path: MOCK_PATH,
            binding: binding_mock_1.MockBinding,
        });
        yield uart.open();
        const portInstance = uart.getUnderlyingPort();
        const lines = [];
        uart.on('line', (l) => lines.push(l));
        (portInstance === null || portInstance === void 0 ? void 0 : portInstance.port).emitData(Buffer.from('FIRST LINE\nSECOND '));
        (portInstance === null || portInstance === void 0 ? void 0 : portInstance.port).emitData(Buffer.from('LINE\n'));
        // Wait briefly for event loop
        yield new Promise((r) => setTimeout(r, 50));
        node_assert_1.default.deepStrictEqual(lines, ['FIRST LINE', 'SECOND LINE']);
        yield uart.close();
    }));
    (0, node_test_1.it)('reads a line using readLine() helper', () => __awaiter(void 0, void 0, void 0, function* () {
        const uart = new UartPort_1.UartPort({
            path: MOCK_PATH,
            binding: binding_mock_1.MockBinding,
        });
        yield uart.open();
        const portInstance = uart.getUnderlyingPort();
        const readLinePromise = uart.readLine('\n', 2000);
        (portInstance === null || portInstance === void 0 ? void 0 : portInstance.port).emitData(Buffer.from('COMMAND OK\n'));
        const line = yield readLinePromise;
        node_assert_1.default.strictEqual(line, 'COMMAND OK');
        yield uart.close();
    }));
});
