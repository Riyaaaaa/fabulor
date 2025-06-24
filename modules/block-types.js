// ブロックタイプ管理モジュール
class BlockTypeManager {
  constructor() {
    // カスタム構造体定義
    this.structs = {};
    
    // 標準定義のブロックタイプ
    this.standardTypes = {
      dialogue: {
        label: 'セリフ',
        description: 'キャラクターの台詞',
        requires_text: true,
        parameters: {
          speaker: {
            type: 'character_select',
            label: '話者',
            placeholder: 'キャラクター名',
            default: '',
            required: false
          },
          emotion: {
            type: 'emotion_select',
            label: '感情',
            default: '',
            required: false
          }
        }
      },
      monologue: {
        label: 'モノローグ',
        description: 'キャラクターの心の中の思考',
        requires_text: true,
        parameters: {
          speaker: {
            type: 'character_select',
            label: '話者',
            placeholder: 'キャラクター名',
            default: '',
            required: false
          },
          emotion: {
            type: 'emotion_select',
            label: '感情',
            default: '',
            required: false
          }
        }
      },
      narrative: {
        label: '地の文',
        description: '小説の地の文・説明文',
        requires_text: true,
        parameters: {}
      }
    };
    
    // デフォルトのブロックタイプ（標準定義を含む）
    this.blockTypes = {
      ...this.standardTypes,
      command: { label: 'コマンド', requires_text: false, parameters: {} }
    };
  }

  async loadSchemaFile(projectPath, schemaFileName) {
    try {
      console.log("Loading schema file:", schemaFileName);
      const result = await window.electronAPI.loadSchemaFile(projectPath, schemaFileName);
      if (result.success) {
        // structs定義を読み込み
        this.structs = result.data.structs || {};
        console.log('Loaded structs:', Object.keys(this.structs));
        
        // スキーマファイルから読み込んだタイプをマージ（標準定義は常に含む）
        const loadedTypes = result.data.block_types || {};
        
        // 標準定義のタイプを除外してカスタムタイプのみ取得
        const customTypes = {};
        Object.entries(loadedTypes).forEach(([key, value]) => {
          if (key !== 'dialogue' && key !== 'monologue' && key !== 'narrative') {
            customTypes[key] = value;
          }
        });
        
        // 標準定義 + カスタムタイプ
        this.blockTypes = {
          ...this.standardTypes,
          ...customTypes
        };
      } else {
        console.error('スキーマファイルの読み込みに失敗:', result.error);
        alert(`スキーマファイル "${schemaFileName}" の読み込みに失敗しました。デフォルト設定を使用します。`);
        // フォールバック用のデフォルト設定（標準定義を含む）
        this.blockTypes = {
          ...this.standardTypes,
          command: { label: 'コマンド', requires_text: false, parameters: {} }
        };
      }
    } catch (error) {
      console.error('スキーマファイル読み込みエラー:', error);
    }
  }

  getBlockTypes() {
    return this.blockTypes;
  }

  getBlockType(type) {
    return this.blockTypes[type];
  }

  getTypeLabel(type) {
    const blockType = this.blockTypes[type];
    return blockType ? blockType.label : 'その他';
  }

  requiresText(type) {
    const blockType = this.blockTypes[type];
    return blockType ? blockType.requires_text : true;
  }

  getStructs() {
    return this.structs;
  }

  getStruct(structName) {
    return this.structs[structName];
  }

  // 構造体の型がパラメータ型として有効かチェック
  isValidStructType(typeName) {
    return this.structs.hasOwnProperty(typeName);
  }
}

export { BlockTypeManager };