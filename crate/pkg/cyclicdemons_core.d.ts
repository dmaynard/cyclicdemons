/* tslint:disable */
/* eslint-disable */
export class CyclicDemons {
  free(): void;
  constructor();
  /**
   * @returns {number}
   */
  get_upload_buffer_ptr(): number;
  /**
   * @param {number} width
   * @param {number} height
   */
  load_image(width: number, height: number): void;
  /**
   * @param {number} count
   */
  set_color_count(count: number): void;
  /**
   * @returns {number}
   */
  step(): number;
  reset(): void;
  /**
   * @returns {number}
   */
  get_nsynced(): number;
  /**
   * @returns {number}
   */
  get_halted_period(): number;
  /**
   * @param {boolean} use_8
   */
  set_use_8_neighbors(use_8: boolean): void;
  /**
   * @returns {boolean}
   */
  get_use_8_neighbors(): boolean;
  /**
   * @returns {number}
   */
  get_frame_count(): number;
  /**
   * @param {number} n
   * @returns {Uint32Array}
   */
  get_recent_history(n: number): Uint32Array;
  /**
   * @returns {number}
   */
  get_cycle_period(): number;
  render(): void;
  /**
   * @returns {number}
   */
  get_display_buffer_ptr(): number;
  /**
   * @returns {number}
   */
  get_display_buffer_len(): number;
  /**
   * @returns {number}
   */
  get_width(): number;
  /**
   * @returns {number}
   */
  get_height(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_cyclicdemons_free: (a: number, b: number) => void;
  readonly cyclicdemons_new: () => number;
  readonly cyclicdemons_get_upload_buffer_ptr: (a: number) => number;
  readonly cyclicdemons_load_image: (a: number, b: number, c: number) => void;
  readonly cyclicdemons_set_color_count: (a: number, b: number) => void;
  readonly cyclicdemons_step: (a: number) => number;
  readonly cyclicdemons_reset: (a: number) => void;
  readonly cyclicdemons_get_nsynced: (a: number) => number;
  readonly cyclicdemons_get_halted_period: (a: number) => number;
  readonly cyclicdemons_set_use_8_neighbors: (a: number, b: number) => void;
  readonly cyclicdemons_get_use_8_neighbors: (a: number) => number;
  readonly cyclicdemons_get_frame_count: (a: number) => number;
  readonly cyclicdemons_get_recent_history: (a: number, b: number) => Array;
  readonly cyclicdemons_get_cycle_period: (a: number) => number;
  readonly cyclicdemons_render: (a: number) => void;
  readonly cyclicdemons_get_display_buffer_ptr: (a: number) => number;
  readonly cyclicdemons_get_display_buffer_len: (a: number) => number;
  readonly cyclicdemons_get_width: (a: number) => number;
  readonly cyclicdemons_get_height: (a: number) => number;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
