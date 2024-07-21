// ベンチマークから参照するため pub を付けている。
// pub をつけることによる wasm へのサイズ影響は 100 バイト程度。
pub mod chain;
pub mod damage;
pub mod puyo;
pub mod puyo_attr;
pub mod puyo_coord;
pub mod puyo_type;
pub mod simulator;
pub mod trace_mode;

#[macro_use]
extern crate approx;
extern crate console_error_panic_hook;
extern crate num_derive;

use puyo::{Field, NextPuyos};
use puyo_coord::PuyoCoord;
use simulator::{SimulationEnvironment, Simulator};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);

}

fn from_value<T>(js_value: JsValue) -> T
where
    T: serde::de::DeserializeOwned,
{
    return serde_wasm_bindgen::from_value(js_value).unwrap();
}

fn to_value<T>(value: &T) -> JsValue
where
    T: serde::ser::Serialize + ?Sized,
{
    return serde_wasm_bindgen::to_value(&value).unwrap();
}

#[wasm_bindgen]
pub fn detect_pop_blocks(js_environment: JsValue, js_field: JsValue) -> JsValue {
    console_error_panic_hook::set_once();
    let environment: SimulationEnvironment = from_value(js_environment);
    let field: Field = from_value(js_field);
    let simulator = Simulator { environment };
    let blocks = simulator.detect_pop_blocks(&field);
    let result = to_value(&blocks);
    return result;
}

#[wasm_bindgen]
pub fn do_chains(
    js_environment: JsValue,
    js_field: JsValue,
    js_next_puyos: JsValue,
    js_trace_coords: JsValue,
) -> JsValue {
    // フックをつかうことによる wasm へのサイズ影響は 1k バイト程度。
    console_error_panic_hook::set_once();

    let environment: SimulationEnvironment =
        serde_wasm_bindgen::from_value(js_environment).unwrap();
    let mut field: Field = serde_wasm_bindgen::from_value(js_field).unwrap();
    let mut next_puyos: NextPuyos = serde_wasm_bindgen::from_value(js_next_puyos).unwrap();
    let trace_coords: Vec<PuyoCoord> = serde_wasm_bindgen::from_value(js_trace_coords).unwrap();
    let simulator = Simulator { environment };
    let chains = simulator.do_chains(&mut field, &mut next_puyos, &trace_coords);
    let result = serde_wasm_bindgen::to_value(&chains).unwrap();
    return result;
}
