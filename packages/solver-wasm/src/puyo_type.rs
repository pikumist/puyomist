use crate::puyo_attr::*;

pub type PuyoType = u8;

pub const TYPE_RED: PuyoType = 1;
pub const TYPE_RED_PLUS: PuyoType = 2;
pub const TYPE_RED_CHANCE: PuyoType = 3;
pub const TYPE_RED_CHANCE_PLUS: PuyoType = 4;
pub const TYPE_BLUE: PuyoType = 5;
pub const TYPE_BLUE_PLUS: PuyoType = 6;
pub const TYPE_BLUE_CHANCE: PuyoType = 7;
pub const TYPE_BLUE_CHANCE_PLUS: PuyoType = 8;
pub const TYPE_GREEN: PuyoType = 9;
pub const TYPE_GREEN_PLUS: PuyoType = 10;
pub const TYPE_GREEN_CHANCE: PuyoType = 11;
pub const TYPE_GREEN_CHANCE_PLUS: PuyoType = 12;
pub const TYPE_YELLOW: PuyoType = 13;
pub const TYPE_YELLOW_PLUS: PuyoType = 14;
pub const TYPE_YELLOW_CHANCE: PuyoType = 15;
pub const TYPE_YELLOW_CHANCE_PLUS: PuyoType = 16;
pub const TYPE_PURPLE: PuyoType = 17;
pub const TYPE_PURPLE_PLUS: PuyoType = 18;
pub const TYPE_PURPLE_CHANCE: PuyoType = 19;
pub const TYPE_PURPLE_CHANCE_PLUS: PuyoType = 20;
pub const TYPE_HEART: PuyoType = 21;
pub const TYPE_PRISM: PuyoType = 22;
pub const TYPE_OJAMA: PuyoType = 23;
pub const TYPE_KATA: PuyoType = 24;
pub const TYPE_PADDING: PuyoType = 25;

pub fn is_colored_type(puyo_type: PuyoType) -> bool {
    if puyo_type >= TYPE_RED && puyo_type <= TYPE_PURPLE_CHANCE_PLUS {
        return true;
    } else {
        return false;
    }
}

pub fn is_plus_type(puyo_type: PuyoType) -> bool {
    match puyo_type {
        TYPE_RED_PLUS => true,
        TYPE_RED_CHANCE_PLUS => true,
        TYPE_BLUE_PLUS => true,
        TYPE_BLUE_CHANCE_PLUS => true,
        TYPE_GREEN_PLUS => true,
        TYPE_GREEN_CHANCE_PLUS => true,
        TYPE_YELLOW_PLUS => true,
        TYPE_YELLOW_CHANCE_PLUS => true,
        TYPE_PURPLE_PLUS => true,
        TYPE_PURPLE_CHANCE_PLUS => true,
        _ => false,
    }
}

pub fn is_chance_type(puyo_type: PuyoType) -> bool {
    match puyo_type {
        TYPE_RED_CHANCE => true,
        TYPE_RED_CHANCE_PLUS => true,
        TYPE_BLUE_CHANCE => true,
        TYPE_BLUE_CHANCE_PLUS => true,
        TYPE_GREEN_CHANCE => true,
        TYPE_GREEN_CHANCE_PLUS => true,
        TYPE_YELLOW_CHANCE => true,
        TYPE_YELLOW_CHANCE_PLUS => true,
        TYPE_PURPLE_CHANCE => true,
        TYPE_PURPLE_CHANCE_PLUS => true,
        _ => false,
    }
}

pub fn is_traceable_type(puyo_type: PuyoType) -> bool {
    match puyo_type {
        TYPE_OJAMA => false,
        TYPE_KATA => false,
        TYPE_PADDING => false,
        _ => true,
    }
}

pub fn get_attr(puyo_type: PuyoType) -> PuyoAttr {
    match puyo_type {
        TYPE_RED => ATTR_RED,
        TYPE_RED_PLUS => ATTR_RED,
        TYPE_RED_CHANCE => ATTR_RED,
        TYPE_RED_CHANCE_PLUS => ATTR_RED,
        TYPE_BLUE => ATTR_BLUE,
        TYPE_BLUE_PLUS => ATTR_BLUE,
        TYPE_BLUE_CHANCE => ATTR_BLUE,
        TYPE_BLUE_CHANCE_PLUS => ATTR_BLUE,
        TYPE_GREEN => ATTR_GREEN,
        TYPE_GREEN_PLUS => ATTR_GREEN,
        TYPE_GREEN_CHANCE => ATTR_GREEN,
        TYPE_GREEN_CHANCE_PLUS => ATTR_GREEN,
        TYPE_YELLOW => ATTR_YELLOW,
        TYPE_YELLOW_PLUS => ATTR_YELLOW,
        TYPE_YELLOW_CHANCE => ATTR_YELLOW,
        TYPE_YELLOW_CHANCE_PLUS => ATTR_YELLOW,
        TYPE_PURPLE => ATTR_PURPLE,
        TYPE_PURPLE_PLUS => ATTR_PURPLE,
        TYPE_PURPLE_CHANCE => ATTR_PURPLE,
        TYPE_PURPLE_CHANCE_PLUS => ATTR_PURPLE,
        TYPE_HEART => ATTR_HEART,
        TYPE_PRISM => ATTR_PRISM,
        TYPE_OJAMA => ATTR_OJAMA,
        TYPE_KATA => ATTR_KATA,
        TYPE_PADDING => ATTR_PADDING,
        _ => ATTR_PADDING,
    }
}

pub fn convert_type(puyo_type: PuyoType, attr: PuyoAttr) -> PuyoType {
    if is_colored_attr(attr) {
        let plus_term = if is_plus_type(puyo_type) { 1 } else { 0 };
        let chance_term = if is_chance_type(puyo_type) { 2 } else { 0 };
        let enhance = plus_term + chance_term;

        return match attr {
            ATTR_RED => TYPE_RED + enhance,
            ATTR_BLUE => TYPE_BLUE + enhance,
            ATTR_GREEN => TYPE_GREEN + enhance,
            ATTR_YELLOW => TYPE_YELLOW + enhance,
            ATTR_PURPLE => TYPE_PURPLE + enhance,
            _ => TYPE_PADDING,
        };
    }
    return match attr {
        ATTR_HEART => TYPE_HEART,
        ATTR_PRISM => TYPE_PRISM,
        ATTR_OJAMA => TYPE_OJAMA,
        ATTR_KATA => TYPE_KATA,
        ATTR_PADDING => TYPE_PADDING,
        _ => TYPE_PADDING,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_colored_type() {
        assert_eq!(is_colored_type(TYPE_RED), true);
        assert_eq!(is_colored_type(TYPE_RED_PLUS), true);
        assert_eq!(is_colored_type(TYPE_RED_CHANCE), true);
        assert_eq!(is_colored_type(TYPE_RED_CHANCE_PLUS), true);
        assert_eq!(is_colored_type(TYPE_BLUE), true);
        assert_eq!(is_colored_type(TYPE_BLUE_PLUS), true);
        assert_eq!(is_colored_type(TYPE_BLUE_CHANCE), true);
        assert_eq!(is_colored_type(TYPE_BLUE_CHANCE_PLUS), true);
        assert_eq!(is_colored_type(TYPE_GREEN), true);
        assert_eq!(is_colored_type(TYPE_GREEN_PLUS), true);
        assert_eq!(is_colored_type(TYPE_GREEN_CHANCE), true);
        assert_eq!(is_colored_type(TYPE_GREEN_CHANCE_PLUS), true);
        assert_eq!(is_colored_type(TYPE_YELLOW), true);
        assert_eq!(is_colored_type(TYPE_YELLOW_PLUS), true);
        assert_eq!(is_colored_type(TYPE_YELLOW_CHANCE), true);
        assert_eq!(is_colored_type(TYPE_YELLOW_CHANCE_PLUS), true);
        assert_eq!(is_colored_type(TYPE_PURPLE), true);
        assert_eq!(is_colored_type(TYPE_PURPLE_PLUS), true);
        assert_eq!(is_colored_type(TYPE_PURPLE_CHANCE), true);
        assert_eq!(is_colored_type(TYPE_PURPLE_CHANCE_PLUS), true);
        assert_eq!(is_colored_type(TYPE_HEART), false);
        assert_eq!(is_colored_type(TYPE_PRISM), false);
        assert_eq!(is_colored_type(TYPE_OJAMA), false);
        assert_eq!(is_colored_type(TYPE_KATA), false);
        assert_eq!(is_colored_type(TYPE_PADDING), false);
    }

    #[test]
    fn test_is_plus_type() {
        assert_eq!(is_plus_type(TYPE_RED), false);
        assert_eq!(is_plus_type(TYPE_RED_PLUS), true);
        assert_eq!(is_plus_type(TYPE_RED_CHANCE), false);
        assert_eq!(is_plus_type(TYPE_RED_CHANCE_PLUS), true);
        assert_eq!(is_plus_type(TYPE_BLUE), false);
        assert_eq!(is_plus_type(TYPE_BLUE_PLUS), true);
        assert_eq!(is_plus_type(TYPE_BLUE_CHANCE), false);
        assert_eq!(is_plus_type(TYPE_BLUE_CHANCE_PLUS), true);
        assert_eq!(is_plus_type(TYPE_GREEN), false);
        assert_eq!(is_plus_type(TYPE_GREEN_PLUS), true);
        assert_eq!(is_plus_type(TYPE_GREEN_CHANCE), false);
        assert_eq!(is_plus_type(TYPE_GREEN_CHANCE_PLUS), true);
        assert_eq!(is_plus_type(TYPE_YELLOW), false);
        assert_eq!(is_plus_type(TYPE_YELLOW_PLUS), true);
        assert_eq!(is_plus_type(TYPE_YELLOW_CHANCE), false);
        assert_eq!(is_plus_type(TYPE_YELLOW_CHANCE_PLUS), true);
        assert_eq!(is_plus_type(TYPE_PURPLE), false);
        assert_eq!(is_plus_type(TYPE_PURPLE_PLUS), true);
        assert_eq!(is_plus_type(TYPE_PURPLE_CHANCE), false);
        assert_eq!(is_plus_type(TYPE_PURPLE_CHANCE_PLUS), true);
        assert_eq!(is_plus_type(TYPE_HEART), false);
        assert_eq!(is_plus_type(TYPE_PRISM), false);
        assert_eq!(is_plus_type(TYPE_OJAMA), false);
        assert_eq!(is_plus_type(TYPE_KATA), false);
        assert_eq!(is_plus_type(TYPE_PADDING), false);
    }

    #[test]
    fn test_is_chance_type() {
        assert_eq!(is_chance_type(TYPE_RED), false);
        assert_eq!(is_chance_type(TYPE_RED_PLUS), false);
        assert_eq!(is_chance_type(TYPE_RED_CHANCE), true);
        assert_eq!(is_chance_type(TYPE_RED_CHANCE_PLUS), true);
        assert_eq!(is_chance_type(TYPE_BLUE), false);
        assert_eq!(is_chance_type(TYPE_BLUE_PLUS), false);
        assert_eq!(is_chance_type(TYPE_BLUE_CHANCE), true);
        assert_eq!(is_chance_type(TYPE_BLUE_CHANCE_PLUS), true);
        assert_eq!(is_chance_type(TYPE_GREEN), false);
        assert_eq!(is_chance_type(TYPE_GREEN_PLUS), false);
        assert_eq!(is_chance_type(TYPE_GREEN_CHANCE), true);
        assert_eq!(is_chance_type(TYPE_GREEN_CHANCE_PLUS), true);
        assert_eq!(is_chance_type(TYPE_YELLOW), false);
        assert_eq!(is_chance_type(TYPE_YELLOW_PLUS), false);
        assert_eq!(is_chance_type(TYPE_YELLOW_CHANCE), true);
        assert_eq!(is_chance_type(TYPE_YELLOW_CHANCE_PLUS), true);
        assert_eq!(is_chance_type(TYPE_PURPLE), false);
        assert_eq!(is_chance_type(TYPE_PURPLE_PLUS), false);
        assert_eq!(is_chance_type(TYPE_PURPLE_CHANCE), true);
        assert_eq!(is_chance_type(TYPE_PURPLE_CHANCE_PLUS), true);
        assert_eq!(is_chance_type(TYPE_HEART), false);
        assert_eq!(is_chance_type(TYPE_PRISM), false);
        assert_eq!(is_chance_type(TYPE_OJAMA), false);
        assert_eq!(is_chance_type(TYPE_KATA), false);
        assert_eq!(is_chance_type(TYPE_PADDING), false);
    }

    #[test]
    fn test_is_traceable_type() {
        assert_eq!(is_traceable_type(TYPE_RED), true);
        assert_eq!(is_traceable_type(TYPE_RED_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_RED_CHANCE), true);
        assert_eq!(is_traceable_type(TYPE_RED_CHANCE_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_BLUE), true);
        assert_eq!(is_traceable_type(TYPE_BLUE_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_BLUE_CHANCE), true);
        assert_eq!(is_traceable_type(TYPE_BLUE_CHANCE_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_GREEN), true);
        assert_eq!(is_traceable_type(TYPE_GREEN_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_GREEN_CHANCE), true);
        assert_eq!(is_traceable_type(TYPE_GREEN_CHANCE_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_YELLOW), true);
        assert_eq!(is_traceable_type(TYPE_YELLOW_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_YELLOW_CHANCE), true);
        assert_eq!(is_traceable_type(TYPE_YELLOW_CHANCE_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_PURPLE), true);
        assert_eq!(is_traceable_type(TYPE_PURPLE_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_PURPLE_CHANCE), true);
        assert_eq!(is_traceable_type(TYPE_PURPLE_CHANCE_PLUS), true);
        assert_eq!(is_traceable_type(TYPE_HEART), true);
        assert_eq!(is_traceable_type(TYPE_PRISM), true);
        assert_eq!(is_traceable_type(TYPE_OJAMA), false);
        assert_eq!(is_traceable_type(TYPE_KATA), false);
        assert_eq!(is_traceable_type(TYPE_PADDING), false);
    }

    #[test]
    fn test_get_attr() {
        assert_eq!(get_attr(TYPE_RED), ATTR_RED);
        assert_eq!(get_attr(TYPE_RED_PLUS), ATTR_RED);
        assert_eq!(get_attr(TYPE_RED_CHANCE), ATTR_RED);
        assert_eq!(get_attr(TYPE_RED_CHANCE_PLUS), ATTR_RED);
        assert_eq!(get_attr(TYPE_BLUE), ATTR_BLUE);
        assert_eq!(get_attr(TYPE_BLUE_PLUS), ATTR_BLUE);
        assert_eq!(get_attr(TYPE_BLUE_CHANCE), ATTR_BLUE);
        assert_eq!(get_attr(TYPE_BLUE_CHANCE_PLUS), ATTR_BLUE);
        assert_eq!(get_attr(TYPE_GREEN), ATTR_GREEN);
        assert_eq!(get_attr(TYPE_GREEN_PLUS), ATTR_GREEN);
        assert_eq!(get_attr(TYPE_GREEN_CHANCE), ATTR_GREEN);
        assert_eq!(get_attr(TYPE_GREEN_CHANCE_PLUS), ATTR_GREEN);
        assert_eq!(get_attr(TYPE_YELLOW), ATTR_YELLOW);
        assert_eq!(get_attr(TYPE_YELLOW_PLUS), ATTR_YELLOW);
        assert_eq!(get_attr(TYPE_YELLOW_CHANCE), ATTR_YELLOW);
        assert_eq!(get_attr(TYPE_YELLOW_CHANCE_PLUS), ATTR_YELLOW);
        assert_eq!(get_attr(TYPE_PURPLE), ATTR_PURPLE);
        assert_eq!(get_attr(TYPE_PURPLE_PLUS), ATTR_PURPLE);
        assert_eq!(get_attr(TYPE_PURPLE_CHANCE), ATTR_PURPLE);
        assert_eq!(get_attr(TYPE_PURPLE_CHANCE_PLUS), ATTR_PURPLE);
        assert_eq!(get_attr(TYPE_HEART), ATTR_HEART);
        assert_eq!(get_attr(TYPE_PRISM), ATTR_PRISM);
        assert_eq!(get_attr(TYPE_OJAMA), ATTR_OJAMA);
        assert_eq!(get_attr(TYPE_KATA), ATTR_KATA);
        assert_eq!(get_attr(TYPE_PADDING), ATTR_PADDING);
    }

    #[test]
    fn test_convert_type() {
        assert_eq!(
            convert_type(TYPE_RED_CHANCE_PLUS, ATTR_BLUE),
            TYPE_BLUE_CHANCE_PLUS
        );
        assert_eq!(convert_type(TYPE_BLUE, ATTR_GREEN), TYPE_GREEN);
        assert_eq!(
            convert_type(TYPE_YELLOW_PLUS, ATTR_PURPLE),
            TYPE_PURPLE_PLUS
        );
        assert_eq!(convert_type(TYPE_PURPLE_CHANCE, ATTR_RED), TYPE_RED_CHANCE);
        assert_eq!(convert_type(TYPE_PURPLE_CHANCE, ATTR_RED), TYPE_RED_CHANCE);
        assert_eq!(convert_type(TYPE_RED_CHANCE_PLUS, ATTR_HEART), TYPE_HEART);
        assert_eq!(convert_type(TYPE_HEART, ATTR_PRISM), TYPE_PRISM);
    }
}
