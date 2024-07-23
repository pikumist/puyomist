use std::cmp;

use crate::{
    chain::Chain,
    puyo_attr::{is_colored_attr, PuyoAttr, COLOR_ATTRS},
};

/** 連鎖情報から対象属性のポップカウント総数を求める。 */
pub fn sum_attr_popped_count(chains: &Vec<Chain>, attr: PuyoAttr) -> u32 {
    chains.iter().fold(0, |acc, c| {
        acc + match c.attributes.get(&attr) {
            Some(attr_chain) => attr_chain.popped_count,
            None => 0,
        }
    })
}

/** 連鎖情報からブーストカウントの総数を求める。 */
pub fn sum_boost_count(chains: &Vec<Chain>) -> u32 {
    chains.iter().fold(0, |acc, c| acc + c.boost_count)
}

/** ブーストカウントによる倍率を求める。 */
pub fn calc_boost_ratio(boost_count: u32) -> f64 {
    1.0 + cmp::min(boost_count, 50) as f64 * 0.04
}

/** 連鎖情報からぷよ使いカウントの総数を求める。 */
pub fn sum_puyo_tsukai_count(chains: &Vec<Chain>) -> u32 {
    chains.iter().fold(0, |acc, c| acc + c.puyo_tsukai_count)
}

/** 対象属性による純粋なダメージを集計する。(プリズムのダメージやブーストカウントによる倍率は考慮に**入れない**) */
fn sum_pure_attr_damage(chains: &Vec<Chain>, attr: PuyoAttr) -> f64 {
    chains.iter().fold(0.0, |acc, c| {
        acc + match c.attributes.get(&attr) {
            Some(attr_chain) => attr_chain.strength,
            None => 0.0,
        }
    })
}

/** プリズムによるダメージを集計する。 */
pub fn sum_prism_damage(chains: &Vec<Chain>) -> f64 {
    sum_pure_attr_damage(chains, PuyoAttr::Prism)
}

/** 対象の色属性におけるダメージを集計する。(プリズムのダメージやブーストカウントによる倍率も考慮に**入れる**) */
pub fn sum_colored_attr_damage(chains: &Vec<Chain>, attr: PuyoAttr) -> f64 {
    if !is_colored_attr(attr) {
        return 0.0;
    }
    let attr_damage = sum_pure_attr_damage(chains, attr);
    let prism_damage = sum_prism_damage(chains);
    let boost_ratio = calc_boost_ratio(sum_boost_count(chains));

    return (attr_damage + prism_damage) * boost_ratio;
}

/** ワイルドによるダメージを計算する。(プリズムのダメージやブーストカウントによる倍率も考慮に**入れる**) */
pub fn sum_wild_damage(chains: &Vec<Chain>) -> f64 {
    let wild_pure_damage = COLOR_ATTRS
        .iter()
        .fold(0.0, |acc, attr| acc + sum_pure_attr_damage(chains, *attr));
    let prism_damage = sum_prism_damage(chains);
    let boost_ratio = calc_boost_ratio(sum_boost_count(chains));

    return (wild_pure_damage + prism_damage) * boost_ratio;
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::chain::AttributeChain;

    use super::*;

    #[test]
    fn test_sum_attr_popped_count() {
        // Arrange
        let chains: Vec<Chain> = Vec::from([
            Chain {
                chain_num: 1,
                simultaneous_num: 9,
                boost_count: 0,
                puyo_tsukai_count: 9,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 5,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false,
            },
            Chain {
                chain_num: 2,
                simultaneous_num: 12,
                boost_count: 0,
                puyo_tsukai_count: 12,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 3.08,
                            popped_count: 5,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 3.08,
                            popped_count: 7,
                            separated_blocks_num: 1,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false,
            },
            Chain {
                chain_num: 3,
                simultaneous_num: 11,
                boost_count: 0,
                puyo_tsukai_count: 11,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Green,
                        AttributeChain {
                            strength: 3.485,
                            popped_count: 7,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 3.485,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false,
            },
        ]);

        // Act & Assert
        assert_eq!(sum_attr_popped_count(&chains, PuyoAttr::Red), 5);
        assert_eq!(sum_attr_popped_count(&chains, PuyoAttr::Blue), 5);
        assert_eq!(sum_attr_popped_count(&chains, PuyoAttr::Green), 7);
        assert_eq!(sum_attr_popped_count(&chains, PuyoAttr::Yellow), 8);
        assert_eq!(sum_attr_popped_count(&chains, PuyoAttr::Purple), 7);
    }

    #[test]
    fn test_sum_boost_count() {
        // Arrange
        let chains: Vec<Chain> = Vec::from([
            Chain {
                chain_num: 1,
                simultaneous_num: 9,
                boost_count: 4,
                puyo_tsukai_count: 19,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Green,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 5,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 2,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: true,
                is_prism_popped: false,
            },
            Chain {
                chain_num: 2,
                simultaneous_num: 10,
                boost_count: 4,
                puyo_tsukai_count: 18,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 2.66,
                            popped_count: 5,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 2.66,
                            popped_count: 5,
                            separated_blocks_num: 1,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false,
            },
        ]);

        // Act & Assert
        assert_eq!(sum_boost_count(&chains), 8);
    }

    #[test]
    fn test_calc_boost_ratio() {
        assert_eq!(calc_boost_ratio(0), 1.0);
        assert_eq!(calc_boost_ratio(1), 1.04);
        assert_eq!(calc_boost_ratio(49), 2.96);
        assert_eq!(calc_boost_ratio(50), 3.0);
        assert_eq!(calc_boost_ratio(51), 3.0);
    }

    #[test]
    fn test_sum_puyo_tsukai_count() {
        // Arrange
        let chains: Vec<Chain> = Vec::from([
            Chain {
                chain_num: 1,
                simultaneous_num: 9,
                boost_count: 4,
                puyo_tsukai_count: 19,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Green,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 5,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 2,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: true,
                is_prism_popped: false,
            },
            Chain {
                chain_num: 2,
                simultaneous_num: 10,
                boost_count: 4,
                puyo_tsukai_count: 18,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 2.66,
                            popped_count: 5,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 2.66,
                            popped_count: 5,
                            separated_blocks_num: 1,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false,
            },
        ]);

        // Act & Assert
        assert_eq!(sum_puyo_tsukai_count(&chains), 37);
    }

    #[test]
    fn test_sum_prism_damage() {
        // Arrange
        let chains: Vec<Chain> = Vec::from([
            Chain {
                chain_num: 1,
                simultaneous_num: 6,
                boost_count: 0,
                puyo_tsukai_count: 6,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 1.3,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 6.0,
                            popped_count: 2,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: true,
            },
            Chain {
                chain_num: 2,
                simultaneous_num: 5,
                boost_count: 0,
                puyo_tsukai_count: 5,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 1.6099999999999999,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 3.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: true,
            },
            Chain {
                chain_num: 3,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Yellow,
                    AttributeChain {
                        strength: 1.7,
                        popped_count: 4,
                        separated_blocks_num: 1,
                    },
                )]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false,
            },
        ]);

        // Act & Assert
        assert_eq!(sum_prism_damage(&chains), 9.0);
    }

    #[test]
    fn test_sum_colored_attr_damage() {
        // Arrange
        let chains: Vec<Chain> = Vec::from([
            Chain {
                chain_num: 1,
                simultaneous_num: 6,
                boost_count: 2,
                puyo_tsukai_count: 6,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 1.3,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 6.0,
                            popped_count: 2,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: true,
            },
            Chain {
                chain_num: 2,
                simultaneous_num: 5,
                boost_count: 3,
                puyo_tsukai_count: 5,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 1.6099999999999999,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 3.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: true,
            },
            Chain {
                chain_num: 3,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Yellow,
                    AttributeChain {
                        strength: 1.7,
                        popped_count: 4,
                        separated_blocks_num: 1,
                    },
                )]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false,
            },
        ]);

        // Act & Assert
        assert_eq!(sum_colored_attr_damage(&chains, PuyoAttr::Red), 12.732); // (red + prism) * boost_ratio
        assert_eq!(
            sum_colored_attr_damage(&chains, PuyoAttr::Blue),
            12.360000000000001
        ); // (blue + prism) * boost_ratio
        assert_eq!(
            sum_colored_attr_damage(&chains, PuyoAttr::Green),
            10.799999999999999
        ); // (prism) * boost_ratio
        assert_eq!(
            sum_colored_attr_damage(&chains, PuyoAttr::Yellow),
            12.839999999999998
        ); // (yellow + prism) * boost_ratio
        assert_eq!(
            sum_colored_attr_damage(&chains, PuyoAttr::Purple),
            10.799999999999999
        ); // (prism) * boost_ratio
        assert_eq!(sum_colored_attr_damage(&chains, PuyoAttr::Prism), 0.0); // because prism is not a colored attr
    }

    #[test]
    fn test_sum_wild_damage() {
        // Arrange
        let chains: Vec<Chain> = Vec::from([
            Chain {
                chain_num: 1,
                simultaneous_num: 6,
                boost_count: 1,
                puyo_tsukai_count: 7,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 1.3,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 3.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    ),
                    (
                        PuyoAttr::Ojama,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: true,
            },
            Chain {
                chain_num: 2,
                simultaneous_num: 5,
                boost_count: 1,
                puyo_tsukai_count: 5,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 1.6099999999999999,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 3.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: true,
            },
            Chain {
                chain_num: 3,
                simultaneous_num: 9,
                boost_count: 3,
                puyo_tsukai_count: 9,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 2.975,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 2.975,
                            popped_count: 4,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Ojama,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    ),
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false,
            },
        ]);

        // Act & Assert
        assert_eq!(sum_wild_damage(&chains), 17.831999999999997);
    }
}
