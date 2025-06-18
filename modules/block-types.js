// ブロックタイプ管理モジュール
class BlockTypeManager {
  constructor() {
    this.blockTypes = {
      dialogue: { label: 'セリフ', requires_text: true, parameters: {} },
      narrative: { label: '地の文', requires_text: true, parameters: {} },
      command: { label: 'コマンド', requires_text: false, parameters: {} }
    };
  }

  async loadSchemaFile(projectPath, schemaFileName) {
    try {
      console.log("Loading schema file:", schemaFileName);
      const result = await window.electronAPI.loadSchemaFile(projectPath, schemaFileName);
      if (result.success) {
        this.blockTypes = result.data.block_types;
      } else {
        console.error('スキーマファイルの読み込みに失敗:', result.error);
        alert(`スキーマファイル "${schemaFileName}" の読み込みに失敗しました。デフォルト設定を使用します。`);
        // フォールバック用のデフォルト設定
        this.blockTypes = {
          dialogue: { label: 'セリフ', requires_text: true, parameters: {} },
          narrative: { label: '地の文', requires_text: true, parameters: {} },
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
}

export { BlockTypeManager };