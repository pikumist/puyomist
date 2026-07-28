# 概要

ぷよクエのなぞり消し最適解を研究するための [Webアプリ](https://pikumist.github.io/puyomist/) です。

[![CI](https://github.com/pikumist/puyomist/actions/workflows/ci.yml/badge.svg)](https://github.com/pikumist/puyomist/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
<!-- バッジは `npm run badges` で `package-lock.json` などから生成しています。手で書き換えないでください。 -->
<!-- badges:start -->
![React 19.2.7](https://img.shields.io/badge/React-19.2.7-087EA4?logo=react&logoColor=white)
![TypeScript 5.9.3](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)
![Vite 8.1.0](https://img.shields.io/badge/Vite-8.1.0-646CFF?logo=vite&logoColor=white)
![Tailwind CSS 4.3.3](https://img.shields.io/badge/Tailwind_CSS-4.3.3-06B6D4?logo=tailwindcss&logoColor=white)
![zustand 5.0.14](https://img.shields.io/badge/zustand-5.0.14-764ABC?logo=react&logoColor=white)
![Rust 1.96.1](https://img.shields.io/badge/Rust-1.96.1-DEA584?logo=rust&logoColor=000000)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?logo=webassembly&logoColor=white)
![Vitest 4.1.9](https://img.shields.io/badge/Vitest-4.1.9-6E9F18?logo=vitest&logoColor=white)
![Storybook 10.4.6](https://img.shields.io/badge/Storybook-10.4.6-FF4785?logo=storybook&logoColor=white)
![Biome 1.9.4](https://img.shields.io/badge/Biome-1.9.4-60A5FA?logo=biome&logoColor=white)
![Node.js 24.18.0](https://img.shields.io/badge/Node.js-24.18.0-5FA04E?logo=nodedotjs&logoColor=white)
<!-- badges:end -->

特徴は

- 連鎖シミュレーション
- 属性ダメージやぷよ使いカウントを対象とした最適解計算
- なぞる前に盤面を1色に塗り替えて連鎖しやすい形を探す「ぷよ塗り探索」
- 最適解計算の簡易マルチスレッド対応
- 特別ルールの盤面リスト
- スクリーンショット画像からの盤面セット (グミのみ対応。チャンスぷよが混じると精度は悪いです)
- 外部通信なし

## 起動方法

Node.js と Rust が必要です (バージョンは [開発](docs/development.md) を参照)。

```sh
npm ci
npm run build:wasm && npm run dev
```

http://localhost:5173 にWebアプリが立ち上がります。これだけで全機能が動きます。

このほかに localhost 専用の任意サーバーが2つあります。スクリーンショットからの盤面セットを楽にする監視サーバーと、
探索を WASM の代わりにネイティブバイナリで実行して約4.3倍高速化する Rust 探索サーバーです。
詳細は [ローカルサーバー](docs/local-servers.md) を参照してください。

いずれも通信はローカルマシン内で完結するため、「外部通信なし」という特徴は変わりません。

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [開発](docs/development.md) | 必要な環境、コマンド一覧、エディタ設定 |
| [ローカルサーバー](docs/local-servers.md) | 監視サーバーと Rust ネイティブ探索サーバー |
| [調査記録](docs/research/) | 探索アルゴリズムの設計判断と実測値 |

## License

[MIT License](LICENSE)
