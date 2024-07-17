#![allow(non_snake_case)]
mod puyo_attr;
mod puyo_coord;
mod puyo_type;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);

}

#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&format!("Hello, {}!", name));
}

#[wasm_bindgen]
pub fn isColoredAttr(n: u8) -> bool {
    return puyo_attr::is_colored_attr(n);
}

#[wasm_bindgen]
pub fn isColoredType(n: u8) -> bool {
    return puyo_type::is_colored_type(n);
}

#[wasm_bindgen]
pub fn isPlusType(n: u8) -> bool {
    return puyo_type::is_plus_type(n);
}
