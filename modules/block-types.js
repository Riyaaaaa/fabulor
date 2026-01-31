// ブロックタイプ管理モジュール
class BlockTypeManager {
  constructor() {
    // カスタム構造体定義
    this.structs = {};
    
    // 列挙型定義
    this.enums = {};
    
    // ブロックタイプ定義（すべてYAMLファイルから読み込む）
    this.blockTypes = {};
  }

  async loadSchemaFile(projectPath, schemaFileName) {
    try {
      const result = await window.electronAPI.loadSchemaFile(projectPath, schemaFileName);
      if (result.success) {
        // enums定義を読み込み
        this.enums = result.data.enums || {};

        // structs定義を読み込み
        this.structs = result.data.structs || {};

        // スキーマファイルから読み込んだタイプをそのまま使用
        this.blockTypes = result.data.block_types || {};
      } else {
        console.error('スキーマファイルの読み込みに失敗:', result.error);
        await window.electronAPI.showMessage({ type: 'warning', message: `スキーマファイル "${schemaFileName}" の読み込みに失敗しました。`, detail: 'デフォルト設定を使用します。' });
        // フォールバック用の最小設定
        this.blockTypes = {
          dialogue: { label: 'セリフ', requires_text: true, parameters: {} },
          narrative: { label: '地の文', requires_text: true, parameters: {} }
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

  getEnums() {
    return this.enums;
  }

  getEnum(enumName) {
    return this.enums[enumName];
  }

  // 列挙型がパラメータ型として有効かチェック
  isValidEnumType(typeName) {
    return this.enums.hasOwnProperty(typeName);
  }
}

export { BlockTypeManager };