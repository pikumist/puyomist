// ベンチマークから参照するため pub を付けている。
// pub をつけることによる wasm へのサイズ影響は 100 バイト程度。
pub mod chain;
pub mod chain_helper;
pub mod damage;
pub mod exploration_target;
pub mod how_many_traces;
pub mod paint;
pub mod paint_search;
pub mod puyo;
pub mod puyo_attr;
pub mod puyo_coord;
pub mod puyo_type;
pub mod simulation_environment;
pub mod simulator_bb;
pub mod solution;
pub mod solution_explorer;
pub mod trace_mode;

#[cfg_attr(test, macro_use)]
extern crate approx;
extern crate console_error_panic_hook;
extern crate num_derive;

use exploration_target::ExplorationTarget;
use paint_search::{PaintBeamContext, PaintEvalContext, PaintEvaluation, PaintSearchParams};
use puyo::{Field, NextPuyos};
use puyo_coord::PuyoCoord;
use simulation_environment::SimulationEnvironment;
use solution_explorer::SolutionExplorer;
use std::collections::HashSet;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);

}

fn from_value<T>(js_value: JsValue) -> Result<T, serde_wasm_bindgen::Error>
where
    T: serde::de::DeserializeOwned,
{
    return serde_wasm_bindgen::from_value(js_value);
}

fn to_value<T>(value: &T) -> Result<JsValue, serde_wasm_bindgen::Error>
where
    T: serde::ser::Serialize + ?Sized,
{
    return serde_wasm_bindgen::to_value(&value);
}

#[wasm_bindgen]
pub fn solve_all_traces(
    js_exploration_target: JsValue,
    js_environment: JsValue,
    js_boost_area_coord_set: JsValue,
    js_field: JsValue,
    js_next_puyos: JsValue,
) -> Result<JsValue, JsError> {
    console_error_panic_hook::set_once();

    let exploration_target: ExplorationTarget = match from_value(js_exploration_target) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let environment: SimulationEnvironment = match from_value(js_environment) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let boost_area_coord_set: HashSet<PuyoCoord> = match from_value(js_boost_area_coord_set) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let field: Field = match from_value(js_field) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let next_puyos: NextPuyos = match from_value(js_next_puyos) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let explorer = SolutionExplorer::new(
        &exploration_target,
        &environment,
        &boost_area_coord_set,
        &field,
        &next_puyos,
    );
    let exploration_result = explorer.solve_all_traces();

    match to_value(&exploration_result) {
        Ok(result) => Ok(result),
        Err(e) => Err(JsError::new(&e.to_string())),
    }
}

#[wasm_bindgen]
pub fn solve_traces_including_index(
    js_exploration_target: JsValue,
    js_environment: JsValue,
    js_boost_area_coord_set: JsValue,
    js_field: JsValue,
    js_next_puyos: JsValue,
    coord_index: u8,
) -> Result<JsValue, JsError> {
    console_error_panic_hook::set_once();

    let exploration_target: ExplorationTarget = match from_value(js_exploration_target) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let environment: SimulationEnvironment = match from_value(js_environment) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let boost_area_coord_set: HashSet<PuyoCoord> = match from_value(js_boost_area_coord_set) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let field: Field = match from_value(js_field) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let next_puyos: NextPuyos = match from_value(js_next_puyos) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let explorer = SolutionExplorer::new(
        &exploration_target,
        &environment,
        &boost_area_coord_set,
        &field,
        &next_puyos,
    );
    let exploration_result = explorer.solve_traces_including_index(coord_index);

    match to_value(&exploration_result) {
        Ok(result) => Ok(result),
        Err(e) => Err(JsError::new(&e.to_string())),
    }
}

/// なぞりの先頭セル列 `js_prefix`(セルインデックスの配列)から始まる部分木を探索する。
/// 並列探索の細粒度分割(深さカット)用。recurse の意味は SolutionExplorer::solve_traces_with_prefix を参照。
#[wasm_bindgen]
pub fn solve_traces_with_prefix(
    js_exploration_target: JsValue,
    js_environment: JsValue,
    js_boost_area_coord_set: JsValue,
    js_field: JsValue,
    js_next_puyos: JsValue,
    js_prefix: JsValue,
    recurse: bool,
) -> Result<JsValue, JsError> {
    console_error_panic_hook::set_once();

    let exploration_target: ExplorationTarget = match from_value(js_exploration_target) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let environment: SimulationEnvironment = match from_value(js_environment) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let boost_area_coord_set: HashSet<PuyoCoord> = match from_value(js_boost_area_coord_set) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let field: Field = match from_value(js_field) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let next_puyos: NextPuyos = match from_value(js_next_puyos) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let prefix: Vec<u8> = match from_value(js_prefix) {
        Ok(v) => v,
        Err(e) => return Err(JsError::new(&e.to_string())),
    };
    let explorer = SolutionExplorer::new(
        &exploration_target,
        &environment,
        &boost_area_coord_set,
        &field,
        &next_puyos,
    );
    let exploration_result = explorer.solve_traces_with_prefix(&prefix, recurse);

    match to_value(&exploration_result) {
        Ok(result) => Ok(result),
        Err(e) => Err(JsError::new(&e.to_string())),
    }
}

///
/// 前段「ぷよ塗り」探索。
///
/// 1関数で完結させると wasm の単スレッドでは幅300でも約19秒かかり、その間 UI が
/// 固まる。そこで段ごとに分けて公開し、重い評価だけを JS が複数ワーカーへ配れる
/// ようにしてある (`docs/paint-search.md`)。JS 側は
/// 「展開 → 評価を分割 → 上位選抜」を深さ分だけ回し、最後に本番評価して
/// `paint_build_plans` へ渡す。
///
/// **分割した評価結果は必ず元の順序で組み直すこと**。順序が崩れると同点の並びが
/// 変わり、Rustネイティブバックエンドと違う結果になる。
///

fn de<T>(js_value: JsValue) -> Result<T, JsError>
where
    T: serde::de::DeserializeOwned,
{
    from_value(js_value).map_err(|e| JsError::new(&e.to_string()))
}

fn ser<T>(value: &T) -> Result<JsValue, JsError>
where
    T: serde::ser::Serialize + ?Sized,
{
    to_value(value).map_err(|e| JsError::new(&e.to_string()))
}

/// 塗り集合の中身が盤面のセル範囲に収まっているか確かめる。
///
/// これらの関数は JS から直接呼べるので、範囲外の値が来ると内部の配列添字で
/// panic (= wasm トラップ) する。JsError にして返した方が原因が分かる。
fn validate_paint_sets(paint_sets: &[Vec<usize>]) -> Result<(), JsError> {
    for cells in paint_sets {
        for &index in cells {
            if index >= paint::CELL_NUM {
                return Err(JsError::new(&format!(
                    "塗りマスの添字が範囲外です: {index} (0..{})",
                    paint::CELL_NUM
                )));
            }
        }
    }
    Ok(())
}

/// ビームを1段展開する。塗り集合(セルインデックスの配列)の配列を返す。
///
/// 空のビーム (空集合1件) を渡すと深さ1の全候補が返る。空が返ったら打ち切ること。
/// 軽い処理なので分割せずメインスレッドで呼んでよい。
#[wasm_bindgen]
pub fn paint_expand_beam(
    js_field: JsValue,
    js_next_puyos: JsValue,
    js_params: JsValue,
    minimum_puyo_num_for_popping: u32,
    js_beam: JsValue,
) -> Result<JsValue, JsError> {
    console_error_panic_hook::set_once();

    let field: Field = de(js_field)?;
    let next_puyos: NextPuyos = de(js_next_puyos)?;
    let params: PaintSearchParams = de(js_params)?;
    let beam: Vec<Vec<usize>> = de(js_beam)?;
    validate_paint_sets(&beam)?;

    let context =
        PaintBeamContext::new(&field, &next_puyos, &params, minimum_puyo_num_for_popping);

    ser(&paint_search::expand_beam(&context, &beam))
}

/// 塗り集合をまとめて評価する。**ここだけが重いので、JS がワーカーへ分割する**。
///
/// - `max_trace_num`: 代理評価なら小さい値 (`params.surrogate_trace_num`)、本番評価なら環境の値
/// - `with_solution`: 後段の最適解も返すか。最終評価のときだけ true
/// - `with_uncertainty`: `params.uncertainty` があるとき期待値も求めるか。最終評価のときだけ true
///
/// 返る評価は渡した塗り集合と同じ順序。分割したときは呼び出し側で元の順に戻すこと。
#[wasm_bindgen]
pub fn paint_evaluate_sets(
    js_exploration_target: JsValue,
    js_environment: JsValue,
    js_boost_area_coord_set: JsValue,
    js_field: JsValue,
    js_next_puyos: JsValue,
    js_params: JsValue,
    js_paint_sets: JsValue,
    max_trace_num: u32,
    with_solution: bool,
    with_uncertainty: bool,
) -> Result<JsValue, JsError> {
    console_error_panic_hook::set_once();

    let exploration_target: ExplorationTarget = de(js_exploration_target)?;
    let environment: SimulationEnvironment = de(js_environment)?;
    let boost_area_coord_set: HashSet<PuyoCoord> = de(js_boost_area_coord_set)?;
    let field: Field = de(js_field)?;
    let next_puyos: NextPuyos = de(js_next_puyos)?;
    let params: PaintSearchParams = de(js_params)?;
    let paint_sets: Vec<Vec<usize>> = de(js_paint_sets)?;
    validate_paint_sets(&paint_sets)?;

    let context = PaintBeamContext::new(
        &field,
        &next_puyos,
        &params,
        environment.minimum_puyo_num_for_popping,
    );
    let eval = PaintEvalContext {
        exploration_target: &exploration_target,
        environment: &environment,
        boost_area: &boost_area_coord_set,
        field: &field,
        next_puyos: &next_puyos,
    };

    // 期待値のサンプル列は全候補で共通にする (共通乱数法)。分割しても同じ列になるよう、
    // ワーカーごとに作らず params から毎回作り直す。
    let unknown_fills = match (with_uncertainty, params.uncertainty.as_ref()) {
        (true, Some(uncertainty)) => paint_search::make_unknown_fills(uncertainty),
        _ => Vec::new(),
    };

    let evaluations = paint_search::evaluate_paint_sets(
        &eval,
        &context,
        &paint_sets,
        max_trace_num,
        with_solution,
        &unknown_fills,
    );

    ser(&evaluations)
}

/// スコアの大きい順に上位 `count` 件の添字を返す。
///
/// JS 側で並べ替えるとタイブレークが Rust と食い違い得るので、ここを通すこと。
#[wasm_bindgen]
pub fn paint_select_top(js_scores: JsValue, count: u32) -> Result<JsValue, JsError> {
    let scores: Vec<f64> = de(js_scores)?;
    ser(&paint_search::select_top(&scores, count as usize))
}

/// 評価済みの塗り集合を、好みの優先度に従って良い順に並べて塗り案にする。
#[wasm_bindgen]
pub fn paint_build_plans(
    js_exploration_target: JsValue,
    js_paint_sets: JsValue,
    js_evaluations: JsValue,
    result_num: u32,
) -> Result<JsValue, JsError> {
    console_error_panic_hook::set_once();

    let exploration_target: ExplorationTarget = de(js_exploration_target)?;
    let paint_sets: Vec<Vec<usize>> = de(js_paint_sets)?;
    let evaluations: Vec<PaintEvaluation> = de(js_evaluations)?;
    validate_paint_sets(&paint_sets)?;

    // 塗り集合と評価は1対1で対応している前提 (評価をワーカーで分割しても順序と件数は
    // 保つ)。食い違ったまま進むと添字で panic するので、ここで断る。
    if paint_sets.len() != evaluations.len() {
        return Err(JsError::new(&format!(
            "塗り集合と評価の件数が一致しません: {} vs {}",
            paint_sets.len(),
            evaluations.len()
        )));
    }

    ser(&paint_search::build_plans(
        &exploration_target,
        &paint_sets,
        &evaluations,
        result_num as usize,
    ))
}
