import { infoLog } from 'app/utils/log';
import { expose } from 'comlink';
import wasmUrl from './lo_web.opt.wasm';
import { wasmProcess } from './process';
import init, { InitOutput } from './wasm';

function withWasm<T extends unknown[], U>(fn: (wasm: InitOutput, ...args: T) => U) {
  const start = performance.now();
  return async (...args: T) => {
    const wasm = await init(wasmUrl);
    const result = fn(wasm, ...args);
    infoLog('loadout optimizer', 'worker side took', performance.now() - start);
    return result;
  };
}

const exports = {
  process: withWasm(wasmProcess),
};

export type ProcessWorker = typeof exports;

expose(exports);
