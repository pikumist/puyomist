use num_derive::{FromPrimitive, ToPrimitive};
use serde_repr::{Deserialize_repr, Serialize_repr};

#[derive(
    Debug, Copy, Clone, PartialEq, FromPrimitive, ToPrimitive, Serialize_repr, Deserialize_repr,
)]
#[repr(u8)]
pub enum TraceMode {
    Normal = 0,
    ToRed = 1,
    ToBlue = 2,
    ToGreen = 3,
    ToYellow = 4,
    ToPurple = 5,
}
