# Fabulor - シナリオライティングツール

## プロジェクト概要
Fabulorは、シナリオやノベルゲームのテキストを効率的に管理するためのElectronベースのデスクトップアプリケーションです。各テキストブロックにGUIDを付与し、将来的なボイスデータやローカライゼーションに対応できる設計になっています。

## 主な機能
- ブロック（段落）単位でのテキスト管理
- 各ブロックに一意のGUIDを自動付与
- YAMLベースのスキーマファイルによる柔軟なブロックタイプ定義
- プレビュー機能（小説形式・台本形式）
- プロジェクトファイル（.fbl）の保存・読み込み
- JSONエクスポート機能

## 技術スタック
- Electron
- Node.js
- Vanilla JavaScript (ES6 modules)
- js-yaml

## プロジェクト構造
```
fabulor/
├── index.html          # メインHTML
├── style.css          # スタイルシート
├── main.js            # Electronメインプロセス
├── preload.js         # プリロードスクリプト
├── scenario-manager.js # メインのアプリケーションロジック
├── modules/           # モジュール化されたコンポーネント
│   ├── block-types.js    # ブロックタイプ管理
│   ├── project-manager.js # プロジェクト管理
│   ├── paragraph-manager.js # ブロック管理
│   ├── ui-manager.js     # UI管理
│   └── preview-manager.js # プレビュー管理
└── schema-sample.yaml # スキーマファイルのサンプル
```

## コマンド
```bash
# 開発環境の起動
npm start

# 依存関係のインストール
npm install
```

## 重要な実装詳細

### ブロックタイプシステム
- 「セリフ」「地の文」は標準定義として常に含まれる
- 追加のブロックタイプはYAMLファイル（スキーマファイル）で定義
- 各タイプごとに異なるパラメータを設定可能
- `requires_text`フラグでテキスト入力の要否を制御
- スキーマファイルでは標準定義以外のカスタムタイプのみ記述

### データ構造
```javascript
// ブロックの基本構造
{
  id: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx", // GUID
  text: "テキスト内容",
  type: "dialogue", // ブロックタイプ
  tags: ["tag1", "tag2"], // タグ
  createdAt: "2025-06-18T...",
  updatedAt: "2025-06-18T...",
  // タイプ固有のパラメータ
  speaker: "キャラクター名", // セリフの場合
  emotion: "happy", // セリフの場合
  // など
}
```

### プロジェクトファイル形式（.fbl）
```json
{
  "version": "1.0.0",
  "createdAt": "2025-06-18T...",
  "schemaFile": "block-types.yaml",
  "paragraphs": [...]
}
```

## 開発時の注意点
- モジュール間の依存関係に注意
- UIの動的生成はスキーマファイルに基づいて行われる
- 変更検知（アスタリスク表示）は各種操作時に`markAsChanged()`を呼ぶ
- プレビューモーダルはCSSクラス`.show`で表示制御

## 今後の拡張予定
- ボイスデータの紐付け機能
- ローカライゼーション対応
- より高度なプレビュー形式
- エクスポート形式の拡張