// 履歴管理とUndo/Redo機能

// オペレーション基底クラス
class Operation {
  constructor(description = '') {
    this.description = description;
    this.timestamp = new Date().toISOString();
  }

  // 実行（サブクラスで実装）
  execute() {
    throw new Error('execute() must be implemented');
  }

  // 巻き戻し（サブクラスで実装）
  rewind() {
    throw new Error('rewind() must be implemented');
  }
}

// ブロック移動オペレーション
class MoveBlockOperation extends Operation {
  constructor(paragraphManager, uiManager, draggedId, targetId, insertAfter) {
    super(`ブロック移動: ${draggedId}`);
    this.paragraphManager = paragraphManager;
    this.uiManager = uiManager;
    this.draggedId = draggedId;
    this.targetId = targetId;
    this.insertAfter = insertAfter;
    
    // 元の位置を記録
    this.originalIndex = this.paragraphManager.getParagraphs().findIndex(p => p.id === draggedId);
  }

  execute() {
    this.paragraphManager.reorderParagraphs(this.draggedId, this.targetId, this.insertAfter);
    this.uiManager.renderParagraphList();
    this.uiManager.updateParagraphSelection();
  }

  rewind() {
    // 元の位置に戻す
    const paragraphs = this.paragraphManager.getParagraphs();
    const currentIndex = paragraphs.findIndex(p => p.id === this.draggedId);
    
    if (currentIndex !== -1 && currentIndex !== this.originalIndex) {
      // 配列から要素を削除
      const [movedParagraph] = paragraphs.splice(currentIndex, 1);
      // 元の位置に挿入
      paragraphs.splice(this.originalIndex, 0, movedParagraph);
      
      this.paragraphManager.setParagraphs(paragraphs);
      this.uiManager.renderParagraphList();
      this.uiManager.updateParagraphSelection();
    }
  }
}

// ブロック内容編集オペレーション
class EditBlockOperation extends Operation {
  constructor(paragraphManager, uiManager, paragraphId, oldData, newData) {
    super(`ブロック編集: ${paragraphId}`);
    this.paragraphManager = paragraphManager;
    this.uiManager = uiManager;
    this.paragraphId = paragraphId;
    this.oldData = JSON.parse(JSON.stringify(oldData)); // ディープコピー
    this.newData = JSON.parse(JSON.stringify(newData)); // ディープコピー
  }

  execute() {
    const paragraph = this.paragraphManager.getParagraphs().find(p => p.id === this.paragraphId);
    if (paragraph) {
      // 新しいデータを適用
      Object.assign(paragraph, this.newData);
      paragraph.updatedAt = new Date().toISOString();
      
      this.uiManager.updateParagraphListItem(paragraph);
      // 選択中のブロックの場合はエディタも更新
      if (this.paragraphManager.getSelectedParagraphId() === this.paragraphId) {
        this.uiManager.showEditor(paragraph);
      }
    }
  }

  rewind() {
    const paragraph = this.paragraphManager.getParagraphs().find(p => p.id === this.paragraphId);
    if (paragraph) {
      // 古いデータを復元
      Object.assign(paragraph, this.oldData);
      
      this.uiManager.updateParagraphListItem(paragraph);
      // 選択中のブロックの場合はエディタも更新
      if (this.paragraphManager.getSelectedParagraphId() === this.paragraphId) {
        this.uiManager.showEditor(paragraph);
      }
    }
  }
}

// ブロック削除オペレーション
class DeleteBlockOperation extends Operation {
  constructor(paragraphManager, uiManager, paragraphId) {
    super(`ブロック削除: ${paragraphId}`);
    this.paragraphManager = paragraphManager;
    this.uiManager = uiManager;
    this.paragraphId = paragraphId;
    
    // 削除前の状態を保存
    const paragraphs = this.paragraphManager.getParagraphs();
    this.deletedIndex = paragraphs.findIndex(p => p.id === paragraphId);
    this.deletedParagraph = JSON.parse(JSON.stringify(paragraphs[this.deletedIndex])); // ディープコピー
    this.wasSelected = this.paragraphManager.getSelectedParagraphId() === paragraphId;
  }

  execute() {
    this.paragraphManager.deleteParagraph(this.paragraphId);
    this.uiManager.renderParagraphList();
    
    // 削除したブロックが選択中だった場合のみプレースホルダーを表示
    if (this.wasSelected) {
      this.uiManager.showPlaceholder();
    }
  }

  rewind() {
    // 削除されたブロックを復元
    const paragraphs = this.paragraphManager.getParagraphs();
    paragraphs.splice(this.deletedIndex, 0, this.deletedParagraph);
    this.paragraphManager.setParagraphs(paragraphs);
    
    this.uiManager.renderParagraphList();
    
    // 元々選択されていた場合は再選択
    if (this.wasSelected) {
      const restoredParagraph = this.paragraphManager.selectParagraph(this.paragraphId);
      if (restoredParagraph) {
        this.uiManager.showEditor(restoredParagraph);
        this.uiManager.updateParagraphSelection();
      }
    }
  }
}

// ブロック追加オペレーション
class AddBlockOperation extends Operation {
  constructor(paragraphManager, uiManager, paragraphId) {
    super(`ブロック追加: ${paragraphId}`);
    this.paragraphManager = paragraphManager;
    this.uiManager = uiManager;
    this.paragraphId = paragraphId;
  }

  execute() {
    // 追加は既に実行済みなので何もしない
  }

  rewind() {
    // 追加されたブロックを削除
    this.paragraphManager.deleteParagraph(this.paragraphId);
    this.uiManager.renderParagraphList();
    this.uiManager.showPlaceholder();
  }
}

// 履歴管理クラス
class HistoryManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = 100;
    this.isExecuting = false; // 操作実行中フラグ（無限ループ防止）
  }

  // オペレーションを実行して履歴に追加
  executeOperation(operation, skipExecute = false) {
    if (this.isExecuting) return;
    
    this.isExecuting = true;
    try {
      // skipExecuteがtrueの場合は実行をスキップ（既に実行済みの場合）
      if (!skipExecute) {
        operation.execute();
      }
      
      this.undoStack.push(operation);
      
      // 履歴サイズ制限
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift();
      }
      
      // redo履歴をクリア
      this.redoStack = [];
      
      console.log(`操作実行: ${operation.description}`);
    } finally {
      this.isExecuting = false;
    }
  }

  // 直前の操作を元に戻す
  undo() {
    if (this.undoStack.length === 0 || this.isExecuting) return false;
    
    this.isExecuting = true;
    try {
      const operation = this.undoStack.pop();
      operation.rewind();
      this.redoStack.push(operation);
      
      console.log(`操作を元に戻しました: ${operation.description}`);
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  // やり直し
  redo() {
    if (this.redoStack.length === 0 || this.isExecuting) return false;
    
    this.isExecuting = true;
    try {
      const operation = this.redoStack.pop();
      operation.execute();
      this.undoStack.push(operation);
      
      console.log(`操作をやり直しました: ${operation.description}`);
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  // undo可能かどうか
  canUndo() {
    return this.undoStack.length > 0;
  }

  // redo可能かどうか
  canRedo() {
    return this.redoStack.length > 0;
  }

  // 履歴をクリア
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  // 履歴情報を取得（デバッグ用）
  getHistoryInfo() {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      undoOperations: this.undoStack.map(op => op.description),
      redoOperations: this.redoStack.map(op => op.description)
    };
  }
}

export { 
  Operation, 
  MoveBlockOperation, 
  EditBlockOperation, 
  DeleteBlockOperation, 
  AddBlockOperation, 
  HistoryManager 
};