# TS/Rust 手動ミラーの限界と等価性ハーネスの提言

> **これは提言の記録であり、実装ではない。** 本ドキュメントに書かれている対策・ハーネスは
> このリポジトリにまだ存在しない未実装の提案であり、実際に着手するかどうかは別途判断する。

## 背景

このリポジトリのシミュレーション本体は TypeScript (`src/logics/Simulator.ts`) と
Rust/WASM (`packages/solver-wasm/src/simulator_bb.rs`) の2実装があり、両者は「手で書き写して
同じ結果になるよう保つ」運用になっている(自動生成でも共有実装でもない)。

`fix/trace-paint-ojama` ブランチの作業だけで、この手動ミラーの**列挙漏れ**に起因するバグが
3件見つかった。いずれも Rust 側の `BitBoards` が持つ属性面(色5枚・ハート・プリズム・
おじゃま・固ぷよ・?ぷよの計9枚)を、ある操作の実装が**一部だけ**扱っていたことが原因。

1. `BitBoards::is_field_all_cleared` が `heart` を占有判定に含めていなかった
   (色・プリズム・おじゃま・固ぷよ・?ぷよの8枚しか見ていなかった)。
2. `fold_field_phase` の `TraceMode::Normal` 分岐が `question` をクリアしていなかった
   (色・ハート・プリズムの3枚しか見ていなかった)。
3. `fold_field_phase` の `TraceMode::To*` 分岐が `ojama`/`kata` をクリアしていなかった
   (色・ハート・プリズムの3枚しか見ていなかった)。

## 構造的な原因

TS 側は「1マス = 1つの型付きの値 (`PuyoType | undefined`)」として盤面を持つため、
「マスの型を問わず何か残っていれば〜」「なぞった升をすべて〜」のような操作は
`field[y][x]` を1箇所読み書きするだけで、型で場合分けする理由がない限り**自然に全属性を
網羅**する(`is_all_cleared` の TS 実装 `field.every(row => row.every(p => !p))` はその典型で、
最初からこの種のバグを構造的に起こしにくい)。

一方 Rust 側は速度のためにビットボード (`BitBoards`) で属性ごとに面を分けて持つため、
「盤面のどこかに何かある」「なぞった升を全部クリアする」といったマス横断の操作は、
実装者が9枚を**手で全部列挙**しないと成立しない。列挙を1枚でも忘れてもコンパイルは通り、
該当する属性が盤面に乗っている盤面でだけ静かに壊れる。これが手動ミラーである限り
今後も同じ形で再発し得る。

## 短期で安く効く対策(実装不要・型で縛る)

`BitBoards` に全属性面を配列で返すヘルパを1つ置き、占有計算・クリア・全消し判定を
**それ経由でしか書けない**ようにする。

```rust
impl BitBoards {
    /// 色5枚・ハート・プリズム・おじゃま・固ぷよ・?ぷよの9枚を配列で返す。
    /// 面を1枚追加/削除したら呼び出し側の配列パターンが長さ不一致でコンパイルエラーに
    /// なるようにするための唯一の列挙点。
    fn planes(&self) -> [u64; 9] {
        [
            self.colors[0], self.colors[1], self.colors[2], self.colors[3], self.colors[4],
            self.heart, self.prism, self.ojama, self.kata, /* question 追加時はここに9枚目... */
        ]
    }
}
```

(実際には `question` を含めて9枚になるよう配列サイズを合わせる。要点は「新しい属性面を
`BitBoards` に追加したら、`planes()` の配列長が変わり、それを使っている全箇所が型エラーで
落ちる」という**追加漏れを構造的に検出できる形**にすること。)

`is_field_all_cleared` や、なぞり消し・なぞり塗りでの一括クリアは、この `planes()` (と
書き込み版があれば `planes_mut()`) を経由するように書き直す。今回のバグはいずれも「全属性を
舐めるべき箇所が一部の属性だけを直書きしていた」ことが原因なので、直書きできる書き方自体を
なくすのが最も安い対策になる。

あわせて、このブランチで実際に追加した `assert_no_double_occupancy`
(`packages/solver-wasm/src/simulator_bb.rs` のテストヘルパ。2枚の属性面が同じマスを
同時に占有していないことを検査する) を `#[cfg(debug_assertions)]` の不変条件検査として
`do_chains` の各フェーズ後(ポップ後・落下後・補充後など)に常時呼ぶようにすると、
「ある属性面のクリアを1つ忘れた」という今回と同種のバグを、特定の盤面を狙ったテストを
書かなくても一般的に検出できるようになる(release ビルドではコストゼロ)。

## 自動等価性ハーネスの現実的な2段階案

### 段階1: フィクスチャ駆動の差分テスト

盤面・なぞり・環境 (`SimulationEnvironment`) を JSON で `fixtures/` に置き、vitest 側は
`Simulator.doChains()`、cargo test 側は `SimulatorBB::do_chains` で**同じフィクスチャ**を読んで
`Chain[]` を比較する。今回このブランチで手でミラーした4組
(`test_trace_paint_converts_ojama_and_kata_without_double_occupancy` /
`test_trace_paint_converts_question` / `test_trace_paint_preserves_plus` /
`test_is_field_all_cleared_counts_heart` とそれぞれの TS 版) が、そのままフィクスチャの
第一弾になる。

比較は**決定論フェーズ限定**(なぞり消し〜フィールド内落下まで)にすると素直になる。
ネクスト不足時の補充は TS が `PuyoType.Question` で埋めるのに対し Rust
(`unknown_fill: None` のとき) は空きマスのまま据え置く、という設計上の差があるため
(詳細は `docs/research/paint-search.md` の不確定ぷよの扱いを参照)、補充が絡むフェーズまで
比較しようとすると本質的でない差分をハーネス側で吸収する必要が出て複雑になる。

### 段階2: ランダム盤面でのソルバ結果の突き合わせ

CI で固定シードのランダム盤面 N 件・小さい `max_trace_num` について、WASM の
`solve_all_traces` (または `paint_search` 相当) と TS の `solveAllTraces` を実行し、
`candidates_num` と最適解 (`optimal_solutions[0]`) を突き合わせる。段階1がロジックの
最小単位(1回の `do_chains`)を守るのに対し、段階2は探索器全体を通した結果の一致を
広く(手で個々のケースを書かなくても)守れる。`packages/solver-wasm/src/bin/common/mod.rs`
に既にランダム盤面生成 (`random_board`) があるので、シード固定・盤面生成そのものは流用できる
見込み。

## まとめ

- 原因は言語間のデータ表現の非対称 (TS: マス単位の値 / Rust: 属性面ごとのビットボード) にあり、
  手動ミラーを続ける限り構造的に再発し得る。
- 実装なしで効く対策として、`BitBoards` の全属性面を1箇所に列挙する `planes()` ヘルパと、
  `assert_no_double_occupancy` の `do_chains` 内での常時実行(debug限定)を提案する。
- 自動ハーネスは (1) フィクスチャ駆動の `do_chains` 差分テスト、(2) ランダム盤面での
  ソルバ結果突き合わせ、の2段階が現実的だが、**どちらも本ブランチでは未着手**。
