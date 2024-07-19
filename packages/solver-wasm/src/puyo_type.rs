use num_derive::{FromPrimitive, ToPrimitive};
use num_traits::{FromPrimitive, ToPrimitive};
use serde_repr::{Deserialize_repr, Serialize_repr};

use crate::puyo_attr::*;

#[derive(
    Debug, Copy, Clone, PartialEq, Eq, FromPrimitive, ToPrimitive, Serialize_repr, Deserialize_repr,
)]
#[repr(u8)]
pub enum PuyoType {
    Red = 1,
    RedPlus = 2,
    RedChance = 3,
    RedChancePlus = 4,
    Blue = 5,
    BluePlus = 6,
    BlueChance = 7,
    BlueChancePlus = 8,
    Green = 9,
    GreenPlus = 10,
    GreenChance = 11,
    GreenChancePlus = 12,
    Yellow = 13,
    YellowPlus = 14,
    YellowChance = 15,
    YellowChancePlus = 16,
    Purple = 17,
    PurplePlus = 18,
    PurpleChance = 19,
    PurpleChancePlus = 20,
    Heart = 21,
    Prism = 22,
    Ojama = 23,
    Kata = 24,
    Padding = 25,
}

pub fn is_colored_type(puyo_type: PuyoType) -> bool {
    match puyo_type {
        PuyoType::Red => true,
        PuyoType::RedPlus => true,
        PuyoType::RedChance => true,
        PuyoType::RedChancePlus => true,
        PuyoType::Blue => true,
        PuyoType::BluePlus => true,
        PuyoType::BlueChance => true,
        PuyoType::BlueChancePlus => true,
        PuyoType::Green => true,
        PuyoType::GreenPlus => true,
        PuyoType::GreenChance => true,
        PuyoType::GreenChancePlus => true,
        PuyoType::Yellow => true,
        PuyoType::YellowPlus => true,
        PuyoType::YellowChance => true,
        PuyoType::YellowChancePlus => true,
        PuyoType::Purple => true,
        PuyoType::PurplePlus => true,
        PuyoType::PurpleChance => true,
        PuyoType::PurpleChancePlus => true,
        _ => false,
    }
}

pub fn is_plus_type(puyo_type: PuyoType) -> bool {
    match puyo_type {
        PuyoType::RedPlus => true,
        PuyoType::RedChancePlus => true,
        PuyoType::BluePlus => true,
        PuyoType::BlueChancePlus => true,
        PuyoType::GreenPlus => true,
        PuyoType::GreenChancePlus => true,
        PuyoType::YellowPlus => true,
        PuyoType::YellowChancePlus => true,
        PuyoType::PurplePlus => true,
        PuyoType::PurpleChancePlus => true,
        _ => false,
    }
}

pub fn is_chance_type(puyo_type: PuyoType) -> bool {
    match puyo_type {
        PuyoType::RedChance => true,
        PuyoType::RedChancePlus => true,
        PuyoType::BlueChance => true,
        PuyoType::BlueChancePlus => true,
        PuyoType::GreenChance => true,
        PuyoType::GreenChancePlus => true,
        PuyoType::YellowChance => true,
        PuyoType::YellowChancePlus => true,
        PuyoType::PurpleChance => true,
        PuyoType::PurpleChancePlus => true,
        _ => false,
    }
}

pub fn is_traceable_type(puyo_type: PuyoType) -> bool {
    match puyo_type {
        PuyoType::Ojama => false,
        PuyoType::Kata => false,
        PuyoType::Padding => false,
        _ => true,
    }
}

pub fn get_attr(puyo_type: PuyoType) -> PuyoAttr {
    match puyo_type {
        PuyoType::Red => PuyoAttr::Red,
        PuyoType::RedPlus => PuyoAttr::Red,
        PuyoType::RedChance => PuyoAttr::Red,
        PuyoType::RedChancePlus => PuyoAttr::Red,
        PuyoType::Blue => PuyoAttr::Blue,
        PuyoType::BluePlus => PuyoAttr::Blue,
        PuyoType::BlueChance => PuyoAttr::Blue,
        PuyoType::BlueChancePlus => PuyoAttr::Blue,
        PuyoType::Green => PuyoAttr::Green,
        PuyoType::GreenPlus => PuyoAttr::Green,
        PuyoType::GreenChance => PuyoAttr::Green,
        PuyoType::GreenChancePlus => PuyoAttr::Green,
        PuyoType::Yellow => PuyoAttr::Yellow,
        PuyoType::YellowPlus => PuyoAttr::Yellow,
        PuyoType::YellowChance => PuyoAttr::Yellow,
        PuyoType::YellowChancePlus => PuyoAttr::Yellow,
        PuyoType::Purple => PuyoAttr::Purple,
        PuyoType::PurplePlus => PuyoAttr::Purple,
        PuyoType::PurpleChance => PuyoAttr::Purple,
        PuyoType::PurpleChancePlus => PuyoAttr::Purple,
        PuyoType::Heart => PuyoAttr::Heart,
        PuyoType::Prism => PuyoAttr::Prism,
        PuyoType::Ojama => PuyoAttr::Ojama,
        PuyoType::Kata => PuyoAttr::Kata,
        PuyoType::Padding => PuyoAttr::Padding,
    }
}

pub fn convert_type(puyo_type: PuyoType, attr: PuyoAttr) -> PuyoType {
    if is_colored_attr(attr) {
        let plus_term = if is_plus_type(puyo_type) { 1 } else { 0 };
        let chance_term = if is_chance_type(puyo_type) { 2 } else { 0 };
        let enhance = plus_term + chance_term;

        return match attr {
            PuyoAttr::Red => PuyoType::from_i32(PuyoType::Red.to_i32().unwrap() + enhance).unwrap(),
            PuyoAttr::Blue => {
                PuyoType::from_i32(PuyoType::Blue.to_i32().unwrap() + enhance).unwrap()
            }
            PuyoAttr::Green => {
                PuyoType::from_i32(PuyoType::Green.to_i32().unwrap() + enhance).unwrap()
            }
            PuyoAttr::Yellow => {
                PuyoType::from_i32(PuyoType::Yellow.to_i32().unwrap() + enhance).unwrap()
            }
            PuyoAttr::Purple => {
                PuyoType::from_i32(PuyoType::Purple.to_i32().unwrap() + enhance).unwrap()
            }
            _ => PuyoType::Padding,
        };
    }
    return match attr {
        PuyoAttr::Heart => PuyoType::Heart,
        PuyoAttr::Prism => PuyoType::Prism,
        PuyoAttr::Ojama => PuyoType::Ojama,
        PuyoAttr::Kata => PuyoType::Kata,
        PuyoAttr::Padding => PuyoType::Padding,
        _ => PuyoType::Padding,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_colored_type() {
        assert_eq!(is_colored_type(PuyoType::Red), true);
        assert_eq!(is_colored_type(PuyoType::RedPlus), true);
        assert_eq!(is_colored_type(PuyoType::RedChance), true);
        assert_eq!(is_colored_type(PuyoType::RedChancePlus), true);
        assert_eq!(is_colored_type(PuyoType::Blue), true);
        assert_eq!(is_colored_type(PuyoType::BluePlus), true);
        assert_eq!(is_colored_type(PuyoType::BlueChance), true);
        assert_eq!(is_colored_type(PuyoType::BlueChancePlus), true);
        assert_eq!(is_colored_type(PuyoType::Green), true);
        assert_eq!(is_colored_type(PuyoType::GreenPlus), true);
        assert_eq!(is_colored_type(PuyoType::GreenChance), true);
        assert_eq!(is_colored_type(PuyoType::GreenChancePlus), true);
        assert_eq!(is_colored_type(PuyoType::Yellow), true);
        assert_eq!(is_colored_type(PuyoType::YellowPlus), true);
        assert_eq!(is_colored_type(PuyoType::YellowChance), true);
        assert_eq!(is_colored_type(PuyoType::YellowChancePlus), true);
        assert_eq!(is_colored_type(PuyoType::Purple), true);
        assert_eq!(is_colored_type(PuyoType::PurplePlus), true);
        assert_eq!(is_colored_type(PuyoType::PurpleChance), true);
        assert_eq!(is_colored_type(PuyoType::PurpleChancePlus), true);
        assert_eq!(is_colored_type(PuyoType::Heart), false);
        assert_eq!(is_colored_type(PuyoType::Prism), false);
        assert_eq!(is_colored_type(PuyoType::Ojama), false);
        assert_eq!(is_colored_type(PuyoType::Kata), false);
        assert_eq!(is_colored_type(PuyoType::Padding), false);
    }

    #[test]
    fn test_is_plus_type() {
        assert_eq!(is_plus_type(PuyoType::Red), false);
        assert_eq!(is_plus_type(PuyoType::RedPlus), true);
        assert_eq!(is_plus_type(PuyoType::RedChance), false);
        assert_eq!(is_plus_type(PuyoType::RedChancePlus), true);
        assert_eq!(is_plus_type(PuyoType::Blue), false);
        assert_eq!(is_plus_type(PuyoType::BluePlus), true);
        assert_eq!(is_plus_type(PuyoType::BlueChance), false);
        assert_eq!(is_plus_type(PuyoType::BlueChancePlus), true);
        assert_eq!(is_plus_type(PuyoType::Green), false);
        assert_eq!(is_plus_type(PuyoType::GreenPlus), true);
        assert_eq!(is_plus_type(PuyoType::GreenChance), false);
        assert_eq!(is_plus_type(PuyoType::GreenChancePlus), true);
        assert_eq!(is_plus_type(PuyoType::Yellow), false);
        assert_eq!(is_plus_type(PuyoType::YellowPlus), true);
        assert_eq!(is_plus_type(PuyoType::YellowChance), false);
        assert_eq!(is_plus_type(PuyoType::YellowChancePlus), true);
        assert_eq!(is_plus_type(PuyoType::Purple), false);
        assert_eq!(is_plus_type(PuyoType::PurplePlus), true);
        assert_eq!(is_plus_type(PuyoType::PurpleChance), false);
        assert_eq!(is_plus_type(PuyoType::PurpleChancePlus), true);
        assert_eq!(is_plus_type(PuyoType::Heart), false);
        assert_eq!(is_plus_type(PuyoType::Prism), false);
        assert_eq!(is_plus_type(PuyoType::Ojama), false);
        assert_eq!(is_plus_type(PuyoType::Kata), false);
        assert_eq!(is_plus_type(PuyoType::Padding), false);
    }

    #[test]
    fn test_is_chance_type() {
        assert_eq!(is_chance_type(PuyoType::Red), false);
        assert_eq!(is_chance_type(PuyoType::RedPlus), false);
        assert_eq!(is_chance_type(PuyoType::RedChance), true);
        assert_eq!(is_chance_type(PuyoType::RedChancePlus), true);
        assert_eq!(is_chance_type(PuyoType::Blue), false);
        assert_eq!(is_chance_type(PuyoType::BluePlus), false);
        assert_eq!(is_chance_type(PuyoType::BlueChance), true);
        assert_eq!(is_chance_type(PuyoType::BlueChancePlus), true);
        assert_eq!(is_chance_type(PuyoType::Green), false);
        assert_eq!(is_chance_type(PuyoType::GreenPlus), false);
        assert_eq!(is_chance_type(PuyoType::GreenChance), true);
        assert_eq!(is_chance_type(PuyoType::GreenChancePlus), true);
        assert_eq!(is_chance_type(PuyoType::Yellow), false);
        assert_eq!(is_chance_type(PuyoType::YellowPlus), false);
        assert_eq!(is_chance_type(PuyoType::YellowChance), true);
        assert_eq!(is_chance_type(PuyoType::YellowChancePlus), true);
        assert_eq!(is_chance_type(PuyoType::Purple), false);
        assert_eq!(is_chance_type(PuyoType::PurplePlus), false);
        assert_eq!(is_chance_type(PuyoType::PurpleChance), true);
        assert_eq!(is_chance_type(PuyoType::PurpleChancePlus), true);
        assert_eq!(is_chance_type(PuyoType::Heart), false);
        assert_eq!(is_chance_type(PuyoType::Prism), false);
        assert_eq!(is_chance_type(PuyoType::Ojama), false);
        assert_eq!(is_chance_type(PuyoType::Kata), false);
        assert_eq!(is_chance_type(PuyoType::Padding), false);
    }

    #[test]
    fn test_is_traceable_type() {
        assert_eq!(is_traceable_type(PuyoType::Red), true);
        assert_eq!(is_traceable_type(PuyoType::RedPlus), true);
        assert_eq!(is_traceable_type(PuyoType::RedChance), true);
        assert_eq!(is_traceable_type(PuyoType::RedChancePlus), true);
        assert_eq!(is_traceable_type(PuyoType::Blue), true);
        assert_eq!(is_traceable_type(PuyoType::BluePlus), true);
        assert_eq!(is_traceable_type(PuyoType::BlueChance), true);
        assert_eq!(is_traceable_type(PuyoType::BlueChancePlus), true);
        assert_eq!(is_traceable_type(PuyoType::Green), true);
        assert_eq!(is_traceable_type(PuyoType::GreenPlus), true);
        assert_eq!(is_traceable_type(PuyoType::GreenChance), true);
        assert_eq!(is_traceable_type(PuyoType::GreenChancePlus), true);
        assert_eq!(is_traceable_type(PuyoType::Yellow), true);
        assert_eq!(is_traceable_type(PuyoType::YellowPlus), true);
        assert_eq!(is_traceable_type(PuyoType::YellowChance), true);
        assert_eq!(is_traceable_type(PuyoType::YellowChancePlus), true);
        assert_eq!(is_traceable_type(PuyoType::Purple), true);
        assert_eq!(is_traceable_type(PuyoType::PurplePlus), true);
        assert_eq!(is_traceable_type(PuyoType::PurpleChance), true);
        assert_eq!(is_traceable_type(PuyoType::PurpleChancePlus), true);
        assert_eq!(is_traceable_type(PuyoType::Heart), true);
        assert_eq!(is_traceable_type(PuyoType::Prism), true);
        assert_eq!(is_traceable_type(PuyoType::Ojama), false);
        assert_eq!(is_traceable_type(PuyoType::Kata), false);
        assert_eq!(is_traceable_type(PuyoType::Padding), false);
    }

    #[test]
    fn test_get_attr() {
        assert_eq!(get_attr(PuyoType::Red), PuyoAttr::Red);
        assert_eq!(get_attr(PuyoType::RedPlus), PuyoAttr::Red);
        assert_eq!(get_attr(PuyoType::RedChance), PuyoAttr::Red);
        assert_eq!(get_attr(PuyoType::RedChancePlus), PuyoAttr::Red);
        assert_eq!(get_attr(PuyoType::Blue), PuyoAttr::Blue);
        assert_eq!(get_attr(PuyoType::BluePlus), PuyoAttr::Blue);
        assert_eq!(get_attr(PuyoType::BlueChance), PuyoAttr::Blue);
        assert_eq!(get_attr(PuyoType::BlueChancePlus), PuyoAttr::Blue);
        assert_eq!(get_attr(PuyoType::Green), PuyoAttr::Green);
        assert_eq!(get_attr(PuyoType::GreenPlus), PuyoAttr::Green);
        assert_eq!(get_attr(PuyoType::GreenChance), PuyoAttr::Green);
        assert_eq!(get_attr(PuyoType::GreenChancePlus), PuyoAttr::Green);
        assert_eq!(get_attr(PuyoType::Yellow), PuyoAttr::Yellow);
        assert_eq!(get_attr(PuyoType::YellowPlus), PuyoAttr::Yellow);
        assert_eq!(get_attr(PuyoType::YellowChance), PuyoAttr::Yellow);
        assert_eq!(get_attr(PuyoType::YellowChancePlus), PuyoAttr::Yellow);
        assert_eq!(get_attr(PuyoType::Purple), PuyoAttr::Purple);
        assert_eq!(get_attr(PuyoType::PurplePlus), PuyoAttr::Purple);
        assert_eq!(get_attr(PuyoType::PurpleChance), PuyoAttr::Purple);
        assert_eq!(get_attr(PuyoType::PurpleChancePlus), PuyoAttr::Purple);
        assert_eq!(get_attr(PuyoType::Heart), PuyoAttr::Heart);
        assert_eq!(get_attr(PuyoType::Prism), PuyoAttr::Prism);
        assert_eq!(get_attr(PuyoType::Ojama), PuyoAttr::Ojama);
        assert_eq!(get_attr(PuyoType::Kata), PuyoAttr::Kata);
        assert_eq!(get_attr(PuyoType::Padding), PuyoAttr::Padding);
    }

    #[test]
    fn test_convert_type() {
        assert_eq!(
            convert_type(PuyoType::RedChancePlus, PuyoAttr::Blue),
            PuyoType::BlueChancePlus
        );
        assert_eq!(
            convert_type(PuyoType::Blue, PuyoAttr::Green),
            PuyoType::Green
        );
        assert_eq!(
            convert_type(PuyoType::YellowPlus, PuyoAttr::Purple),
            PuyoType::PurplePlus
        );
        assert_eq!(
            convert_type(PuyoType::PurpleChance, PuyoAttr::Red),
            PuyoType::RedChance
        );
        assert_eq!(
            convert_type(PuyoType::RedChancePlus, PuyoAttr::Heart),
            PuyoType::Heart
        );
        assert_eq!(
            convert_type(PuyoType::Heart, PuyoAttr::Prism),
            PuyoType::Prism
        );
    }
}
