use num_derive::{FromPrimitive, ToPrimitive};
use serde::{Deserialize, Serialize};

#[derive(Debug, Copy, Clone, PartialEq, FromPrimitive, ToPrimitive, Serialize, Deserialize)]
pub enum TraceMode {
    Normal = 0,
    ToRed = 1,
    ToBlue = 2,
    ToGreen = 3,
    ToYellow = 4,
    ToPurple = 5,
}
