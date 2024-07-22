pub fn calc_damage_term(card_attack: f64, popping_factor: f64, chain_factor: f64) -> f64 {
    card_attack * popping_factor * chain_factor
}

pub fn calc_popping_factor(
    simultaneous_num: u32,
    separated_blocks_num: u32,
    minimum_puyo_num_for_popping: Option<u32>,
    popping_coeffcient: Option<f64>,
    popping_leverage: Option<f64>,
) -> f64 {
    (1.0 + (simultaneous_num - minimum_puyo_num_for_popping.unwrap_or(4)) as f64
        * popping_coeffcient.unwrap_or(0.15)
        * popping_leverage.unwrap_or(1.0))
        * separated_blocks_num as f64
}

const CHAIN_COEFFICIENT_TABLE: [f64; 3] = [
    0.0, // 1連鎖
    0.4, // 2連鎖
    0.7, // 3連鎖
         // 4連鎖は 1.0 でそれ以降 0.2 ずつ上がる
];

pub fn calc_chain_factor(chain_num: u32, chain_leverage: Option<f64>) -> Option<f64> {
    if chain_num < 1 {
        return None;
    }
    let base_coeffcient = if chain_num >= 4 {
        1.0 + ((chain_num - 4) as f64) * 0.2
    } else {
        CHAIN_COEFFICIENT_TABLE[(chain_num - 1) as usize]
    };
    Some(base_coeffcient * chain_leverage.unwrap_or(1.0) + 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_damage_term() {
        assert_eq!(calc_damage_term(2.0, 3.0, 4.0), 24.0);
        assert_eq!(calc_damage_term(3.0, 4.0, 5.0), 60.0);
    }

    #[test]
    fn test_calc_popping_factor() {
        assert_eq!(calc_popping_factor(4, 1, None, None, None), 1.0);
        assert_eq!(calc_popping_factor(5, 1, None, None, None), 1.15);
        assert_eq!(calc_popping_factor(5, 1, None, None, Some(5.0)), 1.75);
        assert_eq!(calc_popping_factor(5, 1, Some(3), None, Some(5.0)), 2.5);
        assert_eq!(
            calc_popping_factor(5, 1, Some(3), Some(0.3), Some(5.0)),
            4.0
        );
        assert_eq!(
            calc_popping_factor(8, 2, Some(4), Some(0.15), Some(1.0)),
            3.2
        );
        assert_eq!(
            calc_popping_factor(4, 1, Some(3), Some(0.15), Some(5.0)),
            1.75
        );
    }

    #[test]
    fn test_calc_chain_factor() {
        assert_eq!(calc_chain_factor(0, None), None);
        assert_relative_eq!(calc_chain_factor(1, None).unwrap(), 1.0);
        assert_relative_eq!(calc_chain_factor(1, Some(1.0)).unwrap(), 1.0);
        assert_relative_eq!(calc_chain_factor(2, Some(1.0)).unwrap(), 1.4);
        assert_relative_eq!(calc_chain_factor(3, Some(1.0)).unwrap(), 1.7);
        assert_relative_eq!(calc_chain_factor(4, Some(1.0)).unwrap(), 2.0);
        assert_relative_eq!(calc_chain_factor(5, Some(1.0)).unwrap(), 2.2);
        assert_relative_eq!(calc_chain_factor(10, Some(1.0)).unwrap(), 3.2);
        assert_relative_eq!(calc_chain_factor(18, Some(1.0)).unwrap(), 4.8);
        assert_relative_eq!(calc_chain_factor(1, Some(7.0)).unwrap(), 1.0);
        assert_relative_eq!(calc_chain_factor(2, Some(7.0)).unwrap(), 3.8);
        assert_relative_eq!(calc_chain_factor(3, Some(7.0)).unwrap(), 5.9);
        assert_relative_eq!(calc_chain_factor(4, Some(7.0)).unwrap(), 8.0);
        assert_relative_eq!(calc_chain_factor(5, Some(7.0)).unwrap(), 9.4);
        assert_relative_eq!(calc_chain_factor(10, Some(7.0)).unwrap(), 16.4);
        assert_relative_eq!(calc_chain_factor(18, Some(7.0)).unwrap(), 27.6);
    }
}
