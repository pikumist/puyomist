//! localhost 専用のネイティブ探索サーバー (WebSocket)。
//!
//! WASM 版と同じ探索器 (SolutionExplorer) を、ハードウェア PEXT (BMI2) が効くネイティブ
//! バイナリとして動かし、フロントエンドの並列探索 (48開始インデックス + 重いインデックスの
//! prefix分割) と同じ分割戦略をサーバー側で再現して rayon で並列実行する。
//!
//! `server` フィーチャー限定のバイナリなので、`wasm-pack build` (デフォルトフィーチャー) には
//! 一切影響しない。
//!
//! README の「外部通信なし」を維持するため、127.0.0.1 のみへバインドする
//! (フロントエンド側は window.location.hostname === 'localhost' の場合のみ接続を試みる想定)。
//! 通信はすべてこのマシン内で完結する。
//!
//! 起動:
//!   cargo run --release --features server --bin solver-server
//!   RUSTFLAGS="-C target-cpu=native" cargo run --release --features server --bin solver-server  # ハードウェアPEXT
//!   PORT=3011 で待受ポートを上書きできる (既定 3011)。
//!
//! ワイヤープロトコル (WebSocket 上の JSON):
//!   client -> server: { type: "solve", exploration_target, environment, boost_area_coords: [{x,y},...], field, next_puyos }
//!   client -> server: { type: "abort" }
//!   server -> client: { type: "partial", candidates_num, optimal_solutions, ideal_share }  (完了タスクごと)
//!   server -> client: { type: "done" }
//!   server -> client: { type: "error", message }

use std::collections::HashSet;
use std::env;
use std::io;
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tungstenite::http::StatusCode;
use tungstenite::{Message, WebSocket};

use solver::exploration_target::ExplorationTarget;
use solver::how_many_traces::count_candidates_num_for_each_indexes;
use solver::puyo::{Field, NextPuyos};
use solver::puyo_coord::PuyoCoord;
use solver::simulation_environment::SimulationEnvironment;
use solver::solution::{ExplorationResult, SolutionResult};
use solver::solution_explorer::SolutionExplorer;

const DEFAULT_PORT: u16 = 3011;
/// 未読メッセージのポーリング周期。abort/close の検知と部分結果の送出の両方をこの周期で行う。
const POLL_INTERVAL: Duration = Duration::from_millis(20);

fn main() {
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_PORT);
    let bmi2 = cfg!(target_feature = "bmi2");

    eprintln!(
        "[solver-server] bmi2(hw PEXT)={} rayon_threads={}",
        bmi2,
        rayon::current_num_threads()
    );
    eprintln!(
        "[solver-server] ローカル専用サーバーです。127.0.0.1:{} でのみ待ち受けます (外部通信なし)。",
        port
    );

    let listener = match TcpListener::bind(("127.0.0.1", port)) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[solver-server] bind failed: {e}");
            std::process::exit(1);
        }
    };

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                thread::spawn(move || handle_connection(stream));
            }
            Err(e) => eprintln!("[solver-server] accept error: {e}"),
        }
    }
}

//
// ワイヤープロトコル
//

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
// Solve は盤面データを持つため大きいが、リクエスト毎に1回作られるだけなので許容する。
#[allow(clippy::large_enum_variant)]
enum ClientMessage {
    Solve {
        exploration_target: ExplorationTarget,
        environment: SimulationEnvironment,
        boost_area_coords: Vec<PuyoCoord>,
        field: Field,
        next_puyos: NextPuyos,
    },
    Abort,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerMessage<'a> {
    Partial {
        candidates_num: u64,
        optimal_solutions: &'a [SolutionResult],
        ideal_share: f64,
    },
    Done,
    Error {
        message: String,
    },
}

/// 1タスク分の探索完了通知。ワーカースレッド (rayon) から接続スレッドへ mpsc で渡す。
struct PartialUpdate {
    result: ExplorationResult,
    ideal_share: f64,
}

//
// 接続ハンドリング
//

/// WebSocket ハンドシェイクの `Origin` を検証する。
///
/// 127.0.0.1 のみへバインドしていてもリモート TCP 接続を防げるだけで、ブラウザからの
/// クロスサイト WebSocket 接続 (CORS は WS を保護しない) は防げない。solver-server が
/// 起動している間、ユーザーが開いた任意の悪意あるサイトが `ws://localhost:3011` へ接続して
/// 重い探索を走らせられてしまう。これを防ぐため、ブラウザが必ず送る `Origin` が
/// localhost / 127.0.0.1 のいずれでもない場合はハンドシェイクを拒否する。
///
/// `Origin` が無いリクエスト (Node の ws クライアントや curl 等、ブラウザ以外のローカルツール) は
/// 許可する。ブラウザは WS ハンドシェイクで常に `Origin` を送り、スクリプトから偽装できないため、
/// 「Origin 無し ⇒ ブラウザ以外 ⇒ 許可」でブラウザ経由のクロスサイト脅威は塞げる。
fn is_allowed_origin(origin: &str) -> bool {
    // origin 例: "http://localhost:5173" / "http://127.0.0.1:5173"
    let host = origin
        .split("://")
        .nth(1)
        .unwrap_or(origin)
        .split('/')
        .next()
        .unwrap_or("");
    // ポートを取り除いてホスト名だけを見る。
    let hostname = host.rsplit_once(':').map(|(h, _)| h).unwrap_or(host);
    hostname == "localhost" || hostname == "127.0.0.1" || hostname == "[::1]"
}

fn handle_connection(stream: TcpStream) {
    let peer = stream.peer_addr().ok();
    let check_origin = |req: &Request, res: Response| -> Result<Response, ErrorResponse> {
        if let Some(origin) = req.headers().get("origin") {
            let allowed = origin
                .to_str()
                .map(is_allowed_origin)
                .unwrap_or(false);
            if !allowed {
                eprintln!("[solver-server] rejected cross-site origin: {origin:?}");
                let mut err = ErrorResponse::new(Some(
                    "origin not allowed (localhost only)".to_string(),
                ));
                *err.status_mut() = StatusCode::FORBIDDEN;
                return Err(err);
            }
        }
        Ok(res)
    };
    let mut websocket = match tungstenite::accept_hdr(stream, check_origin) {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("[solver-server] handshake failed: {e}");
            return;
        }
    };
    eprintln!("[solver-server] client connected: {:?}", peer);

    if let Err(e) = websocket.get_ref().set_read_timeout(Some(POLL_INTERVAL)) {
        eprintln!("[solver-server] failed to set read timeout: {e}");
    }

    // 現在実行中の探索 (abort フラグと結果受信チャネル)。同時に1件のみ。
    //
    // abort/新しい Solve が来た時点でこの Option を即座に取り除き (rx を drop する)、
    // それ以降そのタスクから送られてくる部分結果は誰も受信しないため自然に読み捨てられる
    // (mpsc の Sender::send は受信側が無くても panic せず Err を返すだけ)。
    // これにより「まだ実行中の重いタスクが終わるまで新しい探索を受け付けられない」状態を防ぐ。
    // 打ち切られた側のタスク自身は (専用スレッドプールの上で) バックグラウンドで動き続けるが、
    // 新しい探索とワーカースレッドを奪い合わないよう、探索ごとに専用の rayon ThreadPool を使う
    // (run_solve 参照)。
    let mut current: Option<(Arc<AtomicBool>, mpsc::Receiver<PartialUpdate>)> = None;

    'conn: loop {
        // 1. 完了タスクの部分結果を吐き出す。
        if let Some((_, rx)) = &current {
            loop {
                match rx.try_recv() {
                    Ok(update) => {
                        if send_partial(&mut websocket, &update).is_err() {
                            break 'conn;
                        }
                    }
                    Err(mpsc::TryRecvError::Empty) => break,
                    Err(mpsc::TryRecvError::Disconnected) => {
                        let ok = send_message(&mut websocket, &ServerMessage::Done);
                        current = None;
                        if ok.is_err() {
                            break 'conn;
                        }
                        break;
                    }
                }
            }
        }

        // 2. クライアントからのメッセージを (タイムアウト付きで) 読む。
        match websocket.read() {
            Ok(Message::Text(text)) => match serde_json::from_str::<ClientMessage>(&text) {
                Ok(ClientMessage::Solve {
                    exploration_target,
                    environment,
                    boost_area_coords,
                    field,
                    next_puyos,
                }) => {
                    // 実行中の探索があれば、その結果を待たずに即座に打ち切って置き換える。
                    // (打ち切られた側は abort_flag=true のまま専用スレッドプール上で終息する)
                    if let Some((old_flag, _old_rx)) = current.take() {
                        old_flag.store(true, Ordering::Relaxed);
                    }
                    let boost_area_coord_set: HashSet<PuyoCoord> =
                        boost_area_coords.into_iter().collect();
                    let abort_flag = Arc::new(AtomicBool::new(false));
                    let thread_abort_flag = Arc::clone(&abort_flag);
                    let (tx, rx) = mpsc::channel();
                    thread::spawn(move || {
                        run_solve(
                            &exploration_target,
                            &environment,
                            &boost_area_coord_set,
                            &field,
                            &next_puyos,
                            &thread_abort_flag,
                            tx,
                        );
                    });
                    current = Some((abort_flag, rx));
                }
                Ok(ClientMessage::Abort) => {
                    if let Some((flag, _)) = current.take() {
                        flag.store(true, Ordering::Relaxed);
                    }
                }
                Err(e) => {
                    let _ = send_message(
                        &mut websocket,
                        &ServerMessage::Error {
                            message: format!("不正なメッセージ: {e}"),
                        },
                    );
                }
            },
            Ok(Message::Close(_)) => {
                if let Some((flag, _)) = &current {
                    flag.store(true, Ordering::Relaxed);
                }
                break;
            }
            // ping/pong/binary/生フレームは無視する (ping には tungstenite が内部で自動応答する)。
            Ok(_) => {}
            Err(tungstenite::Error::Io(ref e))
                if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut =>
            {
                // 未着信。ループを継続して部分結果の送出を続ける。
            }
            Err(tungstenite::Error::ConnectionClosed) | Err(tungstenite::Error::AlreadyClosed) => {
                if let Some((flag, _)) = &current {
                    flag.store(true, Ordering::Relaxed);
                }
                break;
            }
            Err(e) => {
                eprintln!("[solver-server] read error: {e}");
                if let Some((flag, _)) = &current {
                    flag.store(true, Ordering::Relaxed);
                }
                break;
            }
        }
    }

    // 接続終了時は実行中の探索があれば止める。
    if let Some((flag, _)) = &current {
        flag.store(true, Ordering::Relaxed);
    }
    eprintln!("[solver-server] client disconnected: {:?}", peer);
}

fn send_partial(
    websocket: &mut WebSocket<TcpStream>,
    update: &PartialUpdate,
) -> tungstenite::Result<()> {
    send_message(
        websocket,
        &ServerMessage::Partial {
            candidates_num: update.result.candidates_num,
            optimal_solutions: &update.result.optimal_solutions,
            ideal_share: update.ideal_share,
        },
    )
}

fn send_message(
    websocket: &mut WebSocket<TcpStream>,
    message: &ServerMessage,
) -> tungstenite::Result<()> {
    let json = serde_json::to_string(message).expect("ServerMessage のシリアライズに失敗");
    websocket.send(Message::text(json))
}

//
// タスク分割 (フロントエンドの src/store/internal/solve.ts _createSolveAllInParallel と同じ戦略)
//

enum TaskKind {
    /// 開始インデックス 1 件をまるごと 1 タスクとして評価する (軽いインデックス用)。
    Index(u8),
    /// `solve_traces_with_prefix(prefix, recurse)` と同じ意味。
    /// 重いインデックス i を、幹 `([i], false)` と葉 `([i, j], true)` に分割するために使う。
    Prefix(Vec<u8>, bool),
}

struct Task {
    kind: TaskKind,
    /// LPT (Longest Processing Time) スケジューリング用の重み。重いタスクから先に流す。
    weight: f64,
    /// 進捗計算用の理想候補数シェア。フロントエンドの traceCandidatesNumMap 由来の値と同じ考え方。
    ideal_share: f64,
}

/// 開始インデックス i の正準な 2 セル目候補 (8 近傍のうちインデックスが i より大きいもの)。
/// フロントエンドの secondCellCandidates と同じ規則。
fn second_cell_candidates(i: u8) -> Vec<u8> {
    let x_num = PuyoCoord::X_NUM as i32;
    let y_num = PuyoCoord::Y_NUM as i32;
    let x = (i as i32) % x_num;
    let y = (i as i32) / x_num;
    let mut res = Vec::new();
    for dy in -1..=1 {
        for dx in -1..=1 {
            if dx == 0 && dy == 0 {
                continue;
            }
            let nx = x + dx;
            let ny = y + dy;
            if nx < 0 || nx >= x_num || ny < 0 || ny >= y_num {
                continue;
            }
            let j = (ny * x_num + nx) as u8;
            if j > i {
                res.push(j);
            }
        }
    }
    res
}

/// 48開始インデックスを、`concurrency` に対して「重すぎる」インデックスだけ
/// prefix分割 (幹+葉) するタスクリストを組み立てる。
fn build_tasks(max_trace_num: u32, concurrency: usize) -> Vec<Task> {
    let ideal = count_candidates_num_for_each_indexes(max_trace_num);
    let ideal_total: u64 = ideal.iter().sum();
    let split_threshold = if ideal_total > 0 {
        ideal_total as f64 / concurrency.max(1) as f64
    } else {
        f64::INFINITY
    };

    let mut tasks = Vec::new();
    let start_index_num = PuyoCoord::X_NUM * PuyoCoord::Y_NUM;
    for i in 0u8..start_index_num {
        let w = ideal[i as usize] as f64;
        if w > split_threshold {
            let children = second_cell_candidates(i);
            let share = if !children.is_empty() {
                w / children.len() as f64
            } else {
                w
            };
            // 幹 {i} (1候補のみ)
            tasks.push(Task {
                kind: TaskKind::Prefix(vec![i], false),
                weight: 1.0,
                ideal_share: 0.0,
            });
            // 葉 [i, j] (それぞれ i, j 始まりの全拡張)
            for j in children {
                tasks.push(Task {
                    kind: TaskKind::Prefix(vec![i, j], true),
                    weight: share,
                    ideal_share: share,
                });
            }
        } else {
            tasks.push(Task {
                kind: TaskKind::Index(i),
                weight: w,
                ideal_share: w,
            });
        }
    }
    // 重いタスクから先に流す (LPT)。rayon の work-stealing により動的に均される。
    tasks.sort_by(|a, b| {
        b.weight
            .partial_cmp(&a.weight)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    tasks
}

/// タスク分割を実行し、rayon で並列に解いて、完了したタスクごとに `tx` へ結果を送る。
fn run_solve(
    exploration_target: &ExplorationTarget,
    environment: &SimulationEnvironment,
    boost_area_coord_set: &HashSet<PuyoCoord>,
    field: &Field,
    next_puyos: &NextPuyos,
    abort_flag: &AtomicBool,
    tx: Sender<PartialUpdate>,
) {
    let explorer = SolutionExplorer::new(
        exploration_target,
        environment,
        boost_area_coord_set,
        field,
        next_puyos,
    );

    let actual_max_trace_num = if environment.is_chance_mode {
        5
    } else {
        environment.max_trace_num
    };
    let concurrency = rayon::current_num_threads();
    let tasks = build_tasks(actual_max_trace_num, concurrency);

    let bmi2 = cfg!(target_feature = "bmi2");
    eprintln!(
        "[solver-server] solve start: max_trace_num={} tasks={} bmi2={}",
        actual_max_trace_num,
        tasks.len(),
        bmi2
    );
    let start = Instant::now();

    // グローバル rayon プールではなく、この探索専用の ThreadPool 上で実行する。
    // 新しい Solve が来ると abort されたまま裏で走り続けるタスクがあり得るため、
    // 使い回しのグローバルプールだと打ち切り済みの探索と新しい探索がワーカースレッドを
    // 奪い合ってしまう。専用プールにしておけば打ち切られた側は自分のプール上でのみ
    // 消費され、新しい探索の応答性に影響しない。
    let run = move || run_tasks(&tasks, &explorer, abort_flag, tx);
    match rayon::ThreadPoolBuilder::new()
        .num_threads(concurrency)
        .build()
    {
        Ok(pool) => pool.install(run),
        Err(e) => {
            eprintln!(
                "[solver-server] failed to build dedicated thread pool: {e}; falling back to ambient pool"
            );
            run();
        }
    }

    eprintln!(
        "[solver-server] solve done: max_trace_num={} elapsed={:.2}ms aborted={}",
        actual_max_trace_num,
        start.elapsed().as_secs_f64() * 1000.0,
        abort_flag.load(Ordering::Relaxed)
    );
}

/// タスク列を並列実行し、完了したタスクごとに `tx` へ結果を送る (現在の rayon プール上で実行される)。
fn run_tasks(
    tasks: &[Task],
    explorer: &SolutionExplorer,
    abort_flag: &AtomicBool,
    tx: Sender<PartialUpdate>,
) {
    tasks.par_iter().for_each_with(tx, |tx, task| {
        if abort_flag.load(Ordering::Relaxed) {
            return;
        }
        let result = match &task.kind {
            TaskKind::Index(i) => explorer.solve_traces_including_index(*i),
            TaskKind::Prefix(prefix, recurse) => {
                explorer.solve_traces_with_prefix(prefix, *recurse)
            }
        };
        if let Some(result) = result {
            if abort_flag.load(Ordering::Relaxed) {
                return;
            }
            let _ = tx.send(PartialUpdate {
                result,
                ideal_share: task.ideal_share,
            });
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use solver::exploration_target::{ExplorationCategory, PreferenceKind};
    use solver::puyo::Puyo;
    use solver::puyo_attr::PuyoAttr;
    use solver::puyo_type::PuyoType;
    use solver::trace_mode::TraceMode;

    /// bench_natsuama.rs と同じ標準ベンチ盤面 (なつアマ/1) を構築する。
    fn build_bench_scenario(
        max_trace_num: u32,
    ) -> (
        ExplorationTarget,
        SimulationEnvironment,
        HashSet<PuyoCoord>,
        Field,
        NextPuyos,
    ) {
        let r = PuyoType::Red;
        let b = PuyoType::Blue;
        let g = PuyoType::Green;
        let y = PuyoType::Yellow;
        let p = PuyoType::Purple;
        let h = PuyoType::Heart;
        let w = PuyoType::Prism;

        let mut id_counter = 0i32;
        let field = [
            [b, g, y, r, b, r, p, r],
            [g, r, g, h, w, b, y, r],
            [g, g, p, p, b, p, r, y],
            [b, b, b, r, g, b, r, y],
            [r, r, g, y, r, g, p, y],
            [g, r, g, y, y, g, g, p],
        ]
        .map(|row| {
            row.map(|puyo_type| {
                id_counter += 1;
                Some(Puyo {
                    id: id_counter,
                    puyo_type,
                })
            })
        });
        let next_puyos = [p, p, p, p, p, p, p, p].map(|puyo_type| {
            id_counter += 1;
            Some(Puyo {
                id: id_counter,
                puyo_type,
            })
        });

        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num,
            trace_mode: TraceMode::ToPurple,
            popping_leverage: 7.5,
            chain_leverage: 10.5,
        };

        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: Vec::from([
                PreferenceKind::BiggerValue,
                PreferenceKind::ChancePop,
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::SmallerTraceNum,
            ]),
            optimal_solution_count: 1,
            main_attr: Some(PuyoAttr::Purple),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };

        (
            exploration_target,
            environment,
            HashSet::new(),
            field,
            next_puyos,
        )
    }

    /// このテストシナリオで使われている PreferenceKind についてのみ判定できる比較関数。
    /// solution_explorer.rs 内の better_solution 系のロジックのサブセットを再実装したもの。
    fn is_a_better(priorities: &[PreferenceKind], a: &SolutionResult, b: &SolutionResult) -> bool {
        for p in priorities {
            match p {
                PreferenceKind::BiggerValue => {
                    if a.value > b.value {
                        return true;
                    }
                    if a.value < b.value {
                        return false;
                    }
                }
                PreferenceKind::ChancePop => {
                    if a.popped_chance_num > 0 && b.popped_chance_num == 0 {
                        return true;
                    }
                    if a.popped_chance_num == 0 && b.popped_chance_num > 0 {
                        return false;
                    }
                }
                PreferenceKind::PrismPop => {
                    if a.popped_prism_num > 0 && b.popped_prism_num == 0 {
                        return true;
                    }
                    if a.popped_prism_num == 0 && b.popped_prism_num > 0 {
                        return false;
                    }
                }
                PreferenceKind::AllClear => {
                    if a.is_all_cleared && !b.is_all_cleared {
                        return true;
                    }
                    if !a.is_all_cleared && b.is_all_cleared {
                        return false;
                    }
                }
                PreferenceKind::SmallerTraceNum => {
                    if a.trace_coords.len() < b.trace_coords.len() {
                        return true;
                    }
                    if a.trace_coords.len() > b.trace_coords.len() {
                        return false;
                    }
                }
                _ => {} // このテストのシナリオでは使わない PreferenceKind
            }
        }
        false
    }

    #[test]
    fn test_is_allowed_origin() {
        // localhost / 127.0.0.1 (任意ポート・スキーム) は許可。
        assert!(is_allowed_origin("http://localhost:5173"));
        assert!(is_allowed_origin("http://localhost:4173"));
        assert!(is_allowed_origin("http://127.0.0.1:5173"));
        assert!(is_allowed_origin("https://localhost"));
        assert!(is_allowed_origin("http://[::1]:5173"));
        // 外部サイトは拒否 (クロスサイト WebSocket 対策)。
        assert!(!is_allowed_origin("https://evil.com"));
        assert!(!is_allowed_origin("http://localhost.evil.com"));
        assert!(!is_allowed_origin("https://pikumist.github.io"));
        assert!(!is_allowed_origin("null"));
    }

    #[test]
    fn test_second_cell_candidates_only_larger_neighbors() {
        // 左上隅 (index 0): 右(1), 下(8), 右下(9) のみが候補。
        let mut c0 = second_cell_candidates(0);
        c0.sort();
        assert_eq!(c0, vec![1, 8, 9]);

        // 右下隅 (index 47 = x7,y5): index より大きい近傍は存在しない。
        assert_eq!(second_cell_candidates(47), Vec::<u8>::new());
    }

    #[test]
    fn test_build_tasks_covers_all_48_start_indexes() {
        // concurrency=1 なら分割は起きず、48個のインデックスタスクのみになるはず。
        let tasks = build_tasks(6, 1);
        assert_eq!(tasks.len(), 48);
        let mut indexes: Vec<u8> = tasks
            .iter()
            .map(|t| match &t.kind {
                TaskKind::Index(i) => *i,
                TaskKind::Prefix(..) => panic!("concurrency=1 では分割されないはず"),
            })
            .collect();
        indexes.sort();
        assert_eq!(indexes, (0u8..48).collect::<Vec<_>>());
    }

    /// タスク分割 (build_tasks) による列挙が、solve_all_traces() の列挙を
    /// 過不足なく分割していること (partition であること) を検証する。
    /// - candidates_num の総和が一致すること (数え上げの網羅性・排他性)
    /// - 最良解が、いずれか1つのタスクの最良解と完全一致すること (正しさ)
    #[test]
    fn test_task_split_partitions_solve_all_traces() {
        let max_trace_num = 6;
        let (exploration_target, environment, boost_area_coord_set, field, next_puyos) =
            build_bench_scenario(max_trace_num);
        let explorer = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &boost_area_coord_set,
            &field,
            &next_puyos,
        );

        let expected = explorer.solve_all_traces();
        assert!(
            expected.candidates_num > 0,
            "テスト盤面・条件がおかしい (候補0件)"
        );

        // 複数の concurrency 値でも partition が崩れないことを確認する。
        for &concurrency in &[1usize, 4, 8] {
            let tasks = build_tasks(max_trace_num, concurrency);

            let mut candidates_num = 0u64;
            let mut best: Option<SolutionResult> = None;

            for task in &tasks {
                let result = match &task.kind {
                    TaskKind::Index(i) => explorer.solve_traces_including_index(*i).unwrap(),
                    TaskKind::Prefix(prefix, recurse) => {
                        explorer.solve_traces_with_prefix(prefix, *recurse).unwrap()
                    }
                };
                candidates_num += result.candidates_num;
                for s in result.optimal_solutions {
                    let replace = match &best {
                        None => true,
                        Some(b) => is_a_better(&exploration_target.preference_priorities, &s, b),
                    };
                    if replace {
                        best = Some(s);
                    }
                }
            }

            assert_eq!(
                candidates_num, expected.candidates_num,
                "concurrency={concurrency}: candidates_num の総和が solve_all_traces と不一致"
            );

            let expected_best = expected.optimal_solutions.first().unwrap();
            let actual_best = best.expect("いずれかのタスクから最良解が見つかるはず");
            assert_eq!(
                actual_best.trace_coords, expected_best.trace_coords,
                "concurrency={concurrency}: 最良解のなぞり位置が不一致"
            );
            assert_eq!(
                actual_best.value, expected_best.value,
                "concurrency={concurrency}: 最良解の値が不一致"
            );
        }
    }
}
