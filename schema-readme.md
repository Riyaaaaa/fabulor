# Fabulor - シナリオライティングツール

## スキーマファイルについて

Fabulor では、ブロックタイプとパラメータを YAML ファイル（スキーマファイル）で定義できます。

### スキーマファイルの仕様

スキーマファイルは `block-types.yaml` として保存され、以下の構造で定義します：

```yaml
block_types:
  dialogue:
    label: "セリフ"
    description: "キャラクターの台詞"
    requires_text: true
    parameters:
      speaker:
        type: "text"
        label: "話者"
        placeholder: "キャラクター名"
        default: ""
        required: false
      emotion:
        type: "select"
        label: "感情"
        default: ""
        required: false
        options:
          - value: ""
            label: "なし"
          - value: "happy"
            label: "喜び"
```

### パラメータタイプ

- **text**: テキスト入力フィールド
- **number**: 数値入力フィールド（min, step オプション対応）
- **select**: セレクトボックス（options で選択肢を定義）

### プロジェクトファイルとの連携

プロジェクトファイル（.fbl）には `schemaFile` フィールドが含まれ、使用するスキーマファイル名が記録されます。プロジェクトを開く際、同じディレクトリからスキーマファイルが自動的にロードされます。

### カスタムスキーマの作成

1. プロジェクトディレクトリに独自の YAML ファイルを作成
2. ブロックタイプとパラメータを定義
3. プロジェクトファイルの `schemaFile` を更新（手動編集）
4. プロジェクトを再読み込み

これにより、プロジェクトごとに異なるブロック定義を使用できます。