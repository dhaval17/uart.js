"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const utils_1 = require("../../src/utils");
(0, node_test_1.describe)('utils module', () => {
    (0, node_test_1.it)('calculates Shannon entropy correctly', () => {
        // All identical bytes should have 0 entropy
        const zeroEntropyBuf = Buffer.from('AAAAAAAAAAAAAA', 'utf8');
        node_assert_1.default.strictEqual((0, utils_1.calculateEntropy)(zeroEntropyBuf), 0);
        // Empty buffer should return 0
        node_assert_1.default.strictEqual((0, utils_1.calculateEntropy)(Buffer.alloc(0)), 0);
        // Random byte distribution should have higher entropy
        const textBuf = Buffer.from('Hello, World!\nThis is a standard text stream.', 'utf8');
        const entropy = (0, utils_1.calculateEntropy)(textBuf);
        node_assert_1.default.ok(entropy > 0 && entropy < 8, `Entropy ${entropy} should be between 0 and 8`);
    });
    (0, node_test_1.it)('calculates ASCII statistics correctly', () => {
        const text = 'Line 1\nLine 2\r\nLine 3';
        const buf = Buffer.from(text, 'utf8');
        const stats = (0, utils_1.calculateAsciiStats)(buf);
        node_assert_1.default.strictEqual(stats.readableRatio, 1.0);
        node_assert_1.default.ok(stats.lineBreakRatio > 0);
        node_assert_1.default.strictEqual(stats.sampleText, text);
    });
    (0, node_test_1.it)('handles empty buffer in ASCII stats', () => {
        const stats = (0, utils_1.calculateAsciiStats)(Buffer.alloc(0));
        node_assert_1.default.strictEqual(stats.readableRatio, 0);
        node_assert_1.default.strictEqual(stats.lineBreakRatio, 0);
        node_assert_1.default.strictEqual(stats.sampleText, '');
    });
    (0, node_test_1.it)('includes standard baud rates', () => {
        node_assert_1.default.ok(utils_1.COMMON_BAUD_RATES.includes(115200));
        node_assert_1.default.ok(utils_1.COMMON_BAUD_RATES.includes(9600));
    });
});
