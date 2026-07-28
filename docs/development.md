# 開発

## 必要な環境

- Node.js — バージョンは [`.nvmrc`](../.nvmrc) に従います
- Rust — バージョンは [`packages/solver-wasm/rust-toolchain.toml`](../packages/solver-wasm/rust-toolchain.toml) に従います。rustup 経由なら自動で切り替わります

wasm-pack は devDependencies に含まれるため、`npm ci` で入ります。個別のインストールは不要です。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run build:wasm` | Rust ソルバを WASM にビルド (`packages/solver-wasm/pkg` を生成) |
| `npm run dev` | 開発サーバー起動 (http://localhost:5173)。事前に `build:wasm` が必要 |
| `npm run build` | WASM ビルド + 型チェック + 本番ビルド |
| `npm run preview` | 本番ビルドをローカルで確認 |
| `npm run lint` | Biome による Lint |
| `npm test` | Vitest (watch) |
| `npm run coverage` | Vitest + カバレッジ計測 |
| `npm run test-wasm` | Rust 側のテスト (`cargo test`) |
| `npm run bench-wasm` | Rust 側のベンチマーク (`cargo bench`) |
| `npm run storybook` | Storybook 起動 (http://localhost:6006) |
| `npm run badges` | README の技術スタックバッジを再生成 |
| `npm run badges:check` | バッジがズレていないか検査 (CI が実行) |
| `npm run server` / `npm run solver-server` | 補助サーバー。[ローカルサーバー](local-servers.md) を参照 |

`packages/solver-wasm` を書き換えたら `npm run build:wasm` をやり直してください。Vite の開発サーバーは
生成済みの `pkg` を読むため、Rust の変更は自動では反映されません。

## エディタ (任意)

VSCode を使う場合のために、ワークスペースファイルを用意してあります。

```sh
code my.code-workspace
```

`Cargo.toml` がワークスペースのトップディレクトリ内にないと rust-analyzer がプロジェクトの特定に失敗するため、
プロジェクトの絶対パスを指定せずに済ませる手段としてこれを置いています。
VSCode 以外を使う場合は不要です。

## ドキュメント

探索アルゴリズムの設計判断と、その根拠になった実測値は [調査記録](research/) にまとめてあります。
`src/logics/` や `packages/solver-wasm/` のコードコメントからも参照しています。
