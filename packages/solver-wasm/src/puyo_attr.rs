use num_derive::{FromPrimitive, ToPrimitive};
use num_traits::ToPrimitive;

#[derive(Debug, Copy, Clone, Hash, PartialEq, Eq, FromPrimitive, ToPrimitive)]
pub enum PuyoAttr {
    Red = 1,
    Blue = 2,
    Green = 3,
    Yellow = 4,
    Purple = 5,
    Heart = 6,
    Prism = 7,
    Ojama = 8,
    Kata = 9,
    Padding = 10,
}

pub const COLOR_ATTRS: [PuyoAttr; 5] = [
    PuyoAttr::Red,
    PuyoAttr::Blue,
    PuyoAttr::Green,
    PuyoAttr::Yellow,
    PuyoAttr::Purple,
];
pub const SPECIAL_ATTRS: [PuyoAttr; 4] = [
    PuyoAttr::Heart,
    PuyoAttr::Prism,
    PuyoAttr::Ojama,
    PuyoAttr::Kata,
];

pub const POPPABLE_ATTRS: [PuyoAttr; 8] = [
    PuyoAttr::Red,
    PuyoAttr::Blue,
    PuyoAttr::Green,
    PuyoAttr::Yellow,
    PuyoAttr::Purple,
    PuyoAttr::Heart,
    PuyoAttr::Prism,
    PuyoAttr::Ojama,
];

pub fn is_colored_attr(attr: PuyoAttr) -> bool {
    if attr.to_usize() >= PuyoAttr::Red.to_usize() && attr.to_usize() <= PuyoAttr::Purple.to_usize()
    {
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_colored_attr() {
        assert_eq!(is_colored_attr(PuyoAttr::Red), true);
        assert_eq!(is_colored_attr(PuyoAttr::Blue), true);
        assert_eq!(is_colored_attr(PuyoAttr::Green), true);
        assert_eq!(is_colored_attr(PuyoAttr::Yellow), true);
        assert_eq!(is_colored_attr(PuyoAttr::Purple), true);
        assert_eq!(is_colored_attr(PuyoAttr::Heart), false);
        assert_eq!(is_colored_attr(PuyoAttr::Prism), false);
        assert_eq!(is_colored_attr(PuyoAttr::Ojama), false);
        assert_eq!(is_colored_attr(PuyoAttr::Kata), false);
        assert_eq!(is_colored_attr(PuyoAttr::Padding), false);
    }
}
