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
