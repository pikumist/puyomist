# 概要

ぷよクエのなぞり消し最適解を研究するための [Webアプリ](https://pikumist.github.io/puyomist/) です。

特徴は

- 連鎖シミュレーション
- 属性ダメージやぷよ使いカウントを対象とした最適解計算
- 最適解計算の簡易マルチスレッド対応
- 特別ルールの盤面リスト
- スクリーンショット画像からの盤面セット (チャンスぷよが混じると精度は悪いです)
- 外部通信なし

## ローカル環境でのプログラム実行方法

###

### Webアプリ

```sh
npm run dev
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

## License

[MIT License](LICENSE)
