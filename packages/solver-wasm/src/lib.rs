#![allow(non_snake_case)]
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
extern crate num_derive;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);

}

#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&format!("Hello, {}!", name));
}
