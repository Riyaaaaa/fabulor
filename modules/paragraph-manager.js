// ブロック（段落）管理モジュール
class ParagraphManager {
  constructor(blockTypeManager) {
    this.paragraphs = [];
    this.selectedParagraphId = null;
    this.blockTypeManager = blockTypeManager;
  }

  generateID() {
    // 既存のIDの最大値を取得
    let maxId = 0;
    for (const paragraph of this.paragraphs) {
      if (typeof paragraph.id === 'number' && paragraph.id > maxId) {
        maxId = paragraph.id;
      }
    }
    return maxId + 1;
  }

  createParagraph(text = '', type = 'dialogue', params = {}, tags = []) {
    const baseData = {
      id: this.generateID(),
      text: text,
      type: type,
      tags: tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // ブロックタイプ定義からデフォルト値を設定
    const blockType = this.blockTypeManager.getBlockType(type);
    if (blockType && blockType.parameters) {
      Object.entries(blockType.parameters).forEach(([paramName, paramDef]) => {
        baseData[paramName] = params[paramName] || paramDef.default || '';
      });
    }
    
    return baseData;
  }

  addParagraph() {
    const newParagraph = this.createParagraph();
    
    // 選択中のブロックがある場合は、その次に挿入
    if (this.selectedParagraphId) {
      const selectedIndex = this.paragraphs.findIndex(p => p.id === this.selectedParagraphId);
      if (selectedIndex !== -1) {
        this.paragraphs.splice(selectedIndex + 1, 0, newParagraph);
        return newParagraph;
      }
    }
    
    // 選択がない場合は最後に追加
    this.paragraphs.push(newParagraph);
    return newParagraph;
  }

  deleteParagraph(id) {
    const index = this.paragraphs.findIndex(p => p.id === id);
    if (index !== -1) {
      this.paragraphs.splice(index, 1);
      if (this.selectedParagraphId === id) {
        this.selectedParagraphId = null;
      }
      return true;
    }
    return false;
  }

  selectParagraph(id) {
    this.selectedParagraphId = id;
    return this.paragraphs.find(p => p.id === id);
  }

  getSelectedParagraph() {
    if (!this.selectedParagraphId) return null;
    return this.paragraphs.find(p => p.id === this.selectedParagraphId);
  }

  updateParagraph(id, updates) {
    const paragraph = this.paragraphs.find(p => p.id === id);
    if (paragraph) {
      Object.assign(paragraph, updates);
      paragraph.updatedAt = new Date().toISOString();
      return paragraph;
    }
    return null;
  }

  migrateParagraph(paragraph) {
    if (!paragraph.type) {
      paragraph.type = paragraph.speaker ? 'dialogue' : 'narrative';
    }
    
    const index = this.paragraphs.findIndex(p => p.id === paragraph.id);
    if (index !== -1) {
      this.paragraphs[index] = paragraph;
    }
    
    return paragraph;
  }

  setDefaultParams(paragraph, type) {
    const blockType = this.blockTypeManager.getBlockType(type);
    if (blockType && blockType.parameters) {
      Object.entries(blockType.parameters).forEach(([paramName, paramDef]) => {
        if (paragraph[paramName] === undefined) {
          paragraph[paramName] = paramDef.default || '';
        }
      });
    }
  }

  getMainInfo(paragraph) {
    const blockType = this.blockTypeManager.getBlockType(paragraph.type);
    if (!blockType) return '(情報なし)';
    
    // 最初のパラメータの値を表示するか、タイプ名を表示
    const params = blockType.parameters;
    const paramKeys = Object.keys(params);
    
    if (paramKeys.length > 0) {
      const firstParamKey = paramKeys[0];
      const value = paragraph[firstParamKey];
      if (value) {
        return value;
      }
    }
    
    return blockType.label;
  }

  getParagraphs() {
    return this.paragraphs;
  }

  setParagraphs(paragraphs) {
    // 古いGUID形式のIDを整数IDに変換
    this.paragraphs = paragraphs.map((paragraph, index) => {
      if (typeof paragraph.id === 'string') {
        // GUID形式の場合は連番に変換
        return { ...paragraph, id: index + 1 };
      }
      return paragraph;
    });
    
    // IDの重複を解決
    this.reassignIDs();
    this.selectedParagraphId = null;
  }

  // IDの重複を解決し、連番に再割り当て
  reassignIDs() {
    this.paragraphs.forEach((paragraph, index) => {
      paragraph.id = index + 1;
    });
  }

  clearSelection() {
    this.selectedParagraphId = null;
  }

  getSelectedParagraphId() {
    return this.selectedParagraphId;
  }

  reorderParagraphs(draggedId, targetId, insertAfter = false) {
    const draggedIndex = this.paragraphs.findIndex(p => p.id === draggedId);
    const targetIndex = this.paragraphs.findIndex(p => p.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
      return false;
    }
    
    // 配列から要素を取り出し
    const draggedParagraph = this.paragraphs.splice(draggedIndex, 1)[0];
    
    // 挿入位置を計算
    let insertIndex = targetIndex;
    
    // ドラッグ元が対象より前にある場合、インデックスを調整
    if (draggedIndex < targetIndex) {
      insertIndex = targetIndex - 1;
    }
    
    // insertAfterが true の場合は後に挿入
    if (insertAfter) {
      insertIndex++;
    }
    
    // 挿入位置に要素を挿入
    this.paragraphs.splice(insertIndex, 0, draggedParagraph);
    
    // 並び替え後にIDを再割り当て
    this.reassignIDs();
    
    return true;
  }
  
  selectNextParagraph() {
    if (this.paragraphs.length === 0) return null;
    
    if (!this.selectedParagraphId) {
      // 何も選択されていない場合は最初のブロックを選択
      this.selectedParagraphId = this.paragraphs[0].id;
      return this.paragraphs[0];
    }
    
    const currentIndex = this.paragraphs.findIndex(p => p.id === this.selectedParagraphId);
    if (currentIndex === -1 || currentIndex === this.paragraphs.length - 1) {
      // 最後のブロックの場合は何もしない
      return this.getSelectedParagraph();
    }
    
    // 次のブロックを選択
    this.selectedParagraphId = this.paragraphs[currentIndex + 1].id;
    return this.paragraphs[currentIndex + 1];
  }
  
  // 全ブロックをクリア
  clearAllParagraphs() {
    this.paragraphs = [];
    this.selectedParagraphId = null;
  }

  // 既存データでブロックを追加
  addParagraphWithData(paragraphData) {
    this.paragraphs.push(paragraphData);
    return paragraphData;
  }

  selectPreviousParagraph() {
    if (this.paragraphs.length === 0) return null;
    
    if (!this.selectedParagraphId) {
      // 何も選択されていない場合は最後のブロックを選択
      this.selectedParagraphId = this.paragraphs[this.paragraphs.length - 1].id;
      return this.paragraphs[this.paragraphs.length - 1];
    }
    
    const currentIndex = this.paragraphs.findIndex(p => p.id === this.selectedParagraphId);
    if (currentIndex === -1 || currentIndex === 0) {
      // 最初のブロックの場合は何もしない
      return this.getSelectedParagraph();
    }
    
    // 前のブロックを選択
    this.selectedParagraphId = this.paragraphs[currentIndex - 1].id;
    return this.paragraphs[currentIndex - 1];
  }
}

export { ParagraphManager };