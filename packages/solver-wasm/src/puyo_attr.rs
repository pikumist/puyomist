pub type PuyoAttr = u8;

pub const ATTR_RED: PuyoAttr = 1;
pub const ATTR_BLUE: PuyoAttr = 2;
pub const ATTR_GREEN: PuyoAttr = 3;
pub const ATTR_YELLOW: PuyoAttr = 4;
pub const ATTR_PURPLE: PuyoAttr = 5;
pub const ATTR_HEART: PuyoAttr = 6;
pub const ATTR_PRISM: PuyoAttr = 7;
pub const ATTR_OJAMA: PuyoAttr = 8;
pub const ATTR_KATA: PuyoAttr = 9;
pub const ATTR_PADDING: PuyoAttr = 10;

pub fn is_colored_attr(attr: PuyoAttr) -> bool {
    if attr >= ATTR_RED && attr <= ATTR_PURPLE {
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
        assert_eq!(is_colored_attr(ATTR_RED), true);
        assert_eq!(is_colored_attr(ATTR_BLUE), true);
        assert_eq!(is_colored_attr(ATTR_GREEN), true);
        assert_eq!(is_colored_attr(ATTR_YELLOW), true);
        assert_eq!(is_colored_attr(ATTR_PURPLE), true);
        assert_eq!(is_colored_attr(ATTR_HEART), false);
        assert_eq!(is_colored_attr(ATTR_PRISM), false);
        assert_eq!(is_colored_attr(ATTR_OJAMA), false);
        assert_eq!(is_colored_attr(ATTR_KATA), false);
        assert_eq!(is_colored_attr(ATTR_PADDING), false);
    }
}
