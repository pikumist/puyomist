import { TraceMode } from './TraceMode';
import { B, G, H, P, R, Y } from './boards/alias';
import { createWorker } from './solution-wasm-worker-shim';
import type { WasmField, WasmSimulationEnvironment } from './wasm';

(async () => {
  const { workerProxy } = createWorker();

  const environment: WasmSimulationEnvironment = {
    boost_area_coord_set: new Set([]),
    is_chance_mode: false,
    minimum_puyo_num_for_popping: 3,
    max_trace_num: 5,
    trace_mode: TraceMode.Normal,
    popping_leverage: 1.0,
    chain_leverage: 1.0
  };

  let id_counter = 0;

  const field: WasmField = [
    [R, R, H, P, Y, Y, Y, Y],
    [R, R, P, H, Y, G, P, G],
    [B, Y, G, B, H, Y, G, P],
    [B, R, B, B, P, B, R, P],
    [Y, G, P, P, R, B, G, G],
    [G, G, P, R, B, Y, R, G]
  ].map((row) => row.map((puyo_type) => ({ id: ++id_counter, puyo_type })));

  const result = await workerProxy.detectPopBlocks(environment, field);

  console.log('detectPopBlocks', result);
})();
