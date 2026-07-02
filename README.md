# 概要

ぷよクエのなぞり消し最適解を研究するための [Webアプリ](https://pikumist.github.io/puyomist/) です。

特徴は

- 連鎖シミュレーション
- 属性ダメージやぷよ使いカウントを対象とした最適解計算
- 最適解計算の簡易マルチスレッド対応
- 特別ルールの盤面リスト
- スクリーンショット画像からの盤面セット (グミのみ対応。チャンスぷよが混じると精度は悪いです)
- 外部通信なし

## 技術スタック

- ビルド: Vite 8
- UI: React 19 + Tailwind CSS v4 + shadcn/ui (Base UI / base-vega) + lucide-react
- 状態管理: zustand
- テーマ: CSS トークン + next-themes (class 方式)
- テスト: Vitest 4 + Testing Library + jsdom、カタログは Storybook
- Lint/Format: Biome
- コア: 連鎖シミュレータ・ソルバ (`src/logics/`) と Rust 製 WASM ソルバ (`packages/solver-wasm/`)

## 必要な環境

- node.js 22.4.x
- Rust 1.79.0
- wasm-pack 0.13.0

## ローカル環境でのプログラム実行方法

起動できるものは以下の3つです。Webアプリだけあれば動作し、残り2つは localhost 専用の任意サーバーです。

| 用途 | コマンド | 待受 | 必須/任意 |
| --- | --- | --- | --- |
| Webアプリ | `npm run build:wasm && npm run dev` | http://localhost:5173 | 必須 |
| スクリーンショット監視サーバー | `npm run server -- [監視ディレクトリ]` | http://localhost:3000 | 任意 |
| Rust ネイティブ探索サーバー | `npm run solver-server` | ws://localhost:3011 | 任意 |

いずれも通信はローカルマシン内で完結するため、「外部通信なし」という特徴は変わりません。各項目の詳細は以下の通りです。

### Webアプリ

```sh
npm run build:wasm && npm run dev
```

http://localhost:5173 にWebアプリが立ち上がります。

### 監視サーバー (任意)

スクリーンショット画像からの盤面セットを楽にするためのサーバーです。
予め登録された監視ディレクトリの中にファイルが追加されると、WebSocket経由でWebアプリに画像ファイルを通知します。
別になくても、Webアプリからも盤面セットはできます。

```sh
npm run server -- [監視するディレクトリのパス]
```

http://localhost:3000 にスクリーンショット画像の監視サーバーが立ち上がります。

デフォルトの監視ディレクトリパスは `/media/ipad/DCIM/100`

### Rust ネイティブ探索サーバー (任意)

最適解計算 (トレース探索) を、WASM の代わりにネイティブバイナリで実行する localhost 専用のオプション機能です。
ハードウェア PEXT (BMI2) を使えるため、WASM 版に比べて約4.3倍高速に探索できます。

```sh
npm run solver-server
```

http://localhost:3011 (WebSocket) にネイティブ探索サーバーが立ち上がります。

Webアプリは `window.location.hostname === 'localhost'` の場合のみこのサーバーへの接続を試み、探索法のプルダウンから選択できるようになります。それ以外の環境 (GitHub Pages など) では選択できません。

なくても、ソフトは通常通り動作しますが、BMI2(PEXT/PDEP)に対応しているCPUではあった方が探索が速いです。

## 開発

VSCodeで開発する際は、ワークスペースファイルを用意してあるのでそれを開きます。

```sh
code my.code-workspace
```

わざわざワークスペースファイルを用意しているのは、`Cargo.toml` がワークスペースのトップディレクトリ内にないと、rust-analyzer がプロジェクトの特定に失敗してしまうからです。プロジェクトの絶対パスを指定すれば動かせますが、環境に依存してしまうのでそれは避けています。

## License

[MIT License](LICENSE)
