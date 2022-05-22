import { warnLog } from 'app/utils/log';

export type InitInput = RequestInfo | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly lo_init: (num_items: number, num_auto_mods: number) => number;
  readonly lo_setup_settings: (
    ctx_ptr: number,
    any_exotic: number,
    allowed_auto_mods: number
  ) => number;

  readonly lo_setup_base_stats_ptr: (ctx_ptr: number) => number;
  readonly lo_setup_num_items_per_bucket_ptr: (ctx_ptr: number) => number;
  readonly lo_setup_bounds_ptr: (ctx_ptr: number) => number;
  readonly lo_setup_items_ptr: (ctx_ptr: number) => number;
  readonly lo_setup_mods_ptr: (ctx_ptr: number) => number;
  readonly lo_setup_auto_mods_ptr: (ctx_ptr: number) => number;

  readonly lo_run: (ctx_ptr: number) => number;

  readonly lo_result_num_sets: (results_ptr: number) => number;
  readonly lo_result_sets_ptr: (results_ptr: number) => number;
  readonly lo_result_info_ptr: (results_ptr: number) => number;
  readonly lo_result_minmax_ptr: (results_ptr: number) => number;

  readonly lo_free: (ctx_ptr: number, results_ptr: number) => void;
}

async function load(
  module: Response | BufferSource | WebAssembly.Module,
  imports: WebAssembly.Imports
) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get('Content-Type') !== 'application/wasm') {
          warnLog(
            '`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
            e
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}

async function init(input: InitInput): Promise<InitOutput> {
  if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request)) {
    input = await fetch(input);
  }

  const { instance } = await load(input, {});

  // We rely on the wasm blob having these exports...
  return instance.exports as unknown as InitOutput;
}

export default init;
