import { TraceMode } from './TraceMode';
import { B, G, H, P, R, Y } from './boards/alias';
import { createWorker } from './solution-wasm-worker-shim';
import type {
  WasmPuyo,
  WasmPuyoCoord,
  WasmSimulationEnvironment
} from './wasm-interface';

(async () => {
  const { workerProxy } = createWorker();

  const environment: WasmSimulationEnvironment = {
    boost_area_coord_set: new Set([]),
    is_chance_mode: false,
    minimum_puyo_num_for_popping: 3,
    max_trace_num: 5,
    trace_mode: TraceMode.Normal,
    popping_leverage: 1.0,
    chain_leverage: 7.0
  };

  let id_counter = 0;

  const field: WasmPuyo[][] = [
    [R, P, H, P, Y, G, Y, Y],
    [R, Y, P, H, Y, G, P, G],
    [B, Y, G, B, H, Y, G, P],
    [B, R, B, R, P, B, R, P],
    [Y, G, P, P, R, B, G, G],
    [B, G, B, R, B, Y, R, R]
  ].map((row) => row.map((puyo_type) => ({ id: ++id_counter, puyo_type })));

  const nextPuyos: WasmPuyo[] = [G, G, G, G, G, G, G, G].map((puyo_type) => ({
    id: ++id_counter,
    puyo_type
  }));

  const traceCoords: WasmPuyoCoord[] = [
    { x: 5, y: 2 },
    { x: 6, y: 2 }
  ];

  const result = await workerProxy.doChains(
    environment,
    field,
    nextPuyos,
    traceCoords
  );

  console.log('doChains', result);
})();
