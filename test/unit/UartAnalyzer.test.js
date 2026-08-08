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
const UartAnalyzer_1 = require("../../src/UartAnalyzer");
(0, node_test_1.describe)('UartAnalyzer class', () => {
    const MOCK_PATH = '/dev/ttyMOCK_ANALYZER';
    (0, node_test_1.beforeEach)(() => {
        binding_mock_1.MockBinding.reset();
        binding_mock_1.MockBinding.createPort(MOCK_PATH, { echo: false, record: true });
    });
    (0, node_test_1.it)('runs analysis across parameter combinations and ranks candidates', () => __awaiter(void 0, void 0, void 0, function* () {
        const analyzer = new UartAnalyzer_1.UartAnalyzer();
        const result = yield analyzer.analyze(MOCK_PATH, {
            baudRates: [9600, 115200],
            dataBitsList: [8],
            stopBitsList: [1],
            parityList: ['none'],
            testTimeoutMs: 150,
            sampleTimeoutMs: 100,
            binding: binding_mock_1.MockBinding,
        });
        node_assert_1.default.strictEqual(result.path, MOCK_PATH);
        node_assert_1.default.ok(Array.isArray(result.candidates));
        node_assert_1.default.ok(result.notes.length > 0);
    }));
    (0, node_test_1.it)('handles empty port gracefully during analysis', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield (0, UartAnalyzer_1.analyzeUart)(MOCK_PATH, {
            baudRates: [115200, 9600],
            dataBitsList: [8],
            stopBitsList: [1],
            parityList: ['none'],
            testTimeoutMs: 100,
            sampleTimeoutMs: 50,
            binding: binding_mock_1.MockBinding,
        });
        node_assert_1.default.strictEqual(result.path, MOCK_PATH);
        node_assert_1.default.ok(result.notes.some((n) => n.includes('No readable data') || n.includes('Completed')));
    }));
});
