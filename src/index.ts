/**
 * @file index.ts
 * @description Main entrypoint exports for @dhaval/uart.js library.
 * 
 * Re-exports core classes, utility functions, analysis tools, and TypeScript types.
 */

export { UartPort } from './UartPort';
export { UartAnalyzer, analyzeUart } from './UartAnalyzer';
export { listPorts, calculateEntropy, calculateAsciiStats, COMMON_BAUD_RATES } from './utils';
export * from './types';
