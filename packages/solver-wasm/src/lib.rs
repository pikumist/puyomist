mod chain;
mod damage;
mod puyo;
mod puyo_attr;
mod puyo_coord;
mod puyo_type;
mod simulator;
mod trace_mode;

#[macro_use]
extern crate approx;
extern crate console_error_panic_hook;
extern crate num_derive;

use puyo::Field;
use simulator::{SimulationEnvironment, Simulator};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);

}

#[wasm_bindgen]
pub fn detect_pop_blocks(js_environment: JsValue, js_field: JsValue) -> JsValue {
    console_error_panic_hook::set_once();
    let environment: SimulationEnvironment =
        serde_wasm_bindgen::from_value(js_environment).unwrap();
    let field: Field = serde_wasm_bindgen::from_value(js_field).unwrap();
    let simulator = Simulator { environment };
    let blocks = simulator.detect_pop_blocks(&field);
    let result = serde_wasm_bindgen::to_value(&blocks).unwrap();
    return result;
}
