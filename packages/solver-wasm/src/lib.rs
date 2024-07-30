// ベンチマークから参照するため pub を付けている。
// pub をつけることによる wasm へのサイズ影響は 100 バイト程度。
pub mod chain;
pub mod chain_helper;
pub mod damage;
pub mod exploration_target;
pub mod puyo;
pub mod puyo_attr;
pub mod puyo_coord;
pub mod puyo_type;
pub mod simulation_environment;
pub mod simulator;
pub mod simulator_bb;
pub mod solution;
pub mod solution_explorer;
pub mod trace_mode;

#[cfg_attr(test, macro_use)]
extern crate approx;
extern crate console_error_panic_hook;
extern crate num_derive;

use exploration_target::ExplorationTarget;
use puyo::{Field, NextPuyos};
use puyo_coord::PuyoCoord;
use simulation_environment::SimulationEnvironment;
use simulator::Simulator;
use solution_explorer::SolutionExplorer;
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);

}

fn from_value<T>(js_value: JsValue) -> Result<T, serde_wasm_bindgen::Error>
where
    T: serde::de::DeserializeOwned,
{
    return serde_wasm_bindgen::from_value(js_value);
}

fn to_value<T>(value: &T) -> Result<JsValue, serde_wasm_bindgen::Error>
where
    T: serde::ser::Serialize + ?Sized,
{
    return serde_wasm_bindgen::to_value(&value);
}

#[wasm_bindgen]
pub fn do_chains(
    js_environment: JsValue,
    js_boost_area_coord_set: JsValue,
    js_field: JsValue,
    js_next_puyos: JsValue,
    js_trace_coords: JsValue,
) -> JsValue {
    console_error_panic_hook::set_once();

    let environment: SimulationEnvironment = from_value(js_environment).unwrap();
    let boost_area_coord_set: HashSet<PuyoCoord> = from_value(js_boost_area_coord_set).unwrap();
    let mut field: Field = from_value(js_field).unwrap();
    let mut next_puyos: NextPuyos = from_value(js_next_puyos).unwrap();
    let trace_coords: Vec<PuyoCoord> = from_value(js_trace_coords).unwrap();
    let simulator = Simulator {
        environment: &environment,
        boost_area_coord_set: &boost_area_coord_set,
    };
    let chains = simulator.do_chains(&mut field, &mut next_puyos, &trace_coords);
    let result = to_value(&chains).unwrap();
    return result;
}

#[wasm_bindgen]
pub fn solve_all_traces(
    js_exploration_target: JsValue,
    js_environment: JsValue,
    js_boost_area_coord_set: JsValue,
    js_field: JsValue,
    js_next_puyos: JsValue,
) -> Result<JsValue, JsError> {
    console_error_panic_hook::set_once();

    let exploration_target: ExplorationTarget = match from_value(js_exploration_target) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let environment: SimulationEnvironment = match from_value(js_environment) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let boost_area_coord_set: HashSet<PuyoCoord> = match from_value(js_boost_area_coord_set) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let field: Field = match from_value(js_field) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let next_puyos: NextPuyos = match from_value(js_next_puyos) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let explorer = SolutionExplorer::new(
        &exploration_target,
        &environment,
        &boost_area_coord_set,
        &field,
        &next_puyos,
    );
    let exploration_result = explorer.solve_all_traces();

    match to_value(&exploration_result) {
        Ok(result) => Ok(result),
        Err(e) => Err(JsError::new(&e.to_string())),
    }
}

#[wasm_bindgen]
pub fn solve_traces_including_index(
    js_exploration_target: JsValue,
    js_environment: JsValue,
    js_boost_area_coord_set: JsValue,
    js_field: JsValue,
    js_next_puyos: JsValue,
    coord_index: u8,
) -> Result<JsValue, JsError> {
    console_error_panic_hook::set_once();

    let exploration_target: ExplorationTarget = match from_value(js_exploration_target) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let environment: SimulationEnvironment = match from_value(js_environment) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let boost_area_coord_set: HashSet<PuyoCoord> = match from_value(js_boost_area_coord_set) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let field: Field = match from_value(js_field) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let next_puyos: NextPuyos = match from_value(js_next_puyos) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let explorer = SolutionExplorer::new(
        &exploration_target,
        &environment,
        &boost_area_coord_set,
        &field,
        &next_puyos,
    );
    let exploration_result = explorer.solve_traces_including_index(coord_index);

    match to_value(&exploration_result) {
        Ok(result) => Ok(result),
        Err(e) => Err(JsError::new(&e.to_string())),
    }
}
