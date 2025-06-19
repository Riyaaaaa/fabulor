// ブロック（段落）管理モジュール
class ParagraphManager {
  constructor(blockTypeManager) {
    this.paragraphs = [];
    this.selectedParagraphId = null;
    this.blockTypeManager = blockTypeManager;
  }

  generateGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  createParagraph(text = '', type = 'dialogue', params = {}, tags = []) {
    const baseData = {
      id: this.generateGUID(),
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
    this.paragraphs = paragraphs;
    this.selectedParagraphId = null;
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
    
    return true;
  }
}

export { ParagraphManager };