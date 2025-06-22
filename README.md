# Fabulor - シナリオライティングツール

![Fabulor Preview](fabulor_preview.png)

## 特徴

### 🎯 ブロック単位での管理

### 📝 柔軟なブロックタイプ定義
- YAMLベースのスキーマファイルによる柔軟なブロックタイプ定義
- 標準定義（セリフ・地の文）に加えてカスタムタイプを追加可能
- キャラクター管理と感情設定

### 🎭 プレビュー機能
- 小説形式プレビュー
- 台本形式プレビュー（話者名付きセリフ表示）

### 🗂️ シーンベース管理

### 📊 エクスポート機能

### 📥 テキストインポート

## インストール方法

### 前提条件
- Node.js (v16以上)
- npm または yarn

### 1. リポジトリのクローン
```bash
git clone https://github.com/your-username/fabulor.git
cd fabulor
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. アプリケーションの起動
```bash
npm start
```

## 使い方

### 1. プロジェクトの作成

#### 新規プロジェクト
1. アプリ起動時に「新規プロジェクト作成」ボタンをクリック
2. プロジェクトファイル（.fbl）の保存場所を選択
3. スキーマファイルとキャラクターファイルが自動生成されます

#### 既存プロジェクトを開く
- アプリ起動時の最近のプロジェクト一覧からクリック
- または「ファイルから開く」でプロジェクトファイルを選択

### 2. シーンの管理

#### シーンの作成
1. 左サイドバーの「+ 新規シーン」ボタンをクリック
2. シーン名を入力してファイルを保存

#### シーンの切り替え
- 左サイドバーのシーン一覧から任意のシーンをクリック

#### シーン名の編集
- シーン名をダブルクリックして直接編集

### 3. ブロック（段落）の編集

#### ブロックの追加
1. 右サイドバーの「+ 新規ブロック」ボタンをクリック
2. 選択中のブロックの次に新しいブロックが挿入されます

#### ブロックタイプの設定
1. エディタでブロックを選択
2. 「タイプ」ドロップダウンから種類を選択
   - **セリフ**: キャラクターの台詞
   - **地の文**: 説明文・描写
   - **カスタムタイプ**: スキーマファイルで定義したタイプ

#### ブロックパラメータの設定
- **セリフブロック**: 話者名、感情を設定
- **カスタムブロック**: スキーマファイルで定義したパラメータを設定

### 4. テキストインポート

#### テキストファイルからシーン生成
1. 「テキスト→シーン」ボタンをクリック
2. テキストファイル（.txt）を選択
3. 自動的にセリフ・地の文が判定されシーンが生成されます

### 5. プレビュー機能

#### プレビューの表示
1. ツールバーの「プレビュー」ボタンをクリック
2. 表示形式を選択：
   - **小説形式**: 鍵カッコ付きでセリフを表示
   - **台本形式**: 話者名を別行で表示

### 6. エクスポート機能

#### CSVエクスポート
1. ツールバーの「CSV出力」ボタンをクリック
2. プロジェクトフォルダ内の`output`ディレクトリに全シーンのCSVファイルが生成されます

#### CSVフォーマット
```csv
Type,Tag,Arg1,Arg2,Arg3
dialogue,"tag1,tag2",speaker_name,emotion,text_content
narrative,tag3,,,narrative_text_content
```

### 7. カスタマイズ

#### ブロックタイプの定義
`プロジェクト名_schema.yaml`ファイルを編集：

```yaml
block_types:
  system_message:
    label: "システムメッセージ"
    description: "ゲーム内システムメッセージ"
    requires_text: true
    parameters:
      message_type:
        type: "select"
        label: "メッセージタイプ"
        options:
          - {value: "info", label: "情報"}
          - {value: "warning", label: "警告"}
        default: "info"
      
  stage_direction:
    label: "ト書き"
    description: "舞台演出指示"
    requires_text: true
    parameters:
      action_type:
        type: "text"
        label: "動作タイプ"
        placeholder: "立つ、座る、歩く等"
        default: ""
        required: false
      location:
        type: "text"
        label: "場所"
        placeholder: "舞台上、下手、上手等"
        default: ""
        required: false
      duration:
        type: "number"
        label: "継続時間"
        placeholder: "秒数"
        default: 1.0
        required: false
        min: 0
        step: 0.1
```

#### パラメータタイプの詳細

##### **text型パラメータ**
```yaml
parameter_name:
  type: "text"
  label: "パラメータ名"
  placeholder: "入力例やヒント"
  default: ""           # デフォルト値
  required: false       # 必須かどうか
```

##### **number型パラメータ**
```yaml
parameter_name:
  type: "number"
  label: "数値パラメータ"
  placeholder: "数値を入力"
  default: 0
  required: false
  min: 0              # 最小値
  max: 100            # 最大値（オプション）
  step: 0.1           # ステップ値
```

##### **select型パラメータ**
```yaml
parameter_name:
  type: "select"
  label: "選択パラメータ"
  default: "option1"
  required: true
  options:
    - value: "option1"
      label: "選択肢1"
    - value: "option2"
      label: "選択肢2"
```

##### **character_select型パラメータ**
```yaml
speaker:
  type: "character_select"
  label: "話者"
  placeholder: "キャラクターを選択"
  default: ""
  required: false
```

##### **emotion_select型パラメータ**
```yaml
emotion:
  type: "emotion_select"
  label: "感情"
  default: ""
  required: false
```

#### キャラクター定義
`プロジェクト名_characters.yaml`ファイルを編集：

```yaml
characters:
  main_character:
    name: "主人公"
    emotions:
      - value: "normal"
        label: "通常"
      - value: "happy"
        label: "喜び"
      - value: "sad"
        label: "悲しみ"
```

## プロジェクト構造

```
your-project/
├── MyProject.fbl                 # プロジェクトファイル
├── MyProject_schema.yaml         # ブロックタイプ定義
├── MyProject_characters.yaml     # キャラクター定義
├── MyProject_scenes/             # シーンファイル格納フォルダ
│   ├── scene_001.json
│   ├── scene_002.json
│   └── ...
└── output/                       # CSVエクスポート先
    ├── Scene1.csv
    ├── Scene2.csv
    └── ...
```

## 技術仕様

- **フレームワーク**: Electron
- **言語**: JavaScript (ES6 modules)
- **データ形式**: JSON (プロジェクト・シーン), YAML (設定)

**Fabulor** - Efficient Scenario Writing Tool for Creators
