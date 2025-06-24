// マイグレーション管理モジュール
class MigrationManager {
  constructor(paragraphManager, uiManager) {
    this.paragraphManager = paragraphManager;
    this.uiManager = uiManager;
    this.availableMigrations = [];
  }

  // マイグレーションスクリプト一覧を読み込み
  async loadAvailableMigrations(projectPath) {
    try {
      console.log('...マイグレーションスクリプト検索開始');
      const result = await window.electronAPI.scanMigrationDirectory(projectPath);
      
      if (result.success) {
        this.availableMigrations = result.migrations;
        console.log('...マイグレーションスクリプト発見:', this.availableMigrations.length, '個');
        return this.availableMigrations;
      } else {
        console.warn('...マイグレーションディレクトリが見つからない:', result.error);
        this.availableMigrations = [];
        return [];
      }
    } catch (error) {
      console.error('...マイグレーション読み込みエラー:', error);
      this.availableMigrations = [];
      return [];
    }
  }

  // マイグレーションスクリプトを実行
  async executeMigration(projectPath, migrationFileName) {
    try {
      console.log('...マイグレーション実行開始:', migrationFileName);
      
      // 現在のブロックデータを取得
      const currentBlocks = this.paragraphManager.getParagraphs();
      console.log('...マイグレーション対象ブロック数:', currentBlocks.length);
      
      if (currentBlocks.length === 0) {
        return { success: false, error: 'マイグレーション対象のブロックがありません' };
      }

      // マイグレーションスクリプトを読み込んで実行
      const result = await window.electronAPI.executeMigration(projectPath, migrationFileName, currentBlocks);
      
      if (result.success) {
        console.log('...マイグレーション実行成功');
        
        // 結果をブロックマネージャに反映
        this.applyMigrationResults(result.migratedBlocks);
        
        return { 
          success: true, 
          message: `マイグレーション "${migrationFileName}" が正常に実行されました。${result.migratedBlocks.length}個のブロックが処理されました。`
        };
      } else {
        console.error('...マイグレーション実行失敗:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('...マイグレーション実行エラー:', error);
      return { success: false, error: error.message };
    }
  }

  // マイグレーション結果をブロックに反映
  applyMigrationResults(migratedBlocks) {
    console.log('...マイグレーション結果を反映開始');
    
    // 既存のブロックをクリア
    this.paragraphManager.clearAllParagraphs();
    
    // マイグレーション済みブロックを追加
    migratedBlocks.forEach((block, index) => {
      // ディープコピーして反映
      const copiedBlock = this.deepCopyBlock(block);
      this.paragraphManager.addParagraphWithData(copiedBlock);
      console.log(`...ブロック ${index + 1} 反映完了:`, copiedBlock.id);
    });
    
    // UIを更新
    this.uiManager.renderParagraphList();
    
    // 最初のブロックを選択
    if (migratedBlocks.length > 0) {
      const firstBlock = this.paragraphManager.getParagraphs()[0];
      if (firstBlock) {
        const selected = this.paragraphManager.selectParagraph(firstBlock.id);
        if (selected) {
          this.uiManager.showEditor(selected);
          this.uiManager.updateParagraphSelection();
        }
      }
    }
    
    console.log('...マイグレーション結果反映完了');
  }

  // ブロックのディープコピー
  deepCopyBlock(block) {
    return JSON.parse(JSON.stringify(block));
  }

  // 利用可能なマイグレーション一覧を取得
  getAvailableMigrations() {
    return this.availableMigrations;
  }

  // マイグレーションモーダルを表示
  showMigrationModal() {
    console.log('...MigrationManager: モーダル表示開始');
    const modal = document.getElementById('migration-modal');
    console.log('...MigrationManager: modal要素:', modal);
    if (modal) {
      modal.style.display = 'flex';  // style属性を直接設定
      modal.classList.add('show');
      console.log('...MigrationManager: showクラス追加完了');
      this.populateMigrationSelect();
    } else {
      console.error('...MigrationManager: migration-modal要素が見つからない');
    }
  }

  // マイグレーションモーダルを閉じる
  closeMigrationModal() {
    const modal = document.getElementById('migration-modal');
    if (modal) {
      modal.style.display = 'none';  // style属性を直接設定
      modal.classList.remove('show');
    }
  }

  // マイグレーション選択プルダウンを更新
  populateMigrationSelect() {
    console.log('...MigrationManager: プルダウン更新開始');
    const select = document.getElementById('migration-select');
    console.log('...MigrationManager: select要素:', select);
    console.log('...MigrationManager: 利用可能マイグレーション:', this.availableMigrations);
    
    if (!select) {
      console.error('...MigrationManager: migration-select要素が見つからない');
      return;
    }

    // 既存のオプションをクリア
    select.innerHTML = '<option value="">マイグレーションを選択してください</option>';

    // 利用可能なマイグレーションを追加
    this.availableMigrations.forEach(migration => {
      const option = document.createElement('option');
      option.value = migration.fileName;
      option.textContent = `${migration.name} - ${migration.description || '説明なし'}`;
      select.appendChild(option);
      console.log('...MigrationManager: オプション追加:', migration.name);
    });
  }
}

export { MigrationManager };