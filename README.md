# LINE Stamp Maker

ブラウザだけで動く LINE スタンプ作成ツール。

## 機能

- 画像のグリッド分割
- 色ベース / AI（isnet-anime）背景除去
- LINE Creators Market 仕様の ZIP 生成（01.png〜40.png + main.png + tab.png）
- サーバー不要、画像は外部に送信されません

## 使い方

1. https://goroyattemiyo.github.io/Background-removal-splitting/ を開く
2. 画像をアップロード → 行列指定 → 分割
3. スタンプに使うセルを選択（8/16/24/32/40個）
4. 必要なら背景除去
5. ZIP ダウンロード → LINE Creators Market にアップロード

## 開発

git clone https://github.com/goroyattemiyo/Background-removal-splitting.git
npx serve .
