import { infoLog } from 'app/utils/log';
import { expose } from 'comlink';
import wasmUrl from './lo_web.opt.wasm';
import { wasmProcess } from './process';
import { LockedProcessMods, ProcessItem, ProcessMod, StatFilter } from './types';
import init from './wasm';

const process = async (
  filteredItems: ProcessItem[][],
  /** Selected mods' total contribution to each stat */
  modStatTotals: number[],
  /** Mods to add onto the sets */
  lockedMods: LockedProcessMods,
  autoStatMods: ProcessMod[],
  statFilters: StatFilter[],
  /** Ensure every set includes one exotic */
  anyExotic: boolean
) => {
  const start = performance.now();
  const wasm = await init(wasmUrl);
  const result = wasmProcess(
    wasm,
    filteredItems,
    modStatTotals,
    lockedMods,
    autoStatMods,
    statFilters,
    anyExotic
  );
  infoLog('loadout optimizer', 'worker side took', performance.now() - start);
  return result;
};

const exports = {
  process,
};

export type ProcessWorker = typeof exports;

expose(exports);
