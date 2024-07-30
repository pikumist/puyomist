use crate::trace_mode::TraceMode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationEnvironment {
    pub is_chance_mode: bool,
    pub minimum_puyo_num_for_popping: u32,
    pub max_trace_num: u32,
    pub trace_mode: TraceMode,
    pub popping_leverage: f64,
    pub chain_leverage: f64,
}
