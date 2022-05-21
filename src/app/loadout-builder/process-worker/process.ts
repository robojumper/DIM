import { infoLog } from 'app/utils/log';
import { LockedProcessMods, ProcessArmorSet, ProcessItem, ProcessMod, StatFilter } from './types';
import { InitOutput } from './wasm';

export function wasmProcess(
  wasm: InitOutput,
  filteredItems: ProcessItem[][],
  /** Selected mods' total contribution to each stat */
  modStatTotals: number[],
  /** Mods to add onto the sets */
  lockedMods: LockedProcessMods,
  autoStatMods: ProcessMod[],
  statFilters: StatFilter[],
  /** Ensure every set includes one exotic */
  anyExotic: boolean
): {
  sets: ProcessArmorSet[];
  combos: number;
  /** The stat ranges of all sets that matched our filters & mod selection. */
  statRanges?: StatFilter[];
} {
  if (filteredItems.length !== 5) {
    throw new Error('must have 5 slots');
  }

  const combos = filteredItems.reduce((acc, slotPieces) => acc * slotPieces.length, 1);
  if (combos === 0) {
    return { sets: [], combos: 0 };
  }

  if (
    lockedMods.generalMods.length > 5 ||
    lockedMods.activityMods.length > 5 ||
    lockedMods.combatMods.length > 5
  ) {
    return { sets: [], combos };
  }

  // This is the really hairy part of exchanging data with the WASM side.
  // Normally, this is something a bindgen tool should be able to handle,
  // and `wasm-bindgen` (wb) has three different approaches:
  //
  // * We can #[wasm_bindgen] our Rust structs. wb generates a JS class
  //    that allocates this struct on the Rust side, and all property access
  //    on the JS side requires a call into WASM. Manual freeing is required.
  //   * This means we have to allocate hundreds of objects on the WASM heap
  //     individually and set their properties, every step requiring an FFI call.
  // * We can expose JSValues to WASM. Access to properties on the Rust side requires
  //   a JS FFI call.
  //   * This is totally unacceptable for performance because WASM is meant to do
  //     the heavy lifting.
  // * We can serialize all of it to JSON and decode that in WASM.
  //   * This works but is unsatisfying for our large amounts of data.
  //
  // All of these cause code size to really blow up because they require
  // a lot of FFI glue on the WASM side, which has no runtime and as such
  // has to pay for everything slightly complex.
  //
  // So we don't use any of wasm-bindgen's glue features. Instead, simple
  // configuration arguments use FFI functions with number arguments, while
  // large amounts of structs (like items, mods) use a JS declaration that
  // informs JS about the C struct layout and just writes the numbers itself.

  const totalNumItems = filteredItems.reduce((acc, slotPieces) => acc + slotPieces.length, 0);

  let ctxPtr = 0;
  let resPtr = 0;

  try {
    // +1 for the all-zeros empty stat mod
    ctxPtr = wasm.lo_init(totalNumItems, autoStatMods.length + 1);

    {
      const ctxBuf = new Uint16Array(wasm.memory.buffer, ctxPtr, 11);

      // Write base stats
      for (let i = 0; i < modStatTotals.length; i++) {
        ctxBuf[i] = modStatTotals[i];
      }
      // and number of items per slot
      for (let i = 0; i < 5; i++) {
        ctxBuf[i + 6] = filteredItems[i].length;
      }
    }

    {
      const ctxBuf = new Uint8Array(wasm.memory.buffer, ctxPtr + 22, 14);

      // Write stat ranges and exoticness
      for (let i = 0; i < statFilters.length; i++) {
        if (statFilters[i].ignored) {
          ctxBuf[i] = 255;
          ctxBuf[i + 6] = 255;
        } else {
          ctxBuf[i] = statFilters[i].min;
          ctxBuf[i + 6] = statFilters[i].max;
        }
      }
      ctxBuf[12] = anyExotic ? 1 : 0;
      ctxBuf[13] = 5; // Auto stat mods
      // ctxBuf[13] = 0; // Auto stat mods
    }

    const modTagToNumber: Record<string, number> = {};
    const getTagNumber = (tag: string) =>
      modTagToNumber[tag] ?? (modTagToNumber[tag] = Object.keys(modTagToNumber).length);

    const processItemIds: string[] = [];
    const getProcessItemNumber = (id: string) => {
      const index = processItemIds.length;
      processItemIds.push(id);
      return index;
    };

    {
      const items = filteredItems.flat();
      const itemsPtr = wasm.lo_items_ptr(ctxPtr);

      for (let i = 0; i < items.length; i++) {
        const view = new DataView(wasm.memory.buffer, itemsPtr + i * 24, 24);
        view.setUint16(0, getProcessItemNumber(items[i].id), true);
        view.setUint16(2, items[i].power, true);
        view.setUint8(4, items[i].energy.type);
        view.setUint8(5, items[i].energy.val);
        view.setUint8(6, items[i].energy.capacity);
        view.setUint8(7, items[i].isExotic ? 1 : 0);
        const tagBitmask =
          items[i].compatibleModSeasons?.reduce(
            (acc, season) => acc | (1 << getTagNumber(season)),
            0
          ) || 0;
        view.setUint32(8, tagBitmask, true);
        const stats = items[i].stats;
        for (let i = 0; i < stats.length; i++) {
          view.setUint16(12 + 2 * i, stats[i], true);
        }
      }
    }

    {
      const modsPtr = wasm.lo_mods_ptr(ctxPtr);
      const serializeMod = (m: ProcessMod | undefined, idx: number) => {
        const view = new DataView(wasm.memory.buffer, modsPtr + idx * 12, 12);
        if (m) {
          view.setUint32(0, m.hash, true);
          view.setUint32(4, m.tag ? 1 << getTagNumber(m.tag) : 0, true);
          view.setUint8(8, m.energy.type);
          view.setUint8(9, m.energy.val);
        } else {
          // Clear it out -- all zeros is interpreted as no mod.
          for (let i = 0; i < 3; i++) {
            view.setUint32(i * 4, 0);
          }
        }
      };

      for (let i = 0; i < 5; i++) {
        serializeMod(lockedMods.generalMods[i], i);
      }
      for (let i = 0; i < 5; i++) {
        serializeMod(lockedMods.combatMods[i], i + 5);
      }
      for (let i = 0; i < 5; i++) {
        serializeMod(lockedMods.activityMods[i], i + 10);
      }
    }

    {
      const autoModsPtr = wasm.lo_auto_mods_ptr(ctxPtr);
      const serializeStatMod = (m: ProcessMod | undefined, idx: number) => {
        const view = new DataView(wasm.memory.buffer, autoModsPtr + idx * 24, 24);
        if (m) {
          view.setUint32(0, m.hash, true);
          view.setUint32(4, m.tag ? 1 << getTagNumber(m.tag) : 0, true);
          view.setUint8(8, m.energy.type);
          view.setUint8(9, m.energy.val);
          for (let i = 0; i < m.investmentStats.length; i++) {
            view.setUint16(12 + i * 2, m.investmentStats[i], true);
          }
        } else {
          // Clear it out -- all zeros is interpreted as no mod.
          for (let i = 0; i < 6; i++) {
            view.setUint32(i * 4, 0);
          }
        }
      };

      let i = 0;
      serializeStatMod(undefined, i++);
      for (const mod of autoStatMods) {
        serializeStatMod(mod, i++);
      }
    }

    // Run it!
    const start = performance.now();
    resPtr = wasm.lo_run(ctxPtr);
    infoLog('loadout optimizer', 'actually took', performance.now() - start);

    // Then copy the results out of WASM linear memory
    const res = new Uint32Array(wasm.memory.buffer, resPtr, 9);
    const [setsPtr, numSets] = [res[0], res[1]];
    const sets: ProcessArmorSet[] = [];
    for (let setIndex = 0; setIndex < numSets; setIndex++) {
      // const setBuf = new Uint16Array(wasm.memory.buffer, setsPtr + (26 * setIndex), 12);
      const setBuf = new Uint16Array(wasm.memory.buffer, setsPtr + 48 * setIndex, 12);
      const stats = [setBuf[0], setBuf[1], setBuf[2], setBuf[3], setBuf[4], setBuf[5]];

      const armor = [
        processItemIds[setBuf[6]],
        processItemIds[setBuf[7]],
        processItemIds[setBuf[8]],
        processItemIds[setBuf[9]],
        processItemIds[setBuf[10]],
      ];

      const autoModsBuf = new Uint32Array(wasm.memory.buffer, setsPtr + 48 * setIndex + 28, 5);

      const mods = [...autoModsBuf].filter((m) => m !== 0);
      // const mods: number[] = [];

      sets.push({ stats, armor, mods });
    }

    // Also get the infos out
    const [numValid, lowTier, statRange, modsUnfit, doubleExotic, noExotic] = [
      res[3],
      res[4],
      res[5],
      res[6],
      res[7],
      res[8],
    ];

    infoLog(
      'loadout optimizer',
      'stats',
      'num valid',
      numValid,
      'skipped low tier',
      lowTier,
      'skipped exceeded stat ranges',
      statRange,
      "skipped mods didn't fit",
      modsUnfit,
      'skipped double exotic',
      doubleExotic,
      'skipped no exotic',
      noExotic
    );

    // Finally extract min-max
    const minMaxBuf = new Uint16Array(wasm.memory.buffer, resPtr + 36, 12);
    const statRanges: StatFilter[] = [];
    for (let i = 0; i < 6; i++) {
      statRanges.push({ min: minMaxBuf[i], max: minMaxBuf[i + 6] });
    }

    return { sets, combos, statRanges };
  } finally {
    wasm.lo_free(ctxPtr, resPtr);
  }
}
